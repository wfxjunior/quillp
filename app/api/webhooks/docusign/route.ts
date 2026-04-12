/**
 * POST /api/webhooks/docusign
 *
 * DocuSign Connect webhook handler.
 *
 * Setup in DocuSign Admin → Connect → New Configuration:
 *   URL: https://yourapp.com/api/webhooks/docusign
 *   Trigger events: envelope-completed, envelope-sent, envelope-declined
 *   HMAC Key: set DOCUSIGN_HMAC_KEY env var to the same value
 *   Data format: JSON
 *
 * Security: HMAC-SHA256 of raw body validated against X-DocuSign-Signature-1 header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/docusign/client'
import { createAdminClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────
// DocuSign webhook payload types
// ─────────────────────────────────────────

interface DocuSignWebhookPayload {
  event:           string
  apiVersion:      string
  envelopeId:      string
  data: {
    accountId:     string
    envelopeId:    string
    envelopeSummary?: {
      status:                  string
      envelopeId:              string
      completedDateTime?:      string
      declinedDateTime?:       string
      sentDateTime?:           string
      emailSubject?:           string
    }
  }
}

// ─────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Read raw body first (needed for HMAC verification) ──
  const rawBody = Buffer.from(await request.arrayBuffer())

  // ── Validate HMAC signature ──
  const signature = request.headers.get('X-DocuSign-Signature-1') ?? ''
  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error('[docusign webhook] Invalid HMAC signature — rejecting')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // ── Parse payload ──
  let payload: DocuSignWebhookPayload
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as DocuSignWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { event, envelopeId } = payload
  console.log(`[docusign webhook] event=${event} envelopeId=${envelopeId}`)

  // ── Only process envelope-completed ──
  if (event !== 'envelope-completed') {
    return NextResponse.json({ received: true, processed: false })
  }

  const supabase = createAdminClient()

  // ── Find Document by docusign_envelope_id ──
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('id, type, client_id, firm_id, title')
    .eq('docusign_envelope_id', envelopeId)
    .single()

  if (docError || !document) {
    console.error('[docusign webhook] No document found for envelope', envelopeId, docError?.message)
    // Return 200 to prevent DocuSign from retrying for unknown envelopes
    return NextResponse.json({ received: true, processed: false })
  }

  const signedAt = payload.data.envelopeSummary?.completedDateTime ?? new Date().toISOString()

  // ── (a) Update Document: status = 'signed', signed_at = now ──
  await supabase
    .from('documents')
    .update({ status: 'signed', signed_at: signedAt })
    .eq('id', document.id)

  // ── (b) Advance pipeline stage for engagement letters ──
  if (document.type === 'engagement_letter' && document.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, pipeline_stage')
      .eq('id', document.client_id)
      .single()

    if (client?.pipeline_stage === 'engaged') {
      await supabase
        .from('clients')
        .update({ pipeline_stage: 'onboarding' })
        .eq('id', document.client_id)
    }
  }

  // ── (c) Create TimelineEvent ──
  if (document.client_id) {
    await supabase
      .from('timeline_events')
      .insert({
        client_id:  document.client_id,
        type:       'document_signed',
        title:      `${document.title} signed`,
        detail:     'Client completed DocuSign signature',
        created_by: null,              // automated event
        created_at: signedAt,
      })
  }

  // ── (d) Create Notification for firm owner ──
  const { data: firm } = await supabase
    .from('firms')
    .select('owner_id')
    .eq('id', document.firm_id)
    .single()

  if (firm?.owner_id) {
    const clientLink = document.client_id ? `/clients/${document.client_id}` : null

    await supabase
      .from('notifications')
      .insert({
        firm_id:    document.firm_id,
        user_id:    firm.owner_id,
        type:       'document_signed',
        title:      'Document signed',
        body:       `${document.title} has been signed.`,
        read:       false,
        link:       clientLink,
        created_at: signedAt,
      })
  }

  console.log(`[docusign webhook] Processed envelope-completed for document ${document.id}`)
  return NextResponse.json({ received: true, processed: true })
}
