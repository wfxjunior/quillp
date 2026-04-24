'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Edit2, Trash2, Clock, ListChecks, FileStack, X, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/NotificationToast'
import { cn } from '@/lib/utils'
import type { Service, ServiceStep, ServiceDocument, PriceType } from '@/types'

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  flat_fee: 'Flat fee',
  hourly:   'Hourly',
  retainer: 'Monthly retainer',
}

function formatPrice(price: number | null, priceType: PriceType | null): string {
  if (!price) return '—'
  const fmt = `$${price.toLocaleString()}`
  if (priceType === 'flat_fee') return `${fmt} flat`
  if (priceType === 'hourly')   return `${fmt}/hr`
  if (priceType === 'retainer') return `${fmt}/mo`
  return fmt
}

function blankStep(order: number): ServiceStep {
  return { order, title: '', description: '', assignee: 'cpa', trigger_event: 'manual' }
}

function blankDoc(): ServiceDocument {
  return { label: '', description: '', required: true }
}

// ─────────────────────────────────────────
// Form state shape
// ─────────────────────────────────────────

interface FormState {
  name:               string
  description:        string
  price:              string
  price_type:         PriceType | ''
  estimated_weeks:    string
  steps:              ServiceStep[]
  required_documents: ServiceDocument[]
}

function emptyForm(): FormState {
  return {
    name: '', description: '', price: '', price_type: '',
    estimated_weeks: '', steps: [blankStep(1)], required_documents: [],
  }
}

// ─────────────────────────────────────────
// Service card
// ─────────────────────────────────────────

