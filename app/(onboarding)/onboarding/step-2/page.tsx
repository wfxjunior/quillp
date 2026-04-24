'use client'

/**
 * /onboarding/step-2 — Firm Description
 * blueprint-part1.md §1.2, blueprint-part2.md §11.1
 *
 * Two-panel layout:
 *   Left:  Textarea for free-text firm description
 *   Right: AIExtractionPreview updating via debounced API call (800ms)
 *
 * On Continue: saves description_raw + description_parsed to firms table,
 * then navigates to /onboarding/step-3.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OnboardingShell } from '../../_components/OnboardingShell'
import {
  AIExtractionPreview,
  type ExtractionStatus,
} from '../../_components/AIExtractionPreview'
import { PrimaryButton } from '@/components/buttons/PrimaryButton'
import { GhostButton } from '@/components/buttons/GhostButton'
import { cn } from '@/lib/utils'
import type { ParseFirmResult } from '@/lib/ai/parse-firm'

const PLACEHOLDER =
  `I run a solo CPA practice in Tampa, Florida. I do individual 1040s and S-Corps for small businesses. Flat-fee model. About 40 clients.`

const MIN_CHARS_TO_PARSE = 30
const DEBOUNCE_MS = 800

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────

export default function OnboardingStep2Page() {
  const router = useRouter()

  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ExtractionStatus>('idle')
  const [extracted, setExtracted] = useState<ParseFirmResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestDescRef = useRef('')

  // ── Debounced parse call ──────────────────────────────────────────

  const triggerParse = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (text.trim().length < MIN_CHARS_TO_PARSE) {
      setStatus('idle')
      setExtracted(null)
      return
    }

    setStatus('loading')

    debounceRef.current = setTimeout(async () => {
      // Bail if description changed again while waiting
      if (text !== latestDescRef.current) return

      try {
        const res = await fetch('/api/ai/parse-firm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: text }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setErrorMsg(body.error ?? 'Could not extract data.')
          setStatus('error')
          return
        }

        const data: ParseFirmResult = await res.json()
        setExtracted(data)
        setStatus('done')
        setErrorMsg(undefined)
      } catch {
        setErrorMsg('Network error. Check your connection.')
        setStatus('error')
      }
    }, DEBOUNCE_MS)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setDescription(val)
    latestDescRef.current = val
    triggerParse(val)
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  // ── Save and continue ─────────────────────────────────────────────

  async function handleContinue() {
    setSaving(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Get firm_id from users table
    const { data: userRow } = await supabase
      .from('users')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    if (userRow?.firm_id) {
      await supabase
        .from('firms')
        .update({
          description_raw:    description.trim() || null,
          description_parsed: extracted ?? null,
          // Sync top-level fields from extraction for easier querying
          ...(extracted?.primary_state && { primary_state: extracted.primary_state }),
          ...(extracted?.fee_model     && { fee_model: extracted.fee_model }),
          ...(extracted?.services      && { services: extracted.services }),
          ...(extracted?.entity_types  && { entity_types: extracted.entity_types }),
        })
        .eq('id', userRow.firm_id)
    }

    router.push('/onboarding/step-3')
  }

  const charCount = description.length
  const canContinue = true // blueprint: "Continue is always enabled on step 2"

  return (
    <OnboardingShell currentStep={2}>
      {/* Heading */}
      <div className="mb-6">
        <h1 className="font-serif text-[28px] font-medium text-ink tracking-[-0.5px] leading-snug mb-2">
          Describe your practice
        </h1>
        <p className="text-[14px] text-ink-mid font-light leading-relaxed">
          Write a few sentences about your firm. The more detail you give, the better Quilp can
          configure your system.
        </p>
      </div>

      {/* Two-panel layout — stacks on small screens */}
      <div className="flex flex-col lg:flex-row gap-5">

        {/* ── Left: Textarea ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col">
          <div className="relative flex-1">
            <textarea
              value={description}
              onChange={handleChange}
              placeholder={PLACEHOLDER}
              rows={9}
              className={cn(
                'w-full resize-none bg-white text-[14px] text-ink leading-relaxed',
                'border-[0.5px] border-beige-300 rounded-[10px]',
                'px-4 py-3.5 outline-none placeholder:text-ink-soft/60',
                'focus:border-sage-400 transition-colors duration-150',
                'min-h-[220px]'
              )}
            />
            {/* Char count */}
            <span className={cn(
              'absolute bottom-3 right-3 text-[11px] pointer-events-none',
              charCount > 0 ? 'text-ink-soft' : 'text-beige-300'
            )}>
              {charCount}
            </span>
          </div>

          <p className="text-[12px] text-ink-soft font-light mt-2 leading-relaxed">
            Example: <span className="italic">
              &ldquo;Solo CPA in Austin, TX. Individual 1040s, S-Corps, and LLCs.
              Flat-fee pricing. ~60 clients annually.&rdquo;
            </span>
          </p>
        </div>

        {/* ── Right: AI Preview ──────────────────────────────── */}
        <div className="w-full lg:w-72 shrink-0">
          <AIExtractionPreview
            status={status}
            data={extracted}
            errorMessage={errorMsg}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-6">
        <GhostButton
          size="md"
          onClick={() => router.push('/onboarding/step-1')}
        >
          Back
        </GhostButton>
        <PrimaryButton
          size="md"
          loading={saving}
          disabled={!canContinue}
          onClick={handleContinue}
        >
          Continue →
        </PrimaryButton>
      </div>
    </OnboardingShell>
  )
}
