-- ─────────────────────────────────────────────────────────────────
-- Migration 014: Add 'admin' to user_role enum + bootstrap admin
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ─────────────────────────────────────────────────────────────────

-- 1. Extend the user_role enum to include 'admin'
--    IF NOT EXISTS guard prevents error on re-runs.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. Grant admin role to the designated admin account.
--    This is safe to run multiple times (UPDATE is idempotent).
--    Also handles the case where the user already exists in the DB
--    (e.g. created before this migration) or is created fresh via signup.
UPDATE public.users
SET role = 'admin'
WHERE email = 'admintest@admin.com';

-- 3. Add RLS policy so admin users can read ALL user rows.
--    The existing policy only allows users to read their own row.
--    Admins need broader visibility for platform management.
--    Drop first to avoid duplicate policy error on re-run.
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users AS me
      WHERE me.id = auth.uid() AND me.role = 'admin'
    )
  );

-- 4. Add RLS policy so admin users can update ANY user row.
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
CREATE POLICY "Admins can update all users"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users AS me
      WHERE me.id = auth.uid() AND me.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- Verification: run these after applying the migration
-- ─────────────────────────────────────────────────────────────────
-- SELECT enum_range(NULL::user_role);          -- should include 'admin'
-- SELECT id, email, role FROM public.users WHERE email = 'admintest@admin.com';
