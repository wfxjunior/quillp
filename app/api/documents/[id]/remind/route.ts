/**
 * POST /api/documents/[id]/remind
 *
 * Re-sends the SignNow signature invite for a document that is already
 * in 'sent' or 'awaiting_signature' status. The document must have a
 * signnow_document_id stored (i.e. it was previously sent via SignNow).
 *
 * Returns: { ok: true }
 */

import { NextRequest, NextResponse }       from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getValidToken, API_BASE }         from '@/lib/signnow/client'

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
      .select('id, title, status, signnow_document_id, client_id, clients(name, email)')
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

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  if (doc.status !== 'sent' && doc.status !== 'awaiting_signature') {
    return NextResponse.json(
      { error: 'Reminders can only be sent for documents awaiting signature' },
      { status: 409 },
    )
  }

  if (!doc.signnow_document_id) {
    return NextResponse.json(
      { error: 'Document has no SignNow ID — try sending it again' },
      { status: 422 },
    )
  }

  if (!firm?.signnow_token) {
    return NextResponse.json(
      { error: 'SignNow not connected. Go to Settings to connect.' },
      { status: 400 },
    )
  }

  const clientRaw = doc.clients
  const client = (Array.isArray(clientRaw) ? clientRaw[0] : clientRaw) as { name: string; email: string } | null
  if (!client?.email) {
    return NextResponse.json({ error: 'Client has no email address' }, { status: 422 })
  }

  try {
    const token = await getValidToken(firmId)

    const subject = `${firm.name ?? 'Your Firm'} — Reminder: Please sign ${doc.title}`
    const message = `This is a friendly reminder to sign the document "${doc.title}". Please click the link in this email to complete your signature.`

    const inviteRes = await fetch(`${API_BASE}/document/${doc.signnow_document_id}/invite`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    userRow.email ?? '',
        subject,
        message,
        to: [
          {
            email:               client.email,
            role:                'Signer 1',
            order:               1,
            authentication_type: 'none',
            reminder:            4,
            expiration_days:     30,
            subject,
            message,
          },
        ],
      }),
    })

    if (!inviteRes.ok) {
      const body = await inviteRes.text()
      throw new Error(`SignNow invite failed: ${inviteRes.status} — ${body}`)
    }

    await admin.from('timeline_events').insert({
      client_id:  doc.client_id,
      type:       'document_sent',
      title:      `Signature reminder sent for ${doc.title}`,
      detail:     `Reminder sent to ${client.email}`,
      created_by: user.id,
    })

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[documents/remind]', err)
    const msg = err instanceof Error ? err.message : 'SignNow API error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
