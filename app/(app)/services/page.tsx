import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ServicesShell } from './_components/ServicesShell'

export default async function ServicesPage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', authUser.id)
    .single()

  if (!userRow?.firm_id) redirect('/onboarding/step-1')

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('firm_id', userRow.firm_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  return <ServicesShell initialServices={services ?? []} />
}
