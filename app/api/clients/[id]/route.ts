/**
 * GET    /api/clients/[id] — client detail with related data
 * PATCH  /api/clients/[id] — update client fields
 * DELETE /api/clients/[id] — soft-delete (archived_at = now)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return null
  return { supabase, user, firmId: userRow.firm_id as string }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const ctx    = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, firmId } = ctx

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (error || !client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [processesRes, documentsRes, invoicesRes, deadlinesRes, timelineRes, taxDocsRes] = await Promise.all([
    supabase
      .from('processes')
      .select('*, services(name)')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, type, status, title, created_at, signed_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('invoices')
      .select('id, invoice_number, amount, status, due_date, paid_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('deadlines')
      .select('*')
      .eq('client_id', id)
      .order('due_date'),
    supabase
      .from('timeline_events')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('tax_documents')
      .select('*')
      .eq('client_id', id),
  ])

  return NextResponse.json({
    data: {
      client,
      processes:     processesRes.data   ?? [],
      documents:     documentsRes.data   ?? [],
      invoices:      invoicesRes.data    ?? [],
      deadlines:     deadlinesRes.data   ?? [],
      recent_timeline: timelineRes.data  ?? [],
      tax_documents: taxDocsRes.data     ?? [],
    },
  })
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const ctx    = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ALLOWED = [
    'name', 'email', 'phone', 'entity_type', 'filing_state',
    'tax_year', 'fee_amount', 'fee_structure', 'pipeline_stage',
    'internal_notes', 'services',
  ]

  const patch: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 })
  }

  const { supabase, firmId } = ctx
  const { data, error } = await supabase
    .from('clients')
    .update(patch)
    .eq('id', id)
    .eq('firm_id', firmId)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found or update failed' }, { status: 404 })

  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const ctx    = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, firmId } = ctx
  const { error } = await supabase
    .from('clients')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('firm_id', firmId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
