'use client'

/**
 * InvoiceListShell — invoice list with filter tabs, metrics, AR aging, and actions.
 */

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Send, CheckCircle, Download, Loader2, CreditCard } from 'lucide-react'
import { MetricCard } from '@/components/ui/MetricCard'
import { useToast } from '@/components/ui/NotificationToast'
import { cn } from '@/lib/utils'
import type { Invoice, InvoiceStatus } from '@/types'

interface InvoiceWithClient extends Invoice {
  client_name:  string
  client_email: string
}

interface InvoiceListShellProps {
  invoices:        InvoiceWithClient[]
  stripeConnected: boolean
}

type FilterTab = 'all' | InvoiceStatus

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',     label: 'All'     },
  { key: 'draft',   label: 'Draft'   },
  { key: 'sent',    label: 'Sent'    },
  { key: 'paid',    label: 'Paid'    },
  { key: 'overdue', label: 'Overdue' },
]

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft:   'bg-beige-100 text-ink-soft border border-beige-200',
  sent:    'bg-amber-50 text-amber-700 border border-amber-200',
  paid:    'bg-sage-50 text-sage-700 border border-sage-200',
  overdue: 'bg-red-50 text-red-600 border border-red-200',
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0,
  }).format(amount)
}

function fmtFull(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function agingBucket(dueDate: string): '0-30' | '31-60' | '60+' {
  const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000)
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  return '60+'
}

