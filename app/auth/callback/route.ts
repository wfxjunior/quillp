/**
 * /auth/callback — Supabase auth code exchange
 *
 * Supabase email links (password reset, magic link, email confirmation)
 * redirect here with a `code` query param. This route:
 *   1. Exchanges the code for a session (sets the session cookie)
 *   2. Redirects to the `next` param (defaults to /dashboard)
 *
 * Used by:
 *   - Password reset: redirects to /reset-password
 *   - Email confirmation (future): redirects to /onboarding/step-1
 *
 * Reference: @supabase/ssr + Next.js App Router pattern
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    // No code — redirect to login with an error
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Code invalid or expired
    return NextResponse.redirect(`${origin}/login?error=invalid_code`)
  }

  // Redirect to the intended destination (e.g. /reset-password)
  // Use the app URL in production, origin in development
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${next}`)
  } else if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`)
  } else {
    return NextResponse.redirect(`${origin}${next}`)
  }
}
