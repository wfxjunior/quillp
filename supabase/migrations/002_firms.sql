-- ══════════════════════════════════════════════════════════════════
--  Migration 002 — firms + auth trigger
--
--  Creates public.firms, adds the FK from users → firms,
--  then installs a SINGLE consolidated trigger function that:
--    1. Creates public.users (profile row)
--    2. Creates public.firms (the practice)
--    3. Links them via users.firm_id
--
--  All three steps run in one transaction — either all succeed
--  or all roll back. No partial signup state possible.
--
--  Trigger input (via supabase.auth.signUp options.data):
--    { name: string, firm_name: string }
-- ══════════════════════════════════════════════════════════════════

CREATE TYPE fee_model           AS ENUM ('flat_fee', 'hourly', 'retainer', 'hybrid');
CREATE TYPE subscription_plan   AS ENUM ('solo', 'small_firm', 'growing_firm');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled');

CREATE TABLE public.firms (
  id                   UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT                NOT NULL,
  owner_id             UUID                NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  logo_url             TEXT,
  -- { street, city, state, zip }
  address              JSONB,
  primary_state        CHAR(2),
  fee_model            fee_model,
  services             TEXT[]              NOT NULL DEFAULT '{}',
  entity_types         TEXT[]              NOT NULL DEFAULT '{}',
  client_types         TEXT[]              NOT NULL DEFAULT '{}',
  description_raw      TEXT,
  description_parsed   JSONB,
  docusign_token       TEXT,               -- encrypted at rest
  stripe_account_id    TEXT,
  subscription_plan    subscription_plan   NOT NULL DEFAULT 'solo',
  subscription_status  subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ         NOT NULL DEFAULT now()
);

-- ── Add FK from users → firms (firms now exists) ─────────────────
ALTER TABLE public.users
  ADD CONSTRAINT fk_users_firm
  FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;

-- ══════════════════════════════════════════════════════════════════
--  Consolidated trigger: users + firm creation
--  Fires AFTER INSERT on auth.users (i.e. after every signUp()).
--  blueprint-part2.md §9.1 step 5
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name      TEXT;
  v_firm_name TEXT;
  v_firm_id   UUID;
BEGIN
  -- ── 1. Extract metadata from the signUp() call ──────────────────
  --  Passed via: supabase.auth.signUp({ options: { data: { name, firm_name } } })
  v_name      := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(NEW.email, '@', 1)
  );
  v_firm_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'firm_name'), ''),
    v_name || '''s Practice'
  );

  -- ── 2. Create the user profile row ──────────────────────────────
  INSERT INTO public.users (id, email, name, role, onboarding_completed)
  VALUES (NEW.id, NEW.email, v_name, 'owner', false);

  -- ── 3. Create the firm ───────────────────────────────────────────
  INSERT INTO public.firms (name, owner_id, subscription_plan, subscription_status, trial_ends_at)
  VALUES (
    v_firm_name,
    NEW.id,
    'solo',
    'trialing',
    now() + INTERVAL '30 days'
  )
  RETURNING id INTO v_firm_id;

  -- ── 4. Link user → firm ──────────────────────────────────────────
  UPDATE public.users
     SET firm_id = v_firm_id
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Drop any previous trigger versions before creating
DROP TRIGGER IF EXISTS on_auth_user_created      ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_firm ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their firm"
  ON public.firms FOR SELECT
  USING (id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Owners can update their firm"
  ON public.firms FOR UPDATE
  USING (owner_id = auth.uid());
