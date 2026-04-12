/**
 * ChecklistRow — single tax document checklist entry
 * blueprint-part1.md §2.2
 *
 * Contains: checkbox, label, sub-text, status tag (Received/Missing/Awaiting)
 * Checked items show strikethrough label.
 */

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { TaxDocumentStatus } from '@/types'

const STATUS_CONFIG: Record<TaxDocumentStatus, {
  label: string
  variant: 'green' | 'red' | 'amber'
}> = {
  received:  { label: 'Received', variant: 'green' },
  missing:   { label: 'Missing',  variant: 'red'   },
  requested: { label: 'Awaiting', variant: 'amber'  },
}

interface ChecklistRowProps {
  label: string
  status: TaxDocumentStatus
  /** e.g. "Received Apr 5" or "Requested Mar 12" */
  subText?: string
  /** Mark as required */
  required?: boolean
  onToggle?: () => void
  className?: string
}

export function ChecklistRow({
  label,
  status,
  subText,
  required,
  onToggle,
  className,
}: ChecklistRowProps) {
  const isReceived = status === 'received'
  const config = STATUS_CONFIG[status]

  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2.5 px-4',
        'border-b border-beige-100 last:border-0',
        className
      )}
    >
      {/* Checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={isReceived}
        onClick={onToggle}
        disabled={!onToggle}
        className={cn(
          'shrink-0 h-4 w-4 rounded-[4px] border flex items-center justify-center',
          'transition-colors duration-150',
          isReceived
            ? 'bg-sage-400 border-sage-400'
            : 'bg-white border-beige-300 hover:border-sage-400',
          !onToggle && 'cursor-default'
        )}
      >
        {isReceived && <Check size={10} strokeWidth={2.5} className="text-white" />}
      </button>

      {/* Label + sub-text */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-[13px] font-[450] truncate',
          isReceived ? 'text-ink-soft line-through' : 'text-ink',
        )}>
          {label}
          {required && !isReceived && (
            <span className="ml-1 text-red-400 text-[11px]">*</span>
          )}
        </p>
        {subText && (
          <p className="text-[11.5px] text-ink-soft font-light mt-0.5 truncate">
            {subText}
          </p>
        )}
      </div>

      {/* Status badge */}
      <StatusBadge label={config.label} variant={config.variant} />
    </div>
  )
}
