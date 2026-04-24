/**
 * Authenticated app layout — server component
 * blueprint-part2.md §10.1
 *
 * Runs on the server: fetches firm + user data, constructs
 * FirmContextValue, and passes it to the client AppShell.
 * Middleware guarantees a valid session before this runs.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import type { FirmContextValue } from '@/lib/context/firm-context'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // Get authenticated user (middleware ensures this exists)
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  // Fetch user record
  const { data: userRow } = await supabase
    .from('users')
    .select('id, email, name, role, firm_id, created_at, last_login_at, onboarding_completed')
    .eq('id', authUser.id)
    .single()

  if (!userRow || !userRow.firm_id) redirect('/onboarding/step-1')

  // Fetch firm record
  const { data: firmRow } = await supabase
    .from('firms')
    .select('*')
    .eq('id', userRow.firm_id)
    .single()

  if (!firmRow) redirect('/onboarding/step-1')

  // Compute subscription days remaining
  let daysRemaining: number | null = null
  if (firmRow.trial_ends_at) {
    const ms = new Date(firmRow.trial_ends_at).getTime() - Date.now()
    daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
  }

  const contextValue: FirmContextValue = {
    firm: {
      id: firmRow.id,
      name: firmRow.name,
      owner_id: firmRow.owner_id,
      logo_url: firmRow.logo_url ?? null,
      address: firmRow.address ?? null,
      primary_state: firmRow.primary_state ?? null,
      fee_model: firmRow.fee_model ?? null,
      services: firmRow.services ?? [],
      entity_types: firmRow.entity_types ?? [],
      client_types: firmRow.client_types ?? [],
      description_raw: firmRow.description_raw ?? null,
      description_parsed: firmRow.description_parsed ?? null,
      signnow_token: firmRow.signnow_token ?? null,
      stripe_account_id: firmRow.stripe_account_id ?? null,
      subscription_plan: firmRow.subscription_plan,
      subscription_status: firmRow.subscription_status,
      trial_ends_at: firmRow.trial_ends_at ?? null,
      created_at: firmRow.created_at,
    },
    user: {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
      firm_id: userRow.firm_id,
      created_at: userRow.created_at,
      last_login_at: userRow.last_login_at ?? null,
      onboarding_completed: userRow.onboarding_completed,
    },
    subscription: {
      plan: firmRow.subscription_plan,
      status: firmRow.subscription_status,
      trialEndsAt: firmRow.trial_ends_at ?? null,
      daysRemaining,
    },
  }

  return (
    <AppShell value={contextValue}>
      {children}
    </AppShell>
  )
}
