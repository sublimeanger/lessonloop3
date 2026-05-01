-- Batch 2C: term_continuation RLS recursion fix + J1-F31 multi-org guardian scoping (PR #375 / 20260514100000)

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

DROP POLICY IF EXISTS "Parents can view runs they have responses in"
  ON public.term_continuation_runs;

CREATE POLICY "Parents can view runs they have responses in"
  ON public.term_continuation_runs FOR SELECT
  USING (
    public.user_has_continuation_response_in_run(auth.uid(), id)
  );

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

  ELSE
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

NOTIFY pgrst, 'reload schema';