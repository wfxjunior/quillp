/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe Connect webhook events forwarded to this platform endpoint.
 * Stripe sends events for all connected accounts here with the
 * `Stripe-Account` header identifying which account fired the event.
 *
 * Handled events:
 *   - checkout.session.completed → mark invoice paid, log timeline
 *   - payment_link.created       → no-op (informational)
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe                        from 'stripe'
import { createAdminClient }         from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const secretKey     = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secretKey || !webhookSecret) {
    console.error('[stripe webhook] Missing env vars')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const stripe    = new Stripe(secretKey, { apiVersion: '2026-04-22.dahlia' })
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const invoiceId = session.metadata?.invoice_id
    const firmId    = session.metadata?.firm_id

    if (!invoiceId || !firmId) {
      console.warn('[stripe webhook] Missing metadata on session', session.id)
      return NextResponse.json({ received: true })
    }

    const admin = createAdminClient()

    // Verify the invoice belongs to the firm
    const { data: invoice } = await admin
      .from('invoices')
      .select('id, invoice_number, client_id, status, amount')
      .eq('id', invoiceId)
      .eq('firm_id', firmId)
      .single() as {
        data: {
          id:             string
          invoice_number: string
          client_id:      string
          status:         string
          amount:         number
        } | null
      }

    if (!invoice) {
      console.warn('[stripe webhook] Invoice not found:', invoiceId)
      return NextResponse.json({ received: true })
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ received: true })
    }

    const paidAt = new Date().toISOString()

    await Promise.all([
      admin
        .from('invoices')
        .update({
          status:                   'paid',
          paid_at:                  paidAt,
          payment_method:           'stripe',
          stripe_payment_intent_id: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
        })
        .eq('id', invoiceId),

      admin
        .from('timeline_events')
        .insert({
          client_id: invoice.client_id,
          type:      'invoice_paid',
          title:     `Invoice ${invoice.invoice_number} paid online`,
          detail:    `$${invoice.amount.toFixed(2)} collected via Stripe`,
        }),
    ])

    console.log('[stripe webhook] Invoice marked paid:', invoiceId)
  }

  return NextResponse.json({ received: true })
}
