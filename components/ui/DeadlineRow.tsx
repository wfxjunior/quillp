/**
 * DeadlineRow — single deadline entry
 * blueprint-part1.md §2.2
 *
 * Urgency indicator:
 *   ≤ 7 days  → red
 *   ≤ 14 days → amber
 *   15+ days  → green
 */

import { cn } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'
import type { DeadlineStatus } from '@/types'

// ─────────────────────────────────────────
// Urgency helpers
// ─────────────────────────────────────────

function getDaysRemaining(dueDateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDueDate(dueDateStr: string): string {
  return new Date(dueDateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─────────────────────────────────────────
// Status badge config
// ─────────────────────────────────────────

const STATUS_CONFIG: Record<DeadlineStatus, { label: string; variant: 'beige' | 'green' | 'ink' }> = {
  pending:  { label: 'Pending',  variant: 'beige' },
  filed:    { label: 'Filed',    variant: 'green' },
  extended: { label: 'Extended', variant: 'ink'   },
}

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────

interface DeadlineRowProps {
  clientName: string
  filingType: string
  dueDate: string        // ISO date string, e.g. "2025-04-15"
  status: DeadlineStatus
  onClick?: () => void
  className?: string
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────

export function DeadlineRow({
  clientName,
  filingType,
  dueDate,
  status,
  onClick,
  className,
}: DeadlineRowProps) {
  const days = getDaysRemaining(dueDate)
  const statusConfig = STATUS_CONFIG[status]
  const isPending = status === 'pending'

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
      {/* Urgency dot */}
      {isPending && (
        <div
          className={cn(
            'shrink-0 h-2 w-2 rounded-full',
            days <= 7  && 'bg-red-400',
            days > 7 && days <= 14 && 'bg-amber-400',
            days > 14 && 'bg-sage-400',
          )}
        />
      )}

      {/* Client + filing type */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-[450] text-ink truncate">{clientName}</p>
        <p className="text-[11.5px] text-ink-soft font-light truncate mt-0.5">{filingType}</p>
      </div>

      {/* Due date */}
      <div className="text-right shrink-0">
        <p className="text-[12px] font-medium text-ink">{formatDueDate(dueDate)}</p>
        {isPending && (
          <p className={cn(
            'text-[11px] font-medium mt-0.5',
            days <= 0  ? 'text-red-500' : '',
            days > 0 && days <= 7  ? 'text-red-500' : '',
            days > 7 && days <= 14 ? 'text-amber-600' : '',
            days > 14 ? 'text-sage-600' : '',
          )}>
            {days <= 0
              ? 'Overdue'
              : days === 1
              ? '1 day left'
              : `${days} days left`
            }
          </p>
        )}
      </div>

      {/* Status badge */}
      <StatusBadge label={statusConfig.label} variant={statusConfig.variant} />
    </div>
  )
}
