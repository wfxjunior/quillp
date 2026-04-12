/**
 * /clients — Client List
 * blueprint-part1.md §1.3
 *
 * Server component. Fetches all clients for the current firm.
 * Passes data to ClientsTable for client-side search/filter.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ClientsTable } from './_components/ClientsTable'

export default async function ClientsPage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', authUser.id)
    .single()

  if (!userRow?.firm_id) redirect('/onboarding/step-1')

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, email, services, entity_type, pipeline_stage, fee_amount, fee_structure, created_at')
    .eq('firm_id', userRow.firm_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-[32px] font-medium text-ink tracking-[-0.5px] leading-tight">
            Clients
          </h1>
          <p className="text-[13.5px] text-ink-soft font-light mt-1">
            {clients?.length ?? 0} active {(clients?.length ?? 0) === 1 ? 'client' : 'clients'}
          </p>
        </div>

        <Link
          href="/clients/new"
          className={[
            'inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-[450]',
            'bg-sage-400 text-white rounded-[8px]',
            'hover:bg-sage-600 transition-colors duration-150 select-none',
          ].join(' ')}
        >
          <Plus size={14} strokeWidth={2} />
          Add client
        </Link>
      </div>

      {/* Table */}
      <ClientsTable clients={clients ?? []} />
    </div>
  )
}
