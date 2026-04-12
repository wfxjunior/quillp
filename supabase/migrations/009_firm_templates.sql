-- ══════════════════════════════════════════════════════════════════
--  Migration 009 — firm_templates
--  Stores firm-specific document overrides that feed the memory AI.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE public.firm_templates (
  id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id           UUID            NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  document_type     document_type   NOT NULL,   -- reuses enum from migration 004
  service_type      TEXT            NOT NULL,   -- e.g. "1040", "S-Corp"
  content_html      TEXT            NOT NULL,
  diff_from_default JSONB,                      -- structured diff vs AI default
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),

  -- One template per (firm, document_type, service_type)
  UNIQUE (firm_id, document_type, service_type)
);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.firm_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their firm's templates"
  ON public.firm_templates FOR SELECT
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert templates into their firm"
  ON public.firm_templates FOR INSERT
  WITH CHECK (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their firm's templates"
  ON public.firm_templates FOR UPDATE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their firm's templates"
  ON public.firm_templates FOR DELETE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));
