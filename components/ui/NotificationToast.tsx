'use client'

/**
 * NotificationToast — temporary pop-up notification
 * blueprint-part1.md §2.6
 *
 * Variants: success (sage green), error (red), info (beige)
 * Auto-dismisses after 4 seconds.
 * Appears in the top-right corner.
 *
 * Usage:
 *   1. Wrap your app in <ToastProvider>
 *   2. Call useToast().show({ message, variant }) from any client component
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  show: (options: { message: string; variant?: ToastVariant }) => void
}

// ─────────────────────────────────────────
// Variant config
// ─────────────────────────────────────────

const VARIANT_CONFIG: Record<ToastVariant, {
  container: string
  icon: typeof CheckCircle
  iconClass: string
}> = {
  success: {
    container: 'bg-white border-sage-200 shadow-panel',
    icon: CheckCircle,
    iconClass: 'text-sage-400',
  },
  error: {
    container: 'bg-white border-red-200 shadow-panel',
    icon: XCircle,
    iconClass: 'text-red-500',
  },
  info: {
    container: 'bg-white border-beige-300 shadow-panel',
    icon: Info,
    iconClass: 'text-ink-mid',
  },
}

// ─────────────────────────────────────────
// Context
// ─────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

// ─────────────────────────────────────────
// Individual toast
// ─────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const config = VARIANT_CONFIG[toast.variant]
  const Icon = config.icon
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), 4000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast.id, onDismiss])

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 px-4 py-3 rounded-[10px]',
        'border-[0.5px] min-w-[280px] max-w-[360px]',
        'animate-in slide-in-from-right-4 fade-in duration-200',
        config.container
      )}
    >
      <Icon size={16} className={cn('shrink-0 mt-px', config.iconClass)} strokeWidth={1.75} />
      <p className="flex-1 text-[13px] text-ink leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-ink-soft hover:text-ink transition-colors -mr-1 -mt-0.5 p-1 rounded"
        aria-label="Dismiss"
      >
        <X size={13} strokeWidth={2} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────
// Provider
// ─────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback(({ message, variant = 'info' }: { message: string; variant?: ToastVariant }) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, variant }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}

      {/* Toast portal — fixed top-right */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ─────────────────────────────────────────
// Hook
// ─────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast() must be called inside <ToastProvider>')
  return ctx
}
