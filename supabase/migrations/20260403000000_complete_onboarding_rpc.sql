-- Atomic onboarding RPC: runs all onboarding steps in a single transaction.
-- Prevents partial state, orphaned orgs, and redirect loops.
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
  -- Idempotency: check if already completed
  SELECT current_org_id INTO _existing_org_id
  FROM profiles WHERE id = _user_id AND has_completed_onboarding = true;

  IF _existing_org_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'org_id', _existing_org_id, 'message', 'Already onboarded');
  END IF;

  -- Recovery: check for existing ownership without completion flag
  SELECT om.org_id INTO _existing_org_id
  FROM org_memberships om
  WHERE om.user_id = _user_id AND om.role = 'owner' AND om.status = 'active'
  LIMIT 1;

  IF _existing_org_id IS NOT NULL THEN
    -- Heal the profile
    UPDATE profiles SET current_org_id = _existing_org_id, has_completed_onboarding = true WHERE id = _user_id;
    RETURN jsonb_build_object('success', true, 'org_id', _existing_org_id, 'message', 'Recovered from partial setup');
  END IF;

  -- Generate new org
  _org_id := gen_random_uuid();
  _trial_ends_at := NOW() + (_trial_days || ' days')::interval;

  -- Ensure profile exists
  INSERT INTO profiles (id, email, full_name, phone, has_completed_onboarding)
  VALUES (_user_id, _user_email, _full_name, _phone, false)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = COALESCE(EXCLUDED.phone, profiles.phone);

  -- Create organisation
  INSERT INTO organisations (id, name, org_type, country_code, currency_code, timezone, created_by, subscription_plan, subscription_status, trial_ends_at, max_students, max_teachers, parent_reschedule_policy)
  VALUES (_org_id, _org_name, _org_type, _country_code, _currency_code, _timezone, _user_id, _subscription_plan, 'trialing', _trial_ends_at, _max_students, _max_teachers, _parent_reschedule_policy);

  -- Create owner membership (if trigger doesn't handle it)
  INSERT INTO org_memberships (org_id, user_id, role, status)
  VALUES (_org_id, _user_id, 'owner', 'active')
  ON CONFLICT DO NOTHING;

  -- Create teacher record if applicable
  IF _org_type = 'solo_teacher' OR _also_teaches THEN
    IF NOT EXISTS (SELECT 1 FROM teachers WHERE org_id = _org_id AND user_id = _user_id) THEN
      INSERT INTO teachers (org_id, user_id, display_name, email, status)
      VALUES (_org_id, _user_id, _full_name, _user_email, 'active');
    END IF;
  END IF;

  -- Seed default location so users don't start with empty calendar
  IF NOT EXISTS (SELECT 1 FROM locations WHERE org_id = _org_id) THEN
    INSERT INTO locations (org_id, name, is_primary, country_code)
    VALUES (_org_id, 'My Studio', true, _country_code);
  END IF;

  -- Seed default make-up policies if function exists
  BEGIN
    PERFORM seed_make_up_policies(_org_id);
  EXCEPTION WHEN undefined_function THEN NULL;
  END;

  -- Mark complete (all in same transaction)
  UPDATE profiles SET current_org_id = _org_id, has_completed_onboarding = true WHERE id = _user_id;

  RETURN jsonb_build_object('success', true, 'org_id', _org_id, 'message', 'Organisation created successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding TO service_role;
REVOKE EXECUTE ON FUNCTION public.complete_onboarding FROM authenticated, anon;
