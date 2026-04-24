import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProcessesShell } from './_components/ProcessesShell'

export default async function ProcessesPage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', authUser.id)
    .single()

  if (!userRow?.firm_id) redirect('/onboarding/step-1')

  const firmId = userRow.firm_id as string

  const [processesResult, clientsResult, servicesResult] = await Promise.all([
    supabase
      .from('processes')
      .select('*, services(name, price_type), clients(name, email)')
      .eq('firm_id', firmId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('clients')
      .select('id, name, email')
      .eq('firm_id', firmId)
      .is('archived_at', null)
      .order('name'),
    supabase
      .from('services')
      .select('id, name, steps')
      .eq('firm_id', firmId)
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <ProcessesShell
      initialProcesses={processesResult.data ?? []}
      clients={clientsResult.data ?? []}
      services={servicesResult.data ?? []}
    />
  )
}
