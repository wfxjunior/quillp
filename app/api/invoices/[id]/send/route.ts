/**
 * POST /api/invoices/[id]/send
 *
 * Sends the invoice PDF to the client via Resend email.
 * Updates invoice status to 'sent'.
 * Logs a TimelineEvent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendInvoiceEmail }               from '@/lib/email/client'
import type { Invoice, Client, Firm }     from '@/types'

const BUCKET = 'invoices'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteContext) {
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

  // ── Load invoice ──
  const { data: invoice } = await admin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('firm_id', userRow.firm_id)
    .single() as { data: Invoice | null }

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  // ── Load client ──
  const { data: client } = await admin
    .from('clients')
    .select('name, email, phone, entity_type')
    .eq('id', invoice.client_id)
    .single() as { data: Pick<Client, 'name' | 'email' | 'phone' | 'entity_type'> | null }

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (!client.email) return NextResponse.json({ error: 'Client has no email address' }, { status: 422 })

  // ── Load firm ──
  const { data: firm } = await admin
    .from('firms')
    .select('name, address, logo_url')
    .eq('id', userRow.firm_id)
    .single() as { data: Pick<Firm, 'name' | 'address' | 'logo_url'> | null }

  if (!firm) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })

  // ── Download PDF from storage ──
  let pdfBuffer: Buffer

  if (invoice.pdf_url) {
    const { data: pdfData, error: dlError } = await admin
      .storage
      .from(BUCKET)
      .download(invoice.pdf_url)

    if (dlError || !pdfData) {
      return NextResponse.json({ error: 'Failed to retrieve PDF' }, { status: 500 })
    }

    pdfBuffer = Buffer.from(await pdfData.arrayBuffer())
  } else {
    // Fallback: generate on the fly
    const { generateInvoicePdf } = await import('@/lib/pdf/generate')
    pdfBuffer = await generateInvoicePdf({ invoice, client, firm })
  }

  // ── Send email ──
  try {
    await sendInvoiceEmail({
      to:            client.email,
      clientName:    client.name,
      firmName:      firm.name,
      invoiceNumber: invoice.invoice_number,
      amount:        invoice.amount,
      dueDate:       invoice.due_date,
      pdfBuffer,
    })
  } catch (emailErr) {
    console.error('[invoices/send] Email error:', emailErr)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  // ── Update status → sent ──
  await admin
    .from('invoices')
    .update({ status: 'sent' })
    .eq('id', id)

  // ── Timeline event ──
  await admin
    .from('timeline_events')
    .insert({
      client_id:  invoice.client_id,
      type:       'document_sent',
      title:      `Invoice ${invoice.invoice_number} sent`,
      detail:     `Sent to ${client.email}`,
      created_by: user.id,
    })

  return NextResponse.json({ sent: true })
}
