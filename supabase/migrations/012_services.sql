-- ══════════════════════════════════════════════════════════════════
--  Migration 012 — services (the service catalog)
--  Firms define reusable service templates. Processes are instances.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE public.services (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             UUID          NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  name                TEXT          NOT NULL,
  description         TEXT,
  price               NUMERIC(10,2),
  price_type          TEXT          CHECK (price_type IN ('flat_fee','hourly','retainer')),
  estimated_weeks     INTEGER,
  -- [{ order, title, description, assignee: 'client'|'cpa'|'system' }]
  steps               JSONB         NOT NULL DEFAULT '[]',
  -- [{ label, description, required: boolean }]
  required_documents  JSONB         NOT NULL DEFAULT '[]',
  -- per-state overrides (future use)
  state_rules         JSONB         NOT NULL DEFAULT '{}',
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX idx_services_firm ON public.services(firm_id) WHERE is_active = true;

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their firm's services"
  ON public.services FOR SELECT
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert services for their firm"
  ON public.services FOR INSERT
  WITH CHECK (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their firm's services"
  ON public.services FOR UPDATE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their firm's services"
  ON public.services FOR DELETE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));
