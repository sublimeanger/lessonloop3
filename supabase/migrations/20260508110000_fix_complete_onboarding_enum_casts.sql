-- Fix complete_onboarding RPC: enum casts + service_role-aware seed +
-- defensive seed exception catch.
--
-- Three bugs surfaced when the migrated RPC was first exercised on the
-- destination Supabase project (xmrhmxizpslhtkibqyfy) during Phase 7
-- final smoke validation:
--
--   Bug 1 (cast): organisations.org_type, .subscription_plan, and
--                 .subscription_status are USER-DEFINED enums. The
--                 original RPC inserts text-typed parameters straight
--                 into them, which fails on this project with
--                 ERROR 42804 "column \"org_type\" is of type org_type
--                 but expression is of type text".
--                 Fix: explicit ::enum casts on insert. Source production
--                 must have had implicit text→enum assignment casts that
--                 weren't in the migrated baseline.
--
--   Bug 2 (auth): seed_make_up_policies() guards itself with
--                 is_org_admin(auth.uid(), _org_id), but auth.uid() is
--                 NULL in service_role context (the path the onboarding
--                 RPC uses). Result: every onboarding call raises
--                 "Not authorised" inside the seed step.
--                 Fix: allow current_setting('role')='service_role' to
--                 bypass the admin check. Authenticated callers still
--                 require admin role.
--
--   Bug 3 (catch): complete_onboarding only catches `undefined_function`
--                  for the seeding helper. Any other error (incl. the
--                  P0001 from bug 2) bubbles up and rolls back the whole
--                  transaction. Broaden to WHEN OTHERS so future helper
--                  failures don't break the whole onboarding flow.
--
-- Both functions are recreated with explicit fixes; behaviour is
-- otherwise identical to 20260403000000_complete_onboarding_rpc.sql.

CREATE OR REPLACE FUNCTION public.seed_make_up_policies(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role (edge functions, onboarding RPC) is always allowed.
  -- Otherwise require org admin.
  IF current_setting('role', true) <> 'service_role'
     AND NOT is_org_admin(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  INSERT INTO make_up_policies (org_id, absence_reason, eligibility, description, releases_slot)
  VALUES
    (_org_id, 'sick',              'waitlist',          'Student sick — waitlisted for make-up if slot becomes available', true),
    (_org_id, 'school_commitment', 'not_eligible',      'Planned school event — no make-up per T&Cs', false),
    (_org_id, 'family_emergency',  'admin_discretion',  'Admin decides on case-by-case basis', true),
    (_org_id, 'holiday',           'not_eligible',      'Family holiday — no make-up per T&Cs', false),
    (_org_id, 'teacher_cancelled', 'automatic',         'Teacher cancelled — credit issued automatically', true),
    (_org_id, 'weather_closure',   'admin_discretion',  'Weather/closure — admin decides', true),
    (_org_id, 'no_show',           'not_eligible',      'No-show without notice — no make-up', false),
    (_org_id, 'other',             'admin_discretion',  'Other reason — admin decides', false)
  ON CONFLICT (org_id, absence_reason) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  _user_id uuid,
  _user_email text,
  _full_name text,
  _phone text DEFAULT NULL,
  _org_name text DEFAULT NULL,
  _org_type text DEFAULT NULL,
  _country_code text DEFAULT 'GB',
  _currency_code text DEFAULT 'GBP',
  _timezone text DEFAULT 'Europe/London',
  _subscription_plan text DEFAULT 'solo_teacher',
  _max_students integer DEFAULT -1,
  _max_teachers integer DEFAULT 1,
  _parent_reschedule_policy text DEFAULT 'request_only',
  _trial_days integer DEFAULT 14,
  _also_teaches boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _trial_ends_at timestamptz;
  _existing_org_id uuid;
BEGIN
  SELECT current_org_id INTO _existing_org_id
  FROM profiles WHERE id = _user_id AND has_completed_onboarding = true;
  IF _existing_org_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'org_id', _existing_org_id, 'message', 'Already onboarded');
  END IF;

  SELECT om.org_id INTO _existing_org_id
  FROM org_memberships om
  WHERE om.user_id = _user_id AND om.role = 'owner'::app_role AND om.status = 'active'::membership_status
  LIMIT 1;
  IF _existing_org_id IS NOT NULL THEN
    UPDATE profiles SET current_org_id = _existing_org_id, has_completed_onboarding = true WHERE id = _user_id;
    RETURN jsonb_build_object('success', true, 'org_id', _existing_org_id, 'message', 'Recovered from partial setup');
  END IF;

  _org_id := gen_random_uuid();
  _trial_ends_at := NOW() + (_trial_days || ' days')::interval;

  INSERT INTO profiles (id, email, full_name, phone, has_completed_onboarding)
  VALUES (_user_id, _user_email, _full_name, _phone, false)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = COALESCE(EXCLUDED.phone, profiles.phone);

  -- Bug 1: explicit enum casts on text params + literals
  INSERT INTO organisations (id, name, org_type, country_code, currency_code, timezone, created_by, subscription_plan, subscription_status, trial_ends_at, max_students, max_teachers, parent_reschedule_policy)
  VALUES (_org_id, _org_name, _org_type::org_type, _country_code, _currency_code, _timezone, _user_id, _subscription_plan::subscription_plan, 'trialing'::subscription_status, _trial_ends_at, _max_students, _max_teachers, _parent_reschedule_policy);

  INSERT INTO org_memberships (org_id, user_id, role, status)
  VALUES (_org_id, _user_id, 'owner'::app_role, 'active'::membership_status)
  ON CONFLICT DO NOTHING;

  IF _org_type = 'solo_teacher' OR _also_teaches THEN
    IF NOT EXISTS (SELECT 1 FROM teachers WHERE org_id = _org_id AND user_id = _user_id) THEN
      INSERT INTO teachers (org_id, user_id, display_name, email, status)
      VALUES (_org_id, _user_id, _full_name, _user_email, 'active'::student_status);
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM locations WHERE org_id = _org_id) THEN
    INSERT INTO locations (org_id, name, is_primary, country_code)
    VALUES (_org_id, 'My Studio', true, _country_code);
  END IF;

  -- Bug 3: any failure inside seeding helpers must not roll back the
  -- whole onboarding transaction. Log and continue.
  BEGIN
    PERFORM seed_make_up_policies(_org_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[complete_onboarding] seed_make_up_policies failed for org %: %', _org_id, SQLERRM;
  END;

  UPDATE profiles SET current_org_id = _org_id, has_completed_onboarding = true WHERE id = _user_id;
  RETURN jsonb_build_object('success', true, 'org_id', _org_id, 'message', 'Organisation created successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding TO service_role;
REVOKE EXECUTE ON FUNCTION public.complete_onboarding FROM authenticated, anon;
