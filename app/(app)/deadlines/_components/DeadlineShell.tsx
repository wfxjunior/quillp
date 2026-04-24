'use client'

/**
 * DeadlineShell — toggles between List and Calendar views.
 * Owns local deadlines state so rows can be updated optimistically.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { List, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/NotificationToast'
import { DeadlineListView }     from './DeadlineListView'
import { DeadlineCalendarView } from './DeadlineCalendarView'
import type { DeadlineWithClient } from '../page'

interface DeadlineShellProps {
  deadlines: DeadlineWithClient[]
}

type View = 'list' | 'calendar'

export function DeadlineShell({ deadlines: initialDeadlines }: DeadlineShellProps) {
  const router = useRouter()
  const { show: toast } = useToast()
  const [view,      setView]      = useState<View>('list')
  const [deadlines, setDeadlines] = useState<DeadlineWithClient[]>(initialDeadlines)
  const [marking,   setMarking]   = useState<Record<string, boolean>>({})

  function openClient(clientId: string) {
    router.push(`/clients/${clientId}`)
  }

  async function handleMark(
    id:                string,
    status:            'filed' | 'extended',
    extension_due_date?: string,
  ) {
    setMarking(m => ({ ...m, [id]: true }))
    try {
      const res = await fetch(`/api/deadlines/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status, extension_due_date }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        toast({ variant: 'error', message: json.error ?? 'Update failed.' })
        return
      }

      setDeadlines(prev => prev.map(d =>
        d.id === id
          ? { ...d, status, extension_due_date: extension_due_date ?? d.extension_due_date }
          : d,
      ))

      toast({
        variant: 'success',
        message: status === 'filed' ? 'Deadline marked as filed.' : 'Deadline marked as extended.',
      })
    } finally {
      setMarking(m => ({ ...m, [id]: false }))
    }
  }

  const pendingCount = deadlines.filter(d => d.status === 'pending').length

  return (
    <div className="px-6 py-6 max-w-[1000px] mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-[32px] font-medium text-ink tracking-[-0.5px] leading-tight">
            Deadlines
          </h1>
          <p className="text-[13.5px] text-ink-soft font-light mt-1">
            {pendingCount} pending filing{pendingCount !== 1 ? 's' : ''}
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
        <DeadlineListView
          deadlines={deadlines}
          marking={marking}
          onSelectClient={openClient}
          onMark={handleMark}
        />
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
