'use client'

/**
 * /forgot-password — Password reset request
 * blueprint-part2.md §9.4
 *
 * Flow:
 *  1. User enters email
 *  2. supabase.auth.resetPasswordForEmail() with redirectTo → /auth/callback?next=/reset-password
 *  3. Show confirmation regardless of whether the email exists (security best practice)
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  AuthCard,
  Field,
  Input,
  SubmitButton,
  ServerError,
} from '../_components/AuthCard'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState('')

  function validateEmail(v: string): string {
    if (!v.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Enter a valid email address'
    return ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const err = validateEmail(email)
    setEmailError(err)
    if (err) return

    setLoading(true)
    setServerError('')

    const supabase = createClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.toLowerCase().trim(),
      {
        redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
      }
    )

    // blueprint §9.4: show confirmation regardless (do not reveal if email exists)
    if (error && !error.message.toLowerCase().includes('email')) {
      setServerError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    setLoading(false)
    setSent(true)
  }

  // ── Success state ─────────────────────────────────────────────────
  if (sent) {
    return (
      <AuthCard
        title="Check your inbox"
        subtitle={`We sent a password reset link to ${email}`}
        footer={
          <Link href="/login" className="text-ink font-medium underline-offset-2 hover:underline">
            ← Back to sign in
          </Link>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Confirmation card */}
          <div className="bg-sage-50 border-[0.5px] border-sage-200 rounded px-4 py-4">
            <p className="text-[13.5px] text-ink-mid font-light leading-relaxed">
              The link expires in <span className="font-medium text-ink">60 minutes</span>.
              If you don&apos;t see it, check your spam folder.
            </p>
          </div>

          {/* Resend */}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-[13px] text-ink-mid hover:text-ink transition-colors text-center"
          >
            Didn&apos;t receive it? Try again
          </button>
        </div>
      </AuthCard>
    )
  }

  // ── Form state ────────────────────────────────────────────────────
  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link href="/login" className="text-ink font-medium underline-offset-2 hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

        <Field label="Email" error={emailError}>
          <Input
            type="email"
            placeholder="you@yourfirm.com"
            value={email}
            onChange={e => {
              setEmail(e.target.value)
              if (emailError) setEmailError(validateEmail(e.target.value))
            }}
            onBlur={() => setEmailError(validateEmail(email))}
            autoComplete="email"
            hasError={!!emailError}
          />
        </Field>

        <ServerError message={serverError} />

        <SubmitButton
          loading={loading}
          label="Send reset link"
          loadingLabel="Sending…"
        />
      </form>
    </AuthCard>
  )
}
