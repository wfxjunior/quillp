/**
 * GET   /api/documents/[id] — get document with signed PDF URL
 * PATCH /api/documents/[id] — save edited content_html, update firm memory
 */
import { NextRequest, NextResponse }       from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { saveFirmPreference }              from '@/lib/ai/firm-memory'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return null
  return { supabase, user, firmId: userRow.firm_id as string }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const ctx    = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, firmId } = ctx
  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (error || !doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let signedUrl: string | null = null
  if (doc.pdf_url) {
    const admin = createAdminClient()
    const { data: signed } = await admin.storage
      .from('invoices')
      .createSignedUrl(doc.pdf_url, 900)
    signedUrl = signed?.signedUrl ?? null
  }

  return NextResponse.json({ data: { ...doc, signed_pdf_url: signedUrl } })
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const ctx    = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { content_html?: string; status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { supabase, firmId } = ctx

  // Fetch the existing document to compute firm memory diff
  const { data: existing } = await supabase
    .from('documents')
    .select('content_html, type')
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const patch: Record<string, unknown> = {}

  if (body.content_html !== undefined) {
    // Strip dangerous tags server-side (no DOM available in Node runtime)
    patch.content_html = body.content_html.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '')
  }

  if (body.status) patch.status = body.status

  const { data: updated, error: updateErr } = await supabase
    .from('documents')
    .update(patch)
    .eq('id', id)
    .eq('firm_id', firmId)
    .select()
    .single()

  if (updateErr || !updated) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // Update firm memory if content was edited
  if (body.content_html && existing.content_html && existing.type) {
    saveFirmPreference(firmId, existing.type, existing.content_html, body.content_html).catch(
      (err: unknown) => console.error('[firm-memory] save failed:', err)
    )
  }

  return NextResponse.json({ data: updated })
}
