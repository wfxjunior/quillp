/**
 * PATCH /api/firms/[id]
 *
 * Updates firm profile fields:
 *   name, address, logo_url
 * Also updates the owner user's display name (users.name).
 *
 * Only the firm owner may call this.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface FirmPatchBody {
  name?:     string
  cpaName?:  string       // → updates users.name for the owner
  address?: {
    street: string
    city:   string
    state:  string
    zip:    string
  }
  logo_url?: string | null
  phone?:    string | null
  email?:    string | null
  notification_prefs?: {
    deadline_alerts:   boolean
    document_signed:   boolean
    portal_submitted:  boolean
    invoice_overdue:   boolean
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, role, name')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id || userRow.firm_id !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (userRow.role !== 'owner') {
    return NextResponse.json({ error: 'Only the firm owner can update settings' }, { status: 403 })
  }

  let body: FirmPatchBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── Build firm update payload ──
  const firmUpdate: Record<string, unknown> = {}
  if (body.name    !== undefined) firmUpdate.name    = body.name
  if (body.address !== undefined) firmUpdate.address = body.address
  if (body.logo_url !== undefined) firmUpdate.logo_url = body.logo_url
  if (body.notification_prefs !== undefined) firmUpdate.notification_prefs = body.notification_prefs

  if (Object.keys(firmUpdate).length > 0) {
    const { error } = await admin
      .from('firms')
      .update(firmUpdate)
      .eq('id', id)

    if (error) {
      console.error('[firms PATCH] Supabase error:', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
  }

  // ── Update owner display name ──
  if (body.cpaName !== undefined) {
    await admin
      .from('users')
      .update({ name: body.cpaName })
      .eq('id', user.id)
  }

  return NextResponse.json({ updated: true })
}
