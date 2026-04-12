/**
 * StepSidebar — vertical step progress indicator
 * blueprint-part1.md §2.4
 *
 * Used in the onboarding flow. Shows steps 1–4 with status icons:
 *   completed → sage check circle
 *   active    → ink filled circle with step number
 *   idle      → beige-200 circle with muted number
 */

import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  number: number
  label: string
  href: string
}

const STEPS: Step[] = [
  { number: 1, label: 'Your account',     href: '/onboarding/step-1' },
  { number: 2, label: 'Describe your firm', href: '/onboarding/step-2' },
  { number: 3, label: 'Your services',    href: '/onboarding/step-3' },
  { number: 4, label: 'Generate system',  href: '/onboarding/step-4' },
]

interface StepSidebarProps {
  currentStep: 1 | 2 | 3 | 4
}

export function StepSidebar({ currentStep }: StepSidebarProps) {
  return (
    <aside className="w-52 shrink-0">
      {/* Wordmark */}
      <Link
        href="/dashboard"
        className="font-serif text-[20px] font-medium text-ink tracking-[-0.4px] block select-none mb-8"
      >
        Quil<span className="text-sage-400">p</span>
      </Link>

      {/* Steps */}
      <ol className="flex flex-col gap-0">
        {STEPS.map((step, i) => {
          const isCompleted = step.number < currentStep
          const isActive    = step.number === currentStep
          const isIdle      = step.number > currentStep
          const isLast      = i === STEPS.length - 1

          return (
            <li key={step.number} className="flex gap-3">
              {/* Icon + connector */}
              <div className="flex flex-col items-center">
                {/* Circle */}
                <div
                  className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center shrink-0',
                    'text-[11px] font-semibold transition-colors',
                    isCompleted && 'bg-sage-400',
                    isActive    && 'bg-ink',
                    isIdle      && 'bg-beige-200',
                  )}
                >
                  {isCompleted ? (
                    <Check size={12} strokeWidth={2.5} className="text-white" />
                  ) : (
                    <span className={cn(
                      isActive ? 'text-white' : 'text-ink-soft'
                    )}>
                      {step.number}
                    </span>
                  )}
                </div>

                {/* Vertical connector */}
                {!isLast && (
                  <div className={cn(
                    'w-[1.5px] flex-1 my-1',
                    isCompleted ? 'bg-sage-200' : 'bg-beige-200'
                  )} style={{ minHeight: '20px' }} />
                )}
              </div>

              {/* Label */}
              <div className="pb-5">
                <span
                  className={cn(
                    'text-[13px] font-[450] leading-tight',
                    isActive    && 'text-ink',
                    isCompleted && 'text-ink-mid',
                    isIdle      && 'text-ink-soft',
                  )}
                >
                  {step.label}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
