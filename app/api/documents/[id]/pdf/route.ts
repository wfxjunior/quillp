/**
 * POST /api/documents/[id]/pdf — generate PDF and store in Supabase Storage
 */
import { NextRequest, NextResponse }       from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generatePDF }                     from '@/lib/pdf/generate'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })

  const firmId = userRow.firm_id as string

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, content_html, type, title')
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (error || !doc || !doc.content_html) {
    return NextResponse.json({ error: 'Document not found or has no content' }, { status: 404 })
  }

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generatePDF(doc.content_html)
  } catch (err) {
    console.error('[documents/pdf] PDF generation error:', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }

  const admin       = createAdminClient()
  const storagePath = `firms/${firmId}/documents/${id}.pdf`

  const { error: uploadErr } = await admin.storage
    .from('invoices')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (uploadErr) {
    console.error('[documents/pdf] Upload error:', uploadErr)
    return NextResponse.json({ error: 'PDF upload failed' }, { status: 500 })
  }

  await admin.from('documents').update({ pdf_url: storagePath }).eq('id', id)

  const { data: signed } = await admin.storage
    .from('invoices')
    .createSignedUrl(storagePath, 900)

  return NextResponse.json({ signedUrl: signed?.signedUrl ?? null })
}
