-- ══════════════════════════════════════════════════════════════════
--  Migration 016 — Supabase Storage Buckets & RLS Policies
--
--  Creates the three buckets the application requires and locks
--  them down with row-level security on storage.objects.
--
--  Buckets:
--    invoices     — private  — invoice PDFs + document PDFs
--                              path: firms/<firm_id>/...
--    firm-assets  — public   — firm logos
--                              path: firms/<firm_id>/logo.<ext>
--    client-files — private  — portal-uploaded tax documents
--                              path: clients/<client_id>/...
--
--  All INSERT operations use the service-role (admin) client
--  server-side, so no anon INSERT policy is needed.
-- ══════════════════════════════════════════════════════════════════

-- ── Create buckets ───────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('invoices',     'invoices',     false, 20971520,  ARRAY['application/pdf']),
  ('client-files', 'client-files', false, 52428800,  ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
  ('firm-assets',  'firm-assets',  true,  5242880,   ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- ── RLS: invoices (private — firm-scoped) ────────────────────────

CREATE POLICY "Firm members can read their invoice files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] = 'firms'
    AND (storage.foldername(name))[2] = (public.get_my_firm_id())::TEXT
  );

-- INSERT/DELETE via service role only — no authenticated policy needed.

-- ── RLS: client-files (private — firm-scoped via clients) ────────

CREATE POLICY "Firm members can read their client files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-files'
    AND (storage.foldername(name))[1] = 'clients'
    AND (storage.foldername(name))[2] IN (
      SELECT id::TEXT FROM public.clients
      WHERE firm_id = public.get_my_firm_id()
    )
  );

-- INSERT via service role only (portal upload uses admin client).

-- ── RLS: firm-assets (public bucket — open read, auth write) ─────
-- Public bucket: Supabase serves GET requests without RLS.
-- Restrict INSERT/UPDATE to authenticated firm owners.

CREATE POLICY "Firm members can upload their own assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'firm-assets'
    AND (storage.foldername(name))[1] = 'firms'
    AND (storage.foldername(name))[2] = (public.get_my_firm_id())::TEXT
  );

CREATE POLICY "Firm members can update their own assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'firm-assets'
    AND (storage.foldername(name))[1] = 'firms'
    AND (storage.foldername(name))[2] = (public.get_my_firm_id())::TEXT
  );
