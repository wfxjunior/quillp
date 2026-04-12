/**
 * Onboarding layout — no sidebar, beige background
 * Wraps all /onboarding/* pages.
 */

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-beige-50">
      {children}
    </div>
  )
}
