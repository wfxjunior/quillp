/**
 * GET /api/processes/[id] — get process with steps, documents, timeline
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

  const firmId = userRow.firm_id as string

  const { data: process, error } = await supabase
    .from('processes')
    .select('*, services(name, description, price, price_type), clients(id, name, email, phone, portal_token)')
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (error || !process) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [stepsResult, docsResult, timelineResult] = await Promise.all([
    supabase
      .from('process_steps')
      .select('*')
      .eq('process_id', id)
      .order('step_order'),
    supabase
      .from('tax_documents')
      .select('*')
      .eq('client_id', process.client_id),
    supabase
      .from('timeline_events')
      .select('*')
      .eq('client_id', process.client_id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return NextResponse.json({
    data: {
      ...process,
      steps:    stepsResult.data  ?? [],
      documents: docsResult.data  ?? [],
      timeline:  timelineResult.data ?? [],
    },
  })
}
