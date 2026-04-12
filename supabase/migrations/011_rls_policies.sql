-- ══════════════════════════════════════════════════════════════════
--  Migration 011 — RLS Policy Consolidation & Helper Function
--  Source: blueprint-part2.md §9.5
--
--  Individual table policies are already applied in migrations 001–010.
--  This file adds:
--    1. A reusable helper function for the firm_id lookup
--    2. The storage bucket policies
--    3. The Supabase Storage RLS for private buckets
-- ══════════════════════════════════════════════════════════════════

-- ── Helper: get the caller's firm_id ─────────────────────────────
-- Used in every firm-scoped policy. Extracted to avoid repetition.

CREATE OR REPLACE FUNCTION public.get_my_firm_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT firm_id FROM public.users WHERE id = auth.uid();
$$;

-- ── NOTE: Policy Pattern used across all firm-scoped tables ──────
--
-- SELECT:
--   USING (firm_id = public.get_my_firm_id())
--
-- INSERT:
--   WITH CHECK (firm_id = public.get_my_firm_id())
--
-- UPDATE / DELETE:
--   USING (firm_id = public.get_my_firm_id())
--
-- For tables without direct firm_id (tax_documents, timeline_events):
--   Use a sub-select through clients:
--     client_id IN (
--       SELECT id FROM public.clients WHERE firm_id = public.get_my_firm_id()
--     )
--
-- Portal routes use the Supabase admin (service role) client, which
-- bypasses RLS entirely. Token validation is enforced at the
-- application layer in /app/api/portal/[token]/route.ts.
-- ────────────────────────────────────────────────────────────────

-- ── Supabase Storage: private bucket for tax documents ───────────
-- Run this in the Supabase Dashboard Storage settings, or via SQL:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('tax-documents', 'tax-documents', false);
--
-- CREATE POLICY "CPAs can read their clients tax documents"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'tax-documents'
--     AND (storage.foldername(name))[1] IN (
--       SELECT id::TEXT FROM public.clients
--       WHERE firm_id = public.get_my_firm_id()
--     )
--   );
--
-- CREATE POLICY "Clients can upload via portal (service role only)"
--   ON storage.objects FOR INSERT
--   WITH CHECK (false);   -- blocked for anon; portal uses service role
--
-- Note: Client portal uploads use the service role key (server-side),
-- so no anon INSERT policy is needed on storage.objects.

-- ── Supabase Storage: public bucket for firm logos / PDF exports ──
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('firm-assets', 'firm-assets', true);
--
-- PDFs for signed documents are stored with a path scoped to firm_id.
-- Public read is intentional for PDF download links.

-- ── Verify all firm-scoped tables have RLS enabled ────────────────
-- Run this query in the Supabase SQL editor to audit:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- Expected: rowsecurity = true for all tables.
