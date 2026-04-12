/**
 * PATCH /api/firms/[id]/templates/[templateId]
 *
 * Updates a FirmTemplate's content_html and diff_from_default.
 * Only the firm owner can update templates.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { FirmTemplate } from '@/types'

interface RouteContext {
  params: Promise<{ id: string; templateId: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id, templateId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, role')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id || userRow.firm_id !== id || userRow.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { content_html: string; diff_from_default?: FirmTemplate['diff_from_default'] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.content_html?.trim()) {
    return NextResponse.json({ error: 'content_html is required' }, { status: 422 })
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('firm_templates')
    .update({
      content_html:      body.content_html,
      diff_from_default: body.diff_from_default ?? null,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', templateId)
    .eq('firm_id', id)

  if (error) {
    console.error('[templates PATCH]', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ updated: true })
}