export function InvoiceListShell({ invoices, stripeConnected }: InvoiceListShellProps) {
  const router = useRouter()
  const { show: toast } = useToast()
  const [tab,       setTab]       = useState<FilterTab>('all')
  const [localRows, setLocalRows] = useState<InvoiceWithClient[]>(invoices)
  const [loading,   setLoading]   = useState<Record<string, boolean>>({})

  const filtered = useMemo(() =>
    tab === 'all' ? localRows : localRows.filter(i => i.status === tab),
    [localRows, tab]
  )

  // ── Metrics ──
  const totalBilled      = localRows.reduce((s, i) => s + i.amount, 0)
  const totalCollected   = localRows.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
  const totalOutstanding = localRows.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0)

  // ── AR Aging ──
  const overdueInvoices = localRows.filter(i => i.status === 'overdue')
  const aging: Record<'0-30' | '31-60' | '60+', number> = { '0-30': 0, '31-60': 0, '60+': 0 }
  overdueInvoices.forEach(inv => { aging[agingBucket(inv.due_date)] += inv.amount })

  // ── Actions ──
  async function handleSend(inv: InvoiceWithClient) {
    setLoading(l => ({ ...l, [`send-${inv.id}`]: true }))
    try {
      const res = await fetch(`/api/invoices/${inv.id}/send`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Send failed')
      }
      setLocalRows(rows => rows.map(r => r.id === inv.id ? { ...r, status: 'sent' } : r))
      toast({ variant: 'success', message: `Invoice sent to ${inv.client_email}` })
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'Failed to send invoice' })
    } finally {
      setLoading(l => ({ ...l, [`send-${inv.id}`]: false }))
    }
  }

  async function handleMarkPaid(inv: InvoiceWithClient) {
    setLoading(l => ({ ...l, [`pay-${inv.id}`]: true }))
    try {
      const res = await fetch(`/api/invoices/${inv.id}/mark-paid`, { method: 'PATCH' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Failed')
      }
      const { data } = await res.json() as { data: { paid_at: string } }
      setLocalRows(rows => rows.map(r => r.id === inv.id ? { ...r, status: 'paid', paid_at: data.paid_at } : r))
      toast({ variant: 'success', message: `${inv.invoice_number} marked as paid` })
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'Failed to mark paid' })
    } finally {
      setLoading(l => ({ ...l, [`pay-${inv.id}`]: false }))
    }
  }

  async function handleDownload(inv: InvoiceWithClient) {
    setLoading(l => ({ ...l, [`pdf-${inv.id}`]: true }))
    try {
      const res = await fetch(`/api/invoices/${inv.id}/pdf`)
      if (!res.ok) throw new Error('Download failed')

      // If JSON → signed URL redirect; if binary → download directly
      const ct = res.headers.get('content-type') ?? ''
      if (ct.includes('application/json')) {
        const { url } = await res.json() as { url: string }
        window.open(url, '_blank')
      } else {
        const blob = await res.blob()
        const a    = document.createElement('a')
        a.href     = URL.createObjectURL(blob)
        a.download = `${inv.invoice_number}.pdf`
        a.click()
        URL.revokeObjectURL(a.href)
      }
    } catch {
      toast({ variant: 'error', message: 'Could not download PDF' })
    } finally {
      setLoading(l => ({ ...l, [`pdf-${inv.id}`]: false }))
    }
  }

  async function handlePaymentLink(inv: InvoiceWithClient) {
    // If link already exists, open it directly
    if (inv.stripe_payment_link) {
      window.open(inv.stripe_payment_link, '_blank', 'noopener')
      return
    }
    setLoading(l => ({ ...l, [`link-${inv.id}`]: true }))
    try {
      const res = await fetch(`/api/invoices/${inv.id}/pay`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Failed to generate payment link')
      }
      const { paymentLink } = await res.json() as { paymentLink: string }
      setLocalRows(rows => rows.map(r =>
        r.id === inv.id ? { ...r, stripe_payment_link: paymentLink } : r
      ))
      window.open(paymentLink, '_blank', 'noopener')
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'Failed to generate payment link' })
    } finally {
      setLoading(l => ({ ...l, [`link-${inv.id}`]: false }))
    }
  }

  return (
    <div className="px-6 py-6 max-w-[1000px] mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-[32px] font-medium text-ink tracking-[-0.5px] leading-tight">
            Invoices
          </h1>
          <p className="text-[13.5px] text-ink-soft font-light mt-1">
            {localRows.length} invoice{localRows.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => router.push('/invoices/new')}
          className="inline-flex items-center gap-1.5 h-9 px-4 bg-ink text-white text-[13px] font-[450] rounded-[10px] hover:bg-ink/90 transition-colors"
        >
          <Plus size={14} strokeWidth={2} />
          Create invoice
        </button>
      </div>

      {/* ── Metrics ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricCard
          label="Total Billed"
          value={fmt(totalBilled)}
          subLabel={`${localRows.length} invoice${localRows.length !== 1 ? 's' : ''}`}
        />
        <MetricCard
          label="Collected"
          value={fmt(totalCollected)}
          subLabel={`${localRows.filter(i => i.status === 'paid').length} paid`}
          tag={{ label: 'Paid', variant: 'green' }}
        />
        <MetricCard
          label="Outstanding"
          value={fmt(totalOutstanding)}
          subLabel={`${localRows.filter(i => i.status === 'sent' || i.status === 'overdue').length} unpaid`}
          tag={totalOutstanding > 0 ? { label: 'Due', variant: 'amber' } : undefined}
        />
      </div>

      {/* ── AR Aging ── */}
      {overdueInvoices.length > 0 && (
        <section className="mb-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft mb-3">
            AR Aging — Overdue
          </h2>
          <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-beige-100">
              {(['0-30', '31-60', '60+'] as const).map(bucket => (
                <div key={bucket} className="px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-soft mb-1">
                    {bucket} days
                  </p>
                  <p className={cn(
                    'font-serif text-[22px] font-medium leading-none tracking-[-0.5px]',
                    aging[bucket] > 0 ? 'text-red-600' : 'text-ink-soft',
                  )}>
                    {fmt(aging[bucket])}
                  </p>
                  <p className="text-[11.5px] text-ink-soft font-light mt-1">
                    {overdueInvoices.filter(i => agingBucket(i.due_date) === bucket).length} invoice
                    {overdueInvoices.filter(i => agingBucket(i.due_date) === bucket).length !== 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Filter tabs ── */}
      <div className="flex gap-1 mb-4 border-b border-beige-100 pb-0">
        {TABS.map(t => {
          const count = t.key === 'all'
            ? localRows.length
            : localRows.filter(i => i.status === t.key).length
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'relative px-3.5 pb-2.5 pt-1 text-[13px] font-[450] transition-colors',
                tab === t.key ? 'text-ink' : 'text-ink-soft hover:text-ink-mid',
              )}
            >
              {t.label}
              {count > 0 && (
                <span className={cn(
                  'ml-1.5 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full',
                  tab === t.key ? 'bg-ink text-white' : 'bg-beige-100 text-ink-soft',
                )}>
                  {count}
                </span>
              )}
              {tab === t.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-ink rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Invoice table ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-ink-soft text-[13.5px] font-light">
          {tab === 'all' ? 'No invoices yet.' : `No ${tab} invoices.`}
        </div>
      ) : (
        <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_140px_120px_100px_180px] gap-4 px-5 py-2.5 border-b border-beige-100 bg-beige-50">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Invoice</span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Client</span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft text-right">Amount</span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Status</span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft text-right">Actions</span>
          </div>

          <div className="divide-y divide-beige-100">
            {filtered.map(inv => (
              <InvoiceTableRow
                key={inv.id}
                inv={inv}
                loading={loading}
                stripeConnected={stripeConnected}
                onSend={handleSend}
                onPay={handleMarkPaid}
                onDownload={handleDownload}
                onPaymentLink={handlePaymentLink}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// Table row
// ─────────────────────────────────────────

interface RowProps {
  inv:             InvoiceWithClient
  loading:         Record<string, boolean>
  stripeConnected: boolean
  onSend:          (inv: InvoiceWithClient) => void
  onPay:           (inv: InvoiceWithClient) => void
  onDownload:      (inv: InvoiceWithClient) => void
  onPaymentLink:   (inv: InvoiceWithClient) => void
}

function InvoiceTableRow({ inv, loading, stripeConnected, onSend, onPay, onDownload, onPaymentLink }: RowProps) {
  const isSending     = loading[`send-${inv.id}`]
  const isPaying      = loading[`pay-${inv.id}`]
  const isDownloading = loading[`pdf-${inv.id}`]
  const isLinking     = loading[`link-${inv.id}`]

  return (
    <div className="grid grid-cols-[1fr_140px_120px_100px_180px] gap-4 px-5 py-3.5 items-center hover:bg-beige-50/50 transition-colors">
      {/* Invoice # + description */}
      <div className="min-w-0">
        <p className="text-[13px] font-[500] text-ink truncate">{inv.description}</p>
        <p className="text-[11.5px] text-ink-soft font-light mt-0.5">
          {inv.invoice_number} · Due {fmtDate(inv.due_date)}
        </p>
      </div>

      {/* Client */}
      <p className="text-[12.5px] text-ink-mid truncate">{inv.client_name}</p>

      {/* Amount */}
      <p className={cn(
        'text-[13px] font-semibold text-right tabular-nums',
        inv.status === 'overdue' ? 'text-red-600' : 'text-ink',
      )}>
        {fmtFull(inv.amount)}
      </p>

      {/* Status badge */}
      <span className={cn(
        'inline-flex items-center text-[11px] font-[500] px-2 py-1 rounded-full w-fit',
        STATUS_COLORS[inv.status],
      )}>
        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1.5 justify-end">
        {/* Send — show for draft/sent */}
        {(inv.status === 'draft' || inv.status === 'sent') && inv.client_email && (
          <ActionButton
            onClick={() => onSend(inv)}
            loading={isSending}
            title="Send by email"
          >
            <Send size={12} strokeWidth={1.75} />
            {inv.status === 'draft' ? 'Send' : 'Resend'}
          </ActionButton>
        )}

        {/* Mark paid — show for sent/overdue */}
        {(inv.status === 'sent' || inv.status === 'overdue') && (
          <ActionButton
            onClick={() => onPay(inv)}
            loading={isPaying}
            title="Mark as paid"
            accent
          >
            <CheckCircle size={12} strokeWidth={1.75} />
            Paid
          </ActionButton>
        )}

        {/* Payment link — show for sent/overdue when Stripe connected */}
        {stripeConnected && (inv.status === 'sent' || inv.status === 'overdue') && (
          <ActionButton
            onClick={() => onPaymentLink(inv)}
            loading={isLinking}
            title={inv.stripe_payment_link ? 'Open payment link' : 'Generate payment link'}
            stripe
          >
            <CreditCard size={12} strokeWidth={1.75} />
            {inv.stripe_payment_link ? 'Pay Link' : 'Get Link'}
          </ActionButton>
        )}

        {/* Download PDF */}
        <ActionButton
          onClick={() => onDownload(inv)}
          loading={isDownloading}
          title="Download PDF"
        >
          <Download size={12} strokeWidth={1.75} />
        </ActionButton>
      </div>
    </div>
  )
}

function ActionButton({
  onClick, loading, title, accent = false, stripe = false, children,
}: {
  onClick:  () => void
  loading:  boolean
  title:    string
  accent?:  boolean
  stripe?:  boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={title}
      className={cn(
        'inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-[450] rounded-[7px]',
        'border transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        accent
          ? 'border-sage-200 bg-sage-50 text-sage-700 hover:bg-sage-100 hover:border-sage-300'
          : stripe
            ? 'border-[#635BFF]/30 bg-[#635BFF]/5 text-[#635BFF] hover:bg-[#635BFF]/10 hover:border-[#635BFF]/50'
            : 'border-beige-200 bg-white text-ink-mid hover:text-ink hover:border-beige-300',
      )}
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : children}
    </button>
  )
}
