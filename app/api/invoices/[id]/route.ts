/**
 * GET  /api/invoices/[id] — fetch a single invoice with client name
 * PATCH /api/invoices/[id] — update a draft invoice (description, amount, dueDate)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
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

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, description, amount, status, due_date,
      paid_at, payment_method, pdf_url, created_at,
      client_id, clients ( name, email )
    `)
    .eq('id', id)
    .eq('firm_id', userRow.firm_id)
    .single()

  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  return NextResponse.json({ invoice })
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
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

  // Only draft invoices can be edited
  const { data: existing } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('id', id)
    .eq('firm_id', userRow.firm_id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft invoices can be edited' }, { status: 409 })
  }

  let body: { description?: string; amount?: number; dueDate?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (body.description !== undefined) patch.description = body.description
  if (body.amount      !== undefined) patch.amount      = body.amount
  if (body.dueDate     !== undefined) patch.due_date    = body.dueDate

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 422 })
  }

  const { data: updated, error: updateErr } = await supabase
    .from('invoices')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json({ invoice: updated })
}
