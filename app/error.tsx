'use client'

/**
 * Global error boundary — app/error.tsx
 *
 * Next.js renders this when an unhandled error is thrown
 * in any route segment. Must be a Client Component.
 *
 * Provides a "Try again" button that calls reset() to
 * re-render the segment, and a fallback link to the dashboard.
 */

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-red-400">
            <path
              d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Message */}
        <h1 className="font-serif text-[26px] font-medium text-ink tracking-[-0.5px] mb-3">
          Something went wrong
        </h1>
        <p className="text-[14px] text-ink-soft font-light leading-relaxed mb-7">
          An unexpected error occurred. Your data is safe — try refreshing the page or
          returning to the dashboard.
        </p>

        {/* Error digest (production fingerprint, useful for support) */}
        {error.digest && (
          <p className="text-[11.5px] text-ink-soft/60 font-mono mb-6">
            Error ID: {error.digest}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center h-9 px-5 text-[13.5px] font-[450] bg-ink text-white rounded-[10px] hover:bg-ink/90 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center h-9 px-5 text-[13.5px] font-[450] border border-beige-300 text-ink-mid rounded-[10px] hover:bg-beige-100 hover:text-ink transition-colors"
          >
            Go to dashboard
          </Link>
        </div>

        {/* Support link */}
        <p className="mt-6 text-[12px] text-ink-soft font-light">
          If this keeps happening, contact{' '}
          <a
            href="mailto:support@quilp.com"
            className="underline underline-offset-2 hover:text-ink transition-colors"
          >
            support@quilp.com
          </a>
        </p>
      </div>
    </div>
  )
}
