-- ─────────────────────────────────────────────────────────────────
-- Migration 014b: Bootstrap admin user + admin RLS policies.
-- Runs after 014 so 'admin' is a committed enum value by this point.
-- ─────────────────────────────────────────────────────────────────

-- Grant admin role to the designated admin account (idempotent).
UPDATE public.users
   SET role = 'admin'
 WHERE email = 'admintest@admin.com';

-- RLS: admins can read all user rows.
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users AS me
      WHERE me.id = auth.uid() AND me.role = 'admin'
    )
  );

-- RLS: admins can update any user row.
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
CREATE POLICY "Admins can update all users"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users AS me
      WHERE me.id = auth.uid() AND me.role = 'admin'
    )
  );
