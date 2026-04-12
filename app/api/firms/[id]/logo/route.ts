/**
 * POST /api/firms/[id]/logo
 *
 * Uploads a firm logo to Supabase Storage at firms/{firmId}/logo.{ext}
 * and updates firms.logo_url with the storage path.
 *
 * Accepts: image/jpeg, image/png, image/webp — max 5 MB.
 * Returns: { logo_url: string } — the storage path (not a signed URL).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const BUCKET       = 'firm-assets'
const MAX_BYTES    = 5 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 422 })

  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPG, PNG, and WebP are accepted.' }, { status: 422 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be under 5 MB.' }, { status: 422 })
  }

  const ext         = file.type.split('/')[1].replace('jpeg', 'jpg')
  const storagePath = `firms/${id}/logo.${ext}`
  const buffer      = Buffer.from(await file.arrayBuffer())

  const admin = createAdminClient()

  const { error: uploadError } = await admin
    .storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error('[logo upload]', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Get public URL
  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath)
  const publicUrl = urlData.publicUrl

  await admin
    .from('firms')
    .update({ logo_url: publicUrl })
    .eq('id', id)

  return NextResponse.json({ logo_url: publicUrl })
}
