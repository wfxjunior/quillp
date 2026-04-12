/**
 * TimelineItem — single activity timeline event
 * blueprint-part1.md §2.2
 *
 * Dot colors:
 *   - Positive events (document_signed, invoice_paid): sage-400
 *   - Stage changes: ink
 *   - Neutral (note, reminder_sent, file_uploaded, document_sent): beige-400
 *
 * A vertical line connects items via the parent container.
 */

import { cn } from '@/lib/utils'
import type { TimelineEventType } from '@/types'

// ─────────────────────────────────────────
// Dot color config
// ─────────────────────────────────────────

const DOT_COLOR: Record<TimelineEventType, string> = {
  note:             'bg-beige-300 border-beige-400',
  stage_change:     'bg-ink border-ink',
  document_sent:    'bg-beige-300 border-beige-400',
  document_signed:  'bg-sage-400 border-sage-400',
  file_uploaded:    'bg-beige-300 border-beige-400',
  invoice_paid:     'bg-sage-400 border-sage-400',
  reminder_sent:    'bg-beige-300 border-beige-400',
}

// ─────────────────────────────────────────
// Timestamp formatter
// ─────────────────────────────────────────

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1)    return 'Just now'
  if (diffMins < 60)   return `${diffMins}m ago`
  if (diffHours < 24)  return `${diffHours}h ago`
  if (diffDays === 1)  return 'Yesterday'
  if (diffDays < 7)    return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────

interface TimelineItemProps {
  type: TimelineEventType
  title: string
  detail?: string | null
  createdAt: string
  /** If true, the vertical connector line below the dot is hidden (last item) */
  isLast?: boolean
  className?: string
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────

export function TimelineItem({
  type,
  title,
  detail,
  createdAt,
  isLast,
  className,
}: TimelineItemProps) {
  return (
    <div className={cn('flex gap-3', className)}>
      {/* Dot + vertical line */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={cn(
            'h-2.5 w-2.5 rounded-full border mt-[5px] shrink-0',
            DOT_COLOR[type]
          )}
        />
        {!isLast && (
          <div className="w-[1.5px] flex-1 bg-beige-200 mt-1" />
        )}
      </div>

      {/* Content */}
      <div className={cn('pb-4 flex-1 min-w-0', isLast && 'pb-0')}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-[450] text-ink leading-snug">
            {title}
          </p>
          <span className="text-[11px] text-ink-soft whitespace-nowrap mt-px shrink-0">
            {formatTimestamp(createdAt)}
          </span>
        </div>
        {detail && (
          <p className="text-[12px] text-ink-soft font-light mt-1 leading-relaxed">
            {detail}
          </p>
        )}
      </div>
    </div>
  )
}
