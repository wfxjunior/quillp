/**
 * /invoices — Invoice list
 *
 * Server component. Fetches all firm invoices with client names joined.
 * Passes data to InvoiceListShell (client component) for filtering + actions.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InvoiceListShell } from './_components/InvoiceListShell'
import type { Invoice } from '@/types'

interface InvoiceWithClient extends Invoice {
  client_name: string
  client_email: string
}

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', authUser.id)
    .single()

  if (!userRow?.firm_id) redirect('/onboarding/step-1')

  // Fetch invoices with client name + email joined
  const { data: rawInvoices } = await supabase
    .from('invoices')
    .select(`
      *,
      clients!inner ( name, email )
    `)
    .eq('firm_id', userRow.firm_id)
    .order('created_at', { ascending: false })

  const invoices: InvoiceWithClient[] = (rawInvoices ?? []).map((row: Record<string, unknown>) => {
    const { clients, ...inv } = row
    const clientData = clients as { name: string; email: string } | null
    return {
      ...(inv as unknown as Invoice),
      client_name:  clientData?.name  ?? '',
      client_email: clientData?.email ?? '',
    }
  })

  return (
    <InvoiceListShell invoices={invoices} />
  )
}
