-- ══════════════════════════════════════════════════════════════════
--  Migration 017 — Rename DocuSign columns to SignNow equivalents
--
--  firms.docusign_token        → firms.signnow_token
--  documents.docusign_envelope_id → documents.signnow_document_id
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.firms
  RENAME COLUMN docusign_token TO signnow_token;

ALTER TABLE public.documents
  RENAME COLUMN docusign_envelope_id TO signnow_document_id;
