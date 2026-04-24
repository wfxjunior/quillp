-- ══════════════════════════════════════════════════════════════════
--  Migration 019 — Add process_id to tax_documents
--
--  Scopes each tax document to a specific process rather than
--  just a client. NULL = client-level document (pre-process era).
--  ON DELETE CASCADE: removing a process cleans up its documents.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.tax_documents
  ADD COLUMN IF NOT EXISTS process_id UUID
    REFERENCES public.processes(id) ON DELETE CASCADE;

-- ── Index for process-scoped queries ──────────────────────────────
-- Primary access pattern: WHERE process_id = ? (AND required = true)
CREATE INDEX IF NOT EXISTS idx_tax_documents_process_id
  ON public.tax_documents(process_id)
  WHERE process_id IS NOT NULL;
