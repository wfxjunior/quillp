'use client'

/**
 * DeadlineListView — grouped list: Overdue / This Week / This Month / Upcoming
 * Clicking a row navigates to /clients/[id].
 */

import { useMemo } from 'react'
import { cn }      from '@/lib/utils'
import type { DeadlineWithClient } from '../page'

interface DeadlineListViewProps {
  deadlines:       DeadlineWithClient[]
  onSelectClient:  (clientId: string) => void
}

type Group = 'overdue' | 'week' | 'month' | 'upcoming' | 'filed'

function getDaysRemaining(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due   = new Date(iso); due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
}

function classify(dl: DeadlineWithClient): Group {
  if (dl.status === 'filed' || dl.status === 'extended') return 'filed'
  const days = getDaysRemaining(dl.due_date)
  if (days  < 0)  return 'overdue'
  if (days <= 7)  return 'week'
  if (days <= 31) return 'month'
  return 'upcoming'
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const GROUP_CONFIG: Record<Group, { label: string; emptyLabel: string }> = {
  overdue:  { label: 'Overdue',       emptyLabel: '' },
  week:     { label: 'This Week',     emptyLabel: '' },
  month:    { label: 'This Month',    emptyLabel: '' },
  upcoming: { label: 'Upcoming',      emptyLabel: '' },
  filed:    { label: 'Filed / Extended', emptyLabel: '' },
}

const GROUP_ORDER: Group[] = ['overdue', 'week', 'month', 'upcoming', 'filed']

export function DeadlineListView({ deadlines, onSelectClient }: DeadlineListViewProps) {
  const grouped = useMemo(() => {
    const map: Record<Group, DeadlineWithClient[]> = {
      overdue: [], week: [], month: [], upcoming: [], filed: [],
    }
    for (const dl of deadlines) map[classify(dl)].push(dl)
    return map
  }, [deadlines])

  const hasAny = deadlines.length > 0

  if (!hasAny) {
    return (
      <div className="text-center py-16 text-[13.5px] text-ink-soft font-light">
        No deadlines yet. Add clients with services to generate deadlines.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {GROUP_ORDER.map(group => {
        const items = grouped[group]
        if (items.length === 0) return null

        return (
          <section key={group}>
            <div className="flex items-center gap-2 mb-2.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                {GROUP_CONFIG[group].label}
              </h2>
              <span className={cn(
                'text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full',
                group === 'overdue'  ? 'bg-red-100 text-red-600'   :
                group === 'week'     ? 'bg-amber-100 text-amber-700' :
                group === 'month'    ? 'bg-sage-100 text-sage-700' :
                                       'bg-beige-100 text-ink-soft',
              )}>
                {items.length}
              </span>
            </div>

            <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden divide-y divide-beige-100">
              {items.map(dl => (
                <DeadlineListRow
                  key={dl.id}
                  deadline={dl}
                  onClick={() => onSelectClient(dl.client_id)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────
// Row
// ─────────────────────────────────────────

function DeadlineListRow({
  deadline, onClick,
}: {
  deadline: DeadlineWithClient
  onClick:  () => void
}) {
  const days = getDaysRemaining(deadline.due_date)
  const isPending = deadline.status === 'pending'

  const urgencyColor = !isPending ? 'bg-beige-200' :
    days < 0    ? 'bg-red-400'   :
    days <= 7   ? 'bg-red-400'   :
    days <= 14  ? 'bg-amber-400' :
                  'bg-sage-400'

  const daysLabel =
    !isPending         ? null :
    days < 0           ? 'Overdue'                       :
    days === 0         ? 'Today'                         :
    days === 1         ? '1 day'                         :
                         `${days} days`

  const daysColor =
    !isPending         ? '' :
    days < 0           ? 'text-red-600 bg-red-50 border-red-200'     :
    days <= 7          ? 'text-red-600 bg-red-50 border-red-200'     :
    days <= 14         ? 'text-amber-700 bg-amber-50 border-amber-200' :
                         'text-sage-700 bg-sage-50 border-sage-200'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter') onClick() }}
      className="flex items-center gap-4 px-5 py-3.5 hover:bg-beige-50 transition-colors cursor-pointer"
    >
      {/* Urgency dot */}
      <div className={cn('h-2 w-2 rounded-full shrink-0', urgencyColor)} />

      {/* Client + filing type */}
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-[500] text-ink truncate">{deadline.client_name}</p>
        <p className="text-[12px] text-ink-soft font-light mt-0.5 truncate">{deadline.filing_type}</p>
      </div>

      {/* Due date */}
      <div className="text-right shrink-0">
        <p className="text-[12.5px] font-[450] text-ink">{fmtDate(deadline.due_date)}</p>
        {deadline.extension_due_date && deadline.status === 'extended' && (
          <p className="text-[11px] text-ink-soft font-light">
            Ext. {fmtDate(deadline.extension_due_date)}
          </p>
        )}
      </div>

      {/* Days remaining badge */}
      {daysLabel && (
        <span className={cn(
          'inline-flex items-center text-[11px] font-[500] px-2 py-1 rounded-full border shrink-0 tabular-nums',
          daysColor,
        )}>
          {daysLabel}
        </span>
      )}

      {/* Status badge */}
      {deadline.status !== 'pending' && (
        <span className={cn(
          'inline-flex items-center text-[11px] font-[500] px-2 py-1 rounded-full border shrink-0',
          deadline.status === 'filed'
            ? 'bg-sage-50 text-sage-700 border-sage-200'
            : 'bg-beige-100 text-ink-mid border-beige-200',
        )}>
          {deadline.status.charAt(0).toUpperCase() + deadline.status.slice(1)}
        </span>
      )}
    </div>
  )
}
