/**
 * GET /api/auth/docusign/callback
 *
 * DocuSign OAuth callback. Exchanges the authorization code for tokens,
 * fetches the user's DocuSign account info, encrypts and stores the token
 * in firms.docusign_token, then redirects to /settings.
 *
 * Required env vars:
 *   DOCUSIGN_CLIENT_ID, DOCUSIGN_CLIENT_SECRET, DOCUSIGN_ENV,
 *   NEXT_PUBLIC_APP_URL, ENCRYPTION_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AUTH_BASE, storeToken, type DocuSignToken } from '@/lib/docusign/client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code   = searchParams.get('code')
  const state  = searchParams.get('state')
  const errMsg = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const settingsUrl = `${appUrl}/settings`

  // ── Handle DocuSign error response ──
  if (errMsg) {
    const desc = searchParams.get('error_description') ?? errMsg
    console.error('[docusign callback] OAuth error:', desc)
    return NextResponse.redirect(`${settingsUrl}?docusign_error=${encodeURIComponent(desc)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?docusign_error=missing_params`)
  }

  // ── Validate CSRF state ──
  const storedState = request.cookies.get('docusign_oauth_state')?.value
  if (!storedState || storedState !== state) {
    console.error('[docusign callback] CSRF state mismatch')
    return NextResponse.redirect(`${settingsUrl}?docusign_error=state_mismatch`)
  }

  // ── Require authenticated user + firm ──
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) {
    return NextResponse.redirect(`${appUrl}/onboarding/step-1`)
  }

  try {
    const clientId     = process.env.DOCUSIGN_CLIENT_ID!
    const clientSecret = process.env.DOCUSIGN_CLIENT_SECRET!
    const redirectUri  = `${appUrl}/api/auth/docusign/callback`

    // ── Exchange authorization code for tokens ──
    const tokenRes = await fetch(`${AUTH_BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: redirectUri,
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

    // ── Fetch user info to get account_id + base_uri ──
    const userInfoRes = await fetch(`${AUTH_BASE}/oauth/userinfo`, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    })

    if (!userInfoRes.ok) {
      throw new Error(`UserInfo fetch failed: ${userInfoRes.status}`)
    }

    const userInfo = await userInfoRes.json() as {
      sub:      string
      accounts: Array<{
        account_id:   string
        is_default:   boolean
        account_name: string
        base_uri:     string
      }>
    }

    const defaultAccount =
      userInfo.accounts.find(a => a.is_default) ?? userInfo.accounts[0]

    if (!defaultAccount) {
      throw new Error('No DocuSign account found in user info')
    }

    // ── Build and store the token ──
    const docuSignToken: DocuSignToken = {
      access_token:  tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at:    new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      account_id:    defaultAccount.account_id,
      base_uri:      defaultAccount.base_uri,
    }

    await storeToken(userRow.firm_id, docuSignToken)

    // ── Clear state cookie and redirect ──
    const response = NextResponse.redirect(`${settingsUrl}?docusign_connected=1`)
    response.cookies.delete('docusign_oauth_state')
    return response

  } catch (err) {
    console.error('[docusign callback] Error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(
      `${settingsUrl}?docusign_error=${encodeURIComponent(msg)}`
    )
  }
}
