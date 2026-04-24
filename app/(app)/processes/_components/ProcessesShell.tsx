'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, ArrowRight, X, Loader2, CalendarDays } from 'lucide-react'
import { useToast } from '@/components/ui/NotificationToast'
import { StatusBadge, type StatusBadgeVariant } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/utils'
import type { ProcessStatus } from '@/types'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface ProcessRow {
  id:           string
  title:        string
  status:       ProcessStatus
  current_step: number
  total_steps:  number
  due_date:     string | null
  created_at:   string
  clients:      { name: string; email: string } | null
  services:     { name: string; price_type: string | null } | null
}

interface ClientOption {
  id:    string
  name:  string
  email: string
}

interface ServiceOption {
  id:    string
  name:  string
  steps: { order: number; title: string }[]
}

interface ProcessesShellProps {
  initialProcesses: ProcessRow[]
  clients:          ClientOption[]
  services:         ServiceOption[]
}

// ─────────────────────────────────────────
// Config
// ─────────────────────────────────────────

type FilterTab = 'all' | ProcessStatus

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',           label: 'All'          },
  { key: 'engaged',       label: 'Engaged'      },
  { key: 'collecting',    label: 'Collecting'   },
  { key: 'in_review',     label: 'In Review'    },
  { key: 'client_review', label: 'Client Review'},
  { key: 'filing',        label: 'Filing'       },
  { key: 'complete',      label: 'Complete'     },
]

