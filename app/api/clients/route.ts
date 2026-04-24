/**
 * GET  /api/clients — paginated list with filters
 * POST /api/clients — create client, then fire-and-forget:
 *        (a) timeline event "Client added"
 *        (b) deadline records from service rules
 *        (c) engagement letter draft + async AI generation
 */
import { NextRequest, NextResponse }        from 'next/server'
import { createClient, createAdminClient }  from '@/lib/supabase/server'
import { rulesForServices, ruleToIsoDate }  from '@/lib/deadlines/rules'
import { SERVICE_DOC_MAPPINGS }             from '@/lib/onboarding/service-mappings'
import { ENGAGEMENT_SYSTEM_PROMPT }         from '@/lib/ai/generate-document'
import OpenAI from 'openai'

// ─────────────────────────────────────────
// Auth helper
// ─────────────────────────────────────────

async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, name')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return null
  return { supabase, user, firmId: userRow.firm_id as string, cpaName: userRow.name as string }
}

// ─────────────────────────────────────────
// Background: create client artifacts
// Called fire-and-forget after client INSERT.
// ─────────────────────────────────────────

async function createClientArtifacts(opts: {
  clientId:   string
  clientName: string
  firmId:     string
  userId:     string
  cpaName:    string
  services:   string[]
  taxYear:    number | null
}) {
  const admin = createAdminClient()
  const { clientId, clientName, firmId, userId, cpaName, services, taxYear } = opts

  // ── (a) Timeline event ──────────────────────────────────────────
  await admin.from('timeline_events').insert({
    client_id:  clientId,
    type:       'stage_change',
    title:      'Client added',
    detail:     `${clientName} was added to the practice.`,
    created_by: userId,
  })

  // ── (b) Deadlines ───────────────────────────────────────────────
  const resolvedYear = taxYear ?? new Date().getFullYear() - 1
  const rules = rulesForServices(services)

  if (rules.length > 0) {
    const deadlineRows = rules.map(rule => ({
      firm_id:    firmId,
      client_id:  clientId,
      filing_type: rule.label,
      due_date:   ruleToIsoDate(rule, resolvedYear),
      status:     'pending' as const,
    }))
    await admin.from('deadlines').insert(deadlineRows)
  }

  // ── (c) Engagement letter ───────────────────────────────────────
  if (services.length === 0) return

  const serviceType = services[0]
  const mapping     = SERVICE_DOC_MAPPINGS[serviceType]
  const docTitle    = mapping?.engagementLetterLabel ?? `Engagement Letter — ${clientName}`

  // Fetch firm for AI context
  const { data: firmRow } = await admin
    .from('firms')
    .select('name, primary_state')
    .eq('id', firmId)
    .single()

  // Create the document record
  const { data: doc } = await admin
    .from('documents')
    .insert({
      firm_id:      firmId,
      client_id:    clientId,
      type:         'engagement_letter',
      status:       'draft',
      title:        docTitle,
      content_html: null,
      service_type: serviceType,
      generation_params: {
        service_type: serviceType,
        firm_name:    firmRow?.name ?? null,
        client_name:  clientName,
        generated_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single()

  if (!doc) return

  // Async AI generation — non-blocking
  generateEngagementLetter(doc.id, {
    firmName:     firmRow?.name ?? 'Your Firm',
    cpaName,
    primaryState: firmRow?.primary_state ?? null,
    clientName,
    serviceType:  docTitle,
    taxYear:      resolvedYear,
  }).catch((err: unknown) => console.error('[clients/post] AI generation failed:', err))
}

// ─────────────────────────────────────────
// Background AI generation
// ─────────────────────────────────────────

async function generateEngagementLetter(documentId: string, params: {
  firmName:     string
  cpaName:      string
  primaryState: string | null
  clientName:   string
  serviceType:  string
  taxYear:      number
}) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const today  = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const userPrompt = `Generate a professional engagement letter with the following parameters:

Firm name: ${params.firmName}
CPA name: ${params.cpaName}
Client name: ${params.clientName}
Service type: ${params.serviceType}
Tax year: ${params.taxYear}
Filing jurisdiction: Federal${params.primaryState ? ` + ${params.primaryState}` : ''}
Fee: To be discussed
Date: ${today}

Generate the complete engagement letter now.`

  const completion = await openai.chat.completions.create({
    model:       'gpt-4o',
    temperature: 0.2,
    max_tokens:  2000,
    messages: [
      { role: 'system', content: ENGAGEMENT_SYSTEM_PROMPT },
      { role: 'user',   content: userPrompt },
    ],
  })

  const html  = completion.choices[0]?.message?.content ?? ''
  const admin = createAdminClient()
  await admin.from('documents').update({ content_html: html }).eq('id', documentId)
}

// ─────────────────────────────────────────
// GET
// ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, firmId }  = ctx
  const { searchParams }      = new URL(request.url)
  const stage                 = searchParams.get('stage')
  const search                = searchParams.get('search')
  const limit                 = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const offset                = parseInt(searchParams.get('offset') ?? '0', 10)

  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('firm_id', firmId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (stage)  query = query.eq('pipeline_stage', stage)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, meta: { total: count ?? 0, limit, offset } })
}

// ─────────────────────────────────────────
// POST
// ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    name:            string
    email?:          string
    phone?:          string
    entity_type?:    string
    filing_state?:   string
    tax_year?:       number
    internal_notes?: string
    services?:       string[]
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 422 })
  }

  const { supabase, firmId, user, cpaName } = ctx
  const { data, error } = await supabase
    .from('clients')
    .insert({
      firm_id:        firmId,
      name:           body.name,
      email:          body.email          ?? null,
      phone:          body.phone          ?? null,
      entity_type:    body.entity_type    ?? 'individual',
      filing_state:   body.filing_state   ?? null,
      tax_year:       body.tax_year       ?? null,
      internal_notes: body.internal_notes ?? null,
      services:       body.services       ?? [],
      pipeline_stage: 'engaged',
      portal_token:   crypto.randomUUID(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire-and-forget: timeline + deadlines + engagement letter
  createClientArtifacts({
    clientId:   data.id,
    clientName: data.name,
    firmId,
    userId:     user.id,
    cpaName,
    services:   data.services ?? [],
    taxYear:    data.tax_year ?? null,
  }).catch((err: unknown) => console.error('[clients/post] artifacts failed:', err))

  return NextResponse.json({ data }, { status: 201 })
}
