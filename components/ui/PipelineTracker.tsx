/**
 * PipelineTracker — horizontal stage progress bar
 * blueprint-part1.md §2.2
 *
 * Stages: engaged → onboarding → docs_received →
 *         in_progress → review → filed_invoiced
 *
 * - Completed stages: sage-400 bg, white text, sage connector line
 * - Active stage: ink bg, white text
 * - Upcoming stages: beige-100 bg, ink-soft text
 */

import { cn } from '@/lib/utils'
import type { PipelineStage } from '@/types'

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: 'engaged',       label: 'Engaged' },
  { key: 'onboarding',    label: 'Onboarding' },
  { key: 'docs_received', label: 'Docs Received' },
  { key: 'in_progress',   label: 'In Progress' },
  { key: 'review',        label: 'Review' },
  { key: 'filed_invoiced',label: 'Filed & Invoiced' },
]

const STAGE_ORDER: Record<PipelineStage, number> = {
  engaged:        0,
  onboarding:     1,
  docs_received:  2,
  in_progress:    3,
  review:         4,
  filed_invoiced: 5,
}

interface PipelineTrackerProps {
  currentStage: PipelineStage
  /** Called when user clicks a stage chip to advance/set the stage */
  onStageChange?: (stage: PipelineStage) => void
  className?: string
}

export function PipelineTracker({ currentStage, onStageChange, className }: PipelineTrackerProps) {
  const activeIndex = STAGE_ORDER[currentStage]

  return (
    <div className={cn('flex items-center w-full', className)}>
      {STAGES.map((stage, i) => {
        const isCompleted = i < activeIndex
        const isActive    = i === activeIndex
        const isUpcoming  = i > activeIndex
        const isLast      = i === STAGES.length - 1

        return (
          <div key={stage.key} className="flex items-center flex-1 min-w-0">
            {/* Stage chip */}
            <button
              type="button"
              onClick={() => onStageChange?.(stage.key)}
              disabled={!onStageChange}
              title={stage.label}
              className={cn(
                'flex-1 min-w-0 h-7 px-2 rounded-[6px] text-[11px] font-medium truncate',
                'transition-colors duration-150 select-none text-center',
                isCompleted && 'bg-sage-400 text-white cursor-pointer hover:bg-sage-600',
                isActive    && 'bg-ink text-white cursor-default',
                isUpcoming  && 'bg-beige-100 text-ink-soft cursor-pointer hover:bg-beige-200',
                !onStageChange && 'cursor-default',
              )}
            >
              {stage.label}
            </button>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  'h-[1.5px] w-2 shrink-0',
                  isCompleted ? 'bg-sage-400' : 'bg-beige-300'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
