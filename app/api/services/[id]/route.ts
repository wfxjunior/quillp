/**
 * GET    /api/services/[id] — get service detail
 * PATCH  /api/services/[id] — update service
 * DELETE /api/services/[id] — soft-delete (is_active = false)
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
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data })
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

  const ALLOWED = ['name', 'description', 'price', 'price_type', 'estimated_weeks', 'steps', 'required_documents', 'state_rules']
  const patch: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 })
  }

  const { supabase, firmId } = ctx
  const { data, error } = await supabase
    .from('services')
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

  // Guard: reject if active processes reference this service
  const { count } = await supabase
    .from('processes')
    .select('id', { count: 'exact', head: true })
    .eq('service_id', id)
    .eq('firm_id', firmId)
    .not('status', 'in', '("complete","archived")')

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Cannot delete service with active processes' },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('services')
    .update({ is_active: false })
    .eq('id', id)
    .eq('firm_id', firmId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
