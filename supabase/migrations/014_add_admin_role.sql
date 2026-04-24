-- ─────────────────────────────────────────────────────────────────
-- Migration 014: Add 'admin' to user_role enum.
-- Intentionally isolated — new enum values cannot be used in the
-- same transaction in which they are added (PG 12+ limitation).
-- The UPDATE and policies that USE 'admin' live in 014b.
-- ─────────────────────────────────────────────────────────────────

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
