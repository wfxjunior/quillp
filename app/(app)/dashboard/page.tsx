/**
 * /dashboard — Main Dashboard
 * blueprint-part1.md §1.3, §2.2, §6.5
 *
 * Server component — all data fetched in parallel from Supabase.
 *
 * Layout:
 *   1. GenerateBanner — sage-tinted contextual strip
 *   2. Metrics row — 4 MetricCard components
 *   3. Two columns — Clients panel (60%) + Deadlines panel (40%)
 *   4. Recent documents panel
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { MetricCard } from '@/components/ui/MetricCard'
import { DeadlineRow } from '@/components/ui/DeadlineRow'
import { DocumentRow } from '@/components/ui/DocumentRow'
import { ClientsPanel } from './_components/ClientsPanel'
import type { DocumentType, DocumentStatus, DeadlineStatus, PipelineStage } from '@/types'

// ─────────────────────────────────────────
// Currency formatter
// ─────────────────────────────────────────

function formatRevenue(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000)     return `$${(amount / 1_000).toFixed(0)}k`
  return `$${amount.toLocaleString()}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// ─────────────────────────────────────────
// Section header
// ─────────────────────────────────────────

function SectionHeader({
  title,
  linkHref,
  linkLabel,
}: {
  title: string
  linkHref?: string
  linkLabel?: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-serif text-[17px] font-medium text-ink tracking-[-0.3px]">
        {title}
      </h2>
      {linkHref && linkLabel && (
        <Link
          href={linkHref}
          className="inline-flex items-center gap-1 text-[12.5px] text-ink-mid hover:text-ink font-[450] transition-colors"
        >
          {linkLabel}
          <ArrowRight size={12} strokeWidth={2} />
        </Link>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// GenerateBanner
// ─────────────────────────────────────────

function GenerateBanner({
  onboardingCount,
  awaitingSignatureCount,
}: {
  onboardingCount: number
  awaitingSignatureCount: number
}) {
  const parts: string[] = []
  if (onboardingCount > 0) {
    parts.push(`${onboardingCount} client${onboardingCount > 1 ? 's' : ''} in onboarding`)
  }
  if (awaitingSignatureCount > 0) {
    parts.push(
      `${awaitingSignatureCount} engagement letter${awaitingSignatureCount > 1 ? 's' : ''} awaiting signature`
    )
  }

  const message = parts.length
    ? parts.join(' · ')
    : 'Your Quilp workspace is ready. Add your first client to get started.'

  return (
    <div className="flex items-center justify-between gap-4 bg-sage-50 border-[0.5px] border-sage-200 rounded-[12px] px-5 py-3.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-6 w-6 rounded-full bg-sage-100 flex items-center justify-center shrink-0">
          <Sparkles size={13} className="text-sage-600" strokeWidth={1.75} />
        </div>
        <p className="text-[13px] font-[450] text-ink truncate">{message}</p>
      </div>
      <Link
        href="/documents"
        className="shrink-0 inline-flex items-center gap-1 text-[12.5px] font-[450] text-sage-600 hover:text-sage-800 transition-colors"
      >
        View all
        <ArrowRight size={12} strokeWidth={2} />
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────
// Panel wrapper
// ─────────────────────────────────────────

function Panel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden ${className ?? ''}`}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  // Get firm_id
  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', authUser.id)
    .single()

  if (!userRow?.firm_id) redirect('/onboarding/step-1')
  const firmId = userRow.firm_id

  // ── Parallel data fetches ────────────────────────────────────────

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [
    firmRes,
    activeClientsRes,
    totalDocsRes,
    pendingSigsRes,
    paidInvoicesRes,
    attentionClientsRes,
    deadlinesRes,
    recentDocsRes,
  ] = await Promise.all([
    // Firm services (for §13.6 no-services prompt)
    supabase
      .from('firms')
      .select('services')
      .eq('id', firmId)
      .single(),
    // Active clients count
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .is('archived_at', null),

    // Total documents generated count
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .not('client_id', 'is', null), // exclude firm-level templates

    // Pending signatures count
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .eq('status', 'awaiting_signature'),

    // Paid invoices this month
    supabase
      .from('invoices')
      .select('amount')
      .eq('firm_id', firmId)
      .eq('status', 'paid')
      .gte('created_at', startOfMonth.toISOString()),

    // Clients needing attention (active pipeline stages), max 8
    supabase
      .from('clients')
      .select('id, name, email, services, pipeline_stage')
      .eq('firm_id', firmId)
      .is('archived_at', null)
      .in('pipeline_stage', ['engaged', 'onboarding', 'docs_received', 'in_progress', 'review'])
      .order('created_at', { ascending: false })
      .limit(8),

    // Upcoming pending deadlines with client name, sorted by due_date
    supabase
      .from('deadlines')
      .select('id, filing_type, due_date, status, clients(name)')
      .eq('firm_id', firmId)
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .limit(8),

    // Recent documents (client-linked only), last 5
    supabase
      .from('documents')
      .select('id, title, type, status, created_at, clients(name)')
      .eq('firm_id', firmId)
      .not('client_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // ── Compute metrics ──────────────────────────────────────────────

  // §13.6 — no-services check
  const firmServices: string[] = (firmRes.data?.services ?? []) as string[]
  const hasNoServices = firmServices.length === 0

  const activeClientsCount = activeClientsRes.count ?? 0
  const totalDocsCount     = totalDocsRes.count ?? 0
  const pendingSigsCount   = pendingSigsRes.count ?? 0
  const revenueConfirmed   = (paidInvoicesRes.data ?? []).reduce(
    (sum: number, inv: { amount: number }) => sum + (inv.amount ?? 0), 0
  )

  // ── Banner counts ────────────────────────────────────────────────

  const onboardingCount        = (attentionClientsRes.data ?? []).filter(
    (c: { pipeline_stage: PipelineStage }) => c.pipeline_stage === 'onboarding'
  ).length
  const awaitingSignatureCount = pendingSigsCount

  // ── Shape deadline rows ──────────────────────────────────────────

  // Supabase returns FK joins as arrays; we take [0] when rendering
  type DeadlineRow = {
    id: string
    filing_type: string
    due_date: string
    status: DeadlineStatus
    clients: { name: string }[] | null
  }

  const deadlines = (deadlinesRes.data ?? []) as unknown as DeadlineRow[]

  // ── Shape document rows ──────────────────────────────────────────

  type DocRow = {
    id: string
    title: string
    type: DocumentType
    status: DocumentStatus
    created_at: string
    clients: { name: string }[] | null
  }

  const recentDocs = (recentDocsRes.data ?? []) as unknown as DocRow[]

  // ── Clients for panel ─────────────────────────────────────────────

  type ClientRow = {
    id: string
    name: string
    email: string
    services: string[]
    pipeline_stage: PipelineStage
  }

  const attentionClients: ClientRow[] = (attentionClientsRes.data ?? []) as ClientRow[]

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto flex flex-col gap-6">

      {/* ── §13.6 No-services prompt ─────────────────────────── */}
      {hasNoServices && (
        <div className="flex items-center justify-between gap-4 bg-amber-50 border-[0.5px] border-amber-200 rounded-[12px] px-5 py-3.5">
          <p className="text-[13px] font-[450] text-amber-900">
            You haven&apos;t added any services yet. Add services in Settings to generate documents and deadlines.
          </p>
          <Link
            href="/settings"
            className="shrink-0 inline-flex items-center gap-1 text-[12.5px] font-[450] text-amber-700 hover:text-amber-900 transition-colors"
          >
            Go to Settings
            <ArrowRight size={12} strokeWidth={2} />
          </Link>
        </div>
      )}

      {/* ── 1. GenerateBanner ────────────────────────────────── */}
      <GenerateBanner
        onboardingCount={onboardingCount}
        awaitingSignatureCount={awaitingSignatureCount}
      />

      {/* ── 2. Metrics row ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Active clients"
          value={activeClientsCount}
          subLabel="Currently in pipeline"
        />
        <MetricCard
          label="Documents generated"
          value={totalDocsCount}
          subLabel="Across all clients"
        />
        <MetricCard
          label="Pending signatures"
          value={pendingSigsCount}
          subLabel={pendingSigsCount === 1 ? '1 awaiting SignNow' : `${pendingSigsCount} awaiting SignNow`}
          tag={pendingSigsCount > 0 ? { label: 'Action needed', variant: 'amber' } : undefined}
        />
        <MetricCard
          label="Revenue confirmed"
          value={revenueConfirmed > 0 ? formatRevenue(revenueConfirmed) : '$0'}
          subLabel="Paid invoices this month"
          tag={revenueConfirmed > 0 ? { label: 'This month', variant: 'green' } : undefined}
        />
      </div>

      {/* ── 3. Two-column section ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* LEFT 60% — Clients needing attention */}
        <div className="lg:col-span-3">
          <SectionHeader title="Clients needing attention" />
          <ClientsPanel clients={attentionClients} />
        </div>

        {/* RIGHT 40% — Upcoming deadlines */}
        <div className="lg:col-span-2">
          <SectionHeader
            title="Upcoming deadlines"
            linkHref="/deadlines"
            linkLabel="Full calendar"
          />
          <Panel>
            {deadlines.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-ink-soft font-light">
                  No upcoming deadlines. Add clients to start tracking.
                </p>
              </div>
            ) : (
              deadlines.map(d => (
                <DeadlineRow
                  key={d.id}
                  clientName={d.clients?.[0]?.name ?? 'Unknown client'}
                  filingType={d.filing_type}
                  dueDate={d.due_date}
                  status={d.status}
                />
              ))
            )}
          </Panel>
        </div>
      </div>

      {/* ── 4. Recent documents ──────────────────────────────── */}
      <div>
        <SectionHeader
          title="Recently generated"
          linkHref="/documents"
          linkLabel="View all"
        />
        <Panel>
          {recentDocs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-ink-soft font-light">
                No documents yet.{' '}
                <Link href="/documents/generate" className="text-ink underline-offset-2 hover:underline">
                  Generate your first document →
                </Link>
              </p>
            </div>
          ) : (
            recentDocs.map(doc => (
              <DocumentRow
                key={doc.id}
                title={doc.title}
                type={doc.type}
                status={doc.status}
                meta={[
                  doc.clients?.[0]?.name,
                  formatDate(doc.created_at),
                ].filter(Boolean).join(' · ')}
              />
            ))
          )}
        </Panel>
      </div>
    </div>
  )
}
