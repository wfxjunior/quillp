/**
 * StatusBadge — reusable pill component
 * blueprint-part1.md §2.2
 *
 * Variants: green, amber, red, beige, ink
 */

import { cn } from '@/lib/utils'

export type StatusBadgeVariant = 'green' | 'amber' | 'red' | 'beige' | 'ink'

interface StatusBadgeProps {
  label: string
  variant: StatusBadgeVariant
  className?: string
}

const VARIANT_STYLES: Record<StatusBadgeVariant, string> = {
  green: 'bg-sage-100 text-sage-600 border-sage-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red:   'bg-red-50 text-red-600 border-red-200',
  beige: 'bg-beige-100 text-ink-mid border-beige-200',
  ink:   'bg-ink text-white border-transparent',
}

export function StatusBadge({ label, variant, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5',
        'text-[11px] font-medium leading-none rounded-full',
        'border-[0.5px] whitespace-nowrap',
        VARIANT_STYLES[variant],
        className
      )}
    >
      {label}
    </span>
  )
}
