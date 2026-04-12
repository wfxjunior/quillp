/**
 * Quilp component barrel export
 * Import from '@/components' for all shared UI and button components.
 */

// ── UI Components ─────────────────────────────────────────────────

export { MetricCard }           from './ui/MetricCard'
export { StatusBadge }          from './ui/StatusBadge'
export type { StatusBadgeVariant } from './ui/StatusBadge'
export { PipelineTracker }      from './ui/PipelineTracker'
export { DocumentRow }          from './ui/DocumentRow'
export { ChecklistRow }         from './ui/ChecklistRow'
export { DeadlineRow }          from './ui/DeadlineRow'
export { InvoiceRow }           from './ui/InvoiceRow'
export { TimelineItem }         from './ui/TimelineItem'
export {
  ToastProvider,
  useToast,
}                               from './ui/NotificationToast'
export type { ToastVariant }    from './ui/NotificationToast'

// ── Button Components ─────────────────────────────────────────────

export { PrimaryButton }        from './buttons/PrimaryButton'
export { SageButton }           from './buttons/SageButton'
export { GhostButton }          from './buttons/GhostButton'

// ── Layout Components ─────────────────────────────────────────────

export { default as Sidebar }   from './layout/Sidebar'
export { default as Topbar }    from './layout/Topbar'
export { default as AppShell }  from './layout/AppShell'
