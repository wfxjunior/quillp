/**
 * POST /api/invoices
 *
 * Creates an invoice, generates a PDF, stores in Supabase Storage,
 * and logs a TimelineEvent on the client record.
 *
 * Body: { clientId, description, amount, dueDate, notes? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateInvoicePdf } from '@/lib/pdf/generate'
import type { Invoice, Client, Firm } from '@/types'

const BUCKET = 'invoices'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, role')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })

  let body: {
    clientId:    string
    description: string
    amount:      number
    dueDate:     string
    notes?:      string | null
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { clientId, description, amount, dueDate } = body

  if (!clientId || !description || !amount || !dueDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 422 })
  }

  // ── Verify client belongs to firm ──
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, email, phone, entity_type, firm_id')
    .eq('id', clientId)
    .eq('firm_id', userRow.firm_id)
    .single() as { data: Client | null }

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // ── Fetch firm data ──
  const { data: firm } = await supabase
    .from('firms')
    .select('id, name, address, logo_url')
    .eq('id', userRow.firm_id)
    .single() as { data: Pick<Firm, 'id' | 'name' | 'address' | 'logo_url'> | null }

  if (!firm) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })

  const admin = createAdminClient()

  // ── Generate sequential invoice number per firm ──
  const { count } = await admin
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('firm_id', userRow.firm_id)

  const seq           = (count ?? 0) + 1
  const invoiceNumber = `INV-${String(seq).padStart(4, '0')}`
  const now           = new Date().toISOString()

  // ── Insert invoice record ──
  const { data: invoice, error: insertError } = await admin
    .from('invoices')
    .insert({
      firm_id:        userRow.firm_id,
      client_id:      clientId,
      invoice_number: invoiceNumber,
      description,
      amount,
      status:         'draft',
      due_date:       dueDate,
      created_at:     now,
    })
    .select()
    .single() as { data: Invoice | null; error: unknown }

  if (insertError || !invoice) {
    console.error('[invoices] Insert error:', insertError)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }

  // ── Generate PDF ──
  let pdfPath: string | null = null
  try {
    const pdfBuffer = await generateInvoicePdf({ invoice, client, firm })

    const storagePath = `firms/${userRow.firm_id}/${invoiceNumber}.pdf`
    const { error: uploadError } = await admin
      .storage
      .from(BUCKET)
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      console.error('[invoices] PDF upload error:', uploadError)
    } else {
      pdfPath = storagePath
      await admin
        .from('invoices')
        .update({ pdf_url: pdfPath })
        .eq('id', invoice.id)
    }
  } catch (pdfErr) {
    // PDF generation is non-fatal — invoice still created
    console.error('[invoices] PDF generation error:', pdfErr)
  }

  // ── Timeline event ──
  await admin
    .from('timeline_events')
    .insert({
      client_id:  clientId,
      type:       'document_sent',
      title:      `Invoice ${invoiceNumber} created`,
      detail:     `$${amount.toLocaleString()} due ${new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      created_by: user.id,
    })

  return NextResponse.json({
    invoice: { ...invoice, pdf_url: pdfPath },
    invoiceNumber,
    hasPdf: !!pdfPath,
    clientEmail: client.email,
  }, { status: 201 })
}
