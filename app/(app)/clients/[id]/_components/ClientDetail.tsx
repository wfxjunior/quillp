'use client'

/**
 * ClientDetail — 5-tab client detail view
 * blueprint-part1.md §1.3
 *
 * Tabs: Full Flow / Documents / Tax Checklist / Invoices / Timeline
 * Fixed ActionBar at bottom with stage-contextual actions.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Copy, Check, ExternalLink, Plus, Send,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PipelineTracker }    from '@/components/ui/PipelineTracker'
import { DocumentRow }        from '@/components/ui/DocumentRow'
import { ChecklistRow }       from '@/components/ui/ChecklistRow'
import { InvoiceRow }         from '@/components/ui/InvoiceRow'
import { TimelineItem }       from '@/components/ui/TimelineItem'
import { SignNowRequiredModal } from '@/components/ui/SignNowRequiredModal'
import { useToast }           from '@/components/ui/NotificationToast'
import { useFirm }            from '@/lib/context/firm-context'
import { cn }                 from '@/lib/utils'
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
  const { firm }  = useFirm()
  const router    = useRouter()
  const supabase  = createClient()

  const signNowConnected = !!firm.signnow_token

  // ── State ──
  const [activeTab,       setActiveTab]       = useState<TabKey>('flow')
  const [client,          setClient]          = useState(initialClient)
  const [documents,       setDocuments]       = useState(initialDocuments)
  const [taxDocs,         setTaxDocs]         = useState(initialTaxDocs)
  const [invoices,         setInvoices]        = useState(initialInvoices)
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)
  const [timeline,        setTimeline]        = useState(initialTimeline)
  const [notes,           setNotes]           = useState(client.internal_notes ?? '')
  const [copied,          setCopied]          = useState(false)
  const [noteText,        setNoteText]        = useState('')
  const [savingNote,      setSavingNote]      = useState(false)
  const [sendingDocId,    setSendingDocId]    = useState<string | null>(null)
  const [remindingDocId,  setRemindingDocId]  = useState<string | null>(null)
  const [showSignNowModal, setShowSignNowModal] = useState(false)

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

  // ── Send portal invite / reminder ──

  async function handleSendPortalInvite() {
    const res = await fetch(`/api/clients/${client.id}/invite`, { method: 'POST' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast({ variant: 'error', message: (json as { error?: string }).error ?? 'Failed to send invite.' })
      return
    }
    // Advance local stage to onboarding if we just sent the first invite
    if (client.pipeline_stage === 'engaged') {
      setClient(c => ({ ...c, pipeline_stage: 'onboarding' }))
    }
    toast({ variant: 'success', message: `Portal link sent to ${client.email}!` })
  }

  // ── Send document via SignNow ──

  async function handleSendDocument(docId: string) {
    if (!signNowConnected) {
      setShowSignNowModal(true)
      return
    }
    setSendingDocId(docId)
    try {
      const res = await fetch(`/api/documents/${docId}/send-signnow`, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast({ variant: 'error', message: (json as { error?: string }).error ?? 'Failed to send document.' })
        return
      }
      setDocuments(prev =>
        prev.map(d => d.id === docId ? { ...d, status: 'awaiting_signature' as const } : d)
      )
      toast({ variant: 'success', message: 'Document sent for signature via SignNow.' })
    } finally {
      setSendingDocId(null)
    }
  }

  // ── Remind signature via SignNow ──

  async function handleRemindDocument(docId: string) {
    if (!signNowConnected) { setShowSignNowModal(true); return }
    setRemindingDocId(docId)
    try {
      const res = await fetch(`/api/documents/${docId}/remind`, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast({ variant: 'error', message: (json as { error?: string }).error ?? 'Failed to send reminder.' })
        return
      }
      toast({ variant: 'success', message: 'Signature reminder sent.' })
    } finally {
      setRemindingDocId(null)
    }
  }

  // ── Archive client ──

  async function handleArchiveClient() {
    if (!confirm(`Archive ${client.name}? They will be removed from the active pipeline.`)) return
    const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast({ variant: 'error', message: 'Failed to archive client.' })
      return
    }
    router.push('/clients')
  }

  // ── ActionBar primary action handler ──

  async function handlePrimaryAction() {
    const stage = client.pipeline_stage
    if (stage === 'engaged') {
      await handleSendPortalInvite()
    } else if (stage === 'onboarding') {
      await handleSendPortalInvite()
    } else if (stage === 'docs_received') {
      await handleStageChange('in_progress')
    } else if (stage === 'in_progress') {
      await handleStageChange('review')
    } else if (stage === 'review') {
      await handleStageChange('filed_invoiced')
    } else if (stage === 'filed_invoiced') {
      await handleArchiveClient()
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
                      ? { label: sendingDocId === doc.id ? 'Sending…' : 'Send', onClick: () => handleSendDocument(doc.id), disabled: !hasEmail || sendingDocId === doc.id, disabledTitle: !hasEmail ? noEmailTip : undefined }
                      : doc.status === 'sent' || doc.status === 'awaiting_signature'
                      ? { label: remindingDocId === doc.id ? 'Sending…' : 'Remind', onClick: () => handleRemindDocument(doc.id), disabled: !hasEmail || remindingDocId === doc.id, disabledTitle: !hasEmail ? noEmailTip : undefined }
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
                    ? { label: sendingDocId === doc.id ? 'Sending…' : 'Send', onClick: () => handleSendDocument(doc.id), disabled: !hasEmail || sendingDocId === doc.id, disabledTitle: !hasEmail ? noEmailTip : undefined }
                    : doc.status === 'sent' || doc.status === 'awaiting_signature'
                    ? { label: 'Remind', onClick: () => toast({ variant: 'info', message: 'Signature reminder coming soon.' }), disabled: !hasEmail, disabledTitle: noEmailTip }
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
              onClick={() => setShowCreateInvoice(true)}
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

      {showCreateInvoice && (
        <CreateInvoiceModal
          clientId={client.id}
          clientName={client.name}
          defaultAmount={client.fee_amount}
          onClose={() => setShowCreateInvoice(false)}
          onCreated={inv => {
            setInvoices(prev => [inv, ...prev])
            setShowCreateInvoice(false)
            toast({ variant: 'success', message: `Invoice ${inv.invoice_number} created.` })
          }}
        />
      )}

      {showSignNowModal && (
        <SignNowRequiredModal onClose={() => setShowSignNowModal(false)} />
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
                  handleSendDocument(engagementDoc.id)
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

// ─────────────────────────────────────────
// CreateInvoiceModal
// ─────────────────────────────────────────

function CreateInvoiceModal({
  clientId,
  clientName,
  defaultAmount,
  onClose,
  onCreated,
}: {
  clientId:      string
  clientName:    string
  defaultAmount: number | null
  onClose:       () => void
  onCreated:     (invoice: Invoice) => void
}) {
  const today = new Date()
  const defaultDue = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
    .toISOString().slice(0, 10)

  const [description, setDescription] = useState('')
  const [amount,      setAmount]      = useState(defaultAmount ? String(defaultAmount) : '')
  const [dueDate,     setDueDate]     = useState(defaultDue)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim() || !amount || !dueDate) return
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) { setError('Enter a valid amount.'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/invoices', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clientId, description: description.trim(), amount: parsed, dueDate }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError((json as { error?: string }).error ?? 'Failed to create invoice.')
        return
      }
      const { invoice } = await res.json() as { invoice: Invoice }
      onCreated(invoice)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-[18px] shadow-[0_20px_60px_rgba(26,25,22,0.2)] w-full max-w-[420px] overflow-hidden">
        <div className="px-6 py-5 border-b border-beige-100">
          <p className="text-[15px] font-[500] text-ink">New Invoice</p>
          <p className="text-[12.5px] text-ink-soft font-light mt-0.5">{clientName}</p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <ModalField label="Description" htmlFor="inv-desc">
            <input
              id="inv-desc"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Tax preparation — 2024"
              required
              className={modalInputCls}
            />
          </ModalField>
          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Amount ($)" htmlFor="inv-amount">
              <input
                id="inv-amount"
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                required
                className={modalInputCls}
              />
            </ModalField>
            <ModalField label="Due Date" htmlFor="inv-due">
              <input
                id="inv-due"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                required
                className={modalInputCls}
              />
            </ModalField>
          </div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-[13px] font-[450] text-ink-mid border border-beige-300 rounded-[9px] hover:border-beige-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !description.trim() || !amount || !dueDate}
              className="h-9 px-5 text-[13px] font-[450] bg-ink text-white rounded-[9px] hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[12px] font-[450] text-ink-mid mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const modalInputCls = cn(
  'w-full h-10 px-3 text-[13.5px] text-ink bg-white border border-beige-200 rounded-[10px] outline-none',
  'focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-colors',
)
