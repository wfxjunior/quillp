-- ══════════════════════════════════════════════════════════════════
--  Migration 015 — process_steps
--  Materialised steps for each process (copied from service template).
-- ══════════════════════════════════════════════════════════════════

CREATE TYPE step_status   AS ENUM ('pending', 'in_progress', 'completed', 'blocked');
CREATE TYPE step_assignee AS ENUM ('client', 'cpa', 'system');

CREATE TABLE public.process_steps (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id   UUID          NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  firm_id      UUID          NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  step_order   INTEGER       NOT NULL,
  title        TEXT          NOT NULL,
  description  TEXT,
  status       step_status   NOT NULL DEFAULT 'pending',
  assignee     step_assignee NOT NULL DEFAULT 'client',
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (process_id, step_order)
);

-- ── Index ─────────────────────────────────────────────────────────
CREATE INDEX idx_process_steps_process ON public.process_steps(process_id, step_order);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.process_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their firm's process steps"
  ON public.process_steps FOR SELECT
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert process steps for their firm"
  ON public.process_steps FOR INSERT
  WITH CHECK (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their firm's process steps"
  ON public.process_steps FOR UPDATE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their firm's process steps"
  ON public.process_steps FOR DELETE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));
