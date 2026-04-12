/**
 * DocumentRow — single document entry in a list
 * blueprint-part1.md §2.2
 *
 * Contains: icon (colored by status), title, meta, status badge, action button
 */

import { cn } from '@/lib/utils'
import {
  FileText, FileCheck, FileSignature, File,
  type LucideIcon,
} from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { DocumentStatus, DocumentType } from '@/types'

// ─────────────────────────────────────────
// Status → badge variant + label
// ─────────────────────────────────────────

const STATUS_BADGE: Record<DocumentStatus, { label: string; variant: 'green' | 'amber' | 'red' | 'beige' | 'ink' }> = {
  draft:              { label: 'Draft',             variant: 'beige' },
  sent:               { label: 'Sent',              variant: 'amber' },
  awaiting_signature: { label: 'Awaiting Signature',variant: 'amber' },
  signed:             { label: 'Signed',            variant: 'green' },
  paid:               { label: 'Paid',              variant: 'green' },
  archived:           { label: 'Archived',          variant: 'beige' },
}

// Status → icon color
const STATUS_ICON_COLOR: Record<DocumentStatus, string> = {
  draft:              'text-ink-soft',
  sent:               'text-amber-500',
  awaiting_signature: 'text-amber-500',
  signed:             'text-sage-400',
  paid:               'text-sage-400',
  archived:           'text-beige-400',
}

// Type → icon
const TYPE_ICON: Record<DocumentType, LucideIcon> = {
  engagement_letter: FileSignature,
  proposal:          FileText,
  form_2848:         File,
  invoice:           FileCheck,
  checklist:         FileText,
  onboarding_portal: FileText,
  delivery_summary:  FileCheck,
}

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────

interface DocumentRowAction {
  label:         string
  onClick:       () => void
  disabled?:     boolean
  disabledTitle?: string
}

interface DocumentRowProps {
  title: string
  type: DocumentType
  status: DocumentStatus
  /** e.g. "John Smith · Apr 5, 2025" */
  meta?: string
  action?: DocumentRowAction
  onClick?: () => void
  className?: string
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────

export function DocumentRow({
  title,
  type,
  status,
  meta,
  action,
  onClick,
  className,
}: DocumentRowProps) {
  const Icon = TYPE_ICON[type] ?? FileText
  const badge = STATUS_BADGE[status]
  const iconColor = STATUS_ICON_COLOR[status]

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick() } : undefined}
      className={cn(
        'flex items-center gap-3 py-3 px-4',
        'border-b border-beige-100 last:border-0',
        'bg-white',
        onClick && 'cursor-pointer hover:bg-beige-50 transition-colors duration-100',
        className
      )}
    >
      {/* Icon */}
      <div className={cn('shrink-0', iconColor)}>
        <Icon size={18} strokeWidth={1.5} />
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-[450] text-ink truncate">{title}</p>
        {meta && (
          <p className="text-[11.5px] text-ink-soft font-light truncate mt-0.5">{meta}</p>
        )}
      </div>

      {/* Badge */}
      <StatusBadge label={badge.label} variant={badge.variant} />

      {/* Action button */}
      {action && (
        <button
          type="button"
          disabled={action.disabled}
          title={action.disabled ? action.disabledTitle : undefined}
          onClick={(e) => { e.stopPropagation(); if (!action.disabled) action.onClick() }}
          className={cn(
            'ml-1 shrink-0 h-7 px-2.5 text-[11.5px] font-[450]',
            'rounded-[6px] border-[0.5px] border-beige-300',
            'bg-white transition-colors duration-150',
            action.disabled
              ? 'opacity-40 cursor-not-allowed text-ink-mid'
              : 'text-ink-mid hover:text-ink hover:border-beige-400 hover:bg-beige-50 cursor-pointer',
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
