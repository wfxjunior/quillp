'use client'

/**
 * DeadlineListView — grouped list: Overdue / This Week / This Month / Upcoming / Filed
 * Pending rows show "Filed" and "Extend" action buttons.
 */

import { useState, useMemo } from 'react'
import { CheckCircle, CalendarClock, Loader2 } from 'lucide-react'
import { cn }      from '@/lib/utils'
import type { DeadlineWithClient } from '../page'

interface DeadlineListViewProps {
  deadlines:       DeadlineWithClient[]
  marking:         Record<string, boolean>
  onSelectClient:  (clientId: string) => void
  onMark:          (id: string, status: 'filed' | 'extended', extension_due_date?: string) => void
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

const GROUP_CONFIG: Record<Group, { label: string }> = {
  overdue:  { label: 'Overdue'          },
  week:     { label: 'This Week'        },
  month:    { label: 'This Month'       },
  upcoming: { label: 'Upcoming'         },
  filed:    { label: 'Filed / Extended' },
}

const GROUP_ORDER: Group[] = ['overdue', 'week', 'month', 'upcoming', 'filed']

export function DeadlineListView({ deadlines, marking, onSelectClient, onMark }: DeadlineListViewProps) {
  const grouped = useMemo(() => {
    const map: Record<Group, DeadlineWithClient[]> = {
      overdue: [], week: [], month: [], upcoming: [], filed: [],
    }
    for (const dl of deadlines) map[classify(dl)].push(dl)
    return map
  }, [deadlines])

  if (deadlines.length === 0) {
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
                group === 'overdue'  ? 'bg-red-100 text-red-600'     :
                group === 'week'     ? 'bg-amber-100 text-amber-700' :
                group === 'month'    ? 'bg-sage-100 text-sage-700'   :
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
                  isMarking={!!marking[dl.id]}
                  onSelectClient={() => onSelectClient(dl.client_id)}
                  onMark={onMark}
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
  deadline, isMarking, onSelectClient, onMark,
}: {
  deadline:        DeadlineWithClient
  isMarking:       boolean
  onSelectClient:  () => void
  onMark:          (id: string, status: 'filed' | 'extended', ext?: string) => void
}) {
  const [showExtend,  setShowExtend]  = useState(false)
  const [extDate,     setExtDate]     = useState('')

  const days      = getDaysRemaining(deadline.due_date)
  const isPending = deadline.status === 'pending'

  const urgencyColor = !isPending ? 'bg-beige-200' :
    days < 0    ? 'bg-red-400'   :
    days <= 7   ? 'bg-red-400'   :
    days <= 14  ? 'bg-amber-400' :
                  'bg-sage-400'

  const daysLabel =
    !isPending         ? null :
    days < 0           ? 'Overdue'  :
    days === 0         ? 'Today'    :
    days === 1         ? '1 day'    :
                         `${days} days`

  const daysColor =
    days < 0   ? 'text-red-600 bg-red-50 border-red-200'       :
    days <= 7  ? 'text-red-600 bg-red-50 border-red-200'       :
    days <= 14 ? 'text-amber-700 bg-amber-50 border-amber-200' :
                 'text-sage-700 bg-sage-50 border-sage-200'

  function handleMarkFiled(e: React.MouseEvent) {
    e.stopPropagation()
    onMark(deadline.id, 'filed')
  }

  function handleExtendClick(e: React.MouseEvent) {
    e.stopPropagation()
    setShowExtend(v => !v)
  }

  function handleConfirmExtend(e: React.MouseEvent) {
    e.stopPropagation()
    if (!extDate) return
    onMark(deadline.id, 'extended', extDate)
    setShowExtend(false)
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelectClient}
        onKeyDown={e => { if (e.key === 'Enter') onSelectClient() }}
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

        {/* Status badge (filed/extended) */}
        {!isPending && (
          <span className={cn(
            'inline-flex items-center text-[11px] font-[500] px-2 py-1 rounded-full border shrink-0',
            deadline.status === 'filed'
              ? 'bg-sage-50 text-sage-700 border-sage-200'
              : 'bg-beige-100 text-ink-mid border-beige-200',
          )}>
            {deadline.status.charAt(0).toUpperCase() + deadline.status.slice(1)}
          </span>
        )}

        {/* Action buttons — pending rows only */}
        {isPending && (
          <div
            className="flex items-center gap-1.5 shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={isMarking}
              onClick={handleMarkFiled}
              title="Mark as filed"
              className="inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-[450] rounded-[7px] border border-sage-200 bg-sage-50 text-sage-700 hover:bg-sage-100 hover:border-sage-300 transition-colors disabled:opacity-50"
            >
              {isMarking
                ? <Loader2 size={11} className="animate-spin" />
                : <CheckCircle size={11} strokeWidth={2} />
              }
              Filed
            </button>
            <button
              type="button"
              disabled={isMarking}
              onClick={handleExtendClick}
              title="Mark as extended"
              className={cn(
                'inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-[450] rounded-[7px] border transition-colors disabled:opacity-50',
                showExtend
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-beige-200 bg-white text-ink-mid hover:text-ink hover:border-beige-300',
              )}
            >
              <CalendarClock size={11} strokeWidth={1.75} />
              Extend
            </button>
          </div>
        )}
      </div>

      {/* Extend date picker — inline below the row */}
      {showExtend && isPending && (
        <div
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-50/60 border-t border-amber-100"
          onClick={e => e.stopPropagation()}
        >
          <span className="text-[12px] text-ink-mid font-[450] shrink-0">Extension due date:</span>
          <input
            type="date"
            value={extDate}
            onChange={e => setExtDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="h-7 px-2 text-[12.5px] text-ink border border-beige-200 rounded-[7px] outline-none focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-colors"
          />
          <button
            type="button"
            disabled={!extDate || isMarking}
            onClick={handleConfirmExtend}
            className="inline-flex items-center h-7 px-3 text-[12px] font-[450] bg-amber-600 text-white rounded-[7px] hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMarking ? <Loader2 size={11} className="animate-spin" /> : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setShowExtend(false) }}
            className="text-[12px] text-ink-soft hover:text-ink transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
