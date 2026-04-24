/**
 * GET /api/auth/signnow/callback
 *
 * SignNow OAuth callback. Exchanges the authorization code for tokens,
 * fetches the connected user's email, encrypts and stores the token
 * in firms.signnow_token, then redirects to /settings.
 *
 * Required env vars:
 *   SIGNNOW_CLIENT_ID, SIGNNOW_CLIENT_SECRET, SIGNNOW_ENV,
 *   NEXT_PUBLIC_APP_URL, ENCRYPTION_KEY
 */

import { NextRequest, NextResponse }           from 'next/server'
import { createClient }                        from '@/lib/supabase/server'
import { API_BASE, storeToken, type SignNowToken } from '@/lib/signnow/client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code   = searchParams.get('code')
  const state  = searchParams.get('state')
  const errMsg = searchParams.get('error')

  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const settingsUrl = `${appUrl}/settings`

  if (errMsg) {
    const desc = searchParams.get('error_description') ?? errMsg
    console.error('[signnow callback] OAuth error:', desc)
    return NextResponse.redirect(`${settingsUrl}?signnow_error=${encodeURIComponent(desc)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?signnow_error=missing_params`)
  }

  const storedState = request.cookies.get('signnow_oauth_state')?.value
  if (!storedState || storedState !== state) {
    console.error('[signnow callback] CSRF state mismatch')
    return NextResponse.redirect(`${settingsUrl}?signnow_error=state_mismatch`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${appUrl}/login`)

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return NextResponse.redirect(`${appUrl}/onboarding/step-1`)

  try {
    const clientId     = process.env.SIGNNOW_CLIENT_ID!
    const clientSecret = process.env.SIGNNOW_CLIENT_SECRET!
    const redirectUri  = `${appUrl}/api/auth/signnow/callback`

    // ── Exchange authorization code for tokens ──
    const tokenRes = await fetch(`${API_BASE}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: redirectUri,
        scope:        '*',
      }).toString(),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      throw new Error(`Token exchange failed: ${tokenRes.status} ${body}`)
    }

    const tokenData = await tokenRes.json() as {
      access_token:  string
      refresh_token: string
      expires_in:    number
    }

    // ── Fetch user info to get the connected email ──
    const userInfoRes = await fetch(`${API_BASE}/user`, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    })

    if (!userInfoRes.ok) {
      throw new Error(`SignNow user info fetch failed: ${userInfoRes.status}`)
    }

    const userInfo = await userInfoRes.json() as { email: string }

    // ── Build and store the token ──
    const signNowToken: SignNowToken = {
      access_token:  tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at:    new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      user_email:    userInfo.email,
    }

    await storeToken(userRow.firm_id, signNowToken)

    const response = NextResponse.redirect(`${settingsUrl}?signnow_connected=1`)
    response.cookies.delete('signnow_oauth_state')
    return response

  } catch (err) {
    console.error('[signnow callback] Error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(`${settingsUrl}?signnow_error=${encodeURIComponent(msg)}`)
  }
}
