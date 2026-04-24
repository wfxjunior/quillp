/**
 * PATCH /api/deadlines/[id]
 *
 * Mark a deadline as filed or extended.
 * Body: { status: 'filed' | 'extended', extension_due_date?: string }
 *
 * Returns: { deadline: updated row }
 */

import { NextRequest, NextResponse }       from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
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

  let body: { status?: string; extension_due_date?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { status, extension_due_date } = body

  if (status !== 'filed' && status !== 'extended') {
    return NextResponse.json({ error: 'status must be "filed" or "extended"' }, { status: 422 })
  }

  if (status === 'extended' && !extension_due_date) {
    return NextResponse.json({ error: 'extension_due_date is required when marking extended' }, { status: 422 })
  }

  const admin = createAdminClient()

  // Verify ownership
  const { data: existing } = await admin
    .from('deadlines')
    .select('id, status')
    .eq('id', id)
    .eq('firm_id', userRow.firm_id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Deadline not found' }, { status: 404 })
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending deadlines can be updated' }, { status: 409 })
  }

  const patch: Record<string, unknown> = { status }
  if (status === 'extended') patch.extension_due_date = extension_due_date

  const { data: updated, error: updateErr } = await admin
    .from('deadlines')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json({ deadline: updated })
}
