/**
 * /documents — All Documents
 *
 * Server component. Fetches all firm documents with client names joined.
 * Passes data to DocumentsShell (client component) for filtering + actions.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DocumentsShell } from './_components/DocumentsShell'
import type { DocumentType, DocumentStatus } from '@/types'

export interface DocumentWithClient {
  id:          string
  title:       string
  type:        DocumentType
  status:      DocumentStatus
  service_type: string | null
  created_at:  string
  client_id:   string | null
  client_name: string | null
}

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', authUser.id)
    .single()

  if (!userRow?.firm_id) redirect('/onboarding/step-1')

  const { data: raw } = await supabase
    .from('documents')
    .select(`
      id, title, type, status, service_type, created_at, client_id,
      clients ( name )
    `)
    .eq('firm_id', userRow.firm_id)
    .not('client_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)

  type RawDoc = {
    id: string; title: string; type: DocumentType; status: DocumentStatus
    service_type: string | null; created_at: string; client_id: string | null
    clients: { name: string }[] | null
  }

  const documents: DocumentWithClient[] = ((raw ?? []) as unknown as RawDoc[]).map(d => ({
    id:           d.id,
    title:        d.title,
    type:         d.type,
    status:       d.status,
    service_type: d.service_type,
    created_at:   d.created_at,
    client_id:    d.client_id,
    client_name:  d.clients?.[0]?.name ?? null,
  }))

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-[26px] font-medium text-ink tracking-[-0.5px]">
            Documents
          </h1>
          <p className="text-[13px] text-ink-soft font-light mt-0.5">
            {documents.length} document{documents.length !== 1 ? 's' : ''} generated
          </p>
        </div>
        <Link
          href="/documents/generate"
          className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-[450] bg-ink text-white rounded-[10px] hover:bg-ink/90 transition-colors"
        >
          + Generate document
        </Link>
      </div>

      <DocumentsShell documents={documents} />
    </div>
  )
}
