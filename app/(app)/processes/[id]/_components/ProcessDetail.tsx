'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, User, CalendarDays, CheckCircle2, Circle, Loader2,
  Clock, ChevronDown, AlertCircle, FileText, CheckCircle, AlertTriangle,
} from 'lucide-react'
import { StatusBadge, type StatusBadgeVariant } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/NotificationToast'
import { cn } from '@/lib/utils'
import type { ProcessStatus, StepStatus, StepAssignee, TriggerEvent, TaxDocumentStatus } from '@/types'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface ProcessData {
  id:           string
  title:        string
  status:       ProcessStatus
  current_step: number
  total_steps:  number
  due_date:     string | null
  notes:        string | null
  created_at:   string
  completed_at: string | null
  client_id:    string
  services: {
    name:            string
    description:     string | null
    price:           number | null
    price_type:      string | null
    estimated_weeks: number | null
  } | null
  clients: {
    id:           string
    name:         string
    email:        string
    phone:        string | null
    portal_token: string
  } | null
}

interface StepData {
  id:            string
  process_id:    string
  step_order:    number
  title:         string
  description:   string | null
  status:        StepStatus
  assignee:      StepAssignee
  trigger_event: TriggerEvent
  document_id:   string | null
  completed_at:  string | null
}

interface TaxDocumentItem {
  id:            string
  document_type: string
  required:      boolean
  status:        TaxDocumentStatus
  file_name:     string | null
  uploaded_at:   string | null
}

interface TimelineEvent {
  id:         string
  type:       string
  title:      string
  detail:     string | null
  created_at: string
}

// ─────────────────────────────────────────
// Config
// ─────────────────────────────────────────

const PROCESS_STATUSES: ProcessStatus[] = [
  'pending', 'engaged', 'collecting', 'in_review', 'client_review', 'filing', 'complete', 'archived',
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

const ASSIGNEE_LABEL: Record<StepAssignee, string> = {
  cpa:    'CPA',
  client: 'Client',
  system: 'System',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function relativeTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 60)    return `${diff}m ago`
  if (diff < 1440)  return `${Math.floor(diff / 60)}h ago`
  return fmtDate(iso)
}

// ─────────────────────────────────────────
// Step row
// ─────────────────────────────────────────

