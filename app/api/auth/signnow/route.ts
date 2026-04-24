/**
 * GET /api/auth/signnow
 *
 * Initiates the SignNow OAuth 2.0 Authorization Code Grant flow.
 * Stores a CSRF state token in an httpOnly cookie, then redirects
 * the user to SignNow's authorization endpoint.
 *
 * Required env vars:
 *   SIGNNOW_CLIENT_ID, SIGNNOW_ENV, NEXT_PUBLIC_APP_URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes }               from 'crypto'
import { createClient }              from '@/lib/supabase/server'
import { AUTH_BASE }                 from '@/lib/signnow/client'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const clientId = process.env.SIGNNOW_CLIENT_ID
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ''

  if (!clientId) {
    return NextResponse.json({ error: 'SIGNNOW_CLIENT_ID is not configured' }, { status: 500 })
  }

  const state       = randomBytes(24).toString('hex')
  const redirectUri = `${appUrl}/api/auth/signnow/callback`

  const authUrl = new URL(`${AUTH_BASE}/authorize`)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id',     clientId)
  authUrl.searchParams.set('redirect_uri',  redirectUri)
  authUrl.searchParams.set('scope',         '*')
  authUrl.searchParams.set('state',         state)

  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set('signnow_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   600,
    path:     '/',
  })

  return response
}