function ServiceCard({
  service, onEdit, onDelete,
}: {
  service:  Service
  onEdit:   () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card flex flex-col p-5 gap-4">
      {/* Name + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-[550] text-ink leading-snug truncate">{service.name}</p>
          {service.description && (
            <p className="text-[12.5px] text-ink-soft font-light mt-0.5 line-clamp-2 leading-relaxed">
              {service.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            title="Edit service"
            className="h-7 w-7 flex items-center justify-center rounded-[6px] text-ink-soft hover:text-ink hover:bg-beige-100 transition-colors"
          >
            <Edit2 size={13} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete service"
            className="h-7 w-7 flex items-center justify-center rounded-[6px] text-ink-soft hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Price */}
      <p className="font-serif text-[22px] font-medium text-ink leading-none tracking-[-0.4px]">
        {formatPrice(service.price, service.price_type)}
        {service.price_type && (
          <span className="font-sans text-[12px] font-normal text-ink-soft ml-2">
            {PRICE_TYPE_LABELS[service.price_type]}
          </span>
        )}
      </p>

      {/* Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {service.estimated_weeks && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-beige-50 border-[0.5px] border-beige-200 rounded-full text-[11px] text-ink-mid">
            <Clock size={11} strokeWidth={1.75} />
            {service.estimated_weeks}w
          </span>
        )}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-beige-50 border-[0.5px] border-beige-200 rounded-full text-[11px] text-ink-mid">
          <ListChecks size={11} strokeWidth={1.75} />
          {service.steps.length} {service.steps.length === 1 ? 'step' : 'steps'}
        </span>
        {service.required_documents.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-beige-50 border-[0.5px] border-beige-200 rounded-full text-[11px] text-ink-mid">
            <FileStack size={11} strokeWidth={1.75} />
            {service.required_documents.length} {service.required_documents.length === 1 ? 'doc' : 'docs'}
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Service modal (create / edit)
// ─────────────────────────────────────────

function ServiceModal({
  title, form, setForm, saving, onSave, onClose,
  onAddStep, onRemoveStep, onUpdateStep,
  onAddDoc, onRemoveDoc, onUpdateDoc,
}: {
  title:         string
  form:          FormState
  setForm:       React.Dispatch<React.SetStateAction<FormState>>
  saving:        boolean
  onSave:        () => void
  onClose:       () => void
  onAddStep:     () => void
  onRemoveStep:  (i: number) => void
  onUpdateStep:  (i: number, key: keyof ServiceStep, value: string) => void
  onAddDoc:      () => void
  onRemoveDoc:   (i: number) => void
  onUpdateDoc:   (i: number, key: keyof ServiceDocument, value: string | boolean) => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)

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
  const labelCls = 'block text-[11.5px] font-[500] text-ink-mid mb-1'

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-end"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]" />

      {/* Drawer panel */}
      <div className="relative z-10 bg-white w-full max-w-[520px] h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-beige-100 shrink-0">
          <h2 className="text-[15px] font-[600] text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-full text-ink-soft hover:text-ink hover:bg-beige-100 transition-colors"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Name */}
          <div>
            <label className={labelCls}>Service name *</label>
            <input
              className={inputCls}
              placeholder="e.g. Individual Tax Return (1040)"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              className={cn(inputCls, 'h-20 py-2 resize-none')}
              placeholder="Brief description of this service…"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Price + type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Price</label>
              <input
                type="number"
                min="0"
                className={inputCls}
                placeholder="0"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Pricing model</label>
              <select
                className={cn(inputCls, 'cursor-pointer')}
                value={form.price_type}
                onChange={e => setForm(f => ({ ...f, price_type: e.target.value as PriceType | '' }))}
              >
                <option value="">Select…</option>
                <option value="flat_fee">Flat fee</option>
                <option value="hourly">Hourly</option>
                <option value="retainer">Monthly retainer</option>
              </select>
            </div>
          </div>

          {/* Estimated weeks */}
          <div>
            <label className={labelCls}>Estimated duration (weeks)</label>
            <input
              type="number"
              min="1"
              className={cn(inputCls, 'w-32')}
              placeholder="4"
              value={form.estimated_weeks}
              onChange={e => setForm(f => ({ ...f, estimated_weeks: e.target.value }))}
            />
          </div>

          {/* Steps builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Steps</label>
              <button
                type="button"
                onClick={onAddStep}
                className="inline-flex items-center gap-1 text-[12px] font-[450] text-sage-600 hover:text-sage-700 transition-colors"
              >
                <Plus size={12} strokeWidth={2} />
                Add step
              </button>
            </div>

            {form.steps.length === 0 ? (
              <p className="text-[12.5px] text-ink-soft font-light">No steps defined.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {form.steps.map((step, idx) => (
                  <div key={idx} className="bg-beige-50 border-[0.5px] border-beige-200 rounded-[10px] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-semibold text-ink-soft w-5 shrink-0 text-center">
                        {idx + 1}
                      </span>
                      <input
                        className={cn(inputCls, 'flex-1')}
                        placeholder="Step title…"
                        value={step.title}
                        onChange={e => onUpdateStep(idx, 'title', e.target.value)}
                      />
                      <select
                        className={cn(inputCls, 'w-28 text-[12px]')}
                        value={step.assignee}
                        onChange={e => onUpdateStep(idx, 'assignee', e.target.value)}
                      >
                        <option value="cpa">CPA</option>
                        <option value="client">Client</option>
                        <option value="system">System</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => onRemoveStep(idx)}
                        className="h-7 w-7 flex items-center justify-center rounded-[6px] text-ink-soft hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <X size={12} strokeWidth={2} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 ml-7">
                      <input
                        className={cn(inputCls, 'flex-1')}
                        placeholder="Description (optional)…"
                        value={step.description}
                        onChange={e => onUpdateStep(idx, 'description', e.target.value)}
                      />
                      <select
                        className={cn(inputCls, 'w-40 text-[12px] shrink-0')}
                        value={step.trigger_event ?? 'manual'}
                        onChange={e => onUpdateStep(idx, 'trigger_event', e.target.value)}
                        title="Auto-complete trigger"
                      >
                        <option value="manual">Manual</option>
                        <option value="document_signed">On doc signed</option>
                        <option value="portal_submitted">On portal submit</option>
                        <option value="file_uploaded">On file upload</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Required documents */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Required documents</label>
              <button
                type="button"
                onClick={onAddDoc}
                className="inline-flex items-center gap-1 text-[12px] font-[450] text-sage-600 hover:text-sage-700 transition-colors"
              >
                <Plus size={12} strokeWidth={2} />
                Add document
              </button>
            </div>

            {form.required_documents.length === 0 ? (
              <p className="text-[12.5px] text-ink-soft font-light">No required documents.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {form.required_documents.map((doc, idx) => (
                  <div key={idx} className="bg-beige-50 border-[0.5px] border-beige-200 rounded-[10px] p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        className={cn(inputCls, 'flex-1')}
                        placeholder="Document label (e.g. W-2)…"
                        value={doc.label}
                        onChange={e => onUpdateDoc(idx, 'label', e.target.value)}
                      />
                      <label className="flex items-center gap-1.5 text-[12px] text-ink-mid font-[450] shrink-0 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={doc.required}
                          onChange={e => onUpdateDoc(idx, 'required', e.target.checked)}
                          className="accent-sage-500"
                        />
                        Required
                      </label>
                      <button
                        type="button"
                        onClick={() => onRemoveDoc(idx)}
                        className="h-7 w-7 flex items-center justify-center rounded-[6px] text-ink-soft hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <X size={12} strokeWidth={2} />
                      </button>
                    </div>
                    <input
                      className={inputCls}
                      placeholder="Description (optional)…"
                      value={doc.description}
                      onChange={e => onUpdateDoc(idx, 'description', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-beige-100 flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex-1 h-10 bg-ink text-white text-[13.5px] font-[450] rounded-[10px] hover:bg-ink/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save service'}
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
// Delete confirmation modal
// ─────────────────────────────────────────

function DeleteModal({
  name, deleting, onConfirm, onClose,
}: {
  name:      string
  deleting:  boolean
  onConfirm: () => void
  onClose:   () => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]" />
      <div className="relative z-10 bg-white rounded-[20px] shadow-2xl border border-beige-200 w-full max-w-sm mx-4 p-6">
        <h2 className="text-[15px] font-[600] text-ink mb-1">Remove service?</h2>
        <p className="text-[13.5px] text-ink-mid font-light leading-relaxed mb-5">
          <strong className="font-[500]">{name}</strong> will be deactivated. Existing processes using this service will not be affected.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 h-10 bg-red-600 text-white text-[13.5px] font-[450] rounded-[10px] hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {deleting && <Loader2 size={14} className="animate-spin" />}
            {deleting ? 'Removing…' : 'Remove'}
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

export function ServicesShell({ initialServices }: { initialServices: Service[] }) {
  const { show: toast } = useToast()
  const [services, setServices]       = useState<Service[]>(initialServices)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<Service | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null)
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [form, setForm]               = useState<FormState>(emptyForm())

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(svc: Service) {
    setEditing(svc)
    setForm({
      name:               svc.name,
      description:        svc.description ?? '',
      price:              svc.price != null ? String(svc.price) : '',
      price_type:         svc.price_type ?? '',
      estimated_weeks:    svc.estimated_weeks != null ? String(svc.estimated_weeks) : '',
      steps:              svc.steps.length ? [...svc.steps] : [blankStep(1)],
      required_documents: [...svc.required_documents],
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  // Steps handlers
  function addStep() {
    setForm(f => ({ ...f, steps: [...f.steps, blankStep(f.steps.length + 1)] }))
  }
  function removeStep(idx: number) {
    setForm(f => ({
      ...f,
      steps: f.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })),
    }))
  }
  function updateStep(idx: number, key: keyof ServiceStep, value: string) {
    setForm(f => ({
      ...f,
      steps: f.steps.map((s, i) => i === idx ? { ...s, [key]: value } : s),
    }))
  }

  // Docs handlers
  function addDoc() {
    setForm(f => ({ ...f, required_documents: [...f.required_documents, blankDoc()] }))
  }
  function removeDoc(idx: number) {
    setForm(f => ({ ...f, required_documents: f.required_documents.filter((_, i) => i !== idx) }))
  }
  function updateDoc(idx: number, key: keyof ServiceDocument, value: string | boolean) {
    setForm(f => ({
      ...f,
      required_documents: f.required_documents.map((d, i) => i === idx ? { ...d, [key]: value } : d),
    }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ variant: 'error', message: 'Service name is required' })
      return
    }

    const validSteps = form.steps
      .filter(s => s.title.trim())
      .map((s, i) => ({ ...s, order: i + 1 }))

    const validDocs = form.required_documents.filter(d => d.label.trim())

    const payload = {
      name:               form.name.trim(),
      description:        form.description.trim() || null,
      price:              form.price ? Number(form.price) : null,
      price_type:         form.price_type || null,
      estimated_weeks:    form.estimated_weeks ? Number(form.estimated_weeks) : null,
      steps:              validSteps,
      required_documents: validDocs,
    }

    setSaving(true)
    try {
      const url    = editing ? `/api/services/${editing.id}` : '/api/services'
      const method = editing ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Save failed')
      }

      const { data } = await res.json() as { data: Service }

      if (editing) {
        setServices(svcs => svcs.map(s => s.id === data.id ? data : s))
        toast({ variant: 'success', message: 'Service updated' })
      } else {
        setServices(svcs => [data, ...svcs])
        toast({ variant: 'success', message: 'Service created' })
      }
      closeModal()
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/services/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Delete failed')
      }
      setServices(svcs => svcs.filter(s => s.id !== deleteTarget.id))
      toast({ variant: 'success', message: 'Service removed' })
      setDeleteTarget(null)
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'Failed to remove' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="px-6 py-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-[32px] font-medium text-ink tracking-[-0.5px] leading-tight">
            Services
          </h1>
          <p className="text-[13.5px] text-ink-soft font-light mt-1">
            {services.length} {services.length === 1 ? 'service' : 'services'} in your catalog
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 h-9 px-4 bg-sage-400 text-white text-[13px] font-[450] rounded-[8px] hover:bg-sage-600 transition-colors select-none"
        >
          <Plus size={14} strokeWidth={2} />
          New service
        </button>
      </div>

      {/* Content */}
      {services.length === 0 ? (
        <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card px-6 py-16 text-center">
          <p className="text-[14px] font-[450] text-ink mb-1">No services yet</p>
          <p className="text-[13px] text-ink-soft font-light mb-4">
            Create your first service template to assign to clients as processes.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 h-9 px-4 bg-ink text-white text-[13px] font-[450] rounded-[8px] hover:bg-ink/90 transition-colors"
          >
            <Plus size={14} strokeWidth={2} />
            Create service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map(svc => (
            <ServiceCard
              key={svc.id}
              service={svc}
              onEdit={() => openEdit(svc)}
              onDelete={() => setDeleteTarget(svc)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit drawer */}
      {modalOpen && (
        <ServiceModal
          title={editing ? 'Edit service' : 'New service'}
          form={form}
          setForm={setForm}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
          onAddStep={addStep}
          onRemoveStep={removeStep}
          onUpdateStep={updateStep}
          onAddDoc={addDoc}
          onRemoveDoc={removeDoc}
          onUpdateDoc={updateDoc}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.name}
          deleting={deleting}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
