/**
 * InvoiceRow — single invoice entry
 * blueprint-part1.md §2.2
 *
 * Displays: description, date, amount, status badge
 */

import { cn } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'
import type { InvoiceStatus } from '@/types'

const STATUS_CONFIG: Record<InvoiceStatus, {
  label: string
  variant: 'green' | 'amber' | 'red' | 'beige'
}> = {
  draft:   { label: 'Draft',   variant: 'beige' },
  sent:    { label: 'Sent',    variant: 'amber' },
  paid:    { label: 'Paid',    variant: 'green' },
  overdue: { label: 'Overdue', variant: 'red'   },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

interface InvoiceRowProps {
  description: string
  date: string        // ISO date string
  amount: number      // in dollars
  status: InvoiceStatus
  invoiceNumber?: string
  onClick?: () => void
  className?: string
}

export function InvoiceRow({
  description,
  date,
  amount,
  status,
  invoiceNumber,
  onClick,
  className,
}: InvoiceRowProps) {
  const config = STATUS_CONFIG[status]

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick() } : undefined}
      className={cn(
        'flex items-center gap-3 py-3 px-4',
        'border-b border-beige-100 last:border-0 bg-white',
        onClick && 'cursor-pointer hover:bg-beige-50 transition-colors duration-100',
        className
      )}
    >
      {/* Description + invoice number */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-[450] text-ink truncate">{description}</p>
        <p className="text-[11.5px] text-ink-soft font-light mt-0.5">
          {invoiceNumber ? `${invoiceNumber} · ` : ''}{formatDate(date)}
        </p>
      </div>

      {/* Amount */}
      <p className={cn(
        'text-[13px] font-semibold shrink-0 tabular-nums',
        status === 'overdue' ? 'text-red-600' : 'text-ink',
      )}>
        {formatAmount(amount)}
      </p>

      {/* Status badge */}
      <StatusBadge label={config.label} variant={config.variant} />
    </div>
  )
}
