-- E2E test infrastructure: flip auth.users.email_confirmed_at for a test user.
--
-- WHY: the s17 auth tightening enabled `enable_email_confirmations`, breaking
-- the §5.4 RBAC test's previous shortcut of password-grant for an unconfirmed
-- user (rejected with HTTP 400 email_not_confirmed). The test needs an
-- unconfirmed user with a VALID session to exercise the RouteGuard redirect.
-- This RPC lets the test (a) create user confirmed, (b) sign in to get a
-- session JWT, (c) call this RPC to flip email_confirmed_at to NULL, (d)
-- load the JWT into a Playwright context and verify RouteGuard redirects
-- to /verify-email.
--
-- SAFETY:
-- - Service-role only (RLS would block; SECURITY DEFINER respects auth.role()).
-- - Email pattern guard: only matches users with email LIKE '%@test.lessonloop.net'
--   so this RPC CANNOT be used to unconfirm a real user, even if service role
--   leaked. (Real users would have @lessonloop.net or @gmail.com etc.)
-- - Returns the row so test can verify the flip succeeded.
CREATE OR REPLACE FUNCTION public._e2e_set_user_email_confirmed(
  _user_id uuid,
  _confirmed boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_result jsonb;
BEGIN
  -- Only callable by service role
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden: _e2e_set_user_email_confirmed is service-role only';
  END IF;

  -- Safety guard: only affect test users
  SELECT email INTO v_email FROM auth.users WHERE id = _user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User % not found', _user_id;
  END IF;
  IF v_email NOT LIKE '%@test.lessonloop.net' THEN
    RAISE EXCEPTION 'Email % does not match e2e test pattern; refusing to modify', v_email;
  END IF;

  -- Apply the flip
  IF _confirmed THEN
    UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = _user_id;
  ELSE
    UPDATE auth.users SET email_confirmed_at = NULL WHERE id = _user_id;
  END IF;

  -- Return current state
  SELECT jsonb_build_object(
    'id', id,
    'email', email,
    'email_confirmed_at', email_confirmed_at
  ) INTO v_result
  FROM auth.users WHERE id = _user_id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public._e2e_set_user_email_confirmed FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public._e2e_set_user_email_confirmed TO service_role;

COMMENT ON FUNCTION public._e2e_set_user_email_confirmed IS
'E2E test infrastructure (s30) — flip auth.users.email_confirmed_at for an e2e test user. Service-role only; safety-guarded by email pattern match against @test.lessonloop.net.';
