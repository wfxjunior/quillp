/**
 * POST /api/invoices/[id]/pay
 *
 * Marks an invoice as paid.
 * Sets status = 'paid', paid_at = now().
 * Logs a TimelineEvent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Invoice } from '@/types'

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

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, invoice_number, client_id, amount, status')
    .eq('id', id)
    .eq('firm_id', userRow.firm_id)
    .single() as { data: Pick<Invoice, 'id' | 'invoice_number' | 'client_id' | 'amount' | 'status'> | null }

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (invoice.status === 'paid') return NextResponse.json({ error: 'Already paid' }, { status: 409 })

  const now = new Date().toISOString()

  await admin
    .from('invoices')
    .update({ status: 'paid', paid_at: now, payment_method: 'manual' })
    .eq('id', id)

  await admin
    .from('timeline_events')
    .insert({
      client_id:  invoice.client_id,
      type:       'invoice_paid',
      title:      `Invoice ${invoice.invoice_number} marked paid`,
      detail:     `$${invoice.amount.toLocaleString()} received`,
      created_by: user.id,
    })

  return NextResponse.json({ paid: true, paid_at: now })
}
