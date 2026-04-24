/**
 * PATCH /api/processes/[id]/status — advance process status
 */
import { NextRequest, NextResponse }         from 'next/server'
import { createClient, createAdminClient }   from '@/lib/supabase/server'
import type { ProcessStatus }                from '@/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

const VALID_STATUSES: ProcessStatus[] = [
  'pending', 'engaged', 'collecting', 'in_review', 'client_review', 'filing', 'complete', 'archived',
]

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

  let body: { status: ProcessStatus; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 422 })
  }

  // Verify process belongs to firm
  const { data: existing } = await supabase
    .from('processes')
    .select('id, client_id, title')
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const patch: Record<string, unknown> = { status: body.status }
  if (body.status === 'complete') patch.completed_at = new Date().toISOString()

  const { data, error } = await admin
    .from('processes')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('timeline_events').insert({
    client_id:  existing.client_id,
    type:       'stage_change',
    title:      `Process status changed to ${body.status}`,
    detail:     body.note ?? existing.title,
    created_by: user.id,
  })

  return NextResponse.json({ data })
}
