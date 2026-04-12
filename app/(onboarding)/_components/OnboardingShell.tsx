/**
 * OnboardingShell — shared page wrapper for all onboarding steps
 *
 * Provides a consistent two-column layout:
 *   Left: StepSidebar (fixed width)
 *   Right: Page content
 */

import { StepSidebar } from './StepSidebar'

interface OnboardingShellProps {
  currentStep: 1 | 2 | 3 | 4
  children: React.ReactNode
}

export function OnboardingShell({ currentStep, children }: OnboardingShellProps) {
  return (
    <div className="min-h-screen bg-beige-50 flex">
      {/* Left: Step sidebar — fixed column */}
      <div className="hidden md:flex flex-col px-10 py-10 border-r border-beige-200 bg-white/60 min-h-screen">
        <StepSidebar currentStep={currentStep} />
      </div>

      {/* Right: Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 min-h-screen">
        <div className="w-full max-w-xl">
          {children}
        </div>
      </div>
    </div>
  )
}
