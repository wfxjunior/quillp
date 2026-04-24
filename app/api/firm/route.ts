/**
 * GET  /api/firm  — return the current user's firm
 * PATCH /api/firm — update firm fields
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, role')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return null
  return { supabase, user, firmId: userRow.firm_id as string }
}

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, firmId } = ctx
  const { data: firm, error } = await supabase
    .from('firms')
    .select('*')
    .eq('id', firmId)
    .single()

  if (error || !firm) {
    return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  }

  return NextResponse.json({ data: firm })
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ALLOWED = ['name', 'primary_state', 'fee_model', 'services', 'logo_url', 'address', 'entity_types', 'client_types']
  const patch: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 })
  }

  const { supabase, firmId } = ctx
  const { data: firm, error } = await supabase
    .from('firms')
    .update(patch)
    .eq('id', firmId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: firm })
}