function StepRow({
  step, processId, onUpdated,
}: {
  step:      StepData
  processId: string
  onUpdated: (updated: StepData) => void
}) {
  const { show: toast } = useToast()
  const [loading, setLoading] = useState(false)

  async function toggleComplete() {
    const newStatus: StepStatus = step.status === 'completed' ? 'pending' : 'completed'
    setLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}/step`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_id: step.id, status: newStatus }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Failed to update step')
      }
      const { data } = await res.json() as { data: StepData }
      onUpdated(data)
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setLoading(false)
    }
  }

  const isComplete = step.status === 'completed'
  const isBlocked  = step.status === 'blocked'

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 border-b border-beige-100 last:border-0',
        'hover:bg-beige-50/50 transition-colors'
      )}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={toggleComplete}
        disabled={loading}
        className={cn(
          'shrink-0 mt-0.5 h-5 w-5 flex items-center justify-center rounded-full transition-colors',
          'border focus:outline-none',
          isComplete
            ? 'bg-sage-400 border-sage-400 text-white'
            : 'border-beige-300 hover:border-sage-400 text-transparent'
        )}
      >
        {loading ? (
          <Loader2 size={11} className="animate-spin text-ink-soft" />
        ) : isComplete ? (
          <CheckCircle2 size={14} strokeWidth={2.5} />
        ) : (
          <Circle size={14} strokeWidth={1.5} className="text-beige-300" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn(
            'text-[13px] font-[450]',
            isComplete ? 'text-ink-soft line-through' : 'text-ink'
          )}>
            {step.title}
          </p>
          {isBlocked && (
            <span className="inline-flex items-center gap-1 text-[11px] font-[450] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              <AlertCircle size={10} strokeWidth={2} />
              Blocked
            </span>
          )}
          <span className="text-[11px] text-ink-soft/60 bg-beige-50 border-[0.5px] border-beige-200 px-2 py-0.5 rounded-full">
            {ASSIGNEE_LABEL[step.assignee]}
          </span>
        </div>
        {step.description && (
          <p className="text-[12px] text-ink-soft font-light mt-0.5 leading-relaxed">{step.description}</p>
        )}
        {isComplete && step.completed_at && (
          <p className="text-[11px] text-ink-soft/50 mt-1">
            Completed {relativeTime(step.completed_at)}
          </p>
        )}
      </div>

      {/* Step order */}
      <span className="text-[11px] text-ink-soft/40 tabular-nums shrink-0 mt-0.5">
        {step.step_order}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────
// Tax documents panel
// ─────────────────────────────────────────

const DOC_STATUS_CONFIG: Record<TaxDocumentStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  missing:   { label: 'Missing',   icon: <AlertTriangle size={11} strokeWidth={2} />, cls: 'text-red-600 bg-red-50 border-red-200' },
  requested: { label: 'Requested', icon: <Clock        size={11} strokeWidth={2} />, cls: 'text-amber-600 bg-amber-50 border-amber-200' },
  received:  { label: 'Received',  icon: <CheckCircle  size={11} strokeWidth={2} />, cls: 'text-green-700 bg-green-50 border-green-200' },
}

function TaxDocumentPanel({ documents }: { documents: TaxDocumentItem[] }) {
  if (documents.length === 0) return null

  return (
    <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-soft mb-3">
        Required Documents
      </p>
      <div className="flex flex-col gap-2">
        {documents.map(doc => {
          const cfg = DOC_STATUS_CONFIG[doc.status]
          return (
            <div key={doc.id} className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={12} strokeWidth={1.75} className="text-ink-soft shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-[450] text-ink truncate">{doc.document_type}</p>
                  {doc.status === 'received' && doc.file_name && (
                    <p className="text-[11px] text-ink-soft font-light truncate">{doc.file_name}</p>
                  )}
                </div>
              </div>
              <span className={cn(
                'inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full text-[10.5px] font-[500] border',
                cfg.cls
              )}>
                {cfg.icon}
                {cfg.label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-beige-100 flex items-center justify-between">
        <span className="text-[11px] text-ink-soft font-light">
          {documents.filter(d => d.status === 'received').length} / {documents.length} received
        </span>
        {documents.some(d => d.required && d.status === 'missing') && (
          <span className="text-[11px] font-[500] text-red-600">
            {documents.filter(d => d.required && d.status === 'missing').length} required missing
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Status selector
// ─────────────────────────────────────────

function StatusSelector({
  processId, currentStatus, onUpdated,
}: {
  processId:     string
  currentStatus: ProcessStatus
  onUpdated:     (status: ProcessStatus) => void
}) {
  const { show: toast } = useToast()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSelect(status: ProcessStatus) {
    if (status === currentStatus) { setOpen(false); return }
    setLoading(true)
    setOpen(false)
    try {
      const res = await fetch(`/api/processes/${processId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Failed to update status')
      }
      onUpdated(status)
      toast({ variant: 'success', message: `Status updated to ${STATUS_BADGE[status].label}` })
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setLoading(false)
    }
  }

  const badge = STATUS_BADGE[currentStatus]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className={cn(
          'inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-[450] rounded-[8px]',
          'border transition-colors select-none disabled:opacity-60',
          'border-beige-200 bg-white text-ink-mid hover:bg-beige-50'
        )}
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <StatusBadge label={badge.label} variant={badge.variant} />
        )}
        <ChevronDown size={12} strokeWidth={2} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 bg-white border border-beige-200 rounded-[12px] shadow-lg z-20 py-1 min-w-[180px]">
          {PROCESS_STATUSES.map(s => {
            const b = STATUS_BADGE[s]
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleSelect(s)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-[450] hover:bg-beige-50 transition-colors text-left',
                  s === currentStatus && 'bg-beige-50'
                )}
              >
                <StatusBadge label={b.label} variant={b.variant} />
                {s === currentStatus && <span className="ml-auto text-[11px] text-ink-soft">Current</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// Main component
// ─────────────────────────────────────────

export function ProcessDetail({
  process, steps: initialSteps, timeline, documents,
}: {
  process:   ProcessData
  steps:     StepData[]
  timeline:  TimelineEvent[]
  documents: TaxDocumentItem[]
}) {
  const [status, setStatus] = useState<ProcessStatus>(process.status)
  const [steps,  setSteps]  = useState<StepData[]>(initialSteps)

  const completedCount = steps.filter(s => s.status === 'completed').length
  const progressPct    = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0

  function handleStepUpdated(updated: StepData) {
    setSteps(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  return (
    <div className="px-6 py-6 max-w-[1100px] mx-auto">
      {/* Back */}
      <Link
        href="/processes"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft hover:text-ink font-[450] transition-colors mb-5"
      >
        <ArrowLeft size={13} strokeWidth={2} />
        All processes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="font-serif text-[28px] font-medium text-ink tracking-[-0.4px] leading-tight truncate">
            {process.title}
          </h1>
          {process.services?.name && (
            <p className="text-[13px] text-ink-soft font-light mt-1">{process.services.name}</p>
          )}
        </div>
        <StatusSelector
          processId={process.id}
          currentStatus={status}
          onUpdated={setStatus}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Steps + progress */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Progress card */}
          <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-ink-soft">Progress</p>
              <span className="text-[13px] font-[500] text-ink tabular-nums">
                {completedCount} / {steps.length} steps
              </span>
            </div>
            <div className="h-2 bg-beige-100 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-sage-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[11.5px] text-ink-soft font-light">{progressPct}% complete</p>
          </div>

          {/* Steps list */}
          <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-beige-100">
              <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-ink-soft">Steps</p>
            </div>
            {steps.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-ink-soft font-light">No steps defined for this process.</p>
              </div>
            ) : (
              steps.map(step => (
                <StepRow
                  key={step.id}
                  step={step}
                  processId={process.id}
                  onUpdated={handleStepUpdated}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Meta + timeline */}
        <div className="flex flex-col gap-4">
          {/* Client info */}
          <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-soft mb-3">Client</p>
            {process.clients ? (
              <div className="flex flex-col gap-1.5">
                <Link
                  href={`/clients/${process.clients.id}`}
                  className="text-[13.5px] font-[500] text-ink hover:text-sage-600 transition-colors"
                >
                  {process.clients.name}
                </Link>
                <p className="text-[12.5px] text-ink-soft font-light">{process.clients.email}</p>
                {process.clients.phone && (
                  <p className="text-[12.5px] text-ink-soft font-light">{process.clients.phone}</p>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-ink-soft font-light">—</p>
            )}
          </div>

          {/* Process meta */}
          <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-soft mb-3">Details</p>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2">
                <CalendarDays size={13} strokeWidth={1.75} className="text-ink-soft mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] text-ink-soft font-light">Started</p>
                  <p className="text-[12.5px] text-ink">{fmtDate(process.created_at)}</p>
                </div>
              </div>
              {process.due_date && (
                <div className="flex items-start gap-2">
                  <Clock size={13} strokeWidth={1.75} className="text-ink-soft mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-ink-soft font-light">Due date</p>
                    <p className="text-[12.5px] text-ink">{fmtDate(process.due_date)}</p>
                  </div>
                </div>
              )}
              {process.completed_at && (
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={13} strokeWidth={1.75} className="text-sage-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-ink-soft font-light">Completed</p>
                    <p className="text-[12.5px] text-ink">{fmtDate(process.completed_at)}</p>
                  </div>
                </div>
              )}
              {process.services?.estimated_weeks && (
                <div className="flex items-start gap-2">
                  <User size={13} strokeWidth={1.75} className="text-ink-soft mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-ink-soft font-light">Est. duration</p>
                    <p className="text-[12.5px] text-ink">{process.services.estimated_weeks} weeks</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Required documents */}
          <TaxDocumentPanel documents={documents} />

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-soft mb-3">Activity</p>
              <div className="flex flex-col gap-3">
                {timeline.map(event => (
                  <div key={event.id} className="flex flex-col gap-0.5">
                    <p className="text-[12.5px] font-[450] text-ink leading-snug">{event.title}</p>
                    {event.detail && (
                      <p className="text-[11.5px] text-ink-soft font-light leading-snug">{event.detail}</p>
                    )}
                    <p className="text-[11px] text-ink-soft/50">{relativeTime(event.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
