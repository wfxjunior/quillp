/**
 * ClientRow — single client entry in a list
 * blueprint-part1.md §2.2
 *
 * Clickable row that navigates to /clients/[id].
 * Displays avatar initials, name, primary service, and pipeline stage badge.
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { StatusBadge, type StatusBadgeVariant } from './StatusBadge'
import type { PipelineStage } from '@/types'

// ─────────────────────────────────────────
// Stage → badge
// ─────────────────────────────────────────

const STAGE_BADGE: Record<PipelineStage, { label: string; variant: StatusBadgeVariant }> = {
  engaged:        { label: 'Engaged',          variant: 'ink'   },
  onboarding:     { label: 'Onboarding',        variant: 'amber' },
  docs_received:  { label: 'Docs Received',     variant: 'amber' },
  in_progress:    { label: 'In Progress',       variant: 'beige' },
  review:         { label: 'Review',            variant: 'amber' },
  filed_invoiced: { label: 'Filed & Invoiced',  variant: 'green' },
}

// ─────────────────────────────────────────
// Service label shorthand
// ─────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  '1040':               'Individual (1040)',
  '1120-S':             'S-Corp (1120-S)',
  '1065':               'Partnership (1065)',
  '1120':               'C-Corp (1120)',
  '990':                'Non-Profit (990)',
  bookkeeping:          'Bookkeeping',
  payroll:              'Payroll',
  tax_planning:         'Tax Planning',
  sales_tax:            'Sales Tax',
  irs_representation:   'IRS Representation',
  cfo_advisory:         'CFO Advisory',
  business_formation:   'Business Formation',
}

function serviceLabel(services: string[]): string {
  if (!services.length) return '—'
  const label = SERVICE_LABELS[services[0]]
  if (!label) return services[0]
  const extra = services.length - 1
  return extra > 0 ? `${label} +${extra}` : label
}

function initials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────

interface ClientRowProps {
  id: string
  name: string
  email: string
  services: string[]
  pipelineStage: PipelineStage
  className?: string
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────

export function ClientRow({ id, name, services, pipelineStage, className }: ClientRowProps) {
  const badge = STAGE_BADGE[pipelineStage]
  const ini   = initials(name)

  return (
    <Link
      href={`/clients/${id}`}
      className={cn(
        'flex items-center gap-3 py-3 px-4',
        'border-b border-beige-100 last:border-0 bg-white',
        'hover:bg-beige-50 transition-colors duration-100',
        className
      )}
    >
      {/* Avatar */}
      <div className="h-7 w-7 rounded-full bg-beige-200 flex items-center justify-center shrink-0">
        <span className="text-[10.5px] font-semibold text-ink-mid leading-none">{ini}</span>
      </div>

      {/* Name + service */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-[450] text-ink truncate">{name}</p>
        <p className="text-[11.5px] text-ink-soft font-light truncate mt-0.5">
          {serviceLabel(services)}
        </p>
      </div>

      {/* Stage badge */}
      <StatusBadge label={badge.label} variant={badge.variant} />
    </Link>
  )
}
