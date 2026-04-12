'use client'

/**
 * AppShell — authenticated layout shell
 * blueprint-part2.md §10.1
 *
 * Receives firm + user + subscription data from the server layout,
 * sets up FirmContext, and renders Sidebar + Topbar + main content.
 */

import { FirmContextProvider, type FirmContextValue } from '@/lib/context/firm-context'
import { ToastProvider } from '@/components/ui/NotificationToast'
import { PaywallOverlay } from '@/components/ui/PaywallOverlay'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

interface AppShellProps {
  value: FirmContextValue
  children: React.ReactNode
}

export default function AppShell({ value, children }: AppShellProps) {
  // §13.11 — subscription expired check
  const isExpired =
    value.subscription.status === 'past_due' ||
    value.subscription.status === 'canceled' ||
    (value.subscription.status === 'trialing' &&
      value.subscription.daysRemaining !== null &&
      value.subscription.daysRemaining <= 0)

  return (
    <FirmContextProvider value={value}>
      <ToastProvider>
      {/* Fixed left sidebar */}
      <Sidebar />

      {/* Main area — offset by sidebar width */}
      <div className="ml-60 min-h-screen flex flex-col bg-beige-50">
        {/* Fixed top bar */}
        <Topbar />

        {/* Page content — offset by topbar height */}
        <main className="flex-1 pt-16">
          {children}
        </main>
      </div>

      {/* §13.11 — Paywall overlay (rendered after children so it layers on top) */}
      {isExpired && (
        <PaywallOverlay
          firmName={value.firm.name}
          trialEndsAt={value.subscription.trialEndsAt}
          daysRemaining={value.subscription.daysRemaining}
        />
      )}
      </ToastProvider>
    </FirmContextProvider>
  )
}
