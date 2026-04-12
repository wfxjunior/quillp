'use client'

/**
 * ClientsTable — searchable, filterable client list
 *
 * Receives full client list from the server component.
 * Search and stage filtering are entirely client-side (no re-fetch).
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, ArrowRight } from 'lucide-react'
import { StatusBadge, type StatusBadgeVariant } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/utils'
import type { PipelineStage, EntityType } from '@/types'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface ClientTableRow {
  id: string
  name: string
  email: string
  services: string[]
  entity_type: EntityType
  pipeline_stage: PipelineStage
  fee_amount: number | null
  fee_structure: string | null
  created_at: string
}

// ─────────────────────────────────────────
// Config
// ─────────────────────────────────────────

type FilterTab = 'all' | 'engaged' | 'onboarding' | 'in_progress' | 'filed'

const FILTER_TABS: { key: FilterTab; label: string; stages: PipelineStage[] }[] = [
  { key: 'all',         label: 'All',         stages: [] },
  { key: 'engaged',     label: 'Engaged',     stages: ['engaged'] },
  { key: 'onboarding',  label: 'Onboarding',  stages: ['onboarding', 'docs_received'] },
  { key: 'in_progress', label: 'In Progress', stages: ['in_progress', 'review'] },
  { key: 'filed',       label: 'Filed',       stages: ['filed_invoiced'] },
]

const STAGE_BADGE: Record<PipelineStage, { label: string; variant: StatusBadgeVariant }> = {
  engaged:        { label: 'Engaged',          variant: 'ink'   },
  onboarding:     { label: 'Onboarding',        variant: 'amber' },
  docs_received:  { label: 'Docs Received',     variant: 'amber' },
  in_progress:    { label: 'In Progress',       variant: 'beige' },
  review:         { label: 'Review',            variant: 'amber' },
  filed_invoiced: { label: 'Filed & Invoiced',  variant: 'green' },
}

const SERVICE_LABELS: Record<string, string> = {
  '1040': 'Individual (1040)', '1120-S': 'S-Corp (1120-S)', '1065': 'Partnership (1065)',
  '1120': 'C-Corp (1120)', '990': 'Non-Profit (990)', bookkeeping: 'Bookkeeping',
  payroll: 'Payroll', tax_planning: 'Tax Planning', sales_tax: 'Sales Tax',
  irs_representation: 'IRS Representation',
}

function primaryService(services: string[]): string {
  if (!services.length) return '—'
  const lbl = SERVICE_LABELS[services[0]] ?? services[0]
  return services.length > 1 ? `${lbl} +${services.length - 1}` : lbl
}

function formatFee(amount: number | null, structure: string | null): string {
  if (!amount) return '—'
  const fmt = `$${amount.toLocaleString()}`
  const sfx = structure === 'flat_fee' ? '/flat' : structure === 'hourly' ? '/hr' : structure === 'retainer' ? '/mo' : ''
  return fmt + sfx
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7)  return `${diff}d ago`
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────

export function ClientsTable({ clients }: { clients: ClientTableRow[] }) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const tabConfig = FILTER_TABS.find(t => t.key === activeTab)!

  const filtered = useMemo(() => {
    let rows = clients
    // Stage filter
    if (tabConfig.stages.length) {
      rows = rows.filter(c => tabConfig.stages.includes(c.pipeline_stage))
    }
    // Search filter
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.services.some(s => (SERVICE_LABELS[s] ?? s).toLowerCase().includes(q))
      )
    }
    return rows
  }, [clients, tabConfig, search])

  return (
    <div className="flex flex-col gap-4">
      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none"
            strokeWidth={1.75}
          />
          <input
            type="search"
            placeholder="Search clients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={cn(
              'w-full h-9 pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-soft',
              'bg-white border-[0.5px] border-beige-300 rounded-[8px]',
              'outline-none focus:border-sage-400 transition-colors'
            )}
          />
        </div>

        {/* Stage filter chips */}
        <div className="flex gap-1 flex-wrap">
          {FILTER_TABS.map(tab => {
            const count = tab.stages.length
              ? clients.filter(c => tab.stages.includes(c.pipeline_stage)).length
              : clients.length
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'h-7 px-3 text-[12px] font-[450] rounded-[6px]',
                  'transition-colors duration-150 select-none',
                  activeTab === tab.key
                    ? 'bg-ink text-white'
                    : 'text-ink-soft hover:text-ink hover:bg-beige-100 bg-white border-[0.5px] border-beige-200',
                )}
              >
                {tab.label}
                <span className={cn(
                  'ml-1.5 text-[10.5px]',
                  activeTab === tab.key ? 'text-white/60' : 'text-ink-soft/60'
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            {clients.length === 0 ? (
              <div>
                <p className="text-[14px] font-[450] text-ink mb-1">No clients yet</p>
                <p className="text-[13px] text-ink-soft font-light">
                  Add your first client to get started.
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-ink-soft font-light">
                No clients match your search.
              </p>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-beige-100">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft">
                  Name
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft hidden sm:table-cell">
                  Service
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft">
                  Stage
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft hidden md:table-cell">
                  Last Activity
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft hidden lg:table-cell">
                  Fee
                </th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(client => {
                const badge = STAGE_BADGE[client.pipeline_stage]
                return (
                  <tr
                    key={client.id}
                    className="border-b border-beige-100 last:border-0 hover:bg-beige-50 transition-colors duration-100"
                  >
                    {/* Name + avatar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-beige-200 flex items-center justify-center shrink-0">
                          <span className="text-[10.5px] font-semibold text-ink-mid leading-none">
                            {initials(client.name)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-[450] text-ink truncate">{client.name}</p>
                          {client.email && (
                            <p className="text-[11.5px] text-ink-soft font-light truncate">{client.email}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Service */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-[12.5px] text-ink-mid">{primaryService(client.services)}</span>
                    </td>

                    {/* Stage */}
                    <td className="px-4 py-3">
                      <StatusBadge label={badge.label} variant={badge.variant} />
                    </td>

                    {/* Last activity */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-[12.5px] text-ink-soft">{relativeDate(client.created_at)}</span>
                    </td>

                    {/* Fee */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-[12.5px] text-ink tabular-nums">
                        {formatFee(client.fee_amount, client.fee_structure)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/clients/${client.id}`}
                        className={cn(
                          'inline-flex items-center gap-1 text-[12px] font-[450]',
                          'text-ink-mid hover:text-ink transition-colors'
                        )}
                      >
                        View
                        <ArrowRight size={12} strokeWidth={2} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-[12px] text-ink-soft font-light">
          {filtered.length} {filtered.length === 1 ? 'client' : 'clients'}
          {search && ` matching "${search}"`}
        </p>
      )}
    </div>
  )
}
