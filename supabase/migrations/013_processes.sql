-- ══════════════════════════════════════════════════════════════════
--  Migration 013 — processes (process engine per client)
--  A process is a service instance assigned to a specific client.
-- ══════════════════════════════════════════════════════════════════

CREATE TYPE process_status AS ENUM (
  'pending',
  'engaged',
  'collecting',
  'in_review',
  'client_review',
  'filing',
  'complete',
  'archived'
);

CREATE TABLE public.processes (
  id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID            NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  client_id     UUID            NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id    UUID            NOT NULL REFERENCES public.services(id),
  title         TEXT            NOT NULL,
  status        process_status  NOT NULL DEFAULT 'pending',
  current_step  INTEGER         NOT NULL DEFAULT 1,
  total_steps   INTEGER         NOT NULL DEFAULT 1,
  started_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  due_date      DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX idx_processes_firm_status ON public.processes(firm_id, status);
CREATE INDEX idx_processes_client     ON public.processes(client_id);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their firm's processes"
  ON public.processes FOR SELECT
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert processes for their firm"
  ON public.processes FOR INSERT
  WITH CHECK (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their firm's processes"
  ON public.processes FOR UPDATE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their firm's processes"
  ON public.processes FOR DELETE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));
