/**
 * GET  /api/processes — list processes for the firm
 * POST /api/processes — create process from service template
 */
import { NextRequest, NextResponse }   from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Service, ServiceStep, TriggerEvent } from '@/types'

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

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, firmId } = ctx
  const { searchParams }     = new URL(request.url)
  const clientId             = searchParams.get('client_id')
  const status               = searchParams.get('status')
  const limit                = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)

  let query = supabase
    .from('processes')
    .select('*, services(name, price_type), clients(name, email)')
    .eq('firm_id', firmId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (clientId) query = query.eq('client_id', clientId)
  if (status)   query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { client_id: string; service_id: string; due_date?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id, service_id, due_date } = body
  if (!client_id || !service_id) {
    return NextResponse.json({ error: 'client_id and service_id are required' }, { status: 422 })
  }

  const { supabase, firmId, user } = ctx

  // Validate client belongs to firm
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, filing_state')
    .eq('id', client_id)
    .eq('firm_id', firmId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Validate service belongs to firm
  const { data: service } = await supabase
    .from('services')
    .select('*')
    .eq('id', service_id)
    .eq('firm_id', firmId)
    .eq('is_active', true)
    .single() as { data: Service | null }

  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

  const admin      = createAdminClient()

  // Apply state_rules: filter/extend steps based on client's filing state
  let steps: ServiceStep[] = service.steps ?? []
  const filingState = client.filing_state
  if (filingState && service.state_rules) {
    const rules = (service.state_rules as Record<string, {
      skip_orders?: number[]
      extra_steps?: ServiceStep[]
    }>)[filingState]

    if (rules) {
      if (rules.skip_orders?.length) {
        steps = steps.filter(s => !rules.skip_orders!.includes(s.order))
      }
      if (rules.extra_steps?.length) {
        const nextOrder = steps.length + 1
        steps = steps.concat(
          rules.extra_steps.map((s, i) => ({ ...s, order: nextOrder + i }))
        )
      }
    }
  }

  const totalSteps = steps.length || 1

  // Create the process record
  const { data: process, error: processErr } = await admin
    .from('processes')
    .insert({
      firm_id:      firmId,
      client_id,
      service_id,
      title:        `${service.name} — ${client.name}`,
      status:       'engaged',
      current_step: 1,
      total_steps:  totalSteps,
      due_date:     due_date ?? null,
    })
    .select()
    .single()

  if (processErr || !process) {
    return NextResponse.json({ error: processErr?.message ?? 'Failed to create process' }, { status: 500 })
  }

  // Materialise steps from (state-adjusted) service template
  if (steps.length > 0) {
    const stepRows = steps.map((s) => ({
      process_id:    process.id,
      firm_id:       firmId,
      step_order:    s.order,
      title:         s.title,
      description:   s.description,
      assignee:      s.assignee,
      trigger_event: (s.trigger_event ?? 'manual') as TriggerEvent,
      status:        'pending',
    }))

    await admin.from('process_steps').insert(stepRows)
  }

  // Materialise required documents into tax_documents, scoped to this process
  const docs = service.required_documents ?? []
  if (docs.length > 0) {
    const docRows = docs.map((d) => ({
      client_id:     client_id,
      process_id:    process.id,
      document_type: d.label,
      required:      d.required,
      status:        'missing',
    }))
    await admin.from('tax_documents').insert(docRows)
  }

  // Timeline event
  await admin.from('timeline_events').insert({
    client_id,
    type:       'stage_change',
    title:      `Process started: ${service.name}`,
    detail:     `Service "${service.name}" assigned to ${client.name}.`,
    created_by: user.id,
  })

  // Fetch steps for response
  const { data: processSteps } = await admin
    .from('process_steps')
    .select('*')
    .eq('process_id', process.id)
    .order('step_order')

  return NextResponse.json({ data: { ...process, steps: processSteps ?? [] } }, { status: 201 })
}
