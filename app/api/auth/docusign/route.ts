/**
 * GET /api/auth/docusign
 *
 * Initiates the DocuSign OAuth 2.0 Authorization Code Grant flow.
 * Stores a CSRF state token in an httpOnly cookie, then redirects
 * the user to DocuSign's authorization endpoint.
 *
 * Required env vars:
 *   DOCUSIGN_CLIENT_ID, DOCUSIGN_ENV, NEXT_PUBLIC_APP_URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { AUTH_BASE } from '@/lib/docusign/client'

export async function GET(request: NextRequest) {
  // ── Require authenticated user ──
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const clientId  = process.env.DOCUSIGN_CLIENT_ID
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? ''

  if (!clientId) {
    return NextResponse.json(
      { error: 'DOCUSIGN_CLIENT_ID is not configured' },
      { status: 500 }
    )
  }

  // ── Generate CSRF state token ──
  const state = randomBytes(24).toString('hex')

  // ── Build DocuSign auth URL ──
  const redirectUri = `${appUrl}/api/auth/docusign/callback`
  const authUrl = new URL(`${AUTH_BASE}/oauth/auth`)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope',         'signature')
  authUrl.searchParams.set('client_id',     clientId)
  authUrl.searchParams.set('redirect_uri',  redirectUri)
  authUrl.searchParams.set('state',         state)

  // ── Store state in httpOnly cookie (10 min expiry) ──
  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set('docusign_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   600,   // 10 minutes
    path:     '/',
  })

  return response
}
