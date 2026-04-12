'use client'

/**
 * /onboarding/step-4 — System Generation
 * blueprint-part1.md §1.2, blueprint-part2.md §19.2
 *
 * Fires generation API on mount while showing an animated checklist.
 * Each item appears with a 600ms delay between them.
 * After all items: shows summary card + "Go to my dashboard" button.
 * Sets users.onboarding_completed = true via the generation API.
 */

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check, Sparkles, FileText, Users, CalendarDays, Receipt, Loader2 } from 'lucide-react'
import { PrimaryButton } from '@/components/buttons/PrimaryButton'
import { OnboardingShell } from '../../_components/OnboardingShell'
import {
  buildGenerationChecklist,
  calcGenerationPreview,
  type GenerationChecklistItem,
} from '@/lib/onboarding/service-mappings'
import { cn } from '@/lib/utils'

const ITEM_DELAY_MS = 600

// ─────────────────────────────────────────
// Checklist item component
// ─────────────────────────────────────────

interface ChecklistItemProps {
  item: GenerationChecklistItem
  state: 'pending' | 'active' | 'done'
}

function AnimatedChecklistItem({ item, state }: ChecklistItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2.5 transition-all duration-300',
        state === 'pending' && 'opacity-0 translate-y-1',
        (state === 'active' || state === 'done') && 'opacity-100 translate-y-0',
      )}
    >
      {/* Icon */}
      <div className={cn(
        'h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300',
        state === 'done'   && 'bg-sage-400',
        state === 'active' && 'bg-beige-200',
        state === 'pending' && 'bg-beige-100',
      )}>
        {state === 'done'   && <Check size={11} strokeWidth={2.5} className="text-white" />}
        {state === 'active' && <Loader2 size={11} strokeWidth={2.5} className="text-ink-soft animate-spin" />}
      </div>

      {/* Label */}
      <span className={cn(
        'text-[13.5px] font-[450] transition-colors duration-300',
        state === 'done'    && 'text-ink',
        state === 'active'  && 'text-ink',
        state === 'pending' && 'text-ink-soft/50',
      )}>
        {item.label}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────
// Summary card
// ─────────────────────────────────────────

interface SummaryCardProps {
  services: string[]
}

