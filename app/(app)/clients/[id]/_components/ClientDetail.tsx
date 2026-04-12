'use client'

/**
 * ClientDetail — 5-tab client detail view
 * blueprint-part1.md §1.3
 *
 * Tabs: Full Flow / Documents / Tax Checklist / Invoices / Timeline
 * Fixed ActionBar at bottom with stage-contextual actions.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Copy, Check, ExternalLink, Plus, Send,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PipelineTracker } from '@/components/ui/PipelineTracker'
import { DocumentRow }     from '@/components/ui/DocumentRow'
import { ChecklistRow }    from '@/components/ui/ChecklistRow'
import { InvoiceRow }      from '@/components/ui/InvoiceRow'
import { TimelineItem }    from '@/components/ui/TimelineItem'
import { useToast }        from '@/components/ui/NotificationToast'
import { cn }              from '@/lib/utils'
import type {
  Client, Document, TaxDocument, Invoice, TimelineEvent,
  PipelineStage, TaxDocumentStatus,
} from '@/types'

// ─────────────────────────────────────────
// Types + config
// ─────────────────────────────────────────

type TabKey = 'flow' | 'documents' | 'checklist' | 'invoices' | 'timeline'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'flow',      label: 'Full Flow'    },
  { key: 'documents', label: 'Documents'    },
  { key: 'checklist', label: 'Tax Checklist'},
  { key: 'invoices',  label: 'Invoices'     },
  { key: 'timeline',  label: 'Timeline'     },
]

const STAGE_ACTIONS: Record<PipelineStage, { hint: string; primary: string; secondary?: string }> = {
  engaged:        { hint: 'Send onboarding materials to get started.',  primary: 'Send Portal Link',     secondary: 'Send Engagement Letter' },
  onboarding:     { hint: 'Waiting for client to complete portal.',     primary: 'Remind Client',        secondary: 'View Portal'            },
  docs_received:  { hint: 'Documents received — begin work.',           primary: 'Move to In Progress'                                       },
  in_progress:    { hint: 'Work in progress. Send for review when ready.', primary: 'Send for Review'                                        },
  review:         { hint: 'Final review — approve and file.',           primary: 'Mark Filed & Invoiced'                                     },
  filed_invoiced: { hint: 'Engagement complete.',                       primary: 'Archive Client'                                            },
}

const SERVICE_LABELS: Record<string, string> = {
  '1040': 'Individual (1040)', '1120-S': 'S-Corp (1120-S)', '1065': 'Partnership (1065)',
  '1120': 'C-Corp (1120)', '990': 'Non-Profit (990)', bookkeeping: 'Bookkeeping',
  payroll: 'Payroll', tax_planning: 'Tax Planning', sales_tax: 'Sales Tax',
  irs_representation: 'IRS Representation',
}

const ENTITY_LABELS: Record<string, string> = {
  individual: 'Individual', s_corp: 'S-Corp', llc: 'LLC',
  partnership: 'Partnership', c_corp: 'C-Corp',
}

function formatFee(amount: number | null, structure: string | null): string {
  if (!amount) return '—'
  const fmt = `$${amount.toLocaleString()}`
  const sfx = structure === 'flat_fee' ? ' (flat)' : structure === 'hourly' ? '/hr' : structure === 'retainer' ? '/mo' : ''
  return fmt + sfx
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────

interface ClientDetailProps {
  client:         Client
  documents:      Document[]
  taxDocuments:   TaxDocument[]
  invoices:       Invoice[]
  timelineEvents: TimelineEvent[]
  firmId:         string
  userId:         string
  appUrl:         string
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────

export function ClientDetail({
  client:         initialClient,
  documents:      initialDocuments,
  taxDocuments:   initialTaxDocs,
  invoices:       initialInvoices,
  timelineEvents: initialTimeline,
  userId,
  appUrl,
}: ClientDetailProps) {
  const { show: toast } = useToast()
  const supabase  = createClient()

  // ── State ──
  const [activeTab,    setActiveTab]    = useState<TabKey>('flow')
  const [client,       setClient]       = useState(initialClient)
  const [documents]    = useState(initialDocuments)
  const [taxDocs,      setTaxDocs]      = useState(initialTaxDocs)
  const [invoices]     = useState(initialInvoices)
  const [timeline,     setTimeline]     = useState(initialTimeline)
  const [notes,        setNotes]        = useState(client.internal_notes ?? '')
  const [copied,       setCopied]       = useState(false)
  const [noteText,     setNoteText]     = useState('')
  const [savingNote,   setSavingNote]   = useState(false)

  // Debounce notes auto-save
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Helpers ──

  const portalUrl = `${appUrl}/portal/${client.portal_token}`

  function addTimelineEvent(event: TimelineEvent) {
    setTimeline(prev => [event, ...prev])
  }

  // ── Stage advancement ──

  async function handleStageChange(newStage: PipelineStage) {
    const oldStage = client.pipeline_stage
    if (newStage === oldStage) return

    // Optimistic update
    setClient(c => ({ ...c, pipeline_stage: newStage }))

    const { error } = await supabase
      .from('clients')
      .update({ pipeline_stage: newStage })
      .eq('id', client.id)

    if (error) {
      setClient(c => ({ ...c, pipeline_stage: oldStage }))
      toast({ variant: 'error', message: 'Failed to update stage.' })
      return
    }

    // Log timeline event
    const stageLabels: Record<PipelineStage, string> = {
      engaged: 'Engaged', onboarding: 'Onboarding', docs_received: 'Docs Received',
      in_progress: 'In Progress', review: 'Review', filed_invoiced: 'Filed & Invoiced',
    }
    const { data: event } = await supabase
      .from('timeline_events')
      .insert({
        client_id:  client.id,
        type:       'stage_change',
        title:      `Stage changed to ${stageLabels[newStage]}`,
        detail:     `From ${stageLabels[oldStage]}`,
        created_by: userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (event) addTimelineEvent(event as TimelineEvent)
    toast({ variant: 'success', message: `Stage updated to ${stageLabels[newStage]}` })
  }

  // ── Tax document toggle ──

  async function handleTaxDocToggle(taxDoc: TaxDocument) {
    const newStatus: TaxDocumentStatus = taxDoc.status === 'received' ? 'missing' : 'received'
    const oldStatus = taxDoc.status

    // Optimistic update
    setTaxDocs(prev =>
      prev.map(d => d.id === taxDoc.id ? { ...d, status: newStatus } : d)
    )

    const { error } = await supabase
      .from('tax_documents')
      .update({
        status:      newStatus,
        uploaded_at: newStatus === 'received' ? new Date().toISOString() : null,
        uploaded_by: newStatus === 'received' ? 'cpa' : null,
      })
      .eq('id', taxDoc.id)

    if (error) {
      setTaxDocs(prev =>
        prev.map(d => d.id === taxDoc.id ? { ...d, status: oldStatus } : d)
      )
      toast({ variant: 'error', message: 'Failed to update document status.' })
      return
    }

    if (newStatus === 'received') {
      const { data: event } = await supabase
        .from('timeline_events')
        .insert({
          client_id:  client.id,
          type:       'file_uploaded',
          title:      `${taxDoc.document_type} marked received`,
          detail:     null,
          created_by: userId,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (event) addTimelineEvent(event as TimelineEvent)
    }
  }

  // ── Internal notes auto-save (800ms debounce) ──

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value)
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(async () => {
      await supabase
        .from('clients')
        .update({ internal_notes: value })
        .eq('id', client.id)
    }, 800)
  }, [client.id, supabase])

  useEffect(() => () => {
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
  }, [])

  // ── Copy portal link ──

  function handleCopyPortal() {
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Log timeline note ──

  async function handleLogNote(e: React.FormEvent) {
    e.preventDefault()
    const text = noteText.trim()
    if (!text) return
    setSavingNote(true)

    const { data: event, error } = await supabase
      .from('timeline_events')
      .insert({
        client_id:  client.id,
        type:       'note',
        title:      text,
        detail:     null,
        created_by: userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    setSavingNote(false)
    if (error) {
      toast({ variant: 'error', message: 'Failed to log note.' })
      return
    }
    if (event) addTimelineEvent(event as TimelineEvent)
    setNoteText('')
    toast({ variant: 'success', message: 'Note logged.' })
  }

  // ── ActionBar primary action handler ──

  async function handlePrimaryAction() {
    const stage = client.pipeline_stage
    if (stage === 'engaged') {
      handleCopyPortal()
      toast({ variant: 'success', message: 'Portal link copied!' })
    } else if (stage === 'onboarding') {
      toast({ variant: 'success', message: 'Reminder sent.' })
    } else if (stage === 'docs_received') {
      await handleStageChange('in_progress')
    } else if (stage === 'in_progress') {
      await handleStageChange('review')
    } else if (stage === 'review') {
      await handleStageChange('filed_invoiced')
    } else if (stage === 'filed_invoiced') {
      toast({ variant: 'success', message: 'Client archiving coming soon.' })
    }
  }

  // ── Render helpers ──

  const stageConfig   = STAGE_ACTIONS[client.pipeline_stage]
  const receivedCount = taxDocs.filter(d => d.status === 'received').length
  // §13.7 — disable email-dependent actions when client has no email
  const hasEmail      = !!client.email
  const noEmailTip    = 'Add a client email address to enable this action'

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto pb-28">
      {/* Page header */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[28px] font-medium text-ink tracking-[-0.5px] leading-tight">
              {client.name}
            </h1>
            <p className="text-[13px] text-ink-soft font-light mt-0.5">
              {ENTITY_LABELS[client.entity_type] ?? client.entity_type}
              {client.email && ` · ${client.email}`}
              {client.phone && ` · ${client.phone}`}
            </p>
          </div>

          {/* Portal link button */}
          <button
            type="button"
            onClick={handleCopyPortal}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-[450]',
              'border-[0.5px] border-beige-300 rounded-[8px] bg-white',
              'text-ink-mid hover:text-ink hover:border-beige-400 transition-colors duration-150',
              'select-none shrink-0',
            )}
          >
            {copied ? <Check size={12} strokeWidth={2} className="text-sage-400" /> : <Copy size={12} strokeWidth={1.75} />}
            {copied ? 'Copied!' : 'Copy Portal Link'}
          </button>
        </div>

        {/* Pipeline tracker */}
        <div className="mt-4">
          <PipelineTracker
            currentStage={client.pipeline_stage}
            onStageChange={handleStageChange}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-beige-200 mb-5 -mx-0">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'h-9 px-4 text-[13px] font-[450] transition-colors duration-150 select-none',
              'border-b-[1.5px] -mb-px',
              activeTab === tab.key
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-soft hover:text-ink',
            )}
          >
            {tab.label}
            {tab.key === 'checklist' && taxDocs.length > 0 && (
              <span className={cn(
                'ml-1.5 text-[11px]',
                activeTab === tab.key ? 'text-ink/50' : 'text-ink-soft/50',
              )}>
                {receivedCount}/{taxDocs.length}
              </span>
            )}
            {tab.key === 'invoices' && invoices.length > 0 && (
              <span className={cn(
                'ml-1.5 text-[11px]',
                activeTab === tab.key ? 'text-ink/50' : 'text-ink-soft/50',
              )}>
                {invoices.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Full Flow tab ── */}
      {activeTab === 'flow' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Documents panel */}
          <Panel
            title="Documents"
            count={documents.length}
            action={
              <a
                href={`/clients/${client.id}/documents/new`}
                className="inline-flex items-center gap-1 text-[12px] font-[450] text-sage-500 hover:text-sage-600 transition-colors"
              >
                <Plus size={12} strokeWidth={2} />
                Generate
              </a>
            }
          >
            {documents.length === 0 ? (
              <EmptyState text="No documents yet." />
            ) : (
              documents.slice(0, 4).map(doc => (
                <DocumentRow
                  key={doc.id}
                  title={doc.title}
                  type={doc.type}
                  status={doc.status}
                  meta={formatDate(doc.created_at)}
                  action={
                    doc.status === 'draft'
                      ? { label: 'Send', onClick: () => toast({ variant: 'success', message: 'Sending coming soon.' }), disabled: !hasEmail, disabledTitle: noEmailTip }
                      : doc.status === 'sent' || doc.status === 'awaiting_signature'
                      ? { label: 'Remind', onClick: () => toast({ variant: 'success', message: 'Reminder sent.' }), disabled: !hasEmail, disabledTitle: noEmailTip }
                      : undefined
                  }
                />
              ))
            )}
            {documents.length > 4 && (
              <ViewAll onClick={() => setActiveTab('documents')} />
            )}
          </Panel>

          {/* Tax Checklist panel */}
          <Panel
            title="Tax Checklist"
            count={`${receivedCount}/${taxDocs.length}`}
            action={
              receivedCount === taxDocs.length && taxDocs.length > 0
                ? <span className="text-[12px] text-sage-500 font-[450]">All received</span>
                : undefined
            }
          >
            {taxDocs.length === 0 ? (
              <EmptyState text="No checklist items." />
            ) : (
              taxDocs.slice(0, 6).map(doc => (
                <ChecklistRow
                  key={doc.id}
                  label={doc.document_type}
                  status={doc.status}
                  required={doc.required}
                  subText={
                    doc.uploaded_at
                      ? `Received ${formatDate(doc.uploaded_at)}`
                      : undefined
                  }
                  onToggle={() => handleTaxDocToggle(doc)}
                />
              ))
            )}
            {taxDocs.length > 6 && (
              <ViewAll onClick={() => setActiveTab('checklist')} />
            )}
          </Panel>

          {/* Quick Info panel */}
          <Panel title="Client Info">
            <div className="px-4 py-3 space-y-3">
              {/* Services */}
              <InfoRow
                label="Services"
                value={client.services.length
                  ? client.services.map(s => SERVICE_LABELS[s] ?? s).join(', ')
                  : '—'}
              />
              <InfoRow label="Entity" value={ENTITY_LABELS[client.entity_type] ?? client.entity_type} />
              {client.filing_state && <InfoRow label="Filing State" value={client.filing_state} />}
              {client.tax_year    && <InfoRow label="Tax Year"     value={String(client.tax_year)} />}
              <InfoRow label="Fee" value={formatFee(client.fee_amount, client.fee_structure)} />

              <div className="border-t border-beige-100 pt-3">
                <InfoRow label="Added" value={formatDate(client.created_at)} />
                {client.portal_submitted_at && (
                  <InfoRow label="Portal submitted" value={formatDate(client.portal_submitted_at)} />
                )}
              </div>

              {/* Portal link */}
              <div className="border-t border-beige-100 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft mb-1.5">
                  Client Portal
                </p>
                <button
                  type="button"
                  onClick={handleCopyPortal}
                  className={cn(
                    'flex items-center gap-1.5 text-[12px] text-ink-mid',
                    'hover:text-ink transition-colors duration-150',
                  )}
                >
                  {copied
                    ? <Check size={12} strokeWidth={2} className="text-sage-400 shrink-0" />
                    : <ExternalLink size={12} strokeWidth={1.75} className="shrink-0" />
                  }
                  <span className="truncate">{copied ? 'Copied!' : portalUrl.replace(/^https?:\/\//, '')}</span>
                </button>
              </div>

              {/* Internal notes */}
              <div className="border-t border-beige-100 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft mb-1.5">
                  Internal Notes
                </p>
                <textarea
                  value={notes}
                  onChange={e => handleNotesChange(e.target.value)}
                  placeholder="Private notes — not visible to client…"
                  rows={3}
                  className={cn(
                    'w-full text-[12.5px] text-ink placeholder:text-ink-soft/60 font-light',
                    'bg-beige-50 border-[0.5px] border-beige-200 rounded-[8px]',
                    'px-3 py-2 resize-none outline-none',
                    'focus:border-sage-400 transition-colors duration-150',
                  )}
                />
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ── Documents tab ── */}
      {activeTab === 'documents' && (
        <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-beige-100">
            <p className="text-[13px] font-[450] text-ink">
              {documents.length} {documents.length === 1 ? 'document' : 'documents'}
            </p>
            <a
              href={`/clients/${client.id}/documents/new`}
              className={cn(
                'inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-[450]',
                'bg-sage-400 text-white rounded-[6px]',
                'hover:bg-sage-600 transition-colors duration-150 select-none',
              )}
            >
              <Plus size={12} strokeWidth={2} />
              Generate Document
            </a>
          </div>
          {documents.length === 0 ? (
            <div className="py-12 text-center">
              <EmptyState text="No documents yet. Generate an engagement letter to get started." />
            </div>
          ) : (
            documents.map(doc => (
              <DocumentRow
                key={doc.id}
                title={doc.title}
                type={doc.type}
                status={doc.status}
                meta={formatDate(doc.created_at)}
                action={
                  doc.status === 'draft'
                    ? { label: 'Send', onClick: () => toast({ variant: 'success', message: 'Sending coming soon.' }), disabled: !hasEmail, disabledTitle: noEmailTip }
                    : doc.status === 'sent' || doc.status === 'awaiting_signature'
                    ? { label: 'Remind', onClick: () => toast({ variant: 'success', message: 'Reminder sent.' }), disabled: !hasEmail, disabledTitle: noEmailTip }
                    : undefined
                }
              />
            ))
          )}
        </div>
      )}

      {/* ── Tax Checklist tab ── */}
      {activeTab === 'checklist' && (
        <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-beige-100">
            <p className="text-[13px] font-[450] text-ink">
              {receivedCount} of {taxDocs.length} received
            </p>
            {receivedCount === taxDocs.length && taxDocs.length > 0 && (
              <span className="text-[12px] text-sage-500 font-[450]">All received</span>
            )}
          </div>
          {taxDocs.length === 0 ? (
            <div className="py-12 text-center">
              <EmptyState text="No checklist items for this client." />
            </div>
          ) : (
            taxDocs.map(doc => (
              <ChecklistRow
                key={doc.id}
                label={doc.document_type}
                status={doc.status}
                required={doc.required}
                subText={
                  doc.uploaded_at
                    ? `Received ${formatDate(doc.uploaded_at)}`
                    : undefined
                }
                onToggle={() => handleTaxDocToggle(doc)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Invoices tab ── */}
      {activeTab === 'invoices' && (
        <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-beige-100">
            <p className="text-[13px] font-[450] text-ink">
              {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
            </p>
            <button
              type="button"
              onClick={() => toast({ variant: 'success', message: 'Invoice creation coming soon.' })}
              className={cn(
                'inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-[450]',
                'bg-sage-400 text-white rounded-[6px]',
                'hover:bg-sage-600 transition-colors duration-150 select-none',
              )}
            >
              <Plus size={12} strokeWidth={2} />
              Create Invoice
            </button>
          </div>
          {invoices.length === 0 ? (
            <div className="py-12 text-center">
              <EmptyState text="No invoices yet." />
            </div>
          ) : (
            invoices.map(inv => (
              <InvoiceRow
                key={inv.id}
                description={inv.description}
                date={inv.due_date}
                amount={inv.amount}
                status={inv.status}
                invoiceNumber={inv.invoice_number}
              />
            ))
          )}

          {/* Total row */}
          {invoices.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-beige-100 bg-beige-50">
              <span className="text-[12px] font-[450] text-ink-soft">Total</span>
              <span className="text-[13px] font-semibold text-ink tabular-nums">
                ${invoices.reduce((s, i) => s + i.amount, 0).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Timeline tab ── */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          {/* Log note form */}
          <form
            onSubmit={handleLogNote}
            className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card p-4"
          >
            <p className="text-[12px] font-[450] text-ink-soft mb-2 uppercase tracking-[0.06em]">Log a note</p>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add a note about this client…"
              rows={2}
              className={cn(
                'w-full text-[13px] text-ink placeholder:text-ink-soft/60 font-light',
                'bg-beige-50 border-[0.5px] border-beige-200 rounded-[8px]',
                'px-3 py-2 resize-none outline-none mb-2.5',
                'focus:border-sage-400 transition-colors duration-150',
              )}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!noteText.trim() || savingNote}
                className={cn(
                  'inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-[450]',
                  'bg-ink text-white rounded-[6px]',
                  'hover:bg-ink/80 transition-colors duration-150 select-none',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                <Send size={11} strokeWidth={2} />
                {savingNote ? 'Saving…' : 'Log Note'}
              </button>
            </div>
          </form>

          {/* Timeline list */}
          <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card p-5">
            {timeline.length === 0 ? (
              <EmptyState text="No activity yet." />
            ) : (
              timeline.map((event, i) => (
                <TimelineItem
                  key={event.id}
                  type={event.type}
                  title={event.title}
                  detail={event.detail}
                  createdAt={event.created_at}
                  isLast={i === timeline.length - 1}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Fixed ActionBar ── */}
      <ActionBar
        hint={stageConfig.hint}
        primary={stageConfig.primary}
        secondary={stageConfig.secondary}
        onPrimary={handlePrimaryAction}
        // §13.7 — disable email actions when client has no email
        primaryDisabled={client.pipeline_stage === 'onboarding' && !hasEmail}
        primaryDisabledTitle={client.pipeline_stage === 'onboarding' ? noEmailTip : undefined}
        secondaryDisabled={stageConfig.secondary === 'Send Engagement Letter' && !hasEmail}
        secondaryDisabledTitle={stageConfig.secondary === 'Send Engagement Letter' ? noEmailTip : undefined}
        onSecondary={
          stageConfig.secondary === 'Send Engagement Letter'
            ? () => {
                const engagementDoc = documents.find(d => d.type === 'engagement_letter')
                if (engagementDoc) {
                  toast({ variant: 'success', message: 'Sending coming soon.' })
                } else {
                  toast({ variant: 'error', message: 'No engagement letter found. Generate one first.' })
                }
              }
            : stageConfig.secondary === 'View Portal'
            ? () => window.open(portalUrl, '_blank')
            : undefined
        }
      />
    </div>
  )
}

// ─────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────

function Panel({
  title,
  count,
  action,
  children,
}: {
  title: string
  count?: number | string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-beige-100">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-[450] text-ink">{title}</p>
          {count !== undefined && (
            <span className="text-[11px] text-ink-soft/60">{count}</span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[12px] text-ink-soft font-light shrink-0">{label}</span>
      <span className="text-[12px] text-ink font-[450] text-right">{value}</span>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-[13px] text-ink-soft font-light px-4 py-4">{text}</p>
  )
}

function ViewAll({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-0.5 w-full px-4 py-2.5',
        'text-[12px] text-ink-soft hover:text-ink font-[450]',
        'border-t border-beige-100 bg-beige-50/50',
        'transition-colors duration-150',
      )}
    >
      View all
      <ChevronRight size={12} strokeWidth={2} />
    </button>
  )
}

function ActionBar({
  hint,
  primary,
  secondary,
  onPrimary,
  onSecondary,
  primaryDisabled,
  primaryDisabledTitle,
  secondaryDisabled,
  secondaryDisabledTitle,
}: {
  hint:                   string
  primary:                string
  secondary?:             string
  onPrimary:              () => void
  onSecondary?:           () => void
  primaryDisabled?:       boolean
  primaryDisabledTitle?:  string
  secondaryDisabled?:     boolean
  secondaryDisabledTitle?: string
}) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-60 right-0 z-30',
        'bg-white/95 backdrop-blur-sm border-t border-beige-200',
        'px-6 py-3',
      )}
    >
      <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
        <p className="text-[12.5px] text-ink-soft font-light">{hint}</p>
        <div className="flex items-center gap-2 shrink-0">
          {secondary && onSecondary && (
            <button
              type="button"
              onClick={secondaryDisabled ? undefined : onSecondary}
              disabled={secondaryDisabled}
              title={secondaryDisabled ? secondaryDisabledTitle : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-3.5 text-[12.5px] font-[450]',
                'border-[0.5px] border-beige-300 rounded-[8px] bg-white',
                'transition-colors duration-150 select-none',
                secondaryDisabled
                  ? 'opacity-40 cursor-not-allowed text-ink-mid'
                  : 'text-ink-mid hover:text-ink hover:border-beige-400 cursor-pointer',
              )}
            >
              {secondary}
            </button>
          )}
          <button
            type="button"
            onClick={primaryDisabled ? undefined : onPrimary}
            disabled={primaryDisabled}
            title={primaryDisabled ? primaryDisabledTitle : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3.5 text-[12.5px] font-[450]',
              'bg-sage-400 text-white rounded-[8px]',
              'transition-colors duration-150 select-none',
              primaryDisabled
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:bg-sage-600 cursor-pointer',
            )}
          >
            {primary}
          </button>
        </div>
      </div>
    </div>
  )
}
