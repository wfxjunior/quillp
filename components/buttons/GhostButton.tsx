/**
 * GhostButton — secondary action button
 * blueprint-part1.md §2.5
 *
 * Transparent background, ink text, beige-300 border.
 * Used for secondary / tertiary actions.
 */

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface GhostButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg'
}

const SIZE: Record<NonNullable<GhostButtonProps['size']>, string> = {
  sm: 'h-7 px-3 text-[12px]',
  md: 'h-9 px-4 text-[13px]',
  lg: 'h-11 px-6 text-[14px]',
}

export const GhostButton = forwardRef<HTMLButtonElement, GhostButtonProps>(
  ({ children, size = 'md', className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2',
        'bg-transparent text-ink font-[450] rounded-[8px]',
        'border-[0.5px] border-beige-300',
        'hover:bg-beige-50 hover:border-beige-400',
        'active:bg-beige-100',
        'transition-colors duration-150 select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        SIZE[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
)

GhostButton.displayName = 'GhostButton'
