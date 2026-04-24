'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, ChevronLeft } from 'lucide-react'
import { useToast } from '@/components/ui/NotificationToast'
import { cn }       from '@/lib/utils'

interface ClientOption {
  id:            string
  name:          string
  email:         string
  fee_amount:    number | null
  fee_structure: string | null
}

interface Props {
  clients: ClientOption[]
}

export function NewInvoiceShell({ clients }: Props) {
  const router = useRouter()
  const { show: toast } = useToast()

  // Client selector
  const [search,         setSearch]         = useState('')
  const [showDrop,       setShowDrop]       = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // Form fields
  const [description, setDescription] = useState('')
  const [amount,      setAmount]      = useState('')
  const [dueDate,     setDueDate]     = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d.toISOString().slice(0, 10)
  })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const filtered = search.trim()
    ? clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
      )
    : clients

  function selectClient(c: ClientOption) {
    setSelectedClient(c)
    setSearch('')
    setShowDrop(false)
    if (c.fee_amount) setAmount(String(c.fee_amount))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClient || !description.trim() || !amount || !dueDate) return
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) { setError('Enter a valid amount.'); return }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/invoices', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          clientId:    selectedClient.id,
          description: description.trim(),
          amount:      parsed,
          dueDate,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError((json as { error?: string }).error ?? 'Failed to create invoice.')
        return
      }
      const { invoiceNumber } = await res.json() as { invoiceNumber: string }
      toast({ variant: 'success', message: `Invoice ${invoiceNumber} created.` })
      router.push('/invoices')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = !!selectedClient && !!description.trim() && !!amount && !!dueDate && !saving

  return (
    <div className="px-6 py-6 max-w-[560px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-[12.5px] text-ink-soft hover:text-ink transition-colors mb-4"
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
          Back
        </button>
        <h1 className="font-serif text-[28px] font-medium text-ink tracking-[-0.5px] leading-tight">
          Create Invoice
        </h1>
        <p className="text-[13.5px] text-ink-soft font-light mt-1">
          Generate a numbered invoice and PDF automatically.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card p-6 space-y-5"
      >
        {/* Client selector */}
        <Field label="Client" required>
          <div className="relative" ref={dropRef}>
            {selectedClient ? (
              <div className="flex items-center justify-between h-10 px-3 border border-beige-200 rounded-[10px] bg-white">
                <div className="min-w-0 flex-1">
                  <span className="text-[13.5px] font-[450] text-ink truncate block">{selectedClient.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedClient(null); setAmount('') }}
                  className="shrink-0 p-0.5 text-ink-soft hover:text-ink transition-colors ml-2"
                >
                  <X size={13} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={13} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search clients…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setShowDrop(true) }}
                    onFocus={() => setShowDrop(true)}
                    className={inputCls}
                    style={{ paddingLeft: '2rem' }}
                  />
                </div>
                {showDrop && (
                  <div className="absolute z-20 top-11 left-0 right-0 bg-white border-[0.5px] border-beige-200 rounded-[10px] shadow-panel max-h-52 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <p className="px-3 py-3 text-[12.5px] text-ink-soft">No clients found.</p>
                    ) : (
                      filtered.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectClient(c)}
                          className="w-full text-left px-3 py-2.5 hover:bg-beige-50 transition-colors border-b border-beige-100 last:border-0"
                        >
                          <p className="text-[13px] font-[450] text-ink">{c.name}</p>
                          {c.email && <p className="text-[11.5px] text-ink-soft">{c.email}</p>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </Field>

        {/* Description */}
        <Field label="Description" required>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Tax preparation services — 2024"
            required
            className={inputCls}
          />
        </Field>

        {/* Amount + Due Date */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount ($)" required>
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              required
              className={inputCls}
            />
          </Field>
          <Field label="Due Date" required>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              required
              className={inputCls}
            />
          </Field>
        </div>

        {error && <p className="text-[12.5px] text-red-500">{error}</p>}

        <div className="pt-1 flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 h-9 px-5 bg-ink text-white text-[13px] font-[450] rounded-[9px] hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating…' : 'Create Invoice'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="h-9 px-4 text-[13px] font-[450] text-ink-mid border border-beige-300 rounded-[9px] hover:border-beige-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-[450] text-ink-mid mb-1.5">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = cn(
  'w-full h-10 px-3 text-[13.5px] text-ink bg-white border border-beige-200 rounded-[10px] outline-none',
  'focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-colors placeholder:text-ink-soft',
)
