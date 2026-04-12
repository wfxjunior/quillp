-- ══════════════════════════════════════════════════════════════════
--  Migration 004 — documents
-- ══════════════════════════════════════════════════════════════════

CREATE TYPE document_type AS ENUM (
  'engagement_letter',
  'proposal',
  'form_2848',
  'invoice',
  'checklist',
  'onboarding_portal',
  'delivery_summary'
);

CREATE TYPE document_status AS ENUM (
  'draft',
  'sent',
  'awaiting_signature',
  'signed',
  'paid',
  'archived'
);

CREATE TABLE public.documents (
  id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id               UUID            NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  client_id             UUID            REFERENCES public.clients(id) ON DELETE SET NULL,
  type                  document_type   NOT NULL,
  status                document_status NOT NULL DEFAULT 'draft',
  title                 TEXT            NOT NULL,
  content_html          TEXT,
  pdf_url               TEXT,
  docusign_envelope_id  TEXT,
  signed_at             TIMESTAMPTZ,
  service_type          TEXT,           -- e.g. "1040", "S-Corp"
  fee_amount            NUMERIC(10,2),
  jurisdiction          CHAR(2),        -- state code
  generation_params     JSONB,          -- all input params used (for re-generation)
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX idx_documents_client_id  ON public.documents(client_id);
CREATE INDEX idx_documents_firm_type  ON public.documents(firm_id, type);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their firm's documents"
  ON public.documents FOR SELECT
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert documents into their firm"
  ON public.documents FOR INSERT
  WITH CHECK (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their firm's documents"
  ON public.documents FOR UPDATE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their firm's documents"
  ON public.documents FOR DELETE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));
