/**
 * GET  /api/services — list all active services for the firm
 * POST /api/services — create a new service
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import type { ServiceStep, ServiceDocument } from '@/types'

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

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, firmId } = ctx
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('firm_id', firmId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    name:               string
    description?:       string
    price?:             number
    price_type?:        string
    estimated_weeks?:   number
    steps?:             ServiceStep[]
    required_documents?: ServiceDocument[]
    state_rules?:       Record<string, unknown>
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 422 })
  }

  const { supabase, firmId } = ctx
  const { data, error } = await supabase
    .from('services')
    .insert({
      firm_id:            firmId,
      name:               body.name,
      description:        body.description ?? null,
      price:              body.price ?? null,
      price_type:         body.price_type ?? null,
      estimated_weeks:    body.estimated_weeks ?? null,
      steps:              body.steps ?? [],
      required_documents: body.required_documents ?? [],
      state_rules:        body.state_rules ?? {},
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
