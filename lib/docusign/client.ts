/**
 * DocuSign API client — token management + crypto utilities
 *
 * Env vars required:
 *   DOCUSIGN_CLIENT_ID        — Integration Key from DocuSign Apps & Keys
 *   DOCUSIGN_CLIENT_SECRET    — Secret from DocuSign Apps & Keys
 *   DOCUSIGN_HMAC_KEY         — Connect webhook HMAC secret (per Connect config)
 *   DOCUSIGN_ENV              — 'sandbox' | 'production'  (default: 'sandbox')
 *   ENCRYPTION_KEY            — 64-char hex string (32 bytes) for AES-256-CBC
 *   NEXT_PUBLIC_APP_URL       — Used to derive the OAuth redirect URI
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────
// Config
// ─────────────────────────────────────────

export const DOCUSIGN_ENV = (process.env.DOCUSIGN_ENV ?? 'sandbox') as 'sandbox' | 'production'

export const AUTH_BASE =
  DOCUSIGN_ENV === 'production'
    ? 'https://account.docusign.com'
    : 'https://account-d.docusign.com'

// ─────────────────────────────────────────
// AES-256-CBC encryption helpers
// ─────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypts a string with AES-256-CBC.
 * Returns `ivHex:ciphertextHex` — IV is prepended so decryption works independently.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv  = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final(),
  ])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts a string produced by `encrypt()`.
 */
export function decrypt(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(':')
  if (!ivHex || !encHex) throw new Error('Invalid ciphertext format')
  const key       = getEncryptionKey()
  const iv        = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const decipher  = createDecipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

// ─────────────────────────────────────────
// Token shape (stored encrypted in firms.docusign_token)
// ─────────────────────────────────────────

export interface DocuSignToken {
  access_token:  string
  refresh_token: string
  expires_at:    string   // ISO-8601
  account_id:    string
  base_uri:      string   // e.g. "https://na4.docusign.net"
}

/** Returns the API base path, e.g. "https://na4.docusign.net/restapi" */
export function apiBasePath(token: DocuSignToken): string {
  return `${token.base_uri}/restapi`
}

// ─────────────────────────────────────────
// Token persistence
// ─────────────────────────────────────────

/** Encrypt and store a DocuSign token for a firm. */
export async function storeToken(firmId: string, token: DocuSignToken): Promise<void> {
  const supabase = createAdminClient()
  const encrypted = encrypt(JSON.stringify(token))
  const { error } = await supabase
    .from('firms')
    .update({ docusign_token: encrypted })
    .eq('id', firmId)
  if (error) throw new Error(`Failed to store DocuSign token: ${error.message}`)
}

/** Load and decrypt a firm's stored DocuSign token. Returns null if not connected. */
export async function loadToken(firmId: string): Promise<DocuSignToken | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('firms')
    .select('docusign_token')
    .eq('id', firmId)
    .single()
  if (error || !data?.docusign_token) return null
  try {
    return JSON.parse(decrypt(data.docusign_token)) as DocuSignToken
  } catch {
    return null
  }
}

// ─────────────────────────────────────────
// Token refresh
// ─────────────────────────────────────────

const REFRESH_MARGIN_MS = 5 * 60 * 1000   // refresh 5 minutes before expiry

function isExpired(token: DocuSignToken): boolean {
  return Date.now() >= new Date(token.expires_at).getTime() - REFRESH_MARGIN_MS
}

async function refreshToken(token: DocuSignToken): Promise<DocuSignToken> {
  const clientId     = process.env.DOCUSIGN_CLIENT_ID!
  const clientSecret = process.env.DOCUSIGN_CLIENT_SECRET!

  const res = await fetch(`${AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: token.refresh_token,
    }).toString(),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`DocuSign token refresh failed: ${res.status} ${body}`)
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
    account_id:    token.account_id,
    base_uri:      token.base_uri,
  }
}

/**
 * Get a valid (non-expired) access token for a firm.
 * Refreshes automatically if needed and persists the new token.
 * Throws if the firm has no DocuSign token stored.
 */
export async function getValidToken(firmId: string): Promise<DocuSignToken> {
  let token = await loadToken(firmId)
  if (!token) throw new Error(`Firm ${firmId} has no DocuSign token. Please connect via Settings.`)

  if (isExpired(token)) {
    token = await refreshToken(token)
    await storeToken(firmId, token)
  }

  return token
}

// ─────────────────────────────────────────
// Webhook HMAC validation (§ DocuSign Connect)
// ─────────────────────────────────────────

/**
 * Validates the X-DocuSign-Signature-1 header from an incoming webhook.
 * DocuSign computes: base64(HMAC-SHA256(rawBody, DOCUSIGN_HMAC_KEY))
 *
 * Returns true if valid, false if invalid.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const hmacKey = process.env.DOCUSIGN_HMAC_KEY
  if (!hmacKey) {
    console.warn('[docusign] DOCUSIGN_HMAC_KEY not set — skipping HMAC verification')
    return true   // permissive in dev when key is not configured
  }

  try {
    const expected = createHmac('sha256', hmacKey)
      .update(rawBody)
      .digest('base64')

    const expectedBuf = Buffer.from(expected)
    const receivedBuf = Buffer.from(signature)

    if (expectedBuf.length !== receivedBuf.length) return false
    return timingSafeEqual(expectedBuf, receivedBuf)
  } catch {
    return false
  }
}
