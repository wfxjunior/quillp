/**
 * MetricCard — summary statistic tile
 * blueprint-part1.md §2.2
 *
 * Props:
 *   label     — small uppercase label above the value
 *   value     — large prominent number or string
 *   subLabel  — smaller note below the value
 *   tag       — optional colored pill {label, variant}
 */

import { cn } from '@/lib/utils'
import { StatusBadge, type StatusBadgeVariant } from './StatusBadge'

interface MetricCardTag {
  label: string
  variant: StatusBadgeVariant
}

interface MetricCardProps {
  label: string
  value: string | number
  subLabel?: string
  tag?: MetricCardTag
  className?: string
}

export function MetricCard({ label, value, subLabel, tag, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        'bg-white border-[0.5px] border-beige-200 rounded-[16px]',
        'px-5 py-4 flex flex-col gap-1',
        'shadow-card',
        className
      )}
    >
      {/* Label */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-soft">
        {label}
      </p>

      {/* Value */}
      <p className="font-serif text-[28px] font-medium text-ink tracking-[-0.5px] leading-none">
        {value}
      </p>

      {/* Sub-label + optional tag */}
      <div className="flex items-center justify-between mt-0.5">
        {subLabel && (
          <p className="text-[12px] text-ink-soft font-light leading-snug">
            {subLabel}
          </p>
        )}
        {tag && (
          <StatusBadge label={tag.label} variant={tag.variant} />
        )}
      </div>
    </div>
  )
}
