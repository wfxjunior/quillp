/**
 * PATCH /api/invoices/[id]/mark-paid — mark an invoice as paid
 */
import { NextRequest, NextResponse }       from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
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

  const firmId = userRow.firm_id as string

  let body: { paid_at?: string } = {}
  try {
    body = await request.json()
  } catch {
    // body is optional
  }

  const paidAt = body.paid_at ?? new Date().toISOString()

  // Verify invoice belongs to firm
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, client_id, invoice_number, amount')
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  // Idempotency guard
  const { data: current } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', id)
    .single()

  if (current?.status === 'paid') return NextResponse.json({ error: 'Already paid' }, { status: 409 })

  const admin = createAdminClient()

  const { data: updated, error } = await admin
    .from('invoices')
    .update({ status: 'paid', paid_at: paidAt, payment_method: 'manual' })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('timeline_events').insert({
    client_id:  invoice.client_id,
    type:       'invoice_paid',
    title:      `Invoice ${invoice.invoice_number} marked paid`,
    detail:     `$${Number(invoice.amount).toLocaleString()} received`,
    created_by: user.id,
  })

  return NextResponse.json({ data: updated })
}
