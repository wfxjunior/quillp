/**
 * /auth/callback — Supabase auth code exchange
 *
 * Handles:
 *  - Email confirmation / magic links (existing)
 *  - Password reset — redirects to /reset-password (existing)
 *  - Google OAuth — upserts public.users row, promotes admin (new)
 *
 * Flow:
 *  1. Exchange code → session cookie
 *  2. Get authenticated user
 *  3. Upsert public.users row (safety net for OAuth users whose DB
 *     trigger may not have run, e.g. Google sign-in without firm_name)
 *  4. Promote admintest@admin.com to role='admin'
 *  5. Redirect: onboarding if incomplete, otherwise dashboard
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ADMIN_EMAIL = 'admintest@admin.com'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? null  // null = auto-detect from onboarding status

  if (!code) {
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

  // 1. Exchange code for session
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  console.log('CALLBACK: code exchange', exchangeError ? `ERROR: ${exchangeError.message}` : 'OK')

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=invalid_code`)
  }

  // 2. Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log('CALLBACK: user', user?.email ?? 'none', userError?.message ?? '')

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`)
  }

  // 3. Upsert public.users row
  //    The DB trigger handle_new_user() should have created this row already,
  //    but for Google OAuth users the trigger may fail (no firm_name metadata).
  //    This upsert is a safe idempotent fallback — it does NOT overwrite existing rows.
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'User'

  const isAdminEmail = user.email?.toLowerCase() === ADMIN_EMAIL

  const { error: upsertError } = await supabase
    .from('users')
    .upsert(
      {
        id: user.id,
        email: user.email!,
        name: displayName,
        role: isAdminEmail ? 'admin' : 'owner',
        onboarding_completed: false,
      },
      {
        onConflict: 'id',
        ignoreDuplicates: true,   // skip if row already exists; don't overwrite
      }
    )

  console.log('CALLBACK: users upsert', upsertError ? `ERROR: ${upsertError.message}` : 'OK')

  // 4. Promote admin email even if the row already existed
  if (isAdminEmail) {
    const { error: adminError } = await supabase
      .from('users')
      .update({ role: 'admin' })
      .eq('id', user.id)
      .neq('role', 'admin')  // only update if not already admin
    console.log('CALLBACK: admin promotion', adminError ? `ERROR: ${adminError.message}` : 'OK')
  }

  // 5. Determine redirect: honour explicit `next` param (e.g. /reset-password),
  //    otherwise check onboarding status.
  let destination = next

  if (!destination) {
    const { data: userData } = await supabase
      .from('users')
      .select('onboarding_completed, firm_id')
      .eq('id', user.id)
      .single()

    destination = userData?.onboarding_completed && userData?.firm_id
      ? '/dashboard'
      : '/onboarding/step-1'

    console.log('CALLBACK: redirect →', destination, '(onboarding_completed:', userData?.onboarding_completed, ')')
  }

  // Build redirect URL — use forwarded host in production
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${destination}`)
  } else if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${destination}`)
  } else {
    return NextResponse.redirect(`${origin}${destination}`)
  }
}
