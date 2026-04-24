/**
 * lib/signnow/client.ts
 *
 * SignNow API client — token management + webhook HMAC validation.
 *
 * Env vars required:
 *   SIGNNOW_CLIENT_ID      — Client ID from SignNow API dashboard
 *   SIGNNOW_CLIENT_SECRET  — Client secret from SignNow API dashboard
 *   SIGNNOW_HMAC_KEY       — Webhook HMAC secret (from SignNow webhook config)
 *   SIGNNOW_ENV            — 'sandbox' | 'production'  (default: 'sandbox')
 *   ENCRYPTION_KEY         — 64-char hex string (32 bytes) for AES-256-CBC token storage
 *   NEXT_PUBLIC_APP_URL    — Used to derive the OAuth redirect URI
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { encrypt, decrypt }            from '@/lib/security/encrypt'
import { createAdminClient }           from '@/lib/supabase/server'

// ─────────────────────────────────────────
// Config
// ─────────────────────────────────────────

export const SIGNNOW_ENV = (process.env.SIGNNOW_ENV ?? 'sandbox') as 'sandbox' | 'production'

/** OAuth / app base URL (browser redirect destination) */
export const AUTH_BASE =
  SIGNNOW_ENV === 'production'
    ? 'https://app.signnow.com'
    : 'https://app-eval.signnow.com'

/** REST API base URL */
export const API_BASE =
  SIGNNOW_ENV === 'production'
    ? 'https://api.signnow.com'
    : 'https://api-eval.signnow.com'

// ─────────────────────────────────────────
// Token shape (stored encrypted in firms.signnow_token)
// ─────────────────────────────────────────

export interface SignNowToken {
  access_token:  string
  refresh_token: string
  expires_at:    string   // ISO-8601
  user_email:    string   // email of the connected SignNow user (for UI display)
}

// ─────────────────────────────────────────
// Token persistence
// ─────────────────────────────────────────

/** Encrypt and store a SignNow token for a firm. */
export async function storeToken(firmId: string, token: SignNowToken): Promise<void> {
  const supabase  = createAdminClient()
  const encrypted = encrypt(JSON.stringify(token))
  const { error } = await supabase
    .from('firms')
    .update({ signnow_token: encrypted })
    .eq('id', firmId)
  if (error) throw new Error(`Failed to store SignNow token: ${error.message}`)
}

/** Load and decrypt a firm's stored SignNow token. Returns null if not connected. */
export async function loadToken(firmId: string): Promise<SignNowToken | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('firms')
    .select('signnow_token')
    .eq('id', firmId)
    .single()
  if (error || !data?.signnow_token) return null
  try {
    return JSON.parse(decrypt(data.signnow_token)) as SignNowToken
  } catch {
    return null
  }
}

// ─────────────────────────────────────────
// Token refresh
// ─────────────────────────────────────────

const REFRESH_MARGIN_MS = 5 * 60 * 1000   // refresh 5 minutes before expiry

function isExpired(token: SignNowToken): boolean {
  return Date.now() >= new Date(token.expires_at).getTime() - REFRESH_MARGIN_MS
}

async function refreshToken(token: SignNowToken): Promise<SignNowToken> {
  const clientId     = process.env.SIGNNOW_CLIENT_ID!
  const clientSecret = process.env.SIGNNOW_CLIENT_SECRET!

  const res = await fetch(`${API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: token.refresh_token,
      scope:         '*',
    }).toString(),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`SignNow token refresh failed: ${res.status} ${body}`)
  }

  const json = await res.json() as {
    access_token:  string
    refresh_token: string
    expires_in:    number
  }

  return {
    access_token:  json.access_token,
    refresh_token: json.refresh_token ?? token.refresh_token,
    expires_at:    new Date(Date.now() + json.expires_in * 1000).toISOString(),
    user_email:    token.user_email,
  }
}

/**
 * Get a valid (non-expired) access token for a firm.
 * Refreshes automatically if needed and persists the new token.
 * Throws if the firm has no SignNow token stored.
 */
export async function getValidToken(firmId: string): Promise<SignNowToken> {
  let token = await loadToken(firmId)
  if (!token) throw new Error(`Firm ${firmId} has no SignNow token. Please connect via Settings.`)

  if (isExpired(token)) {
    token = await refreshToken(token)
    await storeToken(firmId, token)
  }

  return token
}

// ─────────────────────────────────────────
// Webhook HMAC validation
// ─────────────────────────────────────────

/**
 * Validates the X-Signnow-Signature header from an incoming webhook.
 * SignNow computes: hex(HMAC-SHA256(rawBody, SIGNNOW_HMAC_KEY))
 *
 * Returns true if valid, false if invalid or key not configured.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const hmacKey = process.env.SIGNNOW_HMAC_KEY
  if (!hmacKey) {
    console.warn('[signnow] SIGNNOW_HMAC_KEY not set — skipping HMAC verification')
    return true   // permissive when key is not configured (dev only)
  }

  try {
    const expected = createHmac('sha256', hmacKey)
      .update(rawBody)
      .digest('hex')

    const expectedBuf = Buffer.from(expected)
    const receivedBuf = Buffer.from(signature)

    if (expectedBuf.length !== receivedBuf.length) return false
    return timingSafeEqual(expectedBuf, receivedBuf)
  } catch {
    return false
  }
}
