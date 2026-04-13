'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { DocumentRow } from '@/components/ui/DocumentRow'
import { useToast }    from '@/components/ui/NotificationToast'
import { cn }          from '@/lib/utils'
import type { DocumentType, DocumentStatus } from '@/types'
import type { DocumentWithClient } from '../page'

// ─────────────────────────────────────────
// Filter tabs
// ─────────────────────────────────────────

type FilterKey = 'all' | DocumentStatus

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all',                label: 'All'              },
  { key: 'draft',              label: 'Draft'            },
  { key: 'sent',               label: 'Sent'             },
  { key: 'awaiting_signature', label: 'Awaiting Sign'    },
  { key: 'signed',             label: 'Signed'           },
  { key: 'archived',           label: 'Archived'         },
]

// ─────────────────────────────────────────
// Type labels
// ─────────────────────────────────────────

const TYPE_LABELS: Record<DocumentType, string> = {
  engagement_letter: 'Engagement Letter',
  proposal:          'Proposal',
  form_2848:         'Form 2848',
  invoice:           'Invoice',
  checklist:         'Checklist',
  onboarding_portal: 'Onboarding Portal',
  delivery_summary:  'Delivery Summary',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────

interface Props {
  documents: DocumentWithClient[]
}

export function DocumentsShell({ documents }: Props) {
  const router = useRouter()
  const { show: toast } = useToast()
  const [filter, setFilter]   = useState<FilterKey>('all')
  const [search, setSearch]   = useState('')

  const filtered = useMemo(() => {
    let list = documents
    if (filter !== 'all') list = list.filter(d => d.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d =>
        d.title.toLowerCase().includes(q) ||
        (d.client_name ?? '').toLowerCase().includes(q) ||
        TYPE_LABELS[d.type]?.toLowerCase().includes(q)
      )
    }
    return list
  }, [documents, filter, search])

  // Count per status for tab badges
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: documents.length }
    documents.forEach(d => { c[d.status] = (c[d.status] ?? 0) + 1 })
    return c
  }, [documents])

  if (documents.length === 0) {
    return (
      <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card px-6 py-16 text-center">
        <p className="text-[13px] text-ink-soft font-light mb-3">
          No documents yet.
        </p>
        <Link
          href="/documents/generate"
          className="inline-flex items-center h-9 px-5 text-[13px] font-[450] bg-ink text-white rounded-[10px] hover:bg-ink/90 transition-colors"
        >
          Generate your first document →
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden">
      {/* Filter + search bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-beige-100">
        {/* Filter tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {FILTER_TABS.map(tab => {
            const count = counts[tab.key] ?? 0
            if (tab.key !== 'all' && count === 0) return null
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  'shrink-0 h-7 px-3 text-[12px] font-[450] rounded-[6px] transition-colors select-none',
                  filter === tab.key
                    ? 'bg-ink text-white'
                    : 'text-ink-mid hover:bg-beige-100',
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className={cn(
                    'ml-1.5 text-[10.5px]',
                    filter === tab.key ? 'text-white/60' : 'text-ink-soft/60',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative shrink-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" strokeWidth={1.75} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            className={cn(
              'h-7 pl-7 pr-3 w-48 text-[12px] font-light text-ink placeholder:text-ink-soft/60',
              'bg-beige-50 border-[0.5px] border-beige-200 rounded-[6px]',
              'outline-none focus:border-ink/30 transition-colors',
            )}
          />
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_160px_120px_120px_100px] gap-3 px-4 py-2 border-b border-beige-100 bg-beige-50">
        {['Document', 'Client', 'Type', 'Date', ''].map((h, i) => (
          <span key={i} className="text-[11px] font-[500] text-ink-soft uppercase tracking-[0.06em]">{h}</span>
        ))}
      </div>

      {/* Document rows */}
      {filtered.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-[13px] text-ink-soft font-light">No documents match your filter.</p>
        </div>
      ) : (
        filtered.map(doc => (
          <div
            key={doc.id}
            className="grid grid-cols-[1fr_160px_120px_120px_100px] gap-3 items-center px-4 border-b border-beige-100 last:border-0 hover:bg-beige-50/50 transition-colors cursor-pointer"
            onClick={() => doc.client_id && router.push(`/clients/${doc.client_id}`)}
          >
            <DocumentRow
              title={doc.title}
              type={doc.type}
              status={doc.status}
              className="border-0 px-0 py-3 hover:bg-transparent"
            />
            <span className="text-[12.5px] text-ink-mid font-light truncate">
              {doc.client_name ?? '—'}
            </span>
            <span className="text-[12px] text-ink-soft font-light">
              {TYPE_LABELS[doc.type] ?? doc.type}
            </span>
            <span className="text-[12px] text-ink-soft font-light">
              {formatDate(doc.created_at)}
            </span>
            <div className="flex justify-end">
              {doc.status === 'draft' && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    toast({ variant: 'info', message: 'Sending coming soon.' })
                  }}
                  className="h-7 px-2.5 text-[11.5px] font-[450] border-[0.5px] border-beige-300 rounded-[6px] text-ink-mid hover:text-ink hover:border-beige-400 bg-white hover:bg-beige-50 transition-colors"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {/* Footer count */}
      {filtered.length > 0 && (
        <div className="px-4 py-2.5 border-t border-beige-100 bg-beige-50">
          <p className="text-[11.5px] text-ink-soft font-light">
            Showing {filtered.length} of {documents.length} documents
          </p>
        </div>
      )}
    </div>
  )
}
