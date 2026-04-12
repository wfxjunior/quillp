/**
 * /clients/[id] — Client Detail View
 * blueprint-part1.md §1.3
 *
 * Server component — fetches all client data in parallel.
 * Passes everything to ClientDetail client component.
 */

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientDetail } from './_components/ClientDetail'
import type { Document, TaxDocument, Invoice, TimelineEvent } from '@/types'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, name')
    .eq('id', authUser.id)
    .single()

  if (!userRow?.firm_id) redirect('/onboarding/step-1')

  // Parallel fetches — all scoped to firm for security
  const [
    clientRes,
    documentsRes,
    taxDocsRes,
    invoicesRes,
    timelineRes,
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('firm_id', userRow.firm_id)  // RLS double-check
      .single(),

    supabase
      .from('documents')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),

    supabase
      .from('tax_documents')
      .select('*')
      .eq('client_id', id)
      .order('document_type'),

    supabase
      .from('invoices')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),

    supabase
      .from('timeline_events')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (!clientRes.data) notFound()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <ClientDetail
      client={clientRes.data}
      documents={(documentsRes.data ?? []) as unknown as Document[]}
      taxDocuments={(taxDocsRes.data ?? []) as unknown as TaxDocument[]}
      invoices={(invoicesRes.data ?? []) as unknown as Invoice[]}
      timelineEvents={(timelineRes.data ?? []) as unknown as TimelineEvent[]}
      firmId={userRow.firm_id}
      userId={authUser.id}
      appUrl={appUrl}
    />
  )
}
