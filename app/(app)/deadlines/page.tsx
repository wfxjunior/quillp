/**
 * /deadlines — Deadline Dashboard
 *
 * Server component. Fetches all firm deadlines with client names.
 * Renders DeadlineShell (client component) with list + calendar views.
 */

import { redirect }     from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DeadlineShell } from './_components/DeadlineShell'
import type { Deadline } from '@/types'

export interface DeadlineWithClient extends Deadline {
  client_name:    string
  client_email:   string
  client_id:      string
}

export default async function DeadlinesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', authUser.id)
    .single()

  if (!userRow?.firm_id) redirect('/onboarding/step-1')

  // Fetch deadlines with client name + email joined
  const { data: rows } = await supabase
    .from('deadlines')
    .select(`
      *,
      clients!inner ( id, name, email )
    `)
    .eq('firm_id', userRow.firm_id)
    .order('due_date', { ascending: true })

  const deadlines: DeadlineWithClient[] = (rows ?? []).map((r: Record<string, unknown>) => {
    const { clients, ...dl } = r
    const c = clients as { id: string; name: string; email: string } | null
    return {
      ...(dl as unknown as Deadline),
      client_name:  c?.name  ?? '',
      client_email: c?.email ?? '',
      client_id:    c?.id    ?? (dl as unknown as Deadline).client_id,
    }
  })

  return <DeadlineShell deadlines={deadlines} />
}
