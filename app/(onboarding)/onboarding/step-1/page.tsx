'use client'

/**
 * /onboarding/step-1 — Account Confirmation
 * blueprint-part1.md §1.2
 *
 * Confirms the user's name and email from signup.
 * Allows minor corrections before continuing.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OnboardingShell } from '../../_components/OnboardingShell'
import { PrimaryButton } from '@/components/buttons/PrimaryButton'
import { GhostButton } from '@/components/buttons/GhostButton'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────
// Inline field — mirrors AuthCard/Input style
// ─────────────────────────────────────────

interface FieldProps {
  label: string
  children: React.ReactNode
  error?: string
}

function Field({ label, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-ink">{label}</label>
      {children}
      {error && <p className="text-[12px] text-red-500 leading-snug">{error}</p>}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean
}

function Input({ hasError, className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'w-full bg-white text-[14px] text-ink placeholder:text-ink-soft',
        'border-[0.5px] rounded px-4 py-[13px]',
        'outline-none transition-colors duration-150',
        hasError ? 'border-red-400 focus:border-red-400' : 'border-beige-300 focus:border-sage-400',
        className
      )}
      {...props}
    />
  )
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────

export default function OnboardingStep1Page() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [nameError, setNameError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  // Load user data from Supabase session
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setEmail(data.user.email ?? '')
      setName(data.user.user_metadata?.name ?? '')
      setFetching(false)
    })
  }, [router])

  function validateName(v: string): string {
    if (!v.trim()) return 'Name is required'
    if (v.trim().length < 2) return 'Name must be at least 2 characters'
    return ''
  }

  async function handleContinue() {
    const err = validateName(name)
    setNameError(err)
    if (err) return

    setLoading(true)
    const supabase = createClient()

    // Update the name in public.users
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('users')
        .update({ name: name.trim() })
        .eq('id', user.id)
    }

    router.push('/onboarding/step-2')
  }

  if (fetching) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="h-5 w-5 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <OnboardingShell currentStep={1}>
      {/* Heading */}
      <div className="mb-8">
        <h1 className="font-serif text-[28px] font-medium text-ink tracking-[-0.5px] leading-snug mb-2">
          Let&apos;s confirm your details
        </h1>
        <p className="text-[14px] text-ink-mid font-light leading-relaxed">
          Review your name and email before we set up your firm profile.
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-4">
        <Field label="Your name" error={nameError}>
          <Input
            type="text"
            value={name}
            onChange={e => {
              setName(e.target.value)
              if (nameError) setNameError(validateName(e.target.value))
            }}
            onBlur={() => setNameError(validateName(name))}
            placeholder="Your full name"
            autoComplete="name"
            hasError={!!nameError}
          />
        </Field>

        <Field label="Email address">
          <Input
            type="email"
            value={email}
            disabled
            className="opacity-50 cursor-not-allowed"
          />
          <p className="text-[11.5px] text-ink-soft font-light -mt-1">
            Your email can&apos;t be changed here. Contact support if needed.
          </p>
        </Field>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <GhostButton
            size="md"
            onClick={() => router.push('/login')}
          >
            Back
          </GhostButton>
          <PrimaryButton
            size="md"
            loading={loading}
            onClick={handleContinue}
          >
            Continue →
          </PrimaryButton>
        </div>
      </div>
    </OnboardingShell>
  )
}
