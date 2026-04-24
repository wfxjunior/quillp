'use client'

/**
 * app/global-error.tsx
 *
 * Catches unhandled errors thrown in the root layout itself.
 * Must render its own <html> and <body> since it replaces the root layout.
 * Must be a Client Component.
 *
 * Uses inline styles — Tailwind CSS is not loaded at this level.
 */

import { useEffect } from 'react'
import * as Sentry   from '@sentry/nextjs'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{
        margin: 0,
        padding: 0,
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        backgroundColor: '#FAFAF8',
        color: '#1a1a1a',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', padding: '0 24px' }}>

          {/* Icon */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            backgroundColor: '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: '#f87171' }}>
              <path
                d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.4px', margin: '0 0 10px' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: '0 0 28px', fontWeight: 300 }}>
            An unexpected error occurred. Your data is safe — try refreshing the page or
            returning to the dashboard.
          </p>

          {error.digest && (
            <p style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginBottom: 24 }}>
              Error ID: {error.digest}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                height: 36, padding: '0 20px', fontSize: 13.5, fontWeight: 500,
                background: '#1a1a1a', color: '#fff', border: 'none',
                borderRadius: 10, cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/dashboard"
              style={{
                height: 36, padding: '0 20px', fontSize: 13.5, fontWeight: 500,
                border: '0.5px solid #e5e0d8', color: '#374151', borderRadius: 10,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
              }}
            >
              Go to dashboard
            </a>
          </div>

          <p style={{ marginTop: 24, fontSize: 12, color: '#9ca3af', fontWeight: 300 }}>
            If this keeps happening, contact{' '}
            <a href="mailto:support@quilp.com" style={{ color: '#6b7280', textDecoration: 'underline' }}>
              support@quilp.com
            </a>
          </p>
        </div>
      </body>
    </html>
  )
}
