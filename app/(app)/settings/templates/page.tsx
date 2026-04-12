/**
 * /settings/templates — Template Library
 *
 * Server component. Fetches all FirmTemplate records for the firm.
 * Renders TemplateLibraryShell (client component) with inline editor.
 */

import { redirect }     from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TemplateLibraryShell } from './_components/TemplateLibraryShell'
import type { FirmTemplate } from '@/types'

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, role')
    .eq('id', authUser.id)
    .single()

  if (!userRow?.firm_id) redirect('/onboarding/step-1')

  const { data: templates } = await supabase
    .from('firm_templates')
    .select('*')
    .eq('firm_id', userRow.firm_id)
    .order('document_type')
    .order('service_type') as { data: FirmTemplate[] | null }

  return (
    <TemplateLibraryShell
      firmId={userRow.firm_id}
      userRole={userRow.role}
      templates={templates ?? []}
    />
  )
}
