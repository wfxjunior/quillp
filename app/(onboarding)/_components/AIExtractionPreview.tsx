'use client'

/**
 * AIExtractionPreview — real-time AI extraction display panel
 * blueprint-part1.md §2.6, blueprint-part2.md §11.1
 *
 * Shows extracted fields from the firm description:
 *   firm_name, primary_state, fee_model, services, entity_types
 *
 * States:
 *   idle    — "Start typing to see extraction"
 *   loading — pulse skeleton
 *   done    — green dot + value per field (or muted input if null)
 *   error   — error message
 */

import { cn } from '@/lib/utils'
import type { ParseFirmResult } from '@/app/api/ai/parse-firm/route'

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

const FEE_MODEL_LABELS: Record<string, string> = {
  flat_fee: 'Flat fee',
  hourly:   'Hourly',
  retainer: 'Retainer',
  hybrid:   'Hybrid',
}

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California',
  CO:'Colorado', CT:'Connecticut', DE:'Delaware', FL:'Florida', GA:'Georgia',
  HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa',
  KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland',
  MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi', MO:'Missouri',
  MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire', NJ:'New Jersey',
  NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio',
  OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina',
  SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont',
  VA:'Virginia', WA:'Washington', WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming',
  DC:'Washington D.C.',
}

function formatState(code: string | null): string | null {
  if (!code) return null
  return STATE_NAMES[code.toUpperCase()] ?? code
}

function formatServices(services: string[]): string | null {
  if (!services.length) return null
  return services.join(', ')
}

function formatEntityTypes(types: string[]): string | null {
  if (!types.length) return null
  return types
    .map(t => t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    .join(', ')
}

// ─────────────────────────────────────────
// Row sub-component
// ─────────────────────────────────────────

interface ExtractionRowProps {
  label: string
  value: string | null
  loading?: boolean
}

function ExtractionRow({ label, value, loading }: ExtractionRowProps) {
  if (loading) {
    return (
      <div className="flex items-start gap-3 py-2.5 border-b border-beige-100 last:border-0">
        <div className="h-2 w-2 rounded-full bg-beige-200 mt-[5px] shrink-0 animate-pulse" />
        <div className="flex-1">
          <div className="h-2.5 w-16 bg-beige-200 rounded animate-pulse mb-1.5" />
          <div className="h-3 w-32 bg-beige-100 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-beige-100 last:border-0">
      {/* Dot */}
      <div className={cn(
        'h-2 w-2 rounded-full mt-[5px] shrink-0 transition-colors',
        value ? 'bg-sage-400' : 'bg-beige-300'
      )} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-soft mb-0.5">
          {label}
        </p>
        {value ? (
          <p className="text-[13px] font-[450] text-ink leading-snug">{value}</p>
        ) : (
          <p className="text-[13px] text-ink-soft/50 italic font-light">Not detected</p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Main component
// ─────────────────────────────────────────

export type ExtractionStatus = 'idle' | 'loading' | 'done' | 'error'

interface AIExtractionPreviewProps {
  status: ExtractionStatus
  data: ParseFirmResult | null
  errorMessage?: string
}

export function AIExtractionPreview({ status, data, errorMessage }: AIExtractionPreviewProps) {
  const isLoading = status === 'loading'

  return (
    <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-beige-100">
        <div className="flex items-center gap-2">
          <div className={cn(
            'h-1.5 w-1.5 rounded-full transition-colors',
            status === 'done'    && 'bg-sage-400',
            status === 'loading' && 'bg-amber-400 animate-pulse',
            status === 'idle'    && 'bg-beige-300',
            status === 'error'   && 'bg-red-400',
          )} />
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-soft">
            AI Extraction
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-1">
        {status === 'idle' && (
          <p className="text-[13px] text-ink-soft font-light py-6 text-center leading-relaxed">
            Start typing to see your firm&apos;s details extracted in real time.
          </p>
        )}

        {status === 'error' && (
          <p className="text-[13px] text-red-500 font-light py-6 text-center leading-relaxed">
            {errorMessage ?? 'Could not extract data. Keep typing…'}
          </p>
        )}

        {(status === 'loading' || status === 'done') && (
          <div>
            <ExtractionRow
              label="Firm name"
              value={data?.firm_name ?? null}
              loading={isLoading}
            />
            <ExtractionRow
              label="Primary state"
              value={formatState(data?.primary_state ?? null)}
              loading={isLoading}
            />
            <ExtractionRow
              label="Fee model"
              value={data?.fee_model ? FEE_MODEL_LABELS[data.fee_model] ?? data.fee_model : null}
              loading={isLoading}
            />
            <ExtractionRow
              label="Services"
              value={formatServices(data?.services ?? [])}
              loading={isLoading}
            />
            <ExtractionRow
              label="Entity types"
              value={formatEntityTypes(data?.entity_types ?? [])}
              loading={isLoading}
            />
          </div>
        )}
      </div>
    </div>
  )
}
