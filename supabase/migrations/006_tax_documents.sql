-- ══════════════════════════════════════════════════════════════════
--  Migration 006 — tax_documents
--  Uploaded by clients through the portal.
--  Files stored in Supabase Storage (private bucket).
-- ══════════════════════════════════════════════════════════════════

CREATE TYPE tax_document_status      AS ENUM ('missing', 'requested', 'received');
CREATE TYPE tax_document_uploaded_by AS ENUM ('client', 'cpa');

CREATE TABLE public.tax_documents (
  id             UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID                     NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_type  TEXT                     NOT NULL,   -- e.g. "W-2", "1099-INT", "K-1", "1098"
  required       BOOLEAN                  NOT NULL DEFAULT true,
  status         tax_document_status      NOT NULL DEFAULT 'missing',
  file_url       TEXT,                               -- signed URL generated on access (never public)
  file_name      TEXT,
  uploaded_at    TIMESTAMPTZ,
  uploaded_by    tax_document_uploaded_by
);

-- ── RLS ──────────────────────────────────────────────────────────
-- Tax docs belong to clients which belong to firms.
-- CPA access is via client → firm join.
-- Portal access (client-side) uses service role key — bypasses RLS.
ALTER TABLE public.tax_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tax docs for their firm's clients"
  ON public.tax_documents FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert tax docs for their firm's clients"
  ON public.tax_documents FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients
      WHERE firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update tax docs for their firm's clients"
  ON public.tax_documents FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete tax docs for their firm's clients"
  ON public.tax_documents FOR DELETE
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid())
    )
  );
