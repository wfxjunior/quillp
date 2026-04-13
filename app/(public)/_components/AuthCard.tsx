/**
 * AuthCard — shared shell for all auth pages.
 * Stateless; safe to import from 'use client' pages.
 *
 * Exports:
 *   AuthCard  — full-page wrapper (logo + card + footer)
 *   Field     — label + error wrapper for form inputs
 *   Input     — styled <input> matching the Quilp design system
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

// ─────────────────────────────────────────
// AuthCard shell
// ─────────────────────────────────────────

interface AuthCardProps {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
  /** Slim trust-line below the card e.g. "No credit card required" */
  proof?: React.ReactNode
}

export function AuthCard({ title, subtitle, children, footer, proof }: AuthCardProps) {
  return (
    <div className="min-h-screen bg-beige-50 flex flex-col items-center justify-center px-4 py-16">

      {/* ── Logo ───────────────────────────────────────────────── */}
      <Link
        href="/"
        className="font-serif text-[22px] font-medium text-ink tracking-[-0.5px] mb-8 block select-none"
      >
        Quilp<span className="text-sage-400">.</span>
      </Link>

      {/* ── Card ───────────────────────────────────────────────── */}
      <div className="w-full max-w-[420px] bg-white border-[0.5px] border-beige-200 rounded-lg shadow-panel">

        {/* Card header */}
        <div className="px-8 pt-8 pb-6 border-b border-beige-100">
          <h1 className="font-serif text-[24px] font-medium text-ink tracking-[-0.5px] leading-snug mb-1.5">
            {title}
          </h1>
          <p className="text-[13.5px] text-ink-mid font-light leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Card body */}
        <div className="px-8 py-7">
          {children}
        </div>
      </div>

      {/* ── Footer slot ────────────────────────────────────────── */}
      {footer && (
        <div className="mt-5 text-[13px] text-ink-mid text-center">
          {footer}
        </div>
      )}

      {/* ── Proof line ─────────────────────────────────────────── */}
      {proof && (
        <div className="mt-3 text-[12px] text-ink-soft text-center">
          {proof}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// Field — label + input slot + error
// ─────────────────────────────────────────

interface FieldProps {
  label: string
  error?: string
  hint?: React.ReactNode
  children: React.ReactNode
}

export function Field({ label, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[13px] font-medium text-ink">
          {label}
        </label>
        {hint && !error && (
          <span className="text-[11.5px] text-ink-soft font-light">{hint}</span>
        )}
      </div>
      {children}
      {error && (
        <p className="text-[12px] text-red-500 leading-snug">{error}</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// Input — styled text input
// ─────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ hasError, className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        // Base
        'w-full bg-white text-[14px] text-ink placeholder:text-ink-soft',
        'border-[0.5px] rounded px-4 py-[13px]',
        'outline-none transition-colors duration-150',
        // Default border
        'border-beige-300',
        // Focus
        'focus:border-sage-400',
        // Error
        hasError && 'border-red-400 focus:border-red-400',
        className
      )}
      {...props}
    />
  )
)

Input.displayName = 'Input'

// ─────────────────────────────────────────
// SubmitButton — sage CTA
// ─────────────────────────────────────────

interface SubmitButtonProps {
  loading?: boolean
  label: string
  loadingLabel?: string
}

export function SubmitButton({ loading, label, loadingLabel }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={cn(
        'w-full bg-sage-400 hover:bg-sage-600 text-white',
        'text-[14px] font-medium py-[14px] rounded',
        'transition-colors duration-150',
        'flex items-center justify-center gap-2',
        'disabled:opacity-60 disabled:cursor-not-allowed'
      )}
    >
      {loading && (
        <svg
          className="animate-spin h-[15px] w-[15px] text-white/70"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {loading ? (loadingLabel ?? label) : label}
    </button>
  )
}

// ─────────────────────────────────────────
// ServerError — error banner
// ─────────────────────────────────────────

export function ServerError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="rounded border-[0.5px] border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-600 leading-snug">
      {message}
    </div>
  )
}

// ─────────────────────────────────────────
// Divider
// ─────────────────────────────────────────

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="border-[0.5px] border-beige-200 my-1" />
  return (
    <div className="flex items-center gap-3 my-1">
      <hr className="flex-1 border-[0.5px] border-beige-200" />
      <span className="text-[11.5px] text-ink-soft">{label}</span>
      <hr className="flex-1 border-[0.5px] border-beige-200" />
    </div>
  )
}
