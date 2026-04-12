-- ══════════════════════════════════════════════════════════════════
--  Migration 001 — users
--
--  Creates the public.users profile table, linked 1:1 to auth.users.
--  The trigger function that creates users + firms is in migration 002,
--  because it needs to INSERT into public.firms (defined there).
-- ══════════════════════════════════════════════════════════════════

CREATE TYPE user_role AS ENUM ('owner', 'staff');

CREATE TABLE public.users (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT        NOT NULL UNIQUE,
  name                  TEXT        NOT NULL,
  firm_id               UUID,                          -- FK constraint added in migration 002
  role                  user_role   NOT NULL DEFAULT 'owner',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at         TIMESTAMPTZ,
  onboarding_completed  BOOLEAN     NOT NULL DEFAULT false
);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can only read and update their own row
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);
