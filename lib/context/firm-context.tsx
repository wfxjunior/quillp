'use client'

/**
 * FirmContext — global authenticated app context
 * blueprint-part2.md §10.2
 *
 * Populated server-side in app/(app)/layout.tsx and passed as props
 * to AppShell, which wraps everything in this provider.
 *
 * All client components inside (app) can call useFirm() to read
 * the current firm and user without additional fetching.
 */

import { createContext, useContext } from 'react'
import type { Firm, User, SubscriptionPlan, SubscriptionStatus } from '@/types'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface FirmContextValue {
  firm: Firm
  user: User
  subscription: {
    plan: SubscriptionPlan
    status: SubscriptionStatus
    trialEndsAt: string | null
    daysRemaining: number | null
  }
}

// ─────────────────────────────────────────
// Context
// ─────────────────────────────────────────

const FirmContext = createContext<FirmContextValue | null>(null)

// ─────────────────────────────────────────
// Provider
// ─────────────────────────────────────────

interface FirmContextProviderProps {
  value: FirmContextValue
  children: React.ReactNode
}

export function FirmContextProvider({ value, children }: FirmContextProviderProps) {
  return <FirmContext.Provider value={value}>{children}</FirmContext.Provider>
}

// ─────────────────────────────────────────
// Hook
// ─────────────────────────────────────────

export function useFirm(): FirmContextValue {
  const ctx = useContext(FirmContext)
  if (!ctx) throw new Error('useFirm() must be called inside <FirmContextProvider>')
  return ctx
}