function SummaryCard({ services }: SummaryCardProps) {
  const { engagementLetterCount, portalCount, hasDeadlineCalendar } = calcGenerationPreview(services)

  const stats = [
    {
      icon: FileText,
      value: engagementLetterCount,
      label: `Engagement letter${engagementLetterCount !== 1 ? 's' : ''}`,
    },
    portalCount > 0 && {
      icon: Users,
      value: portalCount,
      label: `Client portal template${portalCount !== 1 ? 's' : ''}`,
    },
    hasDeadlineCalendar && {
      icon: CalendarDays,
      value: '1',
      label: 'IRS deadline calendar',
    },
    {
      icon: Receipt,
      value: '1',
      label: 'Invoice template',
    },
  ].filter(Boolean) as Array<{ icon: typeof FileText; value: number | string; label: string }>

  return (
    <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card p-5 mt-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-full bg-sage-100 flex items-center justify-center">
          <Sparkles size={14} className="text-sage-600" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-ink">Your Quilp workspace is ready</p>
          <p className="text-[11.5px] text-ink-soft font-light">Here&apos;s what was generated for your practice:</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="flex items-center gap-2.5 bg-beige-50 rounded-[8px] px-3 py-2.5"
            >
              <div className="h-6 w-6 rounded-md bg-white border-[0.5px] border-beige-200 flex items-center justify-center shrink-0">
                <Icon size={13} className="text-ink-mid" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-ink leading-none">{stat.value}</p>
                <p className="text-[11px] text-ink-soft font-light leading-snug mt-0.5">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Inner page (needs useSearchParams)
// ─────────────────────────────────────────

function Step4Inner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Parse services from URL params (passed from step 3)
  const servicesParam = searchParams.get('services') ?? ''
  const selectedServices = servicesParam ? servicesParam.split(',').filter(Boolean) : []

  const checklist = buildGenerationChecklist(selectedServices)

  // Index of the currently "revealing" item (0-based, -1 = nothing shown yet)
  const [revealedCount,  setRevealedCount]  = useState(0)
  const [apiDone,        setApiDone]        = useState(false)
  const [apiFailed,      setApiFailed]      = useState(false)
  const [showTimeout,    setShowTimeout]    = useState(false)  // §13.10
  const hasStarted = useRef(false)

  const allItemsShown   = revealedCount >= checklist.length
  const allDone         = allItemsShown && apiDone

  // ── Fire API call on mount ──────────────────────────────────────
  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    fetch('/api/onboarding/generate', { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error('Generation failed')
        setApiDone(true)
      })
      .catch(() => {
        setApiFailed(true)
        setApiDone(true) // allow proceeding even if API fails
      })
  }, [])

  // ── §13.10 — 30s timeout escape hatch ──────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setShowTimeout(true), 30_000)
    return () => clearTimeout(t)
  }, [])

  // ── Animate checklist items ─────────────────────────────────────
  useEffect(() => {
    if (revealedCount >= checklist.length) return

    const timer = setTimeout(() => {
      setRevealedCount(prev => prev + 1)
    }, ITEM_DELAY_MS)

    return () => clearTimeout(timer)
  }, [revealedCount, checklist.length])

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────

  return (
    <OnboardingShell currentStep={4}>
      {/* Heading */}
      <div className="mb-6">
        <h1 className="font-serif text-[28px] font-medium text-ink tracking-[-0.5px] leading-snug mb-2">
          {allDone ? 'Your system is ready.' : 'Building your system…'}
        </h1>
        <p className="text-[14px] text-ink-mid font-light leading-relaxed">
          {allDone
            ? 'Everything has been configured for your practice.'
            : 'This takes just a moment. Sit tight.'}
        </p>
      </div>

      {/* Animated checklist */}
      <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card px-5 py-3">
        {checklist.map((item, i) => {
          let state: 'pending' | 'active' | 'done'
          if (i < revealedCount - 1)   state = 'done'
          else if (i === revealedCount - 1) state = allItemsShown ? 'done' : 'active'
          else                          state = 'pending'

          return (
            <AnimatedChecklistItem
              key={item.id}
              item={item}
              state={state}
            />
          )
        })}
      </div>

      {/* API error notice (non-blocking) */}
      {apiFailed && (
        <p className="mt-3 text-[12px] text-amber-600 font-light text-center">
          Some items may not have been created. You can continue — your dashboard will
          show what&apos;s available.
        </p>
      )}

      {/* Summary card — shown after all done */}
      {allDone && selectedServices.length > 0 && (
        <SummaryCard services={selectedServices} />
      )}

      {/* CTA button — shown after all done */}
      {allDone && (
        <div className="mt-6 flex justify-end">
          <PrimaryButton
            size="lg"
            onClick={() => router.push('/dashboard')}
          >
            Go to my dashboard →
          </PrimaryButton>
        </div>
      )}

      {/* §13.10 — Timeout escape hatch after 30s */}
      {!allDone && showTimeout && (
        <div className="mt-5 bg-amber-50 border-[0.5px] border-amber-200 rounded-[12px] px-5 py-4 text-center">
          <p className="text-[13px] text-amber-900 font-[450] mb-1">
            This is taking longer than usual.
          </p>
          <p className="text-[12.5px] text-amber-800 font-light mb-3">
            Your workspace will be ready shortly. You can continue to the dashboard now.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 h-8 px-4 text-[12.5px] font-[450] bg-amber-800 text-white rounded-[8px] hover:bg-amber-900 transition-colors"
          >
            Continue to dashboard
          </Link>
        </div>
      )}
    </OnboardingShell>
  )
}

// ─────────────────────────────────────────
// Page export (Suspense for useSearchParams)
// ─────────────────────────────────────────

export default function OnboardingStep4Page() {
  return (
    <Suspense>
      <Step4Inner />
    </Suspense>
  )
}
