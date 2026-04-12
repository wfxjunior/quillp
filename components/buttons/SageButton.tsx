/**
 * SageButton — generate / send action button
 * blueprint-part1.md §2.5
 *
 * Sage-400 (#6FA664) background, white text.
 * Used for generate and send actions.
 */

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface SageButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZE: Record<NonNullable<SageButtonProps['size']>, string> = {
  sm: 'h-7 px-3 text-[12px]',
  md: 'h-9 px-4 text-[13px]',
  lg: 'h-11 px-6 text-[14px]',
}

export const SageButton = forwardRef<HTMLButtonElement, SageButtonProps>(
  ({ children, loading, size = 'md', className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2',
        'bg-sage-400 text-white font-[450] rounded-[8px]',
        'hover:bg-sage-600 active:bg-sage-600',
        'transition-colors duration-150 select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        SIZE[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin h-[14px] w-[14px] text-white/70"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : null}
      {children}
    </button>
  )
)

SageButton.displayName = 'SageButton'
