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

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { SERVICE_DOC_MAPPINGS } from '@/lib/onboarding/service-mappings'
import type { DocumentType } from '@/types'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// ─────────────────────────────────────────
// System prompts — blueprint §11.2 / §11.4
// ─────────────────────────────────────────

const ENGAGEMENT_SYSTEM_PROMPT = `You are an expert legal and accounting document writer specializing in CPA engagement letters.
Generate professional, complete engagement letters that are:
- Compliant with AICPA professional standards for engagement letters
- Specific to the state and jurisdiction provided
- Properly scoped to limit the CPA's liability
- Formatted as clean HTML with semantic structure

Use these formatting rules:
- Wrap the entire document in a single <div class="document-body">
- Use <p> for paragraphs
- Use <strong> for defined terms on first use
- Use <table> for fee schedules
- Use <div class="signature-block"> for signature areas
- Do not use external CSS classes — this will be rendered in an iframe
- Do not include <html>, <head>, or <body> tags

The letter must include these sections in order:
1. Header (firm name, date, client name and address)
2. Salutation
3. Purpose of letter paragraph
4. Scope of services (specific and limited)
5. Client responsibilities section
6. Firm responsibilities section
7. Fee and payment terms section
8. Limitations and exclusions section
9. Confidentiality statement
10. Governing law (state-specific)
11. Agreement and authorization paragraph
12. Signature blocks for both parties`

const PROPOSAL_SYSTEM_PROMPT = `You are generating a professional service proposal for an accounting firm.
The proposal should be persuasive, professional, and clearly communicate value.
It should not be a legal document — it is a sales and scope document.
Format as clean HTML wrapped in <div class="document-body">. Use <p>, <ul>, <table>, and <div class="signature-block">. No <html>, <head>, or <body> tags.`

const CHECKLIST_SYSTEM_PROMPT = `You are generating a structured tax document checklist for a CPA firm.
Format as clean HTML wrapped in <div class="document-body">.
Use a <table> with columns: Document, Description, Required (Yes/No), Notes.
Keep rows concise. Include all common documents for the given service type.
No <html>, <head>, or <body> tags.`

const FORM_2848_SYSTEM_PROMPT = `You are generating a summary cover letter to accompany IRS Form 2848 (Power of Attorney).
Format as clean HTML wrapped in <div class="document-body">.
The letter explains to the client what they are authorizing, why, and what to sign.
Tone: professional and plain-English. No <html>, <head>, or <body> tags.`

const INVOICE_SYSTEM_PROMPT = `You are generating a professional invoice for an accounting firm.
Format as clean HTML wrapped in <div class="document-body">.
Include: header with firm name/address, invoice number, date, client name/address, itemized services table with amounts, subtotal, and payment terms.
No <html>, <head>, or <body> tags.`

const SYSTEM_PROMPTS: Record<string, string> = {
  engagement_letter: ENGAGEMENT_SYSTEM_PROMPT,
  proposal:          PROPOSAL_SYSTEM_PROMPT,
  checklist:         CHECKLIST_SYSTEM_PROMPT,
  form_2848:         FORM_2848_SYSTEM_PROMPT,
  invoice:           INVOICE_SYSTEM_PROMPT,
}

// ─────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────

interface PromptParams {
  firmName:       string
  firmAddress:    string
  cpaName:        string
  primaryState:   string | null
  clientName:     string
  serviceType:    string         // human label
  taxYear:        number | null
  feeAmount:      number | null
  feeStructure:   string | null
  jurisdiction:   string
  specialTerms:   string
  firmPrefs:      string         // injected FirmTemplate preferences
  today:          string
  documentType:   string
}

