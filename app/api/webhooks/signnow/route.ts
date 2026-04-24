/**
 * POST /api/webhooks/signnow
 *
 * SignNow webhook handler for document completion events.
 *
 * Setup in SignNow dashboard → API → Event Subscriptions:
 *   URL:    https://yourapp.com/api/webhooks/signnow
 *   Events: document.complete, document.decline, document.update
 *   Secret: set SIGNNOW_HMAC_KEY env var to the same value
 *
 * Security: HMAC-SHA256 hex digest validated against X-Signnow-Signature header.
 */

import { NextRequest, NextResponse }  from 'next/server'
import { verifyWebhookSignature }     from '@/lib/signnow/client'
import { createAdminClient }          from '@/lib/supabase/server'
import { sendFirmAlertEmail }         from '@/lib/email/client'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

// ─────────────────────────────────────────
// SignNow webhook payload types
// ─────────────────────────────────────────

interface SignNowWebhookPayload {
  meta: {
    event:       string
    document_id: string
    created:     number
  }
  data: {
    document_id:   string
    document_name: string
    status:        string
    updated:       number
  }
}

// ─────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  const rawBody = Buffer.from(await request.arrayBuffer())

  const signature = request.headers.get('X-Signnow-Signature') ?? ''
  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error('[signnow webhook] Invalid HMAC signature — rejecting')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: SignNowWebhookPayload
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as SignNowWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const event             = payload.meta?.event
  const signnowDocumentId = payload.meta?.document_id ?? payload.data?.document_id

  console.log(`[signnow webhook] event=${event} signnowDocumentId=${signnowDocumentId}`)

  if (event !== 'document.complete') {
    return NextResponse.json({ received: true, processed: false })
  }

  const supabase = createAdminClient()

  // ── Find Document ──
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('id, type, client_id, firm_id, title')
    .eq('signnow_document_id', signnowDocumentId)
    .single()

  if (docError || !document) {
    console.error('[signnow webhook] No document found for id', signnowDocumentId, docError?.message)
    return NextResponse.json({ received: true, processed: false })
  }

  const signedAt = new Date((payload.data?.updated ?? Date.now() / 1000) * 1000).toISOString()

  // ── (a) Mark document signed ──
  await supabase
    .from('documents')
    .update({ status: 'signed', signed_at: signedAt })
    .eq('id', document.id)

  // ── (b) Advance pipeline for engagement letters ──
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

  // ── (c) Auto-advance process steps with trigger_event = 'document_signed' ──
  if (document.client_id) {
    const { data: activeProcs } = await supabase
      .from('processes')
      .select('id, total_steps')
      .eq('client_id', document.client_id)
      .not('status', 'in', '("complete","archived")')

    if (activeProcs?.length) {
      const procIds = activeProcs.map(p => p.id)
      const now     = new Date().toISOString()

      const { data: triggerSteps } = await supabase
        .from('process_steps')
        .select('id, process_id')
        .in('process_id', procIds)
        .eq('trigger_event', 'document_signed')
        .eq('status', 'pending')

      if (triggerSteps?.length) {
        await supabase
          .from('process_steps')
          .update({ status: 'completed', completed_at: now })
          .in('id', triggerSteps.map(s => s.id))

        const affectedProcIds = Array.from(new Set(triggerSteps.map(s => s.process_id)))
        for (const procId of affectedProcIds) {
          const proc = activeProcs.find(p => p.id === procId)
          if (!proc) continue
          const { count } = await supabase
            .from('process_steps')
            .select('id', { count: 'exact', head: true })
            .eq('process_id', procId)
            .eq('status', 'completed')
          const currentStep = Math.min((count ?? 0) + 1, proc.total_steps)
          await supabase.from('processes').update({ current_step: currentStep }).eq('id', procId)
        }
      }
    }
  }

  // ── (d) Timeline event ──
  if (document.client_id) {
    await supabase.from('timeline_events').insert({
      client_id:  document.client_id,
      type:       'document_signed',
      title:      `${document.title} signed`,
      detail:     'Client completed SignNow signature',
      created_by: null,
      created_at: signedAt,
    })
  }

  // ── (e) In-app notification + email to firm owner ──
  const { data: firm } = await supabase
    .from('firms')
    .select('owner_id, name')
    .eq('id', document.firm_id)
    .single()

  if (firm?.owner_id) {
    await supabase.from('notifications').insert({
      firm_id:    document.firm_id,
      user_id:    firm.owner_id,
      type:       'document_signed',
      title:      'Document signed',
      body:       `${document.title} has been signed.`,
      read:       false,
      link:       document.client_id ? `/clients/${document.client_id}` : null,
      created_at: signedAt,
    })

    // Look up owner email for Resend notification
    const { data: ownerUser } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', firm.owner_id)
      .single()

    if (ownerUser?.email) {
      sendFirmAlertEmail({
        to:       ownerUser.email,
        subject:  `Document signed — ${document.title}`,
        title:    'A document has been signed',
        body:     `<strong>${document.title}</strong> has been signed by your client.`,
        ctaLabel: 'View client',
        ctaUrl:   document.client_id ? `${appUrl}/clients/${document.client_id}` : undefined,
      }).catch((err: unknown) => console.error('[signnow webhook] alert email failed:', err))
    }
  }

  console.log(`[signnow webhook] Processed document.complete for document ${document.id}`)
  return NextResponse.json({ received: true, processed: true })
}
