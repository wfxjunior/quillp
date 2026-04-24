/**
 * POST /api/ai/generate-document
 * blueprint-part2.md §11.2 – §11.6
 *
 * Two modes, selected by presence of `document_type` in the request body:
 *
 * LEGACY (fire-and-forget) — Body: { client_id, service_type }
 *   Creates a Document record immediately, returns { document_id },
 *   and generates AI content in the background without blocking.
 *   Used by the client creation flow.
 *
 * STREAMING — Body: { client_id, document_type, service_type?, fee_amount?,
 *                      jurisdiction?, special_terms? }
 *   Creates a Document record, sets X-Document-Id response header, then
 *   streams GPT-4o tokens back as plain text. Saves content_html on completion.
 *   Used by the document generator UI.
 */

import { NextRequest, NextResponse }   from 'next/server'
import OpenAI                          from 'openai'
import { createClient }                from '@/lib/supabase/server'
import { SERVICE_DOC_MAPPINGS }        from '@/lib/onboarding/service-mappings'
import { rateLimit }                   from '@/lib/security/rate-limit'
import {
  buildGenerationPrompt,
  type PromptParams,
}                                      from '@/lib/ai/generate-document'
import type { DocumentType }           from '@/types'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// ─────────────────────────────────────────
// Legacy fire-and-forget helper
// (preserves original behavior for clients/new)
// ─────────────────────────────────────────

async function generateAndSaveLegacy(documentId: string, params: {
  firmName:     string
  cpaName:      string
  primaryState: string | null
  clientName:   string
  serviceType:  string
  feeAmount:    number | null
  feeStructure: string | null
  taxYear:      number | null
}) {
  const supabase = await createClient()
  const today    = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const { systemPrompt, userPrompt, temperature } = buildGenerationPrompt({
    firmName:     params.firmName,
    firmAddress:  '',
    cpaName:      params.cpaName,
    primaryState: params.primaryState,
    clientName:   params.clientName,
    serviceType:  params.serviceType,
    taxYear:      params.taxYear,
    feeAmount:    params.feeAmount,
    feeStructure: params.feeStructure,
    jurisdiction: params.primaryState ?? '',
    specialTerms: '',
    firmPrefs:    '',
    today,
    documentType: 'engagement_letter',
  })

  try {
    const completion = await getOpenAI().chat.completions.create({
      model:       'gpt-4o',
      temperature,
      max_tokens:  2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    })
    const html = completion.choices[0]?.message?.content ?? ''
    await supabase.from('documents').update({ content_html: html }).eq('id', documentId)
  } catch (err) {
    console.error('[generate-document legacy] AI generation failed for doc', documentId, err)
  }
}

// ─────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────

