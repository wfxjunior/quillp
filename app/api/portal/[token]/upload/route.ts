/**
 * POST /api/portal/[token]/upload
 *
 * Validates the portal token, validates the uploaded file,
 * uploads to Supabase Storage 'client-files' bucket at
 * clients/{clientId}/{filename}, and updates the TaxDocument record.
 *
 * No authentication — access gated by portal_token.
 * Accepts multipart/form-data with fields:
 *   file     — the file (PDF, JPG, PNG; max 25 MB)
 *   docId    — TaxDocument.id
 *   clientId — Client.id (cross-checked against the token)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/server'

const MAX_BYTES          = 25 * 1024 * 1024   // 25 MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const BUCKET             = 'client-files'

interface RouteContext {
  params: Promise<{ token: string }>
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params
  const admin     = createAdminClient()

  // ── Validate token → client ──
  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('portal_token', token)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Invalid portal token' }, { status: 404 })
  }

  // ── Parse multipart form ──
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file      = formData.get('file')     as File | null
  const docId     = formData.get('docId')    as string | null
  const clientId  = formData.get('clientId') as string | null

  if (!file || !docId || !clientId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // ── Cross-check clientId against the token's actual client ──
  if (clientId !== client.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Validate file type ──
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only PDF, JPG, and PNG files are accepted.' },
      { status: 422 }
    )
  }

  // ── Validate file size ──
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'File must be under 25 MB.' },
      { status: 422 }
    )
  }

  // ── Verify docId belongs to this client ──
  const { data: taxDoc } = await admin
    .from('tax_documents')
    .select('id, client_id')
    .eq('id', docId)
    .eq('client_id', client.id)
    .single()

  if (!taxDoc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // ── Build storage path ──
  const ext         = file.name.split('.').pop() ?? 'bin'
  const safeDocId   = docId.replace(/[^a-zA-Z0-9-_]/g, '')
  const storagePath = `clients/${client.id}/${safeDocId}.${ext}`

  // ── Upload to Supabase Storage ──
  const arrayBuffer = await file.arrayBuffer()
  const buffer      = Buffer.from(arrayBuffer)

  const { error: uploadError } = await admin
    .storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType:  file.type,
      upsert:       true,         // replace if already uploaded
    })

  if (uploadError) {
    console.error('[portal upload] Storage error:', uploadError)
    return NextResponse.json(
      { error: 'Upload failed. Please try again.' },
      { status: 500 }
    )
  }

  // ── Update TaxDocument record ──
  const now = new Date().toISOString()
  await admin
    .from('tax_documents')
    .update({
      status:       'received',
      file_url:     storagePath,
      file_name:    file.name,
      uploaded_at:  now,
      uploaded_by:  'client',
    })
    .eq('id', docId)

  // ── Timeline event ──
  await admin
    .from('timeline_events')
    .insert({
      client_id:  client.id,
      type:       'file_uploaded',
      title:      'Document uploaded by client',
      detail:     `Client uploaded ${file.name} via the portal.`,
      created_by: null,
    })

  return NextResponse.json({ uploaded: true, path: storagePath })
}
