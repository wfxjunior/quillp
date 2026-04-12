'use client'

/**
 * Step4Review — Summary + confirmation + submit.
 *
 * Shows a condensed summary of all entered data.
 * Requires confirmation checkbox.
 * Calls POST /api/portal/[token] to finalize submission.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle, Loader2, User, Home, FileText } from 'lucide-react'
import type { Client, TaxDocument } from '@/types'
import type { PersonalData } from './Step2Info'

const FILING_STATUS_LABELS: Record<string, string> = {
  single:             'Single',
  married_jointly:    'Married Filing Jointly',
  married_separately: 'Married Filing Separately',
  head_of_household:  'Head of Household',
  qualifying_widow:   'Qualifying Widow(er)',
}

interface Step4ReviewProps {
  token:        string
  client:       Client
  firmName:     string
  portalData:   PersonalData
  taxDocuments: TaxDocument[]
  uploadedDocs: Record<string, boolean>
}

export function Step4Review({
  token, firmName, portalData, taxDocuments, uploadedDocs,
}: Step4ReviewProps) {
  const [confirmed,   setConfirmed]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [submitted,   setSubmitted]   = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const serverUploaded = new Set(
    taxDocuments.filter(d => d.status === 'received').map(d => d.id)
  )
  const uploadedCount = taxDocuments.filter(
    d => serverUploaded.has(d.id) || uploadedDocs[d.id]
  ).length

  async function handleSubmit() {
    if (!confirmed || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/portal/${token}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ portalData }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Submission failed (${res.status})`)
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submitted success screen ──
  if (submitted) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={28} className="text-sage-600" strokeWidth={1.75} />
        </div>
        <h2 className="font-serif text-[28px] font-medium text-ink mb-2">
          All done!
        </h2>
        <p className="text-[14px] text-ink-soft font-light leading-relaxed max-w-sm mx-auto">
          Your information has been sent to{' '}
          <span className="text-ink font-[450]">{firmName}</span>.
          They&apos;ll review everything and be in touch soon.
        </p>
        <p className="mt-4 text-[12.5px] text-ink-soft font-light">
          You can close this page.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-[26px] font-medium text-ink leading-tight mb-1">
          Review &amp; submit
        </h2>
        <p className="text-[13.5px] text-ink-soft font-light">
          Please review your information before submitting to {firmName}.
        </p>
      </div>

      {/* ── Personal info summary ── */}
      <SummaryCard
        icon={<User size={15} strokeWidth={1.75} className="text-ink-soft" />}
        title="Personal information"
      >
        <SummaryRow label="Name">
          {[portalData.firstName, portalData.lastName].filter(Boolean).join(' ') || '—'}
        </SummaryRow>
        <SummaryRow label="Date of birth">
          {portalData.dob
            ? new Date(portalData.dob + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })
            : '—'}
        </SummaryRow>
        <SummaryRow label="SSN last 4">
          {portalData.ssnLast4 ? `••••${portalData.ssnLast4}` : '—'}
        </SummaryRow>
        <SummaryRow label="Filing status">
          {FILING_STATUS_LABELS[portalData.filingStatus] ?? portalData.filingStatus ?? '—'}
        </SummaryRow>
        <SummaryRow label="Dependents">{portalData.dependents || '0'}</SummaryRow>
      </SummaryCard>

      {/* ── Address summary ── */}
      <SummaryCard
        icon={<Home size={15} strokeWidth={1.75} className="text-ink-soft" />}
        title="Home address"
      >
        <SummaryRow label="Address">
          {[portalData.street, portalData.city, portalData.state, portalData.zip]
            .filter(Boolean).join(', ') || '—'}
        </SummaryRow>
      </SummaryCard>

      {/* ── Bank info (if provided) ── */}
      {(portalData.bankRouting || portalData.bankAccount) && (
        <SummaryCard
          icon={<FileText size={15} strokeWidth={1.75} className="text-ink-soft" />}
          title="Direct deposit"
        >
          {portalData.bankRouting && (
            <SummaryRow label="Routing">{portalData.bankRouting}</SummaryRow>
          )}
          {portalData.bankAccount && (
            <SummaryRow label="Account">
              {'•'.repeat(Math.max(0, portalData.bankAccount.length - 4)) +
                portalData.bankAccount.slice(-4)}
            </SummaryRow>
          )}
        </SummaryCard>
      )}

      {/* ── Documents summary ── */}
      {taxDocuments.length > 0 && (
        <SummaryCard
          icon={<FileText size={15} strokeWidth={1.75} className="text-ink-soft" />}
          title="Documents"
        >
          <div className="space-y-1.5">
            {taxDocuments.map(doc => {
              const isUploaded = serverUploaded.has(doc.id) || uploadedDocs[doc.id]
              return (
                <div key={doc.id} className="flex items-center justify-between">
                  <span className="text-[13px] text-ink-mid">{doc.document_type}</span>
                  {isUploaded ? (
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-sage-600">
                      <CheckCircle size={11} strokeWidth={2} /> Uploaded
                    </span>
                  ) : (
                    <span className="text-[11.5px] text-amber-500">Not uploaded</span>
                  )}
                </div>
              )
            })}
          </div>
          {uploadedCount < taxDocuments.length && (
            <p className="mt-2 text-[12px] text-amber-600 font-light">
              {taxDocuments.length - uploadedCount} document(s) not yet uploaded. Your accountant may follow up.
            </p>
          )}
        </SummaryCard>
      )}

      {/* ── Confirmation ── */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="sr-only"
          />
          <div className={cn(
            'h-5 w-5 rounded-[5px] border-[1.5px] flex items-center justify-center transition-colors',
            confirmed
              ? 'bg-ink border-ink'
              : 'bg-white border-beige-300 group-hover:border-beige-400',
          )}>
            {confirmed && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-[13px] text-ink-mid font-light leading-relaxed">
          I confirm that the information above is accurate and I authorize{' '}
          <span className="font-[450] text-ink">{firmName}</span> to use it for tax preparation purposes.
        </span>
      </label>

      {/* ── Error ── */}
      {error && (
        <p className="text-[13px] text-red-500 font-light">{error}</p>
      )}

      {/* ── Submit button ── */}
      <div className="pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!confirmed || submitting}
          className={cn(
            'inline-flex items-center gap-2 h-10 px-6 text-[13.5px] font-[450] rounded-[10px] transition-colors',
            confirmed && !submitting
              ? 'bg-ink text-white hover:bg-ink/90 cursor-pointer'
              : 'bg-ink/30 text-white cursor-not-allowed',
          )}
        >
          {submitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Submitting…
            </>
          ) : (
            `Submit to ${firmName}`
          )}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function SummaryCard({
  icon, title, children,
}: {
  icon:     React.ReactNode
  title:    string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-beige-200 rounded-[14px] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-beige-100 bg-beige-50">
        {icon}
        <span className="text-[12px] font-[500] text-ink-mid">{title}</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        {children}
      </div>
    </div>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[12.5px] text-ink-soft font-light shrink-0">{label}</span>
      <span className="text-[13px] text-ink text-right">{children}</span>
    </div>
  )
}
