/**
 * Supabase browser client
 * Use this in Client Components ('use client') only.
 * Creates one shared instance per browser tab (singleton pattern).
 */
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