const STATUS_BADGE: Record<ProcessStatus, { label: string; variant: StatusBadgeVariant }> = {
  pending:       { label: 'Pending',        variant: 'beige' },
  engaged:       { label: 'Engaged',        variant: 'ink'   },
  collecting:    { label: 'Collecting',     variant: 'amber' },
  in_review:     { label: 'In Review',      variant: 'amber' },
  client_review: { label: 'Client Review',  variant: 'amber' },
  filing:        { label: 'Filing',         variant: 'green' },
  complete:      { label: 'Complete',       variant: 'green' },
  archived:      { label: 'Archived',       variant: 'beige' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function relativeDate(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7)  return `${diff}d ago`
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`
  return fmtDate(iso)
}

// ─────────────────────────────────────────
// Progress bar
// ─────────────────────────────────────────

function StepProgress({ current, total }: { current: number; total: number }) {
  if (total === 0) return <span className="text-[12px] text-ink-soft">—</span>
  const pct = Math.round((current / total) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-beige-100 rounded-full overflow-hidden w-16">
        <div
          className="h-full bg-sage-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11.5px] text-ink-soft tabular-nums">{current}/{total}</span>
    </div>
  )
}

// ─────────────────────────────────────────
// New process modal
// ─────────────────────────────────────────

function NewProcessModal({
  clients, services, onClose, onCreated,
}: {
  clients:   ClientOption[]
  services:  ServiceOption[]
  onClose:   () => void
  onCreated: (row: ProcessRow) => void
}) {
  const { show: toast } = useToast()
  const overlayRef = useRef<HTMLDivElement>(null)
  const [clientId,  setClientId]  = useState('')
  const [serviceId, setServiceId] = useState('')
  const [dueDate,   setDueDate]   = useState('')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const inputCls = cn(
    'w-full h-9 px-3 text-[13px] text-ink placeholder:text-ink-soft',
    'bg-white border-[0.5px] border-beige-300 rounded-[8px]',
    'outline-none focus:border-sage-400 transition-colors'
  )

  async function handleCreate() {
    if (!clientId || !serviceId) {
      toast({ variant: 'error', message: 'Select a client and service' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, service_id: serviceId, due_date: dueDate || undefined }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Failed to create process')
      }
      const { data } = await res.json() as { data: ProcessRow & { steps?: unknown[] } }
      onCreated(data)
      toast({ variant: 'success', message: 'Process started' })
      onClose()
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]" />
      <div className="relative z-10 bg-white rounded-[20px] shadow-2xl border border-beige-200 w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-beige-100">
          <h2 className="text-[15px] font-[600] text-ink">Start new process</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-full text-ink-soft hover:text-ink hover:bg-beige-100 transition-colors"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-[11.5px] font-[500] text-ink-mid mb-1">Client *</label>
            <select
              className={cn(inputCls, 'cursor-pointer')}
              value={clientId}
              onChange={e => setClientId(e.target.value)}
            >
              <option value="">Select client…</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11.5px] font-[500] text-ink-mid mb-1">Service *</label>
            <select
              className={cn(inputCls, 'cursor-pointer')}
              value={serviceId}
              onChange={e => setServiceId(e.target.value)}
            >
              <option value="">Select service…</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.steps.length > 0 ? ` (${s.steps.length} steps)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11.5px] font-[500] text-ink-mid mb-1">Due date (optional)</label>
            <div className="relative">
              <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" strokeWidth={1.75} />
              <input
                type="date"
                className={cn(inputCls, 'pl-8')}
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-beige-100 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 h-10 bg-ink text-white text-[13.5px] font-[450] rounded-[10px] hover:bg-ink/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Starting…' : 'Start process'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 border border-beige-200 text-[13.5px] font-[450] text-ink-mid rounded-[10px] hover:bg-beige-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Main shell
// ─────────────────────────────────────────

export function ProcessesShell({ initialProcesses, clients, services }: ProcessesShellProps) {
  const [processes, setProcesses] = useState<ProcessRow[]>(initialProcesses)
  const [search,    setSearch]    = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = useMemo(() => {
    let rows = activeTab === 'all' ? processes : processes.filter(p => p.status === activeTab)
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.clients?.name.toLowerCase().includes(q) ||
        p.services?.name.toLowerCase().includes(q)
      )
    }
    return rows
  }, [processes, activeTab, search])

  function handleCreated(row: ProcessRow) {
    setProcesses(prev => [row, ...prev])
  }

  const activeCount = (tab: FilterTab) =>
    tab === 'all' ? processes.length : processes.filter(p => p.status === tab).length

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-[32px] font-medium text-ink tracking-[-0.5px] leading-tight">
            Processes
          </h1>
          <p className="text-[13.5px] text-ink-soft font-light mt-1">
            {processes.length} active {processes.length === 1 ? 'process' : 'processes'}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 bg-sage-400 text-white text-[13px] font-[450] rounded-[8px] hover:bg-sage-600 transition-colors select-none"
        >
          <Plus size={14} strokeWidth={2} />
          New process
        </button>
      </div>

      {/* Search + tabs */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-4">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" strokeWidth={1.75} />
          <input
            type="search"
            placeholder="Search processes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={cn(
              'w-full h-9 pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-soft',
              'bg-white border-[0.5px] border-beige-300 rounded-[8px]',
              'outline-none focus:border-sage-400 transition-colors'
            )}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {TABS.map(tab => {
            const count = activeCount(tab.key)
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'h-7 px-3 text-[12px] font-[450] rounded-[6px] transition-colors duration-150 select-none',
                  activeTab === tab.key
                    ? 'bg-ink text-white'
                    : 'text-ink-soft hover:text-ink hover:bg-beige-100 bg-white border-[0.5px] border-beige-200',
                )}
              >
                {tab.label}
                <span className={cn('ml-1.5 text-[10.5px]', activeTab === tab.key ? 'text-white/60' : 'text-ink-soft/60')}>
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
            {processes.length === 0 ? (
              <div>
                <p className="text-[14px] font-[450] text-ink mb-1">No processes yet</p>
                <p className="text-[13px] text-ink-soft font-light">
                  Start a process by assigning a service to a client.
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-ink-soft font-light">No processes match your search.</p>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-beige-100">
                {['Process', 'Client', 'Status', 'Progress', 'Due date', 'Started', ''].map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      'px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft',
                      i === 0 ? 'text-left' : i === 2 || i === 3 ? 'text-left' : i === 6 ? 'text-right' : 'text-left',
                      i >= 3 && i <= 5 ? 'hidden md:table-cell' : '',
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const badge = STATUS_BADGE[p.status]
                return (
                  <tr
                    key={p.id}
                    className="border-b border-beige-100 last:border-0 hover:bg-beige-50 transition-colors duration-100"
                  >
                    {/* Title + service */}
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-[450] text-ink truncate max-w-[220px]">{p.title}</p>
                      {p.services?.name && (
                        <p className="text-[11.5px] text-ink-soft font-light mt-0.5">{p.services.name}</p>
                      )}
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3">
                      <p className="text-[12.5px] text-ink-mid">{p.clients?.name ?? '—'}</p>
                      {p.clients?.email && (
                        <p className="text-[11px] text-ink-soft font-light">{p.clients.email}</p>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge label={badge.label} variant={badge.variant} />
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <StepProgress current={p.current_step} total={p.total_steps} />
                    </td>

                    {/* Due date */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      {p.due_date ? (
                        <span className="text-[12.5px] text-ink-soft">{fmtDate(p.due_date)}</span>
                      ) : (
                        <span className="text-[12.5px] text-ink-soft/40">—</span>
                      )}
                    </td>

                    {/* Started */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-[12.5px] text-ink-soft">{relativeDate(p.created_at)}</span>
                    </td>

                    {/* View link */}
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/processes/${p.id}`}
                        className="inline-flex items-center gap-1 text-[12px] font-[450] text-ink-mid hover:text-ink transition-colors"
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
        <p className="text-[12px] text-ink-soft font-light mt-3">
          {filtered.length} {filtered.length === 1 ? 'process' : 'processes'}
          {search && ` matching "${search}"`}
        </p>
      )}

      {modalOpen && (
        <NewProcessModal
          clients={clients}
          services={services}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
