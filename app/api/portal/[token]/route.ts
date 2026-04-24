/**
 * /api/portal/[token]
 *
 * GET — Poll the engagement letter status (used by Step1Sign).
 *       Returns { letterStatus: 'signed' | 'awaiting_signature' | null }
 *
 * POST — Final portal submission.
 *        Stores personal data in clients.internal_notes (JSON-merged),
 *        sets clients.portal_submitted_at, advances pipeline to 'docs_received',
 *        creates a 'portal_submitted' Notification.
 *
 * No authentication — access gated by portal_token.
 * Uses createAdminClient() (service role) to bypass RLS.
 */

import { NextRequest, NextResponse }                       from 'next/server'
import { createAdminClient }                              from '@/lib/supabase/server'
import { sendPortalConfirmationEmail, sendFirmAlertEmail } from '@/lib/email/client'
import { encrypt }                                        from '@/lib/security/encrypt'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

interface RouteContext {
  params: Promise<{ token: string }>
}

// ─────────────────────────────────────────
// GET — poll engagement letter status
// ─────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { token } = await params
  const admin     = createAdminClient()

  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('portal_token', token)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: letters } = await admin
    .from('documents')
    .select('status')
    .eq('client_id', client.id)
    .eq('type', 'engagement_letter')
    .order('created_at', { ascending: false })
    .limit(1)

  const letterStatus = letters?.[0]?.status ?? null

  return NextResponse.json({ letterStatus })
}

// ─────────────────────────────────────────
// POST — submit portal
// ─────────────────────────────────────────

interface PortalData {
  firstName:    string
  lastName:     string
  dob:          string
  ssnLast4:     string
  street:       string
  city:         string
  state:        string
  zip:          string
  filingStatus: string
  dependents:   string
  bankRouting:  string
  bankAccount:  string
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params
  const admin     = createAdminClient()

  // ── Validate token ──
  const { data: client } = await admin
    .from('clients')
    .select('id, firm_id, name, email, pipeline_stage, internal_notes')
    .eq('portal_token', token)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Prevent double-submission
  const { data: existingCheck } = await admin
    .from('clients')
    .select('portal_submitted_at')
    .eq('portal_token', token)
    .single()

  if (existingCheck?.portal_submitted_at) {
    return NextResponse.json({ error: 'Already submitted' }, { status: 409 })
  }

  // ── Parse body ──
  let portalData: PortalData | null = null
  try {
    const body = await request.json() as { portalData?: PortalData }
    portalData = body.portalData ?? null
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── Merge portal data into internal_notes ──
  let notesObj: Record<string, unknown> = {}
  try {
    if (client.internal_notes) notesObj = JSON.parse(client.internal_notes)
  } catch {
    // If existing notes aren't JSON, preserve as plain text
    notesObj = { legacy_notes: client.internal_notes }
  }

  if (portalData) {
    // Encrypt sensitive fields — fail fast if ENCRYPTION_KEY is not configured
    let encSsn: string
    let encAccount: string | null = null
    try {
      encSsn     = portalData.ssnLast4  ? encrypt(portalData.ssnLast4)  : ''
      encAccount = portalData.bankAccount ? encrypt(portalData.bankAccount) : null
    } catch (err) {
      console.error('[portal/submit] encryption failed:', err)
      return NextResponse.json({ error: 'Server misconfiguration — cannot store sensitive data' }, { status: 500 })
    }

    notesObj.portal_submission = {
      submitted_at:  new Date().toISOString(),
      first_name:    portalData.firstName,
      last_name:     portalData.lastName,
      dob:           portalData.dob,
      ssn_last4_enc: encSsn,
      address: {
        street: portalData.street,
        city:   portalData.city,
        state:  portalData.state,
        zip:    portalData.zip,
      },
      filing_status: portalData.filingStatus,
      dependents:    parseInt(portalData.dependents ?? '0', 10),
      bank: portalData.bankRouting
        ? { routing: portalData.bankRouting, account_enc: encAccount }
        : null,
    }
  }

  const now = new Date().toISOString()

  // ── Update client ──
  await admin
    .from('clients')
    .update({
      portal_submitted_at: now,
      pipeline_stage:      'docs_received',
      internal_notes:      JSON.stringify(notesObj),
    })
    .eq('id', client.id)

  // ── Advance engaged processes → collecting + auto-advance portal_submitted steps ──
  const { data: engagedProcesses } = await admin
    .from('processes')
    .select('id, total_steps')
    .eq('client_id', client.id)
    .eq('status', 'engaged')

  if (engagedProcesses && engagedProcesses.length > 0) {
    const processIds = engagedProcesses.map(p => p.id)

    await admin
      .from('processes')
      .update({ status: 'collecting' })
      .in('id', processIds)

    const stepNow = new Date().toISOString()

    const { data: triggerSteps } = await admin
      .from('process_steps')
      .select('id, process_id')
      .in('process_id', processIds)
      .eq('trigger_event', 'portal_submitted')
      .eq('status', 'pending')

    if (triggerSteps?.length) {
      await admin
        .from('process_steps')
        .update({ status: 'completed', completed_at: stepNow })
        .in('id', triggerSteps.map(s => s.id))

      const affectedProcIds = Array.from(new Set(triggerSteps.map(s => s.process_id)))
      for (const procId of affectedProcIds) {
        const proc = engagedProcesses.find(p => p.id === procId)
        if (!proc) continue
        const { count } = await admin
          .from('process_steps')
          .select('id', { count: 'exact', head: true })
          .eq('process_id', procId)
          .eq('status', 'completed')
        const currentStep = Math.min((count ?? 0) + 1, proc.total_steps)
        await admin.from('processes').update({ current_step: currentStep }).eq('id', procId)
      }
    }
  }

  // ── Timeline event ──
  await admin
    .from('timeline_events')
    .insert({
      client_id:  client.id,
      type:       'stage_change',
      title:      'Portal submitted',
      detail:     `${client.name} completed the onboarding portal. Pipeline advanced to Docs Received.`,
      created_by: null,
    })

  // ── Notification to firm owner ──
  const { data: firmRow } = await admin
    .from('firms')
    .select('owner_id, name')
    .eq('id', client.firm_id)
    .single()

  if (firmRow?.owner_id) {
    await admin
      .from('notifications')
      .insert({
        firm_id:    client.firm_id,
        user_id:    firmRow.owner_id,
        type:       'portal_submitted',
        title:      `${client.name} submitted their portal`,
        body:       'Client has completed onboarding. Documents are ready for review.',
        read:       false,
        link:       `/clients/${client.id}`,
        created_at: now,
      })

    // Email notification to firm owner
    const { data: ownerUser } = await admin
      .from('users')
      .select('email')
      .eq('id', firmRow.owner_id)
      .single()

    if (ownerUser?.email) {
      sendFirmAlertEmail({
        to:       ownerUser.email,
        subject:  `${client.name} submitted their onboarding portal`,
        title:    'Portal submission received',
        body:     `<strong>${client.name}</strong> has completed their onboarding portal. Their documents are ready for review.`,
        ctaLabel: 'View client',
        ctaUrl:   `${appUrl}/clients/${client.id}`,
      }).catch((err: unknown) => console.error('[portal/submit] alert email failed:', err))
    }
  }

  // ── Confirmation email to client (fire-and-forget) ──
  if (client.email && firmRow?.name) {
    sendPortalConfirmationEmail({
      to:         client.email,
      clientName: client.name,
      firmName:   firmRow.name,
    }).catch((err: unknown) => console.error('[portal/submit] confirmation email failed:', err))
  }

  return NextResponse.json({ submitted: true })
}
