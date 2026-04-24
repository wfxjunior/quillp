/**
 * POST /api/documents/[id]/send-signnow
 *
 * Uploads the document to SignNow and sends it for signature.
 * Requires the firm to have a connected SignNow account.
 * Requires the client to have an email address.
 */
import { NextRequest, NextResponse }       from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEnvelope }                    from '@/lib/signnow/send-envelope'

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
    .select('firm_id, email')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })

  const firmId = userRow.firm_id as string
  const admin  = createAdminClient()

  const [docRes, firmRes] = await Promise.all([
    supabase
      .from('documents')
      .select('*, clients(name, email)')
      .eq('id', id)
      .eq('firm_id', firmId)
      .single(),
    supabase
      .from('firms')
      .select('name, signnow_token')
      .eq('id', firmId)
      .single(),
  ])

  const doc  = docRes.data
  const firm = firmRes.data

  if (!doc || !doc.content_html) {
    return NextResponse.json({ error: 'Document not found or has no content' }, { status: 404 })
  }

  if (!firm?.signnow_token) {
    return NextResponse.json(
      { error: 'SignNow not connected. Go to Settings to connect.' },
      { status: 400 }
    )
  }

  const client = doc.clients as { name: string; email: string } | null
  if (!client?.email) {
    return NextResponse.json({ error: 'Client has no email address' }, { status: 400 })
  }

  try {
    const { signnowDocumentId } = await sendEnvelope({
      documentId:    id,
      firmId,
      documentHtml:  doc.content_html,
      clientName:    client.name,
      clientEmail:   client.email,
      cpaEmail:      userRow.email ?? '',
      documentTitle: doc.title,
      firmName:      firm.name ?? 'Your Firm',
    })

    await admin.from('timeline_events').insert({
      client_id:  doc.client_id,
      type:       'document_sent',
      title:      `${doc.title} sent for signature via SignNow`,
      detail:     `Sent to ${client.email}`,
      created_by: user.id,
    })

    return NextResponse.json({ ok: true, signnowDocumentId })

  } catch (err) {
    console.error('[send-signnow]', err)
    const msg = err instanceof Error ? err.message : 'SignNow API error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
