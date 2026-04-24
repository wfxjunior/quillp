/**
 * /settings — Firm Settings
 *
 * Server component. Passes firm + user data to SettingsShell.
 * Sections: Firm Profile · SignNow · Notification Preferences
 */

import { redirect }      from 'next/navigation'
import { createClient }  from '@/lib/supabase/server'
import { SettingsShell } from './_components/SettingsShell'
import { loadToken }     from '@/lib/signnow/client'
import type { Firm, User } from '@/types'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const supabase = await createClient()
  const params   = await searchParams

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, name, role')
    .eq('id', authUser.id)
    .single() as { data: Pick<User, 'firm_id' | 'name' | 'role'> | null }

  if (!userRow?.firm_id) redirect('/onboarding/step-1')

  const { data: firm } = await supabase
    .from('firms')
    .select('id, name, address, logo_url, primary_state, signnow_token, stripe_account_id, notification_prefs')
    .eq('id', userRow.firm_id)
    .single() as {
      data: Pick<Firm, 'id' | 'name' | 'address' | 'logo_url' | 'primary_state' | 'signnow_token' | 'stripe_account_id'> & {
        notification_prefs?: {
          deadline_alerts:  boolean
          document_signed:  boolean
          portal_submitted: boolean
          invoice_overdue:  boolean
        } | null
      } | null
    }

  // Determine SignNow connection status
  let signNowConnected = false
  let signNowEmail: string | null = null

  if (firm?.signnow_token) {
    try {
      const token = await loadToken(userRow.firm_id)
      if (token) {
        signNowConnected = true
        signNowEmail     = token.user_email
      }
    } catch {
      // Token decryption failed — treat as not connected
    }
  }

  const stripeConnected = !!firm?.stripe_account_id
  const stripeAccountId = firm?.stripe_account_id ?? null

  // Fetch team members (owner/admin only — staff gets empty array)
  let initialTeam: { id: string; name: string; email: string; role: string; created_at: string; last_login_at: string | null }[] = []
  if (userRow.role !== 'staff') {
    const { createAdminClient } = await import('@/lib/supabase/server')
    const admin = createAdminClient()
    const { data: members } = await admin
      .from('users')
      .select('id, name, email, role, created_at, last_login_at')
      .eq('firm_id', userRow.firm_id)
      .order('created_at')
    initialTeam = members ?? []
  }

  return (
    <SettingsShell
      firmId={userRow.firm_id}
      firmName={firm?.name ?? ''}
      firmAddress={firm?.address ?? null}
      firmLogoUrl={firm?.logo_url ?? null}
      userRole={userRow.role}
      userId={authUser.id}
      cpaName={userRow.name}
      userEmail={authUser.email ?? ''}
      signNowConnected={signNowConnected}
      signNowEmail={signNowEmail}
      stripeConnected={stripeConnected}
      stripeAccountId={stripeAccountId}
      oauthSuccess={params.signnow_connected === '1'}
      oauthError={params.signnow_error ?? null}
      stripeOauthSuccess={params.stripe_connected === '1'}
      stripeOauthError={params.stripe_error ?? null}
      notificationPrefs={firm?.notification_prefs ?? {
        deadline_alerts:  true,
        document_signed:  true,
        portal_submitted: true,
        invoice_overdue:  true,
      }}
      initialTeam={initialTeam as Parameters<typeof SettingsShell>[0]['initialTeam']}
    />
  )
}
