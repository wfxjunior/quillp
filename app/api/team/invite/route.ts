/**
 * POST /api/team/invite
 *
 * Invites a new staff member to the firm via Supabase magic-link email.
 * Owner-only. The invite sets firm_id, role, and name in the user's metadata
 * so the DB trigger can populate the users row on first sign-in.
 *
 * Body: { email: string, name: string, role: 'staff' | 'admin' }
 */

import { NextRequest, NextResponse }       from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, role')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  if (userRow.role !== 'owner') return NextResponse.json({ error: 'Only the firm owner can invite members' }, { status: 403 })

  let body: { email?: string; name?: string; role?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, name, role } = body
  if (!email || !name) return NextResponse.json({ error: 'email and name are required' }, { status: 422 })
  if (role !== 'staff' && role !== 'admin') {
    return NextResponse.json({ error: 'role must be "staff" or "admin"' }, { status: 422 })
  }

  const admin = createAdminClient()

  // Check if user already exists in this firm
  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .eq('firm_id', userRow.firm_id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'This email is already a member of your firm' }, { status: 409 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/login`,
    data: {
      name,
      firm_id: userRow.firm_id,
      role,
    },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ invited: true, userId: data.user?.id }, { status: 201 })
}
