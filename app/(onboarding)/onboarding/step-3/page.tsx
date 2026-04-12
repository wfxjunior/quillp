'use client'

/**
 * /onboarding/step-3 — Service Selection
 * blueprint-part1.md §1.2
 *
 * ChipGroup of all supported services.
 * Pre-selected from AI-extracted services (step 2).
 * Live "will generate" preview below the chips.
 * On continue: saves firms.services → navigates to step-4
 * with selected services encoded in URL params.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OnboardingShell } from '../../_components/OnboardingShell'
import { PrimaryButton } from '@/components/buttons/PrimaryButton'
import { GhostButton } from '@/components/buttons/GhostButton'
import {
  SERVICE_OPTIONS,
  calcGenerationPreview,
  type ServiceOption,
} from '@/lib/onboarding/service-mappings'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────
// Chip component
// ─────────────────────────────────────────

interface ChipProps {
  option: ServiceOption
  selected: boolean
  onToggle: () => void
}

function Chip({ option, selected, onToggle }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'h-9 px-4 rounded-[8px] text-[13px] font-[450]',
        'border-[0.5px] transition-all duration-150 select-none',
        selected
          ? 'bg-ink text-white border-ink'
          : 'bg-white text-ink-mid border-beige-300 hover:border-beige-400 hover:text-ink hover:bg-beige-50',
      )}
    >
      {option.label}
    </button>
  )
}

// ─────────────────────────────────────────
// "Will generate" preview panel
// ─────────────────────────────────────────

interface GenerationPreviewPanelProps {
  selected: string[]
}

function GenerationPreviewPanel({ selected }: GenerationPreviewPanelProps) {
  if (!selected.length) {
    return (
      <div className="rounded-[10px] border-[0.5px] border-beige-200 bg-beige-50 px-5 py-4">
        <p className="text-[13px] text-ink-soft font-light text-center">
          Select at least one service to see what Quilp will generate.
        </p>
      </div>
    )
  }

  const { engagementLetterCount, portalCount, hasDeadlineCalendar } = calcGenerationPreview(selected)

  const parts: string[] = []
  if (engagementLetterCount) {
    parts.push(`${engagementLetterCount} engagement letter${engagementLetterCount > 1 ? 's' : ''}`)
  }
  if (portalCount) {
    parts.push(`${portalCount} client portal template${portalCount > 1 ? 's' : ''}`)
  }
  if (hasDeadlineCalendar) {
    parts.push('IRS filing deadline calendar')
  }
  parts.push('invoice templates')

  return (
    <div className="rounded-[10px] border-[0.5px] border-sage-200 bg-sage-50 px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-sage-600 mb-1.5">
        Based on your selection, Quilp will generate:
      </p>
      <p className="text-[13.5px] font-[450] text-ink leading-relaxed">
        {parts.map((part, i) => (
          <span key={part}>
            {i > 0 && (
              <span className="text-sage-400 mx-1.5">·</span>
            )}
            {part}
          </span>
        ))}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────

export default function OnboardingStep3Page() {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  // Load pre-selected services from firms.services (saved in step 2)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }

      const { data: userRow } = await supabase
        .from('users')
        .select('firm_id')
        .eq('id', data.user.id)
        .single()

      if (userRow?.firm_id) {
        const { data: firmRow } = await supabase
          .from('firms')
          .select('services')
          .eq('id', userRow.firm_id)
          .single()

        if (firmRow?.services?.length) {
          // Only pre-select services that exist in our options list
          const known = SERVICE_OPTIONS.map(o => o.value)
          setSelected(firmRow.services.filter((s: string) => known.includes(s)))
        }
      }

      setFetching(false)
    })
  }, [router])

  function toggleService(value: string) {
    setSelected(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    )
  }

  async function handleContinue() {
    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: userRow } = await supabase
      .from('users')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    if (userRow?.firm_id) {
      await supabase
        .from('firms')
        .update({ services: selected })
        .eq('id', userRow.firm_id)
    }

    // Pass selected services to step 4 via URL params
    const params = new URLSearchParams({ services: selected.join(',') })
    router.push(`/onboarding/step-4?${params.toString()}`)
  }

  if (fetching) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="h-5 w-5 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
      </div>
    )
  }

  // Group services by category
  const taxServices      = SERVICE_OPTIONS.filter(o => o.category === 'tax')
  const advisoryServices = SERVICE_OPTIONS.filter(o => o.category === 'advisory')
  const complianceServices = SERVICE_OPTIONS.filter(o => o.category === 'compliance')

  return (
    <OnboardingShell currentStep={3}>
      {/* Heading */}
      <div className="mb-7">
        <h1 className="font-serif text-[28px] font-medium text-ink tracking-[-0.5px] leading-snug mb-2">
          What services do you offer?
        </h1>
        <p className="text-[14px] text-ink-mid font-light leading-relaxed">
          Select all that apply. Quilp will generate the right documents for each one.
          {selected.length > 0 && (
            <span className="ml-1 text-ink-soft">
              {selected.length} selected.
            </span>
          )}
        </p>
      </div>

      {/* Service groups */}
      <div className="flex flex-col gap-5">
        <ServiceGroup
          label="Tax Returns"
          options={taxServices}
          selected={selected}
          onToggle={toggleService}
        />
        <ServiceGroup
          label="Advisory & Bookkeeping"
          options={advisoryServices}
          selected={selected}
          onToggle={toggleService}
        />
        <ServiceGroup
          label="Compliance"
          options={complianceServices}
          selected={selected}
          onToggle={toggleService}
        />
      </div>

      {/* Generation preview */}
      <div className="mt-6">
        <GenerationPreviewPanel selected={selected} />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-6">
        <GhostButton size="md" onClick={() => router.push('/onboarding/step-2')}>
          Back
        </GhostButton>
        <PrimaryButton
          size="md"
          loading={loading}
          disabled={selected.length === 0}
          onClick={handleContinue}
        >
          Generate my system →
        </PrimaryButton>
      </div>
    </OnboardingShell>
  )
}

// ─────────────────────────────────────────
// Service group sub-component
// ─────────────────────────────────────────

interface ServiceGroupProps {
  label: string
  options: ServiceOption[]
  selected: string[]
  onToggle: (value: string) => void
}

function ServiceGroup({ label, options, selected, onToggle }: ServiceGroupProps) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-soft mb-2">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map(option => (
          <Chip
            key={option.value}
            option={option}
            selected={selected.includes(option.value)}
            onToggle={() => onToggle(option.value)}
          />
        ))}
      </div>
    </div>
  )
}
