-- ══════════════════════════════════════════════════════════════════
--  Migration 018 — Add trigger_event and document_id to process_steps
--
--  trigger_event: drives automatic step completion when a specific
--  system event fires (document signed, portal submitted, file uploaded).
--  document_id: optional link to a Document that satisfies this step.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS trigger_event TEXT NOT NULL DEFAULT 'manual'
    CHECK (trigger_event IN ('manual', 'document_signed', 'portal_submitted', 'file_uploaded')),
  ADD COLUMN IF NOT EXISTS document_id UUID
    REFERENCES public.documents(id) ON DELETE SET NULL;

-- ── Index for trigger queries ──────────────────────────────────────
-- The trigger system queries: WHERE process_id = ? AND trigger_event = ? AND status = 'pending'
CREATE INDEX IF NOT EXISTS idx_process_steps_trigger
  ON public.process_steps(process_id, trigger_event, status);
