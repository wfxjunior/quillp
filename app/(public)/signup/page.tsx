'use client'

/**
 * /signup — Account creation
 * blueprint-part2.md §9.1
 *
 * Flow:
 *  1. Validate fields (blur + submit)
 *  2. supabase.auth.signUp() with metadata { name, firm_name }
 *  3. DB trigger creates public.users + public.firms (migration 001/002)
 *  4. Redirect to /onboarding/step-1
 */

import { useState } from 'react'
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
  Divider,
} from '../_components/AuthCard'
import { GoogleButton } from '../_components/GoogleButton'

// ─────────────────────────────────────────
// Validation (blueprint-part2.md §14.1)
// ─────────────────────────────────────────

function validateName(v: string): string {
  if (!v.trim()) return 'Full name is required'
  if (v.trim().length < 2) return 'Must be at least 2 characters'
  if (v.trim().length > 80) return 'Must be under 80 characters'
  return ''
}

function validateEmail(v: string): string {
  if (!v.trim()) return 'Email is required'
  // RFC 5322 simplified
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Enter a valid email address'
  return ''
}

function validateFirmName(v: string): string {
  if (!v.trim()) return 'Firm name is required'
  if (v.trim().length < 2) return 'Must be at least 2 characters'
  if (v.trim().length > 100) return 'Must be under 100 characters'
  return ''
}

function validatePassword(v: string): string {
  if (!v) return 'Password is required'
  if (v.length < 8) return 'Must be at least 8 characters'
  if (!/[A-Z]/.test(v)) return 'Must contain at least one uppercase letter'
  if (!/[0-9]/.test(v)) return 'Must contain at least one number'
  return ''
}

type Fields = 'name' | 'email' | 'firmName' | 'password'

const validators: Record<Fields, (v: string) => string> = {
  name: validateName,
  email: validateEmail,
  firmName: validateFirmName,
  password: validatePassword,
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter()

  const [form, setForm] = useState({ name: '', email: '', firmName: '', password: '' })
  const [errors, setErrors] = useState({ name: '', email: '', firmName: '', password: '' })
  const [touched, setTouched] = useState({ name: false, email: false, firmName: false, password: false })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  function handleChange(field: Fields, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (touched[field]) {
      setErrors(prev => ({ ...prev, [field]: validators[field](value) }))
    }
  }

  function handleBlur(field: Fields) {
    setTouched(prev => ({ ...prev, [field]: true }))
    setErrors(prev => ({ ...prev, [field]: validators[field](form[field]) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Mark all touched + validate all
    const newErrors = {
      name:     validateName(form.name),
      email:    validateEmail(form.email),
      firmName: validateFirmName(form.firmName),
      password: validatePassword(form.password),
    }
    setErrors(newErrors)
    setTouched({ name: true, email: true, firmName: true, password: true })
    if (Object.values(newErrors).some(Boolean)) return

    setLoading(true)
    setServerError('')

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: form.email.toLowerCase().trim(),
      password: form.password,
      options: {
        data: {
          name: form.name.trim(),
          firm_name: form.firmName.trim(),
        },
      },
    })

    console.log('SIGNUP RESULT:', { data, error })

    if (error) {
      // blueprint §9.1 error cases
      setServerError(
        error.message.toLowerCase().includes('already registered') ||
        error.message.toLowerCase().includes('already been registered')
          ? 'An account with this email already exists.'
          : 'Something went wrong. Please try again.'
      )
      setLoading(false)
      return
    }

    // Bootstrap admin role for the designated admin account.
    // The DB trigger creates the users row with role='owner' by default;
    // we immediately promote admintest@admin.com to 'admin'.
    if (data?.user && form.email.toLowerCase().trim() === 'admintest@admin.com') {
      const { error: roleError } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('id', data.user.id)
      console.log('ADMIN ROLE SET:', roleError ? roleError.message : 'success')
    }

    router.push('/onboarding/step-1')
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Set up your practice in under 2 minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-ink font-medium underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
      proof="No credit card required · Free 30-day trial"
    >
      {/* ── Google OAuth ───────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-1">
        <GoogleButton label="Sign up with Google" />
        <Divider label="or" />
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

        {/* ── Full name ──────────────────────────────────── */}
        <Field label="Full name" error={errors.name}>
          <Input
            type="text"
            placeholder="James Rivera"
            value={form.name}
            onChange={e => handleChange('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            autoComplete="name"
            hasError={!!errors.name}
          />
        </Field>

        {/* ── Email ──────────────────────────────────────── */}
        <Field label="Work email" error={errors.email}>
          <Input
            type="email"
            placeholder="james@riveracpa.com"
            value={form.email}
            onChange={e => handleChange('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            autoComplete="email"
            hasError={!!errors.email}
          />
        </Field>

        {/* ── Firm name ──────────────────────────────────── */}
        <Field label="Firm name" error={errors.firmName}>
          <Input
            type="text"
            placeholder="Rivera & Associates CPA"
            value={form.firmName}
            onChange={e => handleChange('firmName', e.target.value)}
            onBlur={() => handleBlur('firmName')}
            autoComplete="organization"
            hasError={!!errors.firmName}
          />
        </Field>

        {/* ── Password ───────────────────────────────────── */}
        <Field
          label="Password"
          error={errors.password}
          hint={!errors.password ? '8+ chars, 1 uppercase, 1 number' : undefined}
        >
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              value={form.password}
              onChange={e => handleChange('password', e.target.value)}
              onBlur={() => handleBlur('password')}
              autoComplete="new-password"
              hasError={!!errors.password}
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
          label="Create account"
          loadingLabel="Creating account…"
        />

        {/* ── Terms ──────────────────────────────────────── */}
        <p className="text-center text-[11.5px] text-ink-soft leading-relaxed">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-ink-mid transition-colors">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-ink-mid transition-colors">
            Privacy Policy
          </Link>.
        </p>
      </form>
    </AuthCard>
  )
}