function buildUserPrompt(p: PromptParams): string {
  const feeStr = p.feeAmount
    ? `$${p.feeAmount.toLocaleString()} (${(p.feeStructure ?? 'flat fee').replace(/_/g, ' ')})`
    : 'To be discussed'

  const jurisdiction = `Federal${p.jurisdiction ? ` + ${p.jurisdiction}` : p.primaryState ? ` + ${p.primaryState}` : ''}`

  const scCorpAddition = p.serviceType.toLowerCase().includes('s-corp') || p.serviceType.includes('1120-S')
    ? `\nService type: S-Corporation Tax Return (Form 1120-S)\nFiling deadline: March 15, ${(p.taxYear ?? new Date().getFullYear()) + 1}\nAdditional scope: Corporate tax return preparation and filing for ${p.clientName}\nNote: This engagement covers only the corporate return. Individual returns are separate engagements.`
    : ''

  if (p.documentType === 'engagement_letter') {
    return `Generate a professional engagement letter with the following parameters:

Firm name: ${p.firmName}
CPA name: ${p.cpaName}
Firm address: ${p.firmAddress}
Client name: ${p.clientName}
Service type: ${p.serviceType}${scCorpAddition}
Tax year: ${p.taxYear ?? new Date().getFullYear()}
Filing jurisdiction: ${jurisdiction}
Fee: ${feeStr}
Date: ${p.today}
${p.firmPrefs ? `\n${p.firmPrefs}` : ''}${p.specialTerms ? `\nSpecial terms: ${p.specialTerms}` : ''}

Generate the complete engagement letter now.`
  }

  if (p.documentType === 'proposal') {
    return `Generate a professional accounting services proposal:

Firm: ${p.firmName}
CPA: ${p.cpaName}
Prospect name: ${p.clientName}
Services proposed: ${p.serviceType}
Estimated fees: ${feeStr}
Filing jurisdiction: ${jurisdiction}
Date: ${p.today}
${p.specialTerms ? `\nAdditional notes: ${p.specialTerms}` : ''}

Include sections: Introduction, Our Approach, Services Included, What's Not Included, Investment, Next Steps.`
  }

  if (p.documentType === 'checklist') {
    return `Generate a tax document checklist for:

Client: ${p.clientName}
Service type: ${p.serviceType}
Tax year: ${p.taxYear ?? new Date().getFullYear()}
Filing jurisdiction: ${jurisdiction}
Date: ${p.today}
${p.specialTerms ? `\nAdditional notes: ${p.specialTerms}` : ''}`
  }

  if (p.documentType === 'form_2848') {
    return `Generate a Form 2848 cover letter for:

Firm: ${p.firmName}
CPA: ${p.cpaName}
Client: ${p.clientName}
Date: ${p.today}
${p.specialTerms ? `\nAdditional notes: ${p.specialTerms}` : ''}`
  }

  // invoice
  return `Generate a professional invoice for:

Firm: ${p.firmName}
Firm address: ${p.firmAddress}
CPA: ${p.cpaName}
Client: ${p.clientName}
Services: ${p.serviceType}
Amount: ${feeStr}
Date: ${p.today}
${p.specialTerms ? `\nAdditional notes: ${p.specialTerms}` : ''}`
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
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const feeStr = params.feeAmount
    ? `$${params.feeAmount.toLocaleString()} (${(params.feeStructure ?? 'flat fee').replace('_', ' ')})`
    : 'To be discussed'

  const userPrompt = `Generate a professional engagement letter with the following parameters:

Firm name: ${params.firmName}
CPA name: ${params.cpaName}
Client name: ${params.clientName}
Service type: ${params.serviceType}
Tax year: ${params.taxYear ?? new Date().getFullYear()}
Filing jurisdiction: Federal${params.primaryState ? ` + ${params.primaryState}` : ''}
Fee: ${feeStr}
Date: ${today}

Generate the complete engagement letter now.`

  try {
    const completion = await getOpenAI().chat.completions.create({
      model:       'gpt-4o',
      temperature: 0.2,
      max_tokens:  2000,
      messages: [
        { role: 'system', content: ENGAGEMENT_SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
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

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { client_id, service_type, document_type, fee_amount, jurisdiction, special_terms } = body as {
    client_id:     string
    service_type?: string
    document_type?: DocumentType
    fee_amount?:   number | null
    jurisdiction?: string
    special_terms?: string
  }

  if (!client_id) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  // Fetch user + firm + client in parallel
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
  // No document_type → old fire-and-forget behavior
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
  // Resolve service label
  const { SERVICE_OPTIONS } = await import('@/lib/onboarding/service-mappings')
  const serviceLabel = SERVICE_OPTIONS.find(s => s.value === service_type)?.label ?? service_type ?? document_type

  // Build doc title
  const DOC_TITLE_MAP: Record<string, string> = {
    engagement_letter: 'Engagement Letter',
    proposal:          'Proposal',
    form_2848:         'Form 2848 — Power of Attorney',
    invoice:           'Invoice',
    checklist:         'Tax Document Checklist',
    onboarding_portal: 'Onboarding Portal',
    delivery_summary:  'Delivery Summary',
  }
  const docTitle = (() => {
    const base = DOC_TITLE_MAP[document_type] ?? document_type
    return serviceLabel ? `${base} — ${serviceLabel}` : base
  })()

  // Check for FirmTemplate preferences (§11.6)
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

  // Format firm address
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

  const systemPrompt = SYSTEM_PROMPTS[document_type] ?? ENGAGEMENT_SYSTEM_PROMPT
  const userPrompt   = buildUserPrompt(promptParams)

  const temperature = document_type === 'proposal' ? 0.4 : 0.2

  // Create document record before streaming (so we can return its ID in a header)
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

  // Stream GPT-4o, accumulate, save on completion
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
        // Persist the completed document
        const supabaseInner = await createClient()
        await supabaseInner
          .from('documents')
          .update({ content_html: fullContent })
          .eq('id', documentId)
      } catch (err) {
        console.error('[generate-document stream] Generation failed for doc', documentId, err)
        // Still try to save whatever we got
        if (fullContent) {
          const supabaseInner = await createClient()
          supabaseInner
            .from('documents')
            .update({ content_html: fullContent })
            .eq('id', documentId)
            .then(() => {}, console.error)
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type':    'text/plain; charset=utf-8',
      'X-Document-Id':   documentId,
      'Cache-Control':   'no-cache, no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
