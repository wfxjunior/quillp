/**
 * PATCH /api/team/[userId] — update a member's role (owner only)
 * DELETE /api/team/[userId] — remove a member from the firm (owner only)
 *
 * Cannot target self in either operation.
 */

import { NextRequest, NextResponse }       from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ userId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { userId } = await params
  const supabase   = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.id === userId) return NextResponse.json({ error: 'Cannot change your own role' }, { status: 422 })

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, role')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  if (userRow.role !== 'owner') return NextResponse.json({ error: 'Only the firm owner can change roles' }, { status: 403 })

  let body: { role?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { role } = body
  if (role !== 'staff' && role !== 'admin') {
    return NextResponse.json({ error: 'role must be "staff" or "admin"' }, { status: 422 })
  }

  const admin = createAdminClient()

  // Verify target belongs to same firm
  const { data: target } = await admin
    .from('users')
    .select('id')
    .eq('id', userId)
    .eq('firm_id', userRow.firm_id)
    .single()

  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const { error } = await admin
    .from('users')
    .update({ role })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ updated: true })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await params
  const supabase   = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.id === userId) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 422 })

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, role')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  if (userRow.role !== 'owner') return NextResponse.json({ error: 'Only the firm owner can remove members' }, { status: 403 })

  const admin = createAdminClient()

  // Verify target belongs to same firm
  const { data: target } = await admin
    .from('users')
    .select('id')
    .eq('id', userId)
    .eq('firm_id', userRow.firm_id)
    .single()

  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Remove from users table and revoke auth account
  await Promise.all([
    admin.from('users').delete().eq('id', userId),
    admin.auth.admin.deleteUser(userId),
  ])

  return NextResponse.json({ removed: true })
}
