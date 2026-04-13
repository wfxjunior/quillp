import type { UserRole } from '@/types'

/**
 * Returns true if the given role grants admin-level access.
 *
 * Use this wherever admin-only logic is needed instead of
 * hardcoding the string 'admin' throughout the codebase.
 *
 * Usage:
 *   import { isAdmin } from '@/lib/auth/is-admin'
 *   if (isAdmin(user.role)) { ... }
 */
export function isAdmin(role: UserRole | string | undefined | null): boolean {
  return role === 'admin'
}
