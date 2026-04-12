-- ══════════════════════════════════════════════════════════════════
--  Migration 003 — clients
-- ══════════════════════════════════════════════════════════════════

CREATE TYPE entity_type AS ENUM ('individual', 's_corp', 'llc', 'partnership', 'c_corp');
CREATE TYPE fee_structure AS ENUM ('flat_fee', 'hourly', 'retainer');
CREATE TYPE pipeline_stage AS ENUM (
  'engaged',
  'onboarding',
  'docs_received',
  'in_progress',
  'review',
  'filed_invoiced'
);

CREATE TABLE public.clients (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             UUID          NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  name                TEXT          NOT NULL,
  email               TEXT,
  phone               TEXT,
  entity_type         entity_type   NOT NULL DEFAULT 'individual',
  services            TEXT[]        NOT NULL DEFAULT '{}',
  filing_state        CHAR(2),
  tax_year            SMALLINT,
  fee_amount          NUMERIC(10,2),
  fee_structure       fee_structure,
  pipeline_stage      pipeline_stage NOT NULL DEFAULT 'engaged',
  portal_token        UUID          NOT NULL DEFAULT gen_random_uuid(),
  portal_submitted_at TIMESTAMPTZ,
  internal_notes      TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  archived_at         TIMESTAMPTZ
);

-- ── Indexes (blueprint-part2.md §16.2) ──────────────────────────
CREATE INDEX idx_clients_firm_id       ON public.clients(firm_id);
CREATE INDEX idx_clients_pipeline_stage ON public.clients(firm_id, pipeline_stage);

-- Portal token must be globally unique for public lookup
CREATE UNIQUE INDEX idx_clients_portal_token ON public.clients(portal_token);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their firm's clients"
  ON public.clients FOR SELECT
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert clients into their firm"
  ON public.clients FOR INSERT
  WITH CHECK (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their firm's clients"
  ON public.clients FOR UPDATE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their firm's clients"
  ON public.clients FOR DELETE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));
