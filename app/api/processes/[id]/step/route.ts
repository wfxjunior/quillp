/**
 * PATCH /api/processes/[id]/step — update a specific step status
 */
import { NextRequest, NextResponse }       from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { StepStatus }                 from '@/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

const VALID_STEP_STATUSES: StepStatus[] = ['pending', 'in_progress', 'completed', 'blocked']

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

  let body: { step_id: string; status: StepStatus }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.step_id || !VALID_STEP_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'step_id and valid status are required' }, { status: 422 })
  }

  // Verify process belongs to firm
  const { data: process } = await supabase
    .from('processes')
    .select('id, client_id, total_steps')
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (!process) return NextResponse.json({ error: 'Process not found' }, { status: 404 })

  const admin = createAdminClient()

  const stepPatch: Record<string, unknown> = { status: body.status }
  if (body.status === 'completed') stepPatch.completed_at = new Date().toISOString()

  const { data: step, error: stepErr } = await admin
    .from('process_steps')
    .update(stepPatch)
    .eq('id', body.step_id)
    .eq('process_id', id)
    .select()
    .single()

  if (stepErr || !step) return NextResponse.json({ error: 'Step not found' }, { status: 404 })

  // Count completed steps to update process.current_step
  const { count: completedCount } = await admin
    .from('process_steps')
    .select('id', { count: 'exact', head: true })
    .eq('process_id', id)
    .eq('status', 'completed')

  const currentStep = Math.min((completedCount ?? 0) + 1, process.total_steps)

  await admin
    .from('processes')
    .update({ current_step: currentStep })
    .eq('id', id)

  // Log timeline event
  await admin.from('timeline_events').insert({
    client_id:  process.client_id,
    type:       'stage_change',
    title:      `Step "${step.title}" marked ${body.status}`,
    detail:     null,
    created_by: user.id,
  })

  return NextResponse.json({ data: step })
}
