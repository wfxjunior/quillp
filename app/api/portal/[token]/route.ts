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

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/server'

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
    .select('id, firm_id, name, pipeline_stage, internal_notes')
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
    notesObj.portal_submission = {
      submitted_at:  new Date().toISOString(),
      first_name:    portalData.firstName,
      last_name:     portalData.lastName,
      dob:           portalData.dob,
      ssn_last4:     portalData.ssnLast4,
      address: {
        street: portalData.street,
        city:   portalData.city,
        state:  portalData.state,
        zip:    portalData.zip,
      },
      filing_status: portalData.filingStatus,
      dependents:    parseInt(portalData.dependents ?? '0', 10),
      bank: portalData.bankRouting
        ? { routing: portalData.bankRouting, account: portalData.bankAccount }
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

  // ── Notification to firm ──
  await admin
    .from('notifications')
    .insert({
      firm_id:    client.firm_id,
      client_id:  client.id,
      type:       'portal_submitted',
      title:      `${client.name} submitted their portal`,
      detail:     'Client has completed onboarding. Documents are ready for review.',
      read:       false,
      created_at: now,
    })

  return NextResponse.json({ submitted: true })
}
