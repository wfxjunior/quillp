/**
 * /invoices/new — Create Invoice
 *
 * Server component. Fetches active clients for the selector,
 * then renders NewInvoiceShell (client component).
 */

import { redirect }     from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewInvoiceShell } from './_components/NewInvoiceShell'

export default async function NewInvoicePage() {
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
    .select('id, name, email, fee_amount, fee_structure')
    .eq('firm_id', userRow.firm_id)
    .is('archived_at', null)
    .order('name')

  return <NewInvoiceShell clients={clients ?? []} />
}