const DOC_TITLE_MAP: Record<string, string> = {
  engagement_letter: 'Engagement Letter',
  proposal:          'Proposal',
  form_2848:         'Form 2848 — Power of Attorney',
  invoice:           'Invoice',
  checklist:         'Tax Document Checklist',
  onboarding_portal: 'Onboarding Portal',
  delivery_summary:  'Delivery Summary',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 20 generations per 10 minutes per user
  if (!rateLimit(`generate-document:${authUser.id}`, 20, 600_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait before generating another document.' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { client_id, service_type, document_type, fee_amount, jurisdiction, special_terms } = body as {
    client_id:      string
    service_type?:  string
    document_type?: DocumentType
    fee_amount?:    number | null
    jurisdiction?:  string
    special_terms?: string
  }

  if (!client_id) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, name')
    .eq('id', authUser.id)
    .single()

  if (!userRow?.firm_id) {
    return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  }

  const [{ data: firmRow }, { data: clientRow }] = await Promise.all([
    supabase.from('firms').select('name, primary_state, address').eq('id', userRow.firm_id).single(),
    supabase.from('clients').select('name, fee_amount, fee_structure, tax_year, filing_state, services').eq('id', client_id).single(),
  ])

  if (!clientRow) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // ── LEGACY MODE ──────────────────────────────────────────────────
  if (!document_type) {
    if (!service_type) {
      return NextResponse.json({ error: 'service_type is required in legacy mode' }, { status: 400 })
    }

    const mapping  = SERVICE_DOC_MAPPINGS[service_type]
    const docTitle = mapping?.engagementLetterLabel ?? `Engagement Letter — ${service_type}`

    const { data: newDoc, error: insertError } = await supabase
      .from('documents')
      .insert({
        firm_id:      userRow.firm_id,
        client_id,
        type:         'engagement_letter' as DocumentType,
        status:       'draft',
        title:        docTitle,
        content_html: null,
        service_type,
        fee_amount:   clientRow.fee_amount,
        jurisdiction: firmRow?.primary_state ?? null,
        generation_params: {
          service_type,
          firm_name:    firmRow?.name,
          client_name:  clientRow.name,
          generated_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !newDoc) {
      return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 })
    }

    generateAndSaveLegacy(newDoc.id, {
      firmName:     firmRow?.name ?? 'Your Firm',
      cpaName:      userRow.name,
      primaryState: firmRow?.primary_state ?? null,
      clientName:   clientRow.name,
      serviceType:  docTitle,
      feeAmount:    clientRow.fee_amount,
      feeStructure: clientRow.fee_structure,
      taxYear:      clientRow.tax_year,
    }).catch(console.error)

    return NextResponse.json({ document_id: newDoc.id })
  }

  // ── STREAMING MODE ────────────────────────────────────────────────
  const { SERVICE_OPTIONS } = await import('@/lib/onboarding/service-mappings')
  const serviceLabel = SERVICE_OPTIONS.find(s => s.value === service_type)?.label ?? service_type ?? document_type

  const docTitle = (() => {
    const base = DOC_TITLE_MAP[document_type] ?? document_type
    return serviceLabel ? `${base} — ${serviceLabel}` : base
  })()

  const { data: firmTemplate } = await supabase
    .from('firm_templates')
    .select('diff_from_default')
    .eq('firm_id', userRow.firm_id)
    .eq('document_type', document_type)
    .eq('service_type', service_type ?? '')
    .maybeSingle()

  const firmPrefs = firmTemplate?.diff_from_default?.length
    ? `FIRM PREFERENCES (apply these to the generated document):\n${
        (firmTemplate.diff_from_default as { field: string; original: string; modified: string }[])
          .map(d => `- ${d.field}: use "${d.modified}" instead of the default`)
          .join('\n')
      }`
    : ''

  const addr = firmRow?.address as { street?: string; city?: string; state?: string; zip?: string } | null
  const firmAddress = addr
    ? [addr.street, `${addr.city ?? ''}, ${addr.state ?? ''} ${addr.zip ?? ''}`.trim()].filter(Boolean).join('\n')
    : firmRow?.primary_state ?? ''

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const promptParams: PromptParams = {
    firmName:     firmRow?.name ?? 'Your Firm',
    firmAddress,
    cpaName:      userRow.name,
    primaryState: firmRow?.primary_state ?? null,
    clientName:   clientRow.name,
    serviceType:  serviceLabel,
    taxYear:      clientRow.tax_year,
    feeAmount:    (fee_amount ?? clientRow.fee_amount) ?? null,
    feeStructure: clientRow.fee_structure,
    jurisdiction: jurisdiction ?? clientRow.filing_state ?? firmRow?.primary_state ?? '',
    specialTerms: special_terms ?? '',
    firmPrefs,
    today,
    documentType: document_type,
  }

  const { systemPrompt, userPrompt, temperature } = buildGenerationPrompt(promptParams)

  const { data: newDoc, error: insertError } = await supabase
    .from('documents')
    .insert({
      firm_id:      userRow.firm_id,
      client_id,
      type:         document_type,
      status:       'draft',
      title:        docTitle,
      content_html: null,
      service_type: service_type ?? null,
      fee_amount:   (fee_amount ?? clientRow.fee_amount) ?? null,
      jurisdiction: jurisdiction ?? clientRow.filing_state ?? firmRow?.primary_state ?? null,
      generation_params: {
        document_type,
        service_type,
        firm_name:    firmRow?.name,
        client_name:  clientRow.name,
        generated_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !newDoc) {
    return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 })
  }

  const documentId = newDoc.id

  const openaiStream = await getOpenAI().chat.completions.create({
    model:       'gpt-4o',
    temperature,
    max_tokens:  2500,
    stream:      true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
  })

  const encoder = new TextEncoder()
  let fullContent = ''

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of openaiStream) {
          const token = chunk.choices[0]?.delta?.content ?? ''
          if (token) {
            fullContent += token
            controller.enqueue(encoder.encode(token))
          }
        }
        const supabaseInner = await createClient()
        await supabaseInner.from('documents').update({ content_html: fullContent }).eq('id', documentId)
      } catch (err) {
        console.error('[generate-document stream] Generation failed for doc', documentId, err)
        if (fullContent) {
          const supabaseInner = await createClient()
          supabaseInner.from('documents').update({ content_html: fullContent }).eq('id', documentId)
            .then(() => {}, console.error)
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type':      'text/plain; charset=utf-8',
      'X-Document-Id':     documentId,
      'Cache-Control':     'no-cache, no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
