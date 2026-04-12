/**
 * /settings — Firm Settings
 *
 * Server component. Passes firm + user data to SettingsShell.
 * Sections: Firm Profile · DocuSign · Notification Preferences
 */

import { redirect }     from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsShell } from './_components/SettingsShell'
import { loadToken }     from '@/lib/docusign/client'
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
    .select('id, name, address, logo_url, primary_state, docusign_token, notification_prefs')
    .eq('id', userRow.firm_id)
    .single() as {
      data: Pick<Firm, 'id' | 'name' | 'address' | 'logo_url' | 'primary_state' | 'docusign_token'> & {
        notification_prefs?: {
          deadline_alerts:  boolean
          document_signed:  boolean
          portal_submitted: boolean
          invoice_overdue:  boolean
        } | null
      } | null
    }

  // Determine DocuSign connection status
  let docuSignConnected  = false
  let docuSignAccountId: string | null = null

  if (firm?.docusign_token) {
    try {
      const token = await loadToken(userRow.firm_id)
      if (token) {
        docuSignConnected = true
        docuSignAccountId = token.account_id
      }
    } catch {
      // Token decryption failed — treat as not connected
    }
  }

  return (
    <SettingsShell
      firmId={userRow.firm_id}
      firmName={firm?.name ?? ''}
      firmAddress={firm?.address ?? null}
      firmLogoUrl={firm?.logo_url ?? null}
      userRole={userRow.role}
      cpaName={userRow.name}
      userEmail={authUser.email ?? ''}
      docuSignConnected={docuSignConnected}
      docuSignAccountId={docuSignAccountId}
      oauthSuccess={params.docusign_connected === '1'}
      oauthError={params.docusign_error ?? null}
      notificationPrefs={firm?.notification_prefs ?? {
        deadline_alerts:  true,
        document_signed:  true,
        portal_submitted: true,
        invoice_overdue:  true,
      }}
    />
  )
}
