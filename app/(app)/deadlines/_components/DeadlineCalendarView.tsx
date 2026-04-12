'use client'

/**
 * DeadlineCalendarView — monthly grid calendar.
 *
 * Each day shows colored dots for deadlines on that day.
 * Clicking a dot (or a day with deadlines) shows a popup card.
 * Navigation buttons: previous / next month.
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DeadlineWithClient } from '../page'

interface DeadlineCalendarViewProps {
  deadlines:      DeadlineWithClient[]
  onSelectClient: (clientId: string) => void
}

function getDaysRemaining(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due   = new Date(iso); due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
}

function urgencyColor(days: number): string {
  if (days < 0)   return 'bg-red-400'
  if (days <= 7)  return 'bg-red-400'
  if (days <= 14) return 'bg-amber-400'
  return 'bg-sage-400'
}

function isoDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function DeadlineCalendarView({ deadlines, onSelectClient }: DeadlineCalendarViewProps) {
  const today      = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())         // 0-indexed
  const [popup, setPopup] = useState<{ key: string; x: number; y: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Build date → deadlines map for fast lookup
  const deadlinesByDate = useMemo(() => {
    const map: Record<string, DeadlineWithClient[]> = {}
    for (const dl of deadlines) {
      const key = dl.due_date.slice(0, 10)    // "YYYY-MM-DD"
      if (!map[key]) map[key] = []
      map[key].push(dl)
    }
    return map
  }, [deadlines])

  // Close popup on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-popup]') && !target.closest('[data-day]')) {
        setPopup(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setPopup(null)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setPopup(null)
  }

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay()   // 0 = Sun
  const daysInMonth     = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  // Total cells = rows × 7; at least 35
  const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7

  type Cell = { key: string; day: number; isCurrentMonth: boolean; isToday: boolean }
  const cells: Cell[] = []

  for (let i = 0; i < totalCells; i++) {
    if (i < firstDayOfMonth) {
      const d   = daysInPrevMonth - firstDayOfMonth + i + 1
      const m   = month === 0 ? 11 : month - 1
      const y   = month === 0 ? year - 1 : year
      cells.push({ key: isoDateKey(y, m, d), day: d, isCurrentMonth: false, isToday: false })
    } else if (i >= firstDayOfMonth + daysInMonth) {
      const d   = i - firstDayOfMonth - daysInMonth + 1
      const m   = month === 11 ? 0 : month + 1
      const y   = month === 11 ? year + 1 : year
      cells.push({ key: isoDateKey(y, m, d), day: d, isCurrentMonth: false, isToday: false })
    } else {
      const d     = i - firstDayOfMonth + 1
      const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
      cells.push({ key: isoDateKey(year, month, d), day: d, isCurrentMonth: true, isToday })
    }
  }

  const popupDeadlines = popup ? (deadlinesByDate[popup.key] ?? []) : []

  return (
    <div className="relative">
      {/* ── Month nav ── */}
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={prevMonth}
          className="h-8 w-8 flex items-center justify-center rounded-[8px] border border-beige-200 bg-white hover:bg-beige-50 transition-colors"
        >
          <ChevronLeft size={14} strokeWidth={2} className="text-ink-mid" />
        </button>

        <h2 className="font-serif text-[20px] font-medium text-ink tracking-[-0.3px]">
          {MONTHS[month]} {year}
        </h2>

        <button
          type="button"
          onClick={nextMonth}
          className="h-8 w-8 flex items-center justify-center rounded-[8px] border border-beige-200 bg-white hover:bg-beige-50 transition-colors"
        >
          <ChevronRight size={14} strokeWidth={2} className="text-ink-mid" />
        </button>
      </div>

      {/* ── Calendar grid ── */}
      <div
        ref={gridRef}
        className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden"
      >
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-beige-100">
          {WEEKDAYS.map(wd => (
            <div key={wd} className="py-2 text-center text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-soft">
              {wd}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            const dls     = deadlinesByDate[cell.key] ?? []
            const hasDeadlines = dls.length > 0
            const isLast  = idx >= totalCells - 7
            const isRight = (idx + 1) % 7 === 0

            return (
              <div
                key={`${cell.key}-${idx}`}
                data-day
                onClick={e => {
                  if (!hasDeadlines) return
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  setPopup({ key: cell.key, x: rect.left, y: rect.bottom })
                }}
                className={cn(
                  'min-h-[80px] p-2 border-b border-r border-beige-100 relative',
                  !isLast && 'border-b',
                  isRight && 'border-r-0',
                  isLast  && 'border-b-0',
                  !cell.isCurrentMonth && 'bg-beige-50/50',
                  hasDeadlines && 'cursor-pointer hover:bg-beige-50 transition-colors',
                  popup?.key === cell.key && 'bg-beige-50',
                )}
              >
                {/* Day number */}
                <div className={cn(
                  'h-6 w-6 flex items-center justify-center rounded-full text-[12px] font-[450] mb-1',
                  cell.isToday       ? 'bg-ink text-white'   :
                  !cell.isCurrentMonth ? 'text-ink-soft/40' :
                                        'text-ink-mid',
                )}>
                  {cell.day}
                </div>

                {/* Deadline dots */}
                {hasDeadlines && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {dls.slice(0, 5).map(dl => {
                      const days = getDaysRemaining(dl.due_date)
                      return (
                        <div
                          key={dl.id}
                          title={`${dl.client_name} — ${dl.filing_type}`}
                          className={cn('h-2 w-2 rounded-full shrink-0', urgencyColor(days))}
                        />
                      )
                    })}
                    {dls.length > 5 && (
                      <span className="text-[9px] text-ink-soft font-medium">+{dls.length - 5}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Popup card ── */}
      {popup && popupDeadlines.length > 0 && (
        <PopupCard
          dateKey={popup.key}
          deadlines={popupDeadlines}
          onSelectClient={id => { setPopup(null); onSelectClient(id) }}
          onClose={() => setPopup(null)}
        />
      )}

      {/* ── Legend ── */}
      <div className="flex items-center gap-5 mt-4 justify-end">
        {[
          { color: 'bg-red-400',   label: '≤7 days / overdue' },
          { color: 'bg-amber-400', label: '≤14 days' },
          { color: 'bg-sage-400',  label: '15+ days' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn('h-2 w-2 rounded-full', color)} />
            <span className="text-[11.5px] text-ink-soft font-light">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Popup card
// ─────────────────────────────────────────

function PopupCard({
  dateKey, deadlines, onSelectClient, onClose,
}: {
  dateKey:        string
  deadlines:      DeadlineWithClient[]
  onSelectClient: (id: string) => void
  onClose:        () => void
}) {
  const formattedDate = fmtDate(dateKey)

  return (
    <div
      data-popup
      className="fixed z-50 bottom-0 right-0 m-6 w-80 bg-white border border-beige-200 rounded-[16px] shadow-xl overflow-hidden"
      style={{ maxHeight: '420px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-beige-100 bg-beige-50">
        <span className="text-[12.5px] font-[500] text-ink">{formattedDate}</span>
        <button
          type="button"
          onClick={onClose}
          className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-beige-100 transition-colors"
        >
          <X size={13} strokeWidth={2} className="text-ink-mid" />
        </button>
      </div>

      {/* Deadline list */}
      <div className="overflow-y-auto" style={{ maxHeight: '360px' }}>
        {deadlines.map(dl => {
          const days  = getDaysRemaining(dl.due_date)
          const color = urgencyColor(days)

          return (
            <button
              key={dl.id}
              type="button"
              onClick={() => onSelectClient(dl.client_id)}
              className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-beige-50 transition-colors border-b border-beige-100 last:border-0"
            >
              <div className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', color)} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-[500] text-ink truncate">{dl.client_name}</p>
                <p className="text-[11.5px] text-ink-soft font-light mt-0.5 truncate">{dl.filing_type}</p>
              </div>
              <div className="text-right shrink-0">
                {dl.status === 'pending' && (
                  <span className={cn(
                    'text-[10.5px] font-[500]',
                    days < 0    ? 'text-red-500' :
                    days <= 7   ? 'text-red-500' :
                    days <= 14  ? 'text-amber-600' :
                                  'text-sage-600',
                  )}>
                    {days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d`}
                  </span>
                )}
                {dl.status !== 'pending' && (
                  <span className="text-[10.5px] text-ink-soft capitalize">{dl.status}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
