-- Batch 2C: term_continuation RLS recursion fix + J1-F31 multi-org guardian scoping
--
-- Why
-- ---
-- Production-live HTTP 500 on every page that loads term_continuation_runs or
-- term_continuation_responses. Postgres error 42P17 (infinite recursion in policy)
-- caused by mutual subquery between two SELECT policies introduced when J6-F4/F5
-- shipped in PR #367 (migration 20260511100000_lockdown_parent_rls_j6_j8.sql):
--
--   policy "Parents see own responses" on term_continuation_responses
--     (from 20260315200500) subqueries term_continuation_runs to scope by
--     run.org_id.
--   policy "Parents can view runs they have responses in" on
--     term_continuation_runs (from 20260511100000) subqueries
--     term_continuation_responses (EXISTS-join through guardians).
--
-- PostgREST evaluates all permissive SELECT policies for a row. When any
-- session (parent or staff) reads either table, the planner fires both
-- policies. The mutual subquery loops indefinitely. Postgres detects and
-- aborts with 42P17. Real-world impact: parent portal blank-renders for all
-- users; staff dashboard widgets that touch the continuation surface fail.
--
-- J1-F31 (filed during PR #374 verification): respond_to_makeup_offer and
-- cancel_booked_makeup resolve guardian via
--   SELECT g.id FROM guardians g WHERE g.user_id = _user_id AND deleted_at IS NULL LIMIT 1
-- with no org filter. For parents with guardian rows in multiple orgs the
-- lookup may bind to the wrong guardian and the subsequent waitlist-ownership
-- check fails with "Waitlist entry not found or does not belong to you".
-- Silent failure mode for cross-org parents.
--
-- What
-- ----
-- 1. Two new SECURITY DEFINER helpers that break the recursion by performing
--    the cross-table check internally (SECURITY DEFINER bypasses RLS, so the
--    function body's reads do not trigger policy re-evaluation):
--      public.user_has_continuation_response_in_run(_user_id uuid, _run_id uuid)
--        -> boolean. Replaces the EXISTS subquery in the
--        term_continuation_runs parent policy.
--      public.continuation_run_org_id(_run_id uuid)
--        -> uuid. Replaces the org_id subquery in the
--        term_continuation_responses parent policy.
--
-- 2. Drop and recreate both parent SELECT policies, using the helpers instead
--    of cross-table subqueries. All other policies on both tables are
--    untouched (staff SELECT, admin FOR ALL, parent UPDATE on responses
--    already dropped in PR #367).
--
-- 3. Replace respond_to_makeup_offer and cancel_booked_makeup with org-scoped
--    guardian lookup. The waitlist row is read first to obtain org_id (LIMIT 1
--    by primary key — single row, no policy interaction since these RPCs are
--    SECURITY DEFINER). The guardian lookup then filters by user_id AND org_id.
--    Output of guardian-not-found error message changed to surface multi-org
--    case explicitly: "Guardian record not found for this organisation."

-- ===========================================================================
-- 1. SECURITY DEFINER helpers (recursion-breakers)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.user_has_continuation_response_in_run(
  _user_id uuid, _run_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.term_continuation_responses tcr
    JOIN public.guardians g ON g.id = tcr.guardian_id
    WHERE tcr.run_id = _run_id
      AND g.user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_continuation_response_in_run(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_continuation_response_in_run(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.user_has_continuation_response_in_run(uuid, uuid) IS
  'Recursion-breaker for term_continuation_runs SELECT policy. Reads term_continuation_responses + guardians under SECURITY DEFINER so the body bypasses RLS, avoiding the 42P17 mutual-recursion loop with the responses parent SELECT policy.';

CREATE OR REPLACE FUNCTION public.continuation_run_org_id(_run_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.term_continuation_runs WHERE id = _run_id;
$$;

REVOKE ALL ON FUNCTION public.continuation_run_org_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.continuation_run_org_id(uuid) TO authenticated;

COMMENT ON FUNCTION public.continuation_run_org_id(uuid) IS
  'Recursion-breaker for term_continuation_responses SELECT policy. Reads term_continuation_runs.org_id under SECURITY DEFINER so the body bypasses RLS, avoiding the 42P17 mutual-recursion loop with the runs parent SELECT policy.';

-- ===========================================================================
-- 2a. Rewrite "Parents can view runs they have responses in"
--     on term_continuation_runs to use the helper
-- ===========================================================================

DROP POLICY IF EXISTS "Parents can view runs they have responses in"
  ON public.term_continuation_runs;

CREATE POLICY "Parents can view runs they have responses in"
  ON public.term_continuation_runs FOR SELECT
  USING (
    public.user_has_continuation_response_in_run(auth.uid(), id)
  );

-- ===========================================================================
-- 2b. Rewrite "Parents see own responses" on term_continuation_responses
--     to use the helper
-- ===========================================================================

DROP POLICY IF EXISTS "Parents see own responses"
  ON public.term_continuation_responses;

CREATE POLICY "Parents see own responses"
  ON public.term_continuation_responses FOR SELECT
  USING (
    guardian_id IN (
      SELECT sg.guardian_id
      FROM public.student_guardians sg
      JOIN public.guardians g ON g.id = sg.guardian_id
      WHERE g.user_id = auth.uid()
    )
    AND org_id = public.continuation_run_org_id(run_id)
  );

-- ===========================================================================
-- 3. J1-F31: org-scope the guardian lookup in respond_to_makeup_offer
--    and cancel_booked_makeup
-- ===========================================================================
-- Both functions previously did:
--   SELECT g.id FROM guardians g
--   WHERE g.user_id = _user_id AND g.deleted_at IS NULL
--   LIMIT 1
-- which can bind to the wrong guardian for multi-org parents.
--
-- The waitlist row is read inside the same RPC; we now read it first
-- to obtain org_id, then scope the guardian lookup by both user_id and
-- org_id. This requires no API change (waitlist_id is the only param)
-- and no client change.

CREATE OR REPLACE FUNCTION public.respond_to_makeup_offer(
  _waitlist_id UUID,
  _action TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _entry RECORD;
  _guardian_id UUID;
  _user_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _action NOT IN ('accept', 'decline') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be accept or decline.', _action;
  END IF;

  -- Read the waitlist row first (by primary key, SECURITY DEFINER bypasses RLS)
  -- so we have its org_id available for the guardian scope.
  SELECT * INTO _entry
    FROM make_up_waitlist
    WHERE id = _waitlist_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found';
  END IF;

  -- Resolve guardian for the current user, scoped to the waitlist's org
  SELECT g.id INTO _guardian_id
    FROM guardians g
    WHERE g.user_id = _user_id
      AND g.org_id = _entry.org_id
      AND g.deleted_at IS NULL
    LIMIT 1;

  IF _guardian_id IS NULL THEN
    RAISE EXCEPTION 'Guardian record not found for this organisation';
  END IF;

  IF _entry.guardian_id IS DISTINCT FROM _guardian_id THEN
    RAISE EXCEPTION 'Waitlist entry does not belong to you';
  END IF;

  IF _entry.status != 'offered' THEN
    RAISE EXCEPTION 'This offer is no longer available (current status: %)', _entry.status;
  END IF;

  IF _action = 'accept' THEN
    UPDATE make_up_waitlist
    SET status = 'accepted',
        responded_at = NOW(),
        updated_at = NOW()
    WHERE id = _waitlist_id;

    INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
    VALUES (_entry.org_id, _user_id, 'makeup_offer_accepted', 'make_up_waitlist', _waitlist_id,
      jsonb_build_object('student_id', _entry.student_id,
        'matched_lesson_id', _entry.matched_lesson_id));

    RETURN json_build_object('status', 'accepted', 'id', _waitlist_id);

  ELSE  -- decline
    UPDATE make_up_waitlist
    SET status = 'waiting',
        responded_at = NOW(),
        matched_lesson_id = NULL,
        matched_at = NULL,
        offered_at = NULL,
        updated_at = NOW()
    WHERE id = _waitlist_id;

    INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
    VALUES (_entry.org_id, _user_id, 'makeup_offer_declined', 'make_up_waitlist', _waitlist_id,
      jsonb_build_object('student_id', _entry.student_id,
        'declined_lesson_id', _entry.matched_lesson_id));

    RETURN json_build_object('status', 'waiting', 'id', _waitlist_id);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_booked_makeup(
  _waitlist_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _entry RECORD;
  _guardian_id UUID;
  _user_id UUID;
  _deleted_lesson_id UUID;
  _deleted_count INTEGER;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Read the waitlist row first to obtain org_id for guardian scoping
  SELECT * INTO _entry
    FROM make_up_waitlist
    WHERE id = _waitlist_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found';
  END IF;

  SELECT g.id INTO _guardian_id
    FROM guardians g
    WHERE g.user_id = _user_id
      AND g.org_id = _entry.org_id
      AND g.deleted_at IS NULL
    LIMIT 1;

  IF _guardian_id IS NULL THEN
    RAISE EXCEPTION 'Guardian record not found for this organisation';
  END IF;

  IF _entry.guardian_id IS DISTINCT FROM _guardian_id THEN
    RAISE EXCEPTION 'Waitlist entry does not belong to you';
  END IF;

  IF _entry.status != 'booked' THEN
    RAISE EXCEPTION 'Cannot cancel a make-up that is not booked (current status: %)', _entry.status;
  END IF;

  IF _entry.booked_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Waitlist entry % is in booked status but has no booked_lesson_id', _waitlist_id;
  END IF;

  _deleted_lesson_id := _entry.booked_lesson_id;

  DELETE FROM lesson_participants
  WHERE lesson_id = _deleted_lesson_id
    AND student_id = _entry.student_id;

  GET DIAGNOSTICS _deleted_count = ROW_COUNT;

  IF _deleted_count = 0 THEN
    RAISE EXCEPTION 'No lesson_participant found for waitlist % (lesson_id=%)', _waitlist_id, _deleted_lesson_id;
  END IF;

  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_entry.org_id, _user_id, 'makeup_booking_cancelled', 'make_up_waitlist', _waitlist_id,
    jsonb_build_object('student_id', _entry.student_id, 'lesson_id', _deleted_lesson_id,
      'cancelled_by', 'parent'));

  RETURN json_build_object('status', 'waiting', 'id', _waitlist_id, 'lesson_id', _deleted_lesson_id);
END;
$function$;

-- Note: function-level GRANT/REVOKE on respond_to_makeup_offer and
-- cancel_booked_makeup are intentionally NOT changed here. The broader
-- "SECURITY DEFINER RPCs leak EXECUTE to PUBLIC/anon" issue is filed for
-- a future Track 0.2 RLS-uniformity sweep; touching it in this migration
-- would expand scope. Defence-in-depth is preserved by the explicit
-- auth.uid() IS NULL check at the top of each function.

NOTIFY pgrst, 'reload schema';
