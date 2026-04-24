/**
 * POST /api/clients/[id]/invite
 *
 * Sends (or re-sends) the portal invite email to the client.
 * Requires the client to have an email address and a portal_token.
 * Advances pipeline to 'onboarding' if currently 'engaged'.
 * Creates a timeline event on send.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendPortalInviteEmail }           from '@/lib/email/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params

  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const firmId = userRow.firm_id as string
  const admin  = createAdminClient()

  // Fetch client + firm name
  const { data: client } = await admin
    .from('clients')
    .select('id, name, email, portal_token, pipeline_stage, firm_id')
    .eq('id', id)
    .eq('firm_id', firmId)
    .is('archived_at', null)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (!client.email) return NextResponse.json({ error: 'Client has no email address' }, { status: 422 })
  if (!client.portal_token) return NextResponse.json({ error: 'Client has no portal token' }, { status: 422 })

  const { data: firmRow } = await admin
    .from('firms')
    .select('name')
    .eq('id', firmId)
    .single()

  const firmName = firmRow?.name ?? 'Your Firm'
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.quilp.com'
  const portalUrl = `${appUrl}/portal/${client.portal_token}`

  // Send email
  try {
    await sendPortalInviteEmail({
      to:         client.email,
      clientName: client.name,
      firmName,
      portalUrl,
    })
  } catch (err) {
    console.error('[invite] email send failed:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 502 })
  }

  // Advance pipeline engaged → onboarding (only if not already past)
  const advanceStage = client.pipeline_stage === 'engaged'

  await Promise.all([
    advanceStage
      ? admin.from('clients').update({ pipeline_stage: 'onboarding' }).eq('id', client.id)
      : Promise.resolve(),

    admin.from('timeline_events').insert({
      client_id:  client.id,
      type:       'stage_change',
      title:      'Portal invite sent',
      detail:     `Onboarding portal link sent to ${client.email}.`,
      created_by: user.id,
    }),
  ])

  return NextResponse.json({ sent: true })
}
