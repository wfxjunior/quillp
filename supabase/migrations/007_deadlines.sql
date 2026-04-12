-- ══════════════════════════════════════════════════════════════════
--  Migration 007 — deadlines
--  Alert job runs daily at 06:00 UTC (pg_cron — configured separately).
-- ══════════════════════════════════════════════════════════════════

CREATE TYPE deadline_status AS ENUM ('pending', 'filed', 'extended');

CREATE TABLE public.deadlines (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             UUID            NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  client_id           UUID            NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  filing_type         TEXT            NOT NULL,   -- e.g. "Form 1040", "Form 1120-S"
  due_date            DATE            NOT NULL,
  status              deadline_status NOT NULL DEFAULT 'pending',
  extension_due_date  DATE,
  alert_sent_30       BOOLEAN         NOT NULL DEFAULT false,
  alert_sent_14       BOOLEAN         NOT NULL DEFAULT false,
  alert_sent_7        BOOLEAN         NOT NULL DEFAULT false,
  notes               TEXT
);

-- ── Indexes ──────────────────────────────────────────────────────
-- Most critical — calendar view sorts by firm + due_date
CREATE INDEX idx_deadlines_firm_due ON public.deadlines(firm_id, due_date);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their firm's deadlines"
  ON public.deadlines FOR SELECT
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert deadlines into their firm"
  ON public.deadlines FOR INSERT
  WITH CHECK (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their firm's deadlines"
  ON public.deadlines FOR UPDATE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their firm's deadlines"
  ON public.deadlines FOR DELETE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));
