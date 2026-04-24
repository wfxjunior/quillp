/**
 * POST /api/invoices/[id]/pay
 *
 * Generates a Stripe Payment Link for the invoice via the firm's
 * connected Stripe account. Stores the URL in invoices.stripe_payment_link.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY, NEXT_PUBLIC_APP_URL
 *
 * Returns: { paymentLink: string }
 */

import { NextRequest, NextResponse }       from 'next/server'
import Stripe                              from 'stripe'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Invoice }                    from '@/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })

  const admin = createAdminClient()

  // Load firm's Stripe account
  const { data: firm } = await admin
    .from('firms')
    .select('stripe_account_id, name')
    .eq('id', userRow.firm_id)
    .single() as { data: { stripe_account_id: string | null; name: string } | null }

  if (!firm?.stripe_account_id) {
    return NextResponse.json({ error: 'Stripe not connected' }, { status: 422 })
  }

  // Load invoice
  const { data: invoice } = await admin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('firm_id', userRow.firm_id)
    .single() as { data: Invoice | null }

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  if (invoice.status === 'paid') {
    return NextResponse.json({ error: 'Invoice is already paid' }, { status: 409 })
  }

  // Return cached link if already generated
  if (invoice.stripe_payment_link) {
    return NextResponse.json({ paymentLink: invoice.stripe_payment_link })
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  try {
    const stripe = new Stripe(secretKey, { apiVersion: '2026-04-22.dahlia' })

    // Load client for product name
    const { data: client } = await admin
      .from('clients')
      .select('name')
      .eq('id', invoice.client_id)
      .single() as { data: { name: string } | null }

    // Create the payment link on the connected account
    const paymentLink = await stripe.paymentLinks.create(
      {
        line_items: [
          {
            price_data: {
              currency:     'usd',
              unit_amount:  Math.round(invoice.amount * 100),
              product_data: {
                name: `Invoice ${invoice.invoice_number}${client?.name ? ` — ${client.name}` : ''}`,
                description: invoice.description,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          invoice_id: invoice.id,
          firm_id:    userRow.firm_id,
        },
        after_completion: {
          type:     'redirect',
          redirect: { url: `${appUrl}/invoice-paid?inv=${invoice.invoice_number}` },
        },
      },
      { stripeAccount: firm.stripe_account_id },
    )

    // Persist the link
    await admin
      .from('invoices')
      .update({ stripe_payment_link: paymentLink.url })
      .eq('id', id)

    return NextResponse.json({ paymentLink: paymentLink.url })
  } catch (err) {
    console.error('[invoices/pay] Stripe error:', err)
    const msg = err instanceof Error ? err.message : 'Stripe error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
