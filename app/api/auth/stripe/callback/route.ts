/**
 * GET /api/auth/stripe/callback
 *
 * Stripe Connect OAuth callback. Exchanges the authorization code for the
 * connected account ID and stores it in firms.stripe_account_id.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY, NEXT_PUBLIC_APP_URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code   = searchParams.get('code')
  const state  = searchParams.get('state')
  const errMsg = searchParams.get('error')

  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const settingsUrl = `${appUrl}/settings`

  if (errMsg) {
    const desc = searchParams.get('error_description') ?? errMsg
    console.error('[stripe callback] OAuth error:', desc)
    return NextResponse.redirect(`${settingsUrl}?stripe_error=${encodeURIComponent(desc)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?stripe_error=missing_params`)
  }

  const storedState = request.cookies.get('stripe_oauth_state')?.value
  if (!storedState || storedState !== state) {
    console.error('[stripe callback] CSRF state mismatch')
    return NextResponse.redirect(`${settingsUrl}?stripe_error=state_mismatch`)
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
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY not configured')

    // Exchange authorization code for the connected account ID
    const tokenRes = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${secretKey}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
      }).toString(),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      throw new Error(`Stripe token exchange failed: ${tokenRes.status} ${body}`)
    }

    const tokenData = await tokenRes.json() as {
      stripe_user_id:  string
      access_token:    string
      token_type:      string
      scope:           string
    }

    const admin = createAdminClient()
    const { error: updateErr } = await admin
      .from('firms')
      .update({ stripe_account_id: tokenData.stripe_user_id })
      .eq('id', userRow.firm_id)

    if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`)

    const response = NextResponse.redirect(`${settingsUrl}?stripe_connected=1`)
    response.cookies.delete('stripe_oauth_state')
    return response

  } catch (err) {
    console.error('[stripe callback] Error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(`${settingsUrl}?stripe_error=${encodeURIComponent(msg)}`)
  }
}
