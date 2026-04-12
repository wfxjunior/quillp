/**
 * POST /api/onboarding/generate
 * blueprint-part2.md §19.2
 *
 * Generation pipeline for onboarding step 4.
 * Idempotent — skips records that already exist.
 *
 * Creates per-service:
 *   - FirmTemplate records (engagement_letter + portal checklist)
 *   - Firm-level Document records (status: draft, client_id: null)
 *
 * After all services:
 *   - Sets users.onboarding_completed = true
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SERVICE_DOC_MAPPINGS } from '@/lib/onboarding/service-mappings'

export async function POST() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Load user + firm
  const { data: userRow } = await supabase
    .from('users')
    .select('id, firm_id')
    .eq('id', authUser.id)
    .single()

  if (!userRow?.firm_id) {
    return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  }

  const firmId = userRow.firm_id

  const { data: firmRow } = await supabase
    .from('firms')
    .select('services, name, primary_state, fee_model')
    .eq('id', firmId)
    .single()

  const selectedServices: string[] = firmRow?.services ?? []
  const summary = { documents: 0, templates: 0 }

  // ── For each service: create FirmTemplate + firm-level Document ──

  for (const svc of selectedServices) {
    const mapping = SERVICE_DOC_MAPPINGS[svc]
    if (!mapping) continue

    // ── 1. FirmTemplate — engagement letter (idempotent) ─────────

    const { data: existingTemplate } = await supabase
      .from('firm_templates')
      .select('id')
      .eq('firm_id', firmId)
      .eq('document_type', 'engagement_letter')
      .eq('service_type', svc)
      .maybeSingle()

    if (!existingTemplate) {
      await supabase.from('firm_templates').insert({
        firm_id:          firmId,
        document_type:    'engagement_letter',
        service_type:     svc,
        // content_html null = use system default template; customized on first edit
        content_html:     '',
        diff_from_default: null,
        updated_at:       new Date().toISOString(),
      })
      summary.templates++
    }

    // ── 2. Firm-level Document placeholder (idempotent) ──────────

    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('firm_id', firmId)
      .eq('type', 'engagement_letter')
      .eq('service_type', svc)
      .is('client_id', null)
      .maybeSingle()

    if (!existingDoc) {
      await supabase.from('documents').insert({
        firm_id:           firmId,
        client_id:         null,
        type:              'engagement_letter',
        status:            'draft',
        title:             mapping.engagementLetterLabel,
        service_type:      svc,
        jurisdiction:      firmRow?.primary_state ?? null,
        content_html:      null,
        generation_params: {
          firm_name:   firmRow?.name,
          fee_model:   firmRow?.fee_model,
          service:     svc,
          generated_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      })
      summary.documents++
    }

    // ── 3. Portal template (if service has portal) ────────────────

    if (mapping.hasPortal) {
      const { data: existingPortal } = await supabase
        .from('firm_templates')
        .select('id')
        .eq('firm_id', firmId)
        .eq('document_type', 'onboarding_portal')
        .eq('service_type', svc)
        .maybeSingle()

      if (!existingPortal) {
        await supabase.from('firm_templates').insert({
          firm_id:           firmId,
          document_type:     'onboarding_portal',
          service_type:      svc,
          content_html:      '',
          diff_from_default: null,
          updated_at:        new Date().toISOString(),
        })
        summary.templates++
      }
    }
  }

  // ── Mark onboarding complete ─────────────────────────────────────

  await supabase
    .from('users')
    .update({ onboarding_completed: true })
    .eq('id', authUser.id)

  return NextResponse.json({
    success: true,
    summary: {
      services:   selectedServices.length,
      documents:  summary.documents,
      templates:  summary.templates,
    },
  })
}
