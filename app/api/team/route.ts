/**
 * GET /api/team
 *
 * Returns all users in the current firm.
 * Accessible by owner and admin roles only.
 */

import { NextResponse }      from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, role')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  if (userRow.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: members, error } = await admin
    .from('users')
    .select('id, name, email, role, created_at, last_login_at')
    .eq('firm_id', userRow.firm_id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ members })
}
