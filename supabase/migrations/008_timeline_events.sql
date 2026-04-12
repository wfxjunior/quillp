-- ══════════════════════════════════════════════════════════════════
--  Migration 008 — timeline_events
--  Immutable append-only log. Never updated or deleted.
-- ══════════════════════════════════════════════════════════════════

CREATE TYPE timeline_event_type AS ENUM (
  'note',
  'stage_change',
  'document_sent',
  'document_signed',
  'file_uploaded',
  'invoice_paid',
  'reminder_sent'
);

CREATE TABLE public.timeline_events (
  id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID                NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type        timeline_event_type NOT NULL,
  title       TEXT                NOT NULL,
  detail      TEXT,
  created_by  UUID                REFERENCES public.users(id) ON DELETE SET NULL,  -- null = automated
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT now()
);

-- ── Index ─────────────────────────────────────────────────────────
-- Always queried by client, newest first
CREATE INDEX idx_timeline_client_id ON public.timeline_events(client_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view timeline events for their firm's clients"
  ON public.timeline_events FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert timeline events for their firm's clients"
  ON public.timeline_events FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients
      WHERE firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid())
    )
  );

-- Timeline events are immutable — no UPDATE or DELETE policies
