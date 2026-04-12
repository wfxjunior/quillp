'use client'

/**
 * /reset-password — Set new password
 * blueprint-part2.md §9.4
 *
 * Flow:
 *  1. User arrives here after /auth/callback exchanges the code for a session
 *  2. Supabase session is now active in cookies
 *  3. User enters + confirms new password
 *  4. supabase.auth.updateUser({ password })
 *  5. Redirect to /login with ?reset=success
 *
 * Error case: if user arrives without a valid session (bad/expired link),
 * show an error with a link back to /forgot-password.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  AuthCard,
  Field,
  Input,
  SubmitButton,
  ServerError,
} from '../_components/AuthCard'

function validatePassword(v: string): string {
  if (!v) return 'Password is required'
  if (v.length < 8) return 'Must be at least 8 characters'
  if (!/[A-Z]/.test(v)) return 'Must contain at least one uppercase letter'
  if (!/[0-9]/.test(v)) return 'Must contain at least one number'
  return ''
}

export default function ResetPasswordPage() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [sessionReady, setSessionReady] = useState<boolean | null>(null) // null = checking

  // ── Check that the user has a valid session ─────────────────────
  // The /auth/callback route exchanges the reset code and sets a session.
  // If no session → show "invalid link" state.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setSessionReady(!!data.session)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const passErr = validatePassword(password)
    const confErr = password !== confirm ? 'Passwords do not match' : ''
    setPasswordError(passErr)
    setConfirmError(confErr)
    if (passErr || confErr) return

    setLoading(true)
    setServerError('')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setServerError('Failed to update password. The reset link may have expired.')
      setLoading(false)
      return
    }

    // Sign out so user logs in fresh with the new password
    await supabase.auth.signOut()
    router.push('/login?reset=success')
  }

  // ── Loading check ─────────────────────────────────────────────
  if (sessionReady === null) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <span className="text-[13px] text-ink-soft">Verifying link…</span>
      </div>
    )
  }

  // ── Invalid / expired link ─────────────────────────────────────
  if (sessionReady === false) {
    return (
      <AuthCard
        title="Link expired"
        subtitle="This password reset link is no longer valid."
        footer={
          <Link href="/login" className="text-ink font-medium underline-offset-2 hover:underline">
            ← Back to sign in
          </Link>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-[13.5px] text-ink-mid font-light leading-relaxed">
            Reset links expire after 60 minutes. Request a new one below.
          </p>
          <Link
            href="/forgot-password"
            className="w-full text-center bg-sage-400 hover:bg-sage-600 text-white text-[14px] font-medium py-[14px] rounded transition-colors block"
          >
            Request new link
          </Link>
        </div>
      </AuthCard>
    )
  }

  // ── Reset form ────────────────────────────────────────────────
  return (
    <AuthCard
      title="Set new password"
      subtitle="Choose a strong password for your account."
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

        {/* ── New password ──────────────────────────────── */}
        <Field
          label="New password"
          error={passwordError}
          hint={!passwordError ? '8+ chars, 1 uppercase, 1 number' : undefined}
        >
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              value={password}
              onChange={e => {
                setPassword(e.target.value)
                if (passwordError) setPasswordError(validatePassword(e.target.value))
                if (confirmError && confirm) {
                  setConfirmError(e.target.value !== confirm ? 'Passwords do not match' : '')
                }
              }}
              onBlur={() => setPasswordError(validatePassword(password))}
              autoComplete="new-password"
              hasError={!!passwordError}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink-mid transition-colors"
            >
              {showPassword
                ? <EyeOff size={16} strokeWidth={1.5} />
                : <Eye size={16} strokeWidth={1.5} />
              }
            </button>
          </div>
        </Field>

        {/* ── Confirm password ──────────────────────────── */}
        <Field label="Confirm password" error={confirmError}>
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="Repeat your password"
            value={confirm}
            onChange={e => {
              setConfirm(e.target.value)
              if (confirmError) {
                setConfirmError(password !== e.target.value ? 'Passwords do not match' : '')
              }
            }}
            onBlur={() => setConfirmError(password !== confirm ? 'Passwords do not match' : '')}
            autoComplete="new-password"
            hasError={!!confirmError}
          />
        </Field>

        {/* ── Server error ──────────────────────────────── */}
        <ServerError message={serverError} />

        {/* ── Submit ────────────────────────────────────── */}
        <SubmitButton
          loading={loading}
          label="Update password"
          loadingLabel="Updating…"
        />
      </form>
    </AuthCard>
  )
}
