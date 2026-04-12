/**
 * Supabase middleware helper
 * Refreshes the session on every request so Server Components always
 * have access to a valid session.
 *
 * Used by /middleware.ts at the root of the project.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session (do NOT add logic between createServerClient and getUser)
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // ── Route protection rules (blueprint-part2.md §9.3) ─────────────

  // 1. Public routes — always allow
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/auth/callback') ||   // Supabase code exchange
    pathname.startsWith('/portal/')

  if (isPublicRoute) {
    return supabaseResponse
  }

  // 2. No session → redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 3. Session exists — check onboarding completion
  const { data: userData } = await supabase
    .from('users')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  const onboardingComplete = userData?.onboarding_completed ?? false
  const isOnboardingRoute = pathname.startsWith('/onboarding')

  // 4. Onboarding not complete → redirect to onboarding
  if (!onboardingComplete && !isOnboardingRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding/step-1'
    return NextResponse.redirect(url)
  }

  // 5. Onboarding complete + trying to access onboarding → redirect to dashboard
  if (onboardingComplete && isOnboardingRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
