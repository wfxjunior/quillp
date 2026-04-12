/**
 * /portal/[token] — Client-facing onboarding portal
 *
 * Public page — no authentication required.
 * Access is gated by the portal_token UUID on the client row.
 *
 * Uses createAdminClient() (service role) to bypass RLS.
 */

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { PortalShell } from './_components/PortalShell'
import type { Client, Document, TaxDocument, Firm } from '@/types'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function ClientPortalPage({ params }: PageProps) {
  const { token } = await params
  const admin = createAdminClient()

  // ── Fetch client by portal token ──
  const { data: client } = await admin
    .from('clients')
    .select('*')
    .eq('portal_token', token)
    .single() as { data: Client | null }

  if (!client) notFound()

  // ── Fetch firm ──
  const { data: firm } = await admin
    .from('firms')
    .select('id, name, logo_url, primary_state, owner_id')
    .eq('id', client.firm_id)
    .single() as { data: Pick<Firm, 'id' | 'name' | 'logo_url' | 'primary_state' | 'owner_id'> | null }

  // Fetch firm owner email for the already-submitted screen
  let firmOwnerEmail: string | null = null
  if (firm?.owner_id) {
    const { data: ownerRow } = await admin
      .from('users')
      .select('email')
      .eq('id', firm.owner_id)
      .single()
    firmOwnerEmail = ownerRow?.email ?? null
  }

  // ── Fetch engagement letter (Step 1) ──
  const { data: engagementLetters } = await admin
    .from('documents')
    .select('*')
    .eq('client_id', client.id)
    .eq('type', 'engagement_letter')
    .order('created_at', { ascending: false })
    .limit(1) as { data: Document[] | null }

  const engagementLetter = engagementLetters?.[0] ?? null

  // ── Fetch required tax documents (Step 3) ──
  const { data: taxDocuments } = await admin
    .from('tax_documents')
    .select('*')
    .eq('client_id', client.id)
    .eq('required', true)
    .order('document_type') as { data: TaxDocument[] | null }

  // ── Already submitted screen — §13.5 ──
  if (client.portal_submitted_at) {
    const submittedDate = new Date(client.portal_submitted_at).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
    const firmName = firm?.name ?? 'your accountant'

    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white border border-beige-200 rounded-[20px] shadow-sm p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-sage-600">
                <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="font-serif text-[24px] font-medium text-ink mb-2">
              Already submitted
            </h1>
            <p className="text-[13.5px] text-ink-soft font-light leading-relaxed mb-4">
              You submitted your documents on{' '}
              <span className="text-ink font-[450]">{submittedDate}</span>.{' '}
              <span className="text-ink font-[450]">{firmName}</span> is reviewing your submission.
            </p>
            {firmOwnerEmail && (
              <p className="text-[13px] text-ink-soft font-light">
                Need to add documents? Contact your accountant at{' '}
                <a
                  href={`mailto:${firmOwnerEmail}`}
                  className="text-ink font-[450] hover:underline underline-offset-2"
                >
                  {firmOwnerEmail}
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <PortalShell
      token={token}
      client={client}
      firm={firm ?? { id: client.firm_id, name: 'Your Accountant', logo_url: null, primary_state: null }}
      engagementLetter={engagementLetter}
      taxDocuments={taxDocuments ?? []}
    />
  )
}
