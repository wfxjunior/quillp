'use client'

/**
 * /documents/generate — Document Generator
 * blueprint-part1.md §1.4 / blueprint-part2.md §11.2
 *
 * Two-panel layout:
 *   Left  (40%): form — client, doc type, service, fee, jurisdiction, special terms
 *   Right (60%): live streaming HTML preview + action toolbar
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import DOMPurify from 'dompurify'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, Search, X, Download, Send, Save, FileText, RefreshCw,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SageButton }   from '@/components/buttons/SageButton'
import { GhostButton }  from '@/components/buttons/GhostButton'
import { useToast }     from '@/components/ui/NotificationToast'
import { useFirm }      from '@/lib/context/firm-context'
import { SignNowRequiredModal } from '@/components/ui/SignNowRequiredModal'
import { SERVICE_OPTIONS } from '@/lib/onboarding/service-mappings'
import { cn } from '@/lib/utils'
import type { DocumentType } from '@/types'

// ─────────────────────────────────────────
// Config
// ─────────────────────────────────────────

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'engagement_letter', label: 'Engagement Letter' },
  { value: 'proposal',          label: 'Proposal'          },
  { value: 'form_2848',         label: 'Form 2848'         },
  { value: 'invoice',           label: 'Invoice'           },
  { value: 'checklist',         label: 'Checklist'         },
]

const DOC_SERVICE_OPTIONS: Partial<Record<DocumentType, { value: string; label: string }[]>> = {
  engagement_letter: SERVICE_OPTIONS.map(s => ({ value: s.value, label: s.label })),
  proposal:          SERVICE_OPTIONS.map(s => ({ value: s.value, label: s.label })),
  checklist:         SERVICE_OPTIONS.filter(s => s.category === 'tax').map(s => ({ value: s.value, label: s.label })),
  form_2848:         [{ value: 'irs_representation', label: 'IRS Representation' }],
  invoice:           SERVICE_OPTIONS.map(s => ({ value: s.value, label: s.label })),
}

const US_STATES: { value: string; label: string }[] = [
  { value: 'AL', label: 'Alabama'        }, { value: 'AK', label: 'Alaska'         },
  { value: 'AZ', label: 'Arizona'        }, { value: 'AR', label: 'Arkansas'       },
  { value: 'CA', label: 'California'     }, { value: 'CO', label: 'Colorado'       },
  { value: 'CT', label: 'Connecticut'    }, { value: 'DE', label: 'Delaware'       },
  { value: 'FL', label: 'Florida'        }, { value: 'GA', label: 'Georgia'        },
  { value: 'HI', label: 'Hawaii'         }, { value: 'ID', label: 'Idaho'          },
  { value: 'IL', label: 'Illinois'       }, { value: 'IN', label: 'Indiana'        },
  { value: 'IA', label: 'Iowa'           }, { value: 'KS', label: 'Kansas'         },
  { value: 'KY', label: 'Kentucky'       }, { value: 'LA', label: 'Louisiana'      },
  { value: 'ME', label: 'Maine'          }, { value: 'MD', label: 'Maryland'       },
  { value: 'MA', label: 'Massachusetts'  }, { value: 'MI', label: 'Michigan'       },
  { value: 'MN', label: 'Minnesota'      }, { value: 'MS', label: 'Mississippi'    },
  { value: 'MO', label: 'Missouri'       }, { value: 'MT', label: 'Montana'        },
  { value: 'NE', label: 'Nebraska'       }, { value: 'NV', label: 'Nevada'         },
  { value: 'NH', label: 'New Hampshire'  }, { value: 'NJ', label: 'New Jersey'     },
  { value: 'NM', label: 'New Mexico'     }, { value: 'NY', label: 'New York'       },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota'   },
  { value: 'OH', label: 'Ohio'           }, { value: 'OK', label: 'Oklahoma'       },
  { value: 'OR', label: 'Oregon'         }, { value: 'PA', label: 'Pennsylvania'   },
  { value: 'RI', label: 'Rhode Island'   }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota'   }, { value: 'TN', label: 'Tennessee'      },
  { value: 'TX', label: 'Texas'          }, { value: 'UT', label: 'Utah'           },
  { value: 'VT', label: 'Vermont'        }, { value: 'VA', label: 'Virginia'       },
  { value: 'WA', label: 'Washington'     }, { value: 'WV', label: 'West Virginia'  },
  { value: 'WI', label: 'Wisconsin'      }, { value: 'WY', label: 'Wyoming'        },
  { value: 'DC', label: 'Washington D.C.'},
]

// Injected into the preview iframe so .document-body renders like a real document
const PREVIEW_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.7; color: #1a1a1a; background: transparent; padding: 40px 48px; }
  .document-body { max-width: 100%; }
  .document-body p { margin-bottom: 1em; }
  .document-body strong { font-weight: 600; }
  .document-body h1, .document-body h2, .document-body h3 { font-family: Georgia, serif; margin-bottom: 0.75em; }
  .document-body h1 { font-size: 20px; }
  .document-body h2 { font-size: 16px; }
  .document-body h3 { font-size: 14px; font-weight: 600; }
  .document-body ul, .document-body ol { margin: 0 0 1em 1.5em; }
  .document-body li { margin-bottom: 0.25em; }
  .document-body table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 13px; }
  .document-body th { background: #f5f5f2; font-weight: 600; text-align: left; padding: 8px 10px; border: 1px solid #d4d0c8; }
  .document-body td { padding: 7px 10px; border: 1px solid #d4d0c8; vertical-align: top; }
  .document-body .signature-block { margin-top: 2.5em; padding-top: 1.5em; border-top: 1px solid #999; }
  .document-body .signature-block p { margin-bottom: 0.5em; font-size: 13px; }
`

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface ClientOption {
  id:            string
  name:          string
  email:         string
  filing_state:  string | null
  fee_amount:    number | null
  fee_structure: string | null
  services:      string[]
}

interface FormState {
  clientId:     string
  documentType: DocumentType | ''
  serviceType:  string
  feeAmount:    string
  jurisdiction: string
  specialTerms: string
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────

export default function DocumentGeneratePage() {
  const router = useRouter()
  const { show: toast } = useToast()
  const { firm } = useFirm()
  const supabase = createClient()
  const signNowConnected = !!firm.signnow_token
  const [showSignNowModal, setShowSignNowModal] = useState(false)

  // ── Clients ──
  const [clients,        setClients]        = useState<ClientOption[]>([])
  const [clientSearch,   setClientSearch]   = useState('')
  const [showDrop,       setShowDrop]       = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // ── Form ──
  const [form, setForm] = useState<FormState>({
    clientId:     '',
    documentType: '',
    serviceType:  '',
    feeAmount:    '',
    jurisdiction: '',
    specialTerms: '',
  })

  // ── Generation state ──
  const [isGenerating,    setIsGenerating]    = useState(false)
  const [hasGenerated,    setHasGenerated]    = useState(false)
  const [generatedDocId,  setGeneratedDocId]  = useState<string | null>(null)
  const [genError,        setGenError]        = useState<string | null>(null)
  const [downloadingPdf,  setDownloadingPdf]  = useState(false)
  const [sendingSignNow,  setSendingSignNow]  = useState(false)

  // ── Preview (ref-based for zero-render token updates) ──
  const accumulatedRef = useRef('')
  const iframeRef      = useRef<HTMLIFrameElement>(null)
  const hasContentRef  = useRef(false)

  // ─────────────────────────────────────────
  // Load clients on mount
  // ─────────────────────────────────────────

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, name, email, filing_state, fee_amount, fee_structure, services')
      .is('archived_at', null)
      .order('name')
      .then(({ data }) => setClients((data ?? []) as ClientOption[]))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowDrop(false)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  // ─────────────────────────────────────────
  // Client selection
  // ─────────────────────────────────────────

  function selectClient(c: ClientOption) {
    setSelectedClient(c)
    setForm(f => {
      const validServices = f.documentType ? (DOC_SERVICE_OPTIONS[f.documentType as DocumentType] ?? []) : []
      const autoService = c.services.find(s => validServices.some(o => o.value === s)) ?? f.serviceType
      return {
        ...f,
        clientId:     c.id,
        jurisdiction: c.filing_state ?? f.jurisdiction,
        feeAmount:    c.fee_amount ? String(c.fee_amount) : f.feeAmount,
        serviceType:  autoService,
      }
    })
    setClientSearch('')
    setShowDrop(false)
  }

  function clearClient() {
    setSelectedClient(null)
    setForm(f => ({ ...f, clientId: '', jurisdiction: '', feeAmount: '', serviceType: '' }))
  }

  // ─────────────────────────────────────────
  // Form helpers
  // ─────────────────────────────────────────

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleDocTypeChange(newType: DocumentType | '') {
    const validServices = DOC_SERVICE_OPTIONS[newType as DocumentType] ?? []
    const serviceStillValid = validServices.some(s => s.value === form.serviceType)
    setForm(f => ({
      ...f,
      documentType: newType,
      serviceType:  serviceStillValid
        ? f.serviceType
        : newType === 'form_2848' ? 'irs_representation' : '',
    }))
  }

  // ─────────────────────────────────────────
  // Streaming generation
  // ─────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!form.clientId || !form.documentType) return

    setIsGenerating(true)
    setHasGenerated(false)
    setGeneratedDocId(null)
    setGenError(null)
    accumulatedRef.current = ''
    hasContentRef.current  = false

    // Reset iframe
    const iframeDoc = iframeRef.current?.contentDocument
    if (iframeDoc) {
      iframeDoc.open()
      iframeDoc.write(`<html><head><style>${PREVIEW_CSS}</style></head><body></body></html>`)
      iframeDoc.close()
    }

    try {
      const res = await fetch('/api/ai/generate-document', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:     form.clientId,
          document_type: form.documentType,
          service_type:  form.serviceType || undefined,
          fee_amount:    form.feeAmount ? parseFloat(form.feeAmount) : undefined,
          jurisdiction:  form.jurisdiction || undefined,
          special_terms: form.specialTerms || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Generation failed')
      }

      const docId = res.headers.get('X-Document-Id')
      if (docId) setGeneratedDocId(docId)

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulatedRef.current += chunk
        hasContentRef.current = true

        // Direct DOM mutation — zero React re-renders during streaming
        const body = iframeRef.current?.contentDocument?.body
        if (body) {
          body.innerHTML = DOMPurify.sanitize(accumulatedRef.current)
          // Auto-resize iframe to content height
          if (iframeRef.current) {
            const h = body.scrollHeight
            if (h > 0) iframeRef.current.style.height = `${h + 80}px`
          }
        }
      }

      setHasGenerated(true)
    } catch (err) {
      console.error('[generate page] Generation error:', err)
      setGenError('Generation failed. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }, [form]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────
  // Toolbar actions
  // ─────────────────────────────────────────

  function handleSaveToClient() {
    if (!generatedDocId || !form.clientId) return
    toast({ variant: 'success', message: 'Document saved to client.' })
    router.push(`/clients/${form.clientId}`)
  }

  async function handleDownloadPdf() {
    if (!generatedDocId) return
    setDownloadingPdf(true)
    try {
      const res = await fetch(`/api/documents/${generatedDocId}/pdf`, { method: 'POST' })
      if (!res.ok) {
        toast({ variant: 'error', message: 'PDF generation failed. Try again.' })
        return
      }
      const { signedUrl } = await res.json() as { signedUrl: string | null }
      if (signedUrl) {
        window.open(signedUrl, '_blank', 'noopener')
      } else {
        toast({ variant: 'error', message: 'Could not retrieve PDF URL.' })
      }
    } finally {
      setDownloadingPdf(false)
    }
  }

  async function handleSendViaSignNow() {
    if (!generatedDocId) return
    if (!signNowConnected) { setShowSignNowModal(true); return }
    setSendingSignNow(true)
    try {
      const res = await fetch(`/api/documents/${generatedDocId}/send-signnow`, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast({ variant: 'error', message: (json as { error?: string }).error ?? 'Failed to send document.' })
        return
      }
      toast({ variant: 'success', message: 'Document sent for signature via SignNow.' })
    } finally {
      setSendingSignNow(false)
    }
  }

  // ─────────────────────────────────────────
  // Derived
  // ─────────────────────────────────────────

  const filteredClients = clientSearch.trim()
    ? clients.filter(c =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(clientSearch.toLowerCase())
      )
    : clients

  const serviceOptions = form.documentType
    ? (DOC_SERVICE_OPTIONS[form.documentType as DocumentType] ?? [])
    : []

  const canGenerate = !!form.clientId && !!form.documentType && !isGenerating

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">

      {/* ══ LEFT PANEL — Form ══════════════════════════════════════════ */}
      <div className="w-[40%] min-w-[340px] max-w-[520px] flex flex-col border-r border-beige-200 bg-white overflow-y-auto">

        <div className="px-6 py-5 border-b border-beige-100">
          <h1 className="font-serif text-[22px] font-medium text-ink tracking-[-0.4px]">
            Generate Document
          </h1>
          <p className="text-[13px] text-ink-soft font-light mt-0.5">
            AI-drafted, ready to send in seconds.
          </p>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5 flex-1">

          {/* Client selector */}
          <Field label="Client" required>
            <div className="relative" ref={dropRef}>
              {selectedClient ? (
                <div className={cn(
                  'flex items-center justify-between h-9 px-3',
                  'border-[0.5px] border-beige-300 rounded-[8px] bg-white',
                )}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[13px] font-[450] text-ink truncate">{selectedClient.name}</span>
                    {selectedClient.email && (
                      <span className="text-[11.5px] text-ink-soft truncate">{selectedClient.email}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={clearClient}
                    className="shrink-0 p-0.5 text-ink-soft hover:text-ink transition-colors ml-2"
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search
                      size={13}
                      strokeWidth={1.75}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none"
                    />
                    <input
                      type="text"
                      placeholder="Search clients…"
                      value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setShowDrop(true) }}
                      onFocus={() => setShowDrop(true)}
                      className={cn(
                        'w-full h-9 pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-soft',
                        'bg-white border-[0.5px] border-beige-300 rounded-[8px]',
                        'outline-none focus:border-sage-400 transition-colors',
                      )}
                    />
                  </div>

                  {showDrop && (
                    <div className={cn(
                      'absolute z-20 top-10 left-0 right-0',
                      'bg-white border-[0.5px] border-beige-200 rounded-[10px] shadow-panel',
                      'max-h-52 overflow-y-auto',
                    )}>
                      {filteredClients.length === 0 ? (
                        <p className="px-3 py-3 text-[12.5px] text-ink-soft">No clients found.</p>
                      ) : (
                        filteredClients.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectClient(c)}
                            className={cn(
                              'w-full text-left px-3 py-2.5',
                              'hover:bg-beige-50 transition-colors duration-100',
                              'border-b border-beige-100 last:border-0',
                            )}
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

          {/* Document type */}
          <Field label="Document Type" required>
            <SelectInput
              value={form.documentType}
              onChange={v => handleDocTypeChange(v as DocumentType | '')}
              placeholder="Select document type…"
              options={DOC_TYPE_OPTIONS}
            />
          </Field>

          {/* Service type — only shown when the doc type has service options */}
          {serviceOptions.length > 0 && (
            <Field label="Service Type">
              <SelectInput
                value={form.serviceType}
                onChange={v => setField('serviceType', v)}
                placeholder={form.documentType === 'form_2848' ? 'IRS Representation' : 'Select service…'}
                options={serviceOptions}
                disabled={form.documentType === 'form_2848'}
              />
            </Field>
          )}

          {/* Fee amount */}
          <Field label="Fee Amount">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-soft select-none">
                $
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={form.feeAmount}
                onChange={e => setField('feeAmount', e.target.value)}
                placeholder="0"
                className={cn(
                  'w-full h-9 pl-6 pr-3 text-[13px] text-ink placeholder:text-ink-soft',
                  'bg-white border-[0.5px] border-beige-300 rounded-[8px]',
                  'outline-none focus:border-sage-400 transition-colors',
                )}
              />
            </div>
          </Field>

          {/* Jurisdiction */}
          <Field label="Jurisdiction">
            <SelectInput
              value={form.jurisdiction}
              onChange={v => setField('jurisdiction', v)}
              placeholder="Select state…"
              options={US_STATES}
            />
          </Field>

          {/* Special terms */}
          <Field label="Special Terms" hint="Optional · max 500 chars">
            <textarea
              value={form.specialTerms}
              onChange={e => setField('specialTerms', e.target.value.slice(0, 500))}
              placeholder="Custom clauses or instructions for the AI…"
              rows={3}
              className={cn(
                'w-full text-[13px] text-ink placeholder:text-ink-soft/70 font-light',
                'bg-white border-[0.5px] border-beige-300 rounded-[8px]',
                'px-3 py-2 resize-none outline-none',
                'focus:border-sage-400 transition-colors duration-150',
              )}
            />
            {form.specialTerms.length > 0 && (
              <p className="text-[11px] text-ink-soft/60 mt-1 text-right">
                {form.specialTerms.length}/500
              </p>
            )}
          </Field>
        </div>

        {/* Sticky footer — Generate / Regenerate */}
        <div className="px-6 py-4 border-t border-beige-100 flex gap-2 bg-white sticky bottom-0">
          <SageButton
            onClick={handleGenerate}
            disabled={!canGenerate}
            loading={isGenerating}
            className="flex-1"
          >
            {isGenerating ? 'Generating…' : 'Generate'}
          </SageButton>

          {hasGenerated && (
            <GhostButton
              onClick={handleGenerate}
              disabled={isGenerating}
              className="shrink-0"
              title="Regenerate"
            >
              <RefreshCw size={14} strokeWidth={2} />
            </GhostButton>
          )}
        </div>
      </div>

      {/* SignNow not-connected modal */}
      {showSignNowModal && (
        <SignNowRequiredModal onClose={() => setShowSignNowModal(false)} />
      )}

      {/* ══ RIGHT PANEL — Preview ══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col bg-beige-50 overflow-hidden">

        {/* Preview toolbar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-beige-200 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText size={15} strokeWidth={1.75} className="text-ink-soft" />
            <span className="text-[13px] font-[450] text-ink">
              {hasGenerated
                ? `${DOC_TYPE_OPTIONS.find(d => d.value === form.documentType)?.label ?? 'Document'}${selectedClient ? ` — ${selectedClient.name}` : ''}`
                : 'Preview'
              }
            </span>
            {isGenerating && (
              <span className="flex items-center gap-1.5 text-[11.5px] text-sage-500 font-[450]">
                <span className="h-1.5 w-1.5 rounded-full bg-sage-400 animate-pulse shrink-0" />
                Generating…
              </span>
            )}
          </div>

          {/* Action toolbar — only shown after first successful generation */}
          {hasGenerated && (
            <div className="flex items-center gap-1.5">
              <GhostButton
                size="sm"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf || !generatedDocId}
              >
                <Download size={12} strokeWidth={2} />
                {downloadingPdf ? 'Generating…' : 'Download PDF'}
              </GhostButton>
              <GhostButton
                size="sm"
                onClick={handleSendViaSignNow}
                disabled={sendingSignNow || !generatedDocId}
              >
                <Send size={12} strokeWidth={2} />
                {sendingSignNow ? 'Sending…' : 'Send via SignNow'}
              </GhostButton>
              <SageButton size="sm" onClick={handleSaveToClient} disabled={!generatedDocId}>
                <Save size={12} strokeWidth={2} />
                Save to Client
              </SageButton>
            </div>
          )}
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
          {/* ── Generation error panel ── */}
          {genError && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-sm my-auto">
              <div className="h-14 w-14 rounded-[14px] bg-red-50 border border-red-100 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-red-400">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-[14px] font-[500] text-ink mb-1.5">Generation failed</p>
              <p className="text-[13px] text-ink-soft font-light leading-relaxed mb-4">
                Something went wrong while generating your document. This is usually a temporary issue.
              </p>
              <button
                type="button"
                onClick={handleGenerate}
                className="inline-flex items-center gap-2 h-9 px-5 bg-ink text-white text-[13px] font-[450] rounded-[9px] hover:bg-ink/90 transition-colors"
              >
                <RefreshCw size={13} strokeWidth={2} />
                Try again
              </button>
            </div>
          )}

          {!genError && !isGenerating && !hasGenerated ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center max-w-xs my-auto">
              <div className="h-14 w-14 rounded-[14px] bg-beige-100 flex items-center justify-center mb-4">
                <FileText size={26} strokeWidth={1.25} className="text-ink-soft" />
              </div>
              <p className="text-[14px] font-[450] text-ink mb-1.5">Ready to generate</p>
              <p className="text-[13px] text-ink-soft font-light leading-relaxed">
                Select a client and document type, then click Generate.
              </p>
            </div>
          ) : !genError && (
            /* Document paper */
            <div className="w-full max-w-[780px]">
              {/* Loading skeleton — visible until first token arrives */}
              {isGenerating && !hasContentRef.current && (
                <div className="bg-white rounded-[12px] border-[0.5px] border-beige-200 shadow-panel p-10 space-y-3">
                  {[100, 55, 80, 100, 40, 90, 65, 50, 100, 35, 75].map((w, i) => (
                    <div
                      key={i}
                      className="h-3 rounded-full bg-beige-100 animate-pulse"
                      style={{ width: `${w}%`, animationDelay: `${i * 60}ms` }}
                    />
                  ))}
                </div>
              )}

              {/* Iframe renders the streaming HTML in isolation */}
              <iframe
                ref={iframeRef}
                title="Document Preview"
                className={cn(
                  'w-full border-0 rounded-[12px] shadow-panel',
                  'transition-opacity duration-300',
                  // Hide iframe until content starts arriving (skeleton shows instead)
                  isGenerating && !hasContentRef.current ? 'opacity-0 pointer-events-none h-px' : 'opacity-100',
                )}
                style={{ minHeight: '1000px' }}
                srcDoc={`<html><head><style>${PREVIEW_CSS}</style></head><body></body></html>`}
                onLoad={() => {
                  // Re-inject any content that arrived before the iframe finished loading
                  const doc = iframeRef.current?.contentDocument
                  if (doc?.body && accumulatedRef.current) {
                    doc.body.innerHTML = DOMPurify.sanitize(accumulatedRef.current)
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label:     string
  required?: boolean
  hint?:     string
  children:  React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[12px] font-[500] text-ink-mid uppercase tracking-[0.05em]">
          {label}
          {required && <span className="ml-0.5 text-red-400">*</span>}
        </label>
        {hint && <span className="text-[11px] text-ink-soft/70">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function SelectInput({
  value,
  onChange,
  placeholder,
  options,
  disabled,
}: {
  value:       string
  onChange:    (v: string) => void
  placeholder: string
  options:     { value: string; label: string }[]
  disabled?:   boolean
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'w-full h-9 px-3 pr-8 text-[13px] rounded-[8px] appearance-none cursor-pointer',
          'bg-white border-[0.5px] border-beige-300',
          'outline-none focus:border-sage-400 transition-colors duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          value ? 'text-ink' : 'text-ink-soft',
        )}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown
        size={13}
        strokeWidth={2}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none"
      />
    </div>
  )
}
