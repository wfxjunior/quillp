/**
 * lib/storage/upload.ts
 *
 * Shared Supabase Storage helpers used across API routes.
 *
 * Buckets in use:
 *   'invoices'     — firm PDF invoices   (private)
 *   'firm-assets'  — firm logos          (private, served via signed URL or public path)
 *   'client-files' — portal uploads      (private)
 *
 * All functions accept a Supabase client so callers can pass either
 * the authenticated client or the admin (service-role) client.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface UploadResult {
  path:  string         // storage path (e.g. "firms/abc/logo.png")
  error: string | null
}

export interface SignedUrlResult {
  url:   string | null
  error: string | null
}

// ─────────────────────────────────────────
// Upload a Buffer (server-side, e.g. PDF)
// ─────────────────────────────────────────

/**
 * Upload a Node.js Buffer to a private Supabase Storage bucket.
 * Used by invoice PDF generation.
 */
export async function uploadBuffer(
  supabase:    SupabaseClient,
  bucket:      string,
  path:        string,
  buffer:      Buffer,
  contentType: string,
): Promise<UploadResult> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: true })

  return { path, error: error?.message ?? null }
}

// ─────────────────────────────────────────
// Upload a File / Blob (client portal, logo)
// ─────────────────────────────────────────

/**
 * Upload a File or Blob to a private Supabase Storage bucket.
 * Used by the portal file upload and logo upload routes.
 */
export async function uploadFile(
  supabase:    SupabaseClient,
  bucket:      string,
  path:        string,
  file:        File | Blob,
  contentType: string,
): Promise<UploadResult> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: true })

  return { path, error: error?.message ?? null }
}

// ─────────────────────────────────────────
// Create a short-lived signed URL
// ─────────────────────────────────────────

/**
 * Generate a signed URL for private storage access.
 * Default expiry: 15 minutes (900 seconds).
 *
 * Use this instead of public URLs for all private buckets.
 */
export async function createSignedUrl(
  supabase:   SupabaseClient,
  bucket:     string,
  path:       string,
  expiresIn = 900,
): Promise<SignedUrlResult> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  return {
    url:   data?.signedUrl ?? null,
    error: error?.message ?? null,
  }
}

// ─────────────────────────────────────────
// Delete a file
// ─────────────────────────────────────────

/**
 * Remove a file from storage. Non-fatal — returns error string if it fails.
 */
export async function deleteFile(
  supabase: SupabaseClient,
  bucket:   string,
  path:     string,
): Promise<string | null> {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path])

  return error?.message ?? null
}

// ─────────────────────────────────────────
// Bucket name constants
// ─────────────────────────────────────────

export const BUCKET_INVOICES     = 'invoices'
export const BUCKET_FIRM_ASSETS  = 'firm-assets'
export const BUCKET_CLIENT_FILES = 'client-files'
