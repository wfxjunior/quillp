/**
 * GET /api/invoices/[id]/pdf
 *
 * Returns a signed URL (15-min expiry) for the invoice PDF in Supabase Storage.
 * Falls back to regenerating the PDF on the fly if no stored PDF exists.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Invoice, Client, Firm } from '@/types'

const BUCKET     = 'invoices'
const EXPIRY_SEC = 900   // 15 minutes

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
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

  const { data: invoice } = await admin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('firm_id', userRow.firm_id)
    .single() as { data: Invoice | null }

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  // ── If PDF stored, return signed URL ──
  if (invoice.pdf_url) {
    const { data: signedData, error: signError } = await admin
      .storage
      .from(BUCKET)
      .createSignedUrl(invoice.pdf_url, EXPIRY_SEC)

    if (!signError && signedData?.signedUrl) {
      return NextResponse.json({ url: signedData.signedUrl, expiresIn: EXPIRY_SEC })
    }
  }

  // ── Fallback: generate PDF inline and return as binary ──
  const { data: client } = await admin
    .from('clients')
    .select('name, email, phone, entity_type')
    .eq('id', invoice.client_id)
    .single() as { data: Pick<Client, 'name' | 'email' | 'phone' | 'entity_type'> | null }

  const { data: firm } = await admin
    .from('firms')
    .select('name, address, logo_url')
    .eq('id', userRow.firm_id)
    .single() as { data: Pick<Firm, 'name' | 'address' | 'logo_url'> | null }

  if (!client || !firm) return NextResponse.json({ error: 'Missing data for PDF generation' }, { status: 500 })

  const { generateInvoicePdf } = await import('@/lib/pdf/generate')
  const pdfBuffer = await generateInvoicePdf({ invoice, client, firm })

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  })
}
