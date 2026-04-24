/**
 * GET /api/notifications — last 20 notifications for the current user
 * Marks all as read on fetch.
 */
import { NextResponse }  from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark all unread as read (non-blocking)
  const unreadIds = (data ?? [])
    .filter((n) => !n.read)
    .map((n) => n.id as string)

  if (unreadIds.length > 0) {
    const admin = createAdminClient()
    admin.from('notifications').update({ read: true }).in('id', unreadIds).then()
  }

  return NextResponse.json({ data })
}
