/**
 * GET /api/auth/stripe
 *
 * Initiates Stripe Connect Standard OAuth.
 * Stores a CSRF state token in a cookie, then redirects to Stripe.
 *
 * Required env vars:
 *   STRIPE_CLIENT_ID, NEXT_PUBLIC_APP_URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes }               from 'crypto'
import { createClient }              from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userRow?.role !== 'owner') {
    return NextResponse.redirect(new URL('/settings?stripe_error=not_owner', request.url))
  }

  const clientId = process.env.STRIPE_CLIENT_ID
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ''

  if (!clientId) {
    return NextResponse.json({ error: 'STRIPE_CLIENT_ID is not configured' }, { status: 500 })
  }

  const state       = randomBytes(24).toString('hex')
  const redirectUri = `${appUrl}/api/auth/stripe/callback`

  const authUrl = new URL('https://connect.stripe.com/oauth/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id',     clientId)
  authUrl.searchParams.set('scope',         'read_write')
  authUrl.searchParams.set('redirect_uri',  redirectUri)
  authUrl.searchParams.set('state',         state)

  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set('stripe_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   600,
    path:     '/',
  })

  return response
}
