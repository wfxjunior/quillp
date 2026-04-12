-- ══════════════════════════════════════════════════════════════════
--  Migration 010 — notifications
--  MVP: populated but no in-app bell UI (V2 feature).
--  All alerts delivered by email (Resend). Table pre-built for V2.
-- ══════════════════════════════════════════════════════════════════

CREATE TYPE notification_type AS ENUM (
  'deadline_alert',
  'document_signed',
  'portal_submitted',
  'invoice_overdue',
  'missing_document'
);

CREATE TABLE public.notifications (
  id         UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id    UUID               NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  user_id    UUID               NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       notification_type  NOT NULL,
  title      TEXT               NOT NULL,
  body       TEXT               NOT NULL,
  read       BOOLEAN            NOT NULL DEFAULT false,
  link       TEXT,              -- relative app URL, e.g. "/clients/[id]"
  created_at TIMESTAMPTZ        NOT NULL DEFAULT now()
);

-- ── Index ─────────────────────────────────────────────────────────
-- Unread count badge query
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can mark their own notifications as read"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- INSERT is handled by server-side service role (background jobs, webhooks)
-- No client-side INSERT policy needed
