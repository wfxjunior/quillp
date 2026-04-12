'use client'

/**
 * /login — Authentication
 * blueprint-part2.md §9.2
 *
 * Flow:
 *  1. supabase.auth.signInWithPassword()
 *  2. Check users.onboarding_completed
 *     - false → /onboarding/step-1
 *     - true  → /dashboard
 */

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

// useSearchParams() requires a Suspense boundary in Next.js 14
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resetSuccess = searchParams.get('reset') === 'success'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  function validateEmail(v: string): string {
    if (!v.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Enter a valid email address'
    return ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const emailErr = validateEmail(email)
    setEmailError(emailErr)
    if (emailErr || !password) {
      if (!password) setServerError('Password is required')
      return
    }

    setLoading(true)
    setServerError('')

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    })

    if (error) {
      // blueprint §9.2: never confirm whether email exists
      setServerError('Incorrect email or password.')
      setLoading(false)
      return
    }

    // Check onboarding status — blueprint §9.2 step 3
    const { data: userData } = await supabase
      .from('users')
      .select('onboarding_completed')
      .eq('id', data.user.id)
      .single()

    if (userData?.onboarding_completed) {
      router.push('/dashboard')
    } else {
      router.push('/onboarding/step-1')
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your Quilp account."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="text-ink font-medium underline-offset-2 hover:underline"
          >
            Create one free
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

        {/* ── Password reset success banner ──────────────── */}
        {resetSuccess && (
          <div className="rounded border-[0.5px] border-sage-200 bg-sage-50 px-3.5 py-2.5 text-[13px] text-sage-600 leading-snug">
            Password updated. Sign in with your new password.
          </div>
        )}

        {/* ── Email ──────────────────────────────────────── */}
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

        {/* ── Password ───────────────────────────────────── */}
        <Field
          label="Password"
          hint={
            <Link
              href="/forgot-password"
              className="text-[11.5px] text-ink-soft hover:text-ink-mid transition-colors"
            >
              Forgot password?
            </Link>
          }
        >
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
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

        {/* ── Server error ───────────────────────────────── */}
        <ServerError message={serverError} />

        {/* ── Submit ─────────────────────────────────────── */}
        <SubmitButton
          loading={loading}
          label="Sign in"
          loadingLabel="Signing in…"
        />
      </form>
    </AuthCard>
  )
}
