/**
 * GET /api/files/[...path] — generate a signed URL for a private file
 * Never exposes the raw storage URL directly.
 */
import { NextRequest, NextResponse }       from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ path: string[] }>
}

const BUCKET_MAP: Record<string, string> = {
  firms:   'invoices',
  clients: 'client-files',
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })

  const segments    = await params
  const pathSegments = segments.path
  const filePath    = pathSegments.join('/')

  // Path must start with firms/<firm_id>/ or clients/<client_id>/
  // Scope enforcement: first segment is bucket type, second is ID
  const bucketType = pathSegments[0] // 'firms' or 'clients'
  const bucket     = BUCKET_MAP[bucketType]

  if (!bucket) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: signed, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(filePath, 900)

  if (error || !signed) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  return NextResponse.json({ signedUrl: signed.signedUrl })
}
