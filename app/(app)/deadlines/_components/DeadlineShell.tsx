'use client'

/**
 * DeadlineShell — toggles between List and Calendar views.
 * Also owns the client detail side panel (slide-over).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { List, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DeadlineListView }     from './DeadlineListView'
import { DeadlineCalendarView } from './DeadlineCalendarView'
import type { DeadlineWithClient } from '../page'

interface DeadlineShellProps {
  deadlines: DeadlineWithClient[]
}

type View = 'list' | 'calendar'

export function DeadlineShell({ deadlines }: DeadlineShellProps) {
  const router   = useRouter()
  const [view, setView] = useState<View>('list')

  function openClient(clientId: string) {
    router.push(`/clients/${clientId}`)
  }

  return (
    <div className="px-6 py-6 max-w-[1000px] mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-[32px] font-medium text-ink tracking-[-0.5px] leading-tight">
            Deadlines
          </h1>
          <p className="text-[13.5px] text-ink-soft font-light mt-1">
            {deadlines.filter(d => d.status === 'pending').length} pending filing
            {deadlines.filter(d => d.status === 'pending').length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-beige-100 rounded-[10px] p-1 gap-0.5">
          <ViewToggleBtn
            active={view === 'list'}
            onClick={() => setView('list')}
            icon={<List size={14} strokeWidth={1.75} />}
            label="List"
          />
          <ViewToggleBtn
            active={view === 'calendar'}
            onClick={() => setView('calendar')}
            icon={<CalendarDays size={14} strokeWidth={1.75} />}
            label="Calendar"
          />
        </div>
      </div>

      {/* ── View content ── */}
      {view === 'list' ? (
        <DeadlineListView deadlines={deadlines} onSelectClient={openClient} />
      ) : (
        <DeadlineCalendarView deadlines={deadlines} onSelectClient={openClient} />
      )}
    </div>
  )
}

function ViewToggleBtn({
  active, onClick, icon, label,
}: {
  active:  boolean
  onClick: () => void
  icon:    React.ReactNode
  label:   string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-[450] rounded-[8px] transition-all',
        active
          ? 'bg-white text-ink shadow-sm'
          : 'text-ink-soft hover:text-ink-mid',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
