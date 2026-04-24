/**
 * POST /api/auth/stripe/disconnect
 *
 * Clears firms.stripe_account_id for the current firm.
 * Owner-only. Also deauthorizes the connected account from the platform.
 */

import { NextResponse }                    from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id, role')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  if (userRow.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Fetch the current stripe_account_id before clearing it
  const { data: firm } = await admin
    .from('firms')
    .select('stripe_account_id')
    .eq('id', userRow.firm_id)
    .single()

  const stripeAccountId = (firm as { stripe_account_id?: string | null })?.stripe_account_id

  // Deauthorize the connected account from the platform
  if (stripeAccountId) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    const clientId  = process.env.STRIPE_CLIENT_ID
    if (secretKey && clientId) {
      await fetch('https://connect.stripe.com/oauth/deauthorize', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${secretKey}`,
        },
        body: new URLSearchParams({
          client_id:       clientId,
          stripe_user_id:  stripeAccountId,
        }).toString(),
      }).catch(err => console.warn('[stripe disconnect] Deauthorize failed:', err))
    }
  }

  const { error } = await admin
    .from('firms')
    .update({ stripe_account_id: null })
    .eq('id', userRow.firm_id)

  if (error) return NextResponse.json({ error: 'Failed to disconnect Stripe' }, { status: 500 })

  return NextResponse.json({ disconnected: true })
}
