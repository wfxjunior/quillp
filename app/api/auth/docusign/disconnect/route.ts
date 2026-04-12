/**
 * POST /api/auth/docusign/disconnect
 * Clears the firm's stored DocuSign token.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, role')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  if (userRow.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  await admin
    .from('firms')
    .update({ docusign_token: null })
    .eq('id', userRow.firm_id)

  return NextResponse.json({ disconnected: true })
}
