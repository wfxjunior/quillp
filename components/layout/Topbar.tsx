'use client'

/**
 * Topbar — fixed top navigation bar
 * blueprint-part1.md §2.2
 *
 * Design:
 *  - Height: 64px, fixed top, left-60 (starts after sidebar)
 *  - Background: beige-50/95 + backdrop-blur
 *  - Border-bottom: beige-200 0.5px
 *  - Left: page title (serif) + subtitle (inter)
 *  - Right: contextual action buttons per route
 *  - Dashboard greeting uses first name + time of day
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Upload, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFirm } from '@/lib/context/firm-context'

// ─────────────────────────────────────────
// Route config
// ─────────────────────────────────────────

interface RouteAction {
  label: string
  href?: string
  icon?: React.ElementType
  variant?: 'primary' | 'secondary'
}

interface RouteConfig {
  title: string | ((firstName: string) => string)
  subtitle: string
  actions?: RouteAction[]
}

const ROUTE_CONFIG: Record<string, RouteConfig> = {
  '/dashboard': {
    title: (firstName) => {
      const hour = new Date().getHours()
      const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
      return `${greeting}, ${firstName}`
    },
    subtitle: 'Here\'s what\'s happening across your practice.',
    actions: [
      { label: 'Add client', href: '/clients/new', icon: Plus, variant: 'primary' },
    ],
  },
  '/clients': {
    title: 'Clients',
    subtitle: 'Manage your client relationships and pipeline.',
    actions: [
      { label: 'Import', href: '/clients/import', icon: Upload, variant: 'secondary' },
      { label: 'Add client', href: '/clients/new', icon: Plus, variant: 'primary' },
    ],
  },
  '/documents': {
    title: 'Documents',
    subtitle: 'All generated and uploaded documents.',
    actions: [
      { label: 'Generate document', href: '/documents/generate', icon: FileText, variant: 'primary' },
    ],
  },
  '/documents/generate': {
    title: 'Generate document',
    subtitle: 'Use AI to draft a professional document.',
  },
  '/deadlines': {
    title: 'Deadlines',
    subtitle: 'Track filing deadlines and tax calendar.',
    actions: [
      { label: 'Add deadline', href: '/deadlines/new', icon: Plus, variant: 'primary' },
    ],
  },
  '/invoices': {
    title: 'Invoices',
    subtitle: 'Billing and payment tracking.',
    actions: [
      { label: 'Create invoice', href: '/invoices/new', icon: Plus, variant: 'primary' },
    ],
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Manage your firm preferences and account.',
  },
}

function getRouteConfig(pathname: string): RouteConfig {
  // Exact match first
  if (ROUTE_CONFIG[pathname]) return ROUTE_CONFIG[pathname]

  // Prefix match (e.g. /clients/abc123 → /clients config)
  const prefixes = ['/clients', '/documents', '/invoices', '/deadlines', '/settings']
  for (const prefix of prefixes) {
    if (pathname.startsWith(prefix + '/')) {
      return ROUTE_CONFIG[prefix]
    }
  }

  return { title: 'Quilp', subtitle: '' }
}

// ─────────────────────────────────────────
// Action button
// ─────────────────────────────────────────

function ActionButton({ action }: { action: RouteAction }) {
  const isPrimary = action.variant === 'primary'
  const Icon = action.icon

  const className = cn(
    'inline-flex items-center gap-1.5 h-8 px-3.5 text-[13px] font-[450] rounded-[8px]',
    'transition-colors duration-150 select-none whitespace-nowrap',
    isPrimary
      ? 'bg-ink text-white hover:bg-ink/[0.85]'
      : 'bg-white text-ink border-[0.5px] border-beige-300 hover:bg-beige-50 hover:border-beige-400'
  )

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {Icon && <Icon size={13} strokeWidth={2} />}
        {action.label}
      </Link>
    )
  }

  return (
    <button type="button" className={className}>
      {Icon && <Icon size={13} strokeWidth={2} />}
      {action.label}
    </button>
  )
}

// ─────────────────────────────────────────
// Topbar
// ─────────────────────────────────────────

export default function Topbar() {
  const pathname = usePathname()
  const { user } = useFirm()

  const firstName = user.name.split(' ')[0]
  const config = getRouteConfig(pathname)

  const title = typeof config.title === 'function'
    ? config.title(firstName)
    : config.title

  return (
    <header
      className={cn(
        'fixed top-0 left-60 right-0 z-30 h-16',
        'flex items-center justify-between px-6',
        'border-b border-beige-200',
      )}
      style={{
        backgroundColor: 'rgba(250,250,246,0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* ── Left: Title + subtitle ───────────────────────────── */}
      <div className="min-w-0">
        <h1 className="font-serif text-[18px] font-medium text-ink tracking-[-0.3px] leading-snug truncate">
          {title}
        </h1>
        {config.subtitle && (
          <p className="text-[12px] text-ink-soft font-light leading-tight truncate">
            {config.subtitle}
          </p>
        )}
      </div>

      {/* ── Right: Contextual actions ────────────────────────── */}
      {config.actions && config.actions.length > 0 && (
        <div className="flex items-center gap-2 ml-4 shrink-0">
          {config.actions.map((action) => (
            <ActionButton key={action.label} action={action} />
          ))}
        </div>
      )}
    </header>
  )
}
