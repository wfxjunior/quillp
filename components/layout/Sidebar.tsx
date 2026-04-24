'use client'

/**
 * Sidebar — fixed left navigation panel
 * blueprint-part1.md §2.1
 *
 * Design:
 *  - Background: ink (#1A1916)
 *  - Width: 240px, fixed full height
 *  - Top: Quilp wordmark + firm name
 *  - Nav groups: Workspace (Dashboard, Clients, Documents, Deadlines)
 *                Billing (Invoices)
 *  - Bottom: Settings link + user profile + logout
 *  - Active: sage-400/14 bg, white text, sage-400 icon
 *  - Default: white/45 text, white/30 icon
 *  - Hover: white/70 text, white/5 bg
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Layers,
  Workflow,
  FileText,
  CalendarDays,
  Receipt,
  Settings2,
  LogOut,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFirm } from '@/lib/context/firm-context'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────
// Nav configuration
// ─────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  matchPrefix?: boolean  // match /clients/[id] as active on /clients
}

interface NavSection {
  label: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard',  href: '/dashboard',  icon: LayoutDashboard },
      { label: 'Clients',    href: '/clients',    icon: Users,      matchPrefix: true },
      { label: 'Services',   href: '/services',   icon: Layers,     matchPrefix: true },
      { label: 'Processes',  href: '/processes',  icon: Workflow,   matchPrefix: true },
      { label: 'Documents',  href: '/documents',  icon: FileText,   matchPrefix: true },
      { label: 'Deadlines',  href: '/deadlines',  icon: CalendarDays },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Invoices',   href: '/invoices',   icon: Receipt,    matchPrefix: true },
    ],
  },
]

// ─────────────────────────────────────────
// NavLink
// ─────────────────────────────────────────

interface NavLinkProps {
  item: NavItem
  pathname: string
}

function NavLink({ item, pathname }: NavLinkProps) {
  const isActive = item.matchPrefix
    ? pathname.startsWith(item.href)
    : pathname === item.href

  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        'relative flex items-center gap-2.5 h-9 px-3 text-[13px] font-[450] rounded-[8px]',
        'transition-colors duration-150 select-none',
        isActive
          ? 'bg-sage-400/[0.14] text-white'
          : 'text-white/[0.45] hover:text-white/[0.72] hover:bg-white/[0.05]'
      )}
    >
      {/* Sage left indicator on active */}
      {isActive && (
        <span className="absolute left-0 top-[7px] bottom-[7px] w-[2px] bg-sage-400 rounded-full -translate-x-[8px]" />
      )}

      <Icon
        size={15}
        strokeWidth={isActive ? 2 : 1.75}
        className={cn(
          'shrink-0 transition-colors',
          isActive ? 'text-sage-400' : 'opacity-50'
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

// ─────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { firm, user } = useFirm()

  // Initials for user avatar
  const initials = user.name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isSettingsActive = pathname.startsWith('/settings')

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 bottom-0 w-60 z-40 flex flex-col',
        'bg-ink border-r border-white/[0.07]',
        'overflow-y-auto overflow-x-hidden'
      )}
    >
      {/* ── Top: Wordmark + firm name ────────────────────────────── */}
      <div className="px-4 pt-5 pb-4 border-b border-white/[0.07]">
        <Link
          href="/dashboard"
          className="font-serif text-[20px] font-medium text-white tracking-[-0.4px] leading-none block select-none"
        >
          Quilp<span className="text-sage-400">.</span>
        </Link>
        <p className="text-[11px] text-white/[0.38] mt-[5px] truncate tracking-wide">
          {firm.name}
        </p>
      </div>

      {/* ── Navigation ───────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.label} className={cn(si > 0 && 'mt-3')}>
            {/* Section label */}
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/[0.22]">
              {section.label}
            </p>

            {/* Section items */}
            <div className="flex flex-col gap-0.5">
              {section.items.map(item => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        ))}

        {/* ── Generate shortcut ───────────────────────────────────── */}
        <div className="mt-3">
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/[0.22]">
            Generate
          </p>
          <Link
            href="/documents/generate"
            className={cn(
              'flex items-center gap-2.5 h-9 px-3 text-[13px] font-[450] rounded-[8px]',
              'transition-colors duration-150 select-none',
              pathname === '/documents/generate'
                ? 'bg-sage-400/[0.14] text-white'
                : 'text-white/[0.45] hover:text-white/[0.72] hover:bg-white/[0.05]'
            )}
          >
            <Sparkles
              size={15}
              strokeWidth={1.75}
              className={cn(
                'shrink-0',
                pathname === '/documents/generate' ? 'text-sage-400' : 'opacity-50'
              )}
            />
            <span>New document</span>
          </Link>
        </div>
      </nav>

      {/* ── Bottom: Settings + User profile ─────────────────────── */}
      <div className="border-t border-white/[0.07] px-2 pt-2 pb-3">

        {/* Settings */}
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2.5 h-9 px-3 text-[13px] font-[450] rounded-[8px]',
            'transition-colors duration-150 select-none mb-1',
            isSettingsActive
              ? 'bg-sage-400/[0.14] text-white'
              : 'text-white/[0.45] hover:text-white/[0.72] hover:bg-white/[0.05]'
          )}
        >
          <Settings2
            size={15}
            strokeWidth={1.75}
            className={cn('shrink-0', isSettingsActive ? 'text-sage-400' : 'opacity-50')}
          />
          <span>Settings</span>
        </Link>

        {/* User profile */}
        <div className="flex items-center gap-2.5 px-3 pt-2 mt-1 border-t border-white/[0.07]">
          {/* Avatar */}
          <div className="h-7 w-7 rounded-full bg-sage-400/[0.18] border border-sage-400/[0.25] flex items-center justify-center shrink-0">
            <span className="text-[11px] font-semibold text-sage-400 leading-none">
              {initials}
            </span>
          </div>

          {/* Name + role */}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-white/[0.72] truncate leading-tight">
              {user.name}
            </p>
            <p className="text-[10.5px] text-white/[0.3] capitalize leading-tight">
              {user.role}
            </p>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded-[6px] text-white/[0.3] hover:text-white/[0.65] hover:bg-white/[0.07] transition-colors"
          >
            <LogOut size={13} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </aside>
  )
}
