/**
 * Global 404 — app-wide not-found page
 *
 * Shown for any unmatched route that doesn't have a
 * more specific not-found.tsx (e.g. portal has its own).
 */

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Numeral */}
        <p className="font-serif text-[72px] font-medium text-ink/10 leading-none mb-6 select-none">
          404
        </p>

        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-beige-100 flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-ink-soft">
            <path
              d="M9.172 14.828L12 12m0 0l2.828-2.828M12 12L9.172 9.172M12 12l2.828 2.828M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Message */}
        <h1 className="font-serif text-[26px] font-medium text-ink tracking-[-0.5px] mb-3">
          Page not found
        </h1>
        <p className="text-[14px] text-ink-soft font-light leading-relaxed mb-7">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center h-9 px-5 text-[13.5px] font-[450] bg-ink text-white rounded-[10px] hover:bg-ink/90 transition-colors"
          >
            Go to dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center h-9 px-5 text-[13.5px] font-[450] border border-beige-300 text-ink-mid rounded-[10px] hover:bg-beige-100 hover:text-ink transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
