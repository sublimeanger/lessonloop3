-- ================================================================
-- Migration 1 of 2: 20260513100000_makeup_flow_integrity_j1_f4_f29.sql
-- ================================================================

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

  SELECT g.id INTO _guardian_id
    FROM guardians g
    WHERE g.user_id = _user_id AND g.deleted_at IS NULL
    LIMIT 1;

  IF _guardian_id IS NULL THEN
    RAISE EXCEPTION 'Guardian record not found';
  END IF;

  SELECT * INTO _entry
    FROM make_up_waitlist
    WHERE id = _waitlist_id
      AND guardian_id = _guardian_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found or does not belong to you';
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

REVOKE ALL ON FUNCTION public.cancel_booked_makeup(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_booked_makeup(UUID) TO authenticated;

COMMENT ON FUNCTION public.cancel_booked_makeup(UUID) IS
  'Parent-initiated cancel of a booked make-up. Deletes the matched lesson_participants row, which fires trg_makeup_participant_removed to restore credit and reset waitlist. Writes a parent-intent audit entry. SECURITY DEFINER because parents have no DELETE on lesson_participants.';

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

  SELECT g.id INTO _guardian_id
    FROM guardians g
    WHERE g.user_id = _user_id AND g.deleted_at IS NULL
    LIMIT 1;

  IF _guardian_id IS NULL THEN
    RAISE EXCEPTION 'Guardian record not found';
  END IF;

  IF _action NOT IN ('accept', 'decline') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be accept or decline.', _action;
  END IF;

  SELECT * INTO _entry
    FROM make_up_waitlist
    WHERE id = _waitlist_id
      AND guardian_id = _guardian_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found or does not belong to you';
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

NOTIFY pgrst, 'reload schema';

-- ================================================================
-- Migration 2 of 2: 20260513100100_audit_triggers_cc1_makeup_continuation.sql
-- ================================================================

DROP TRIGGER IF EXISTS audit_make_up_waitlist ON public.make_up_waitlist;

CREATE TRIGGER audit_make_up_waitlist
  AFTER INSERT OR UPDATE OR DELETE ON public.make_up_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('make_up_waitlist');

DROP TRIGGER IF EXISTS audit_term_continuation_responses ON public.term_continuation_responses;

CREATE TRIGGER audit_term_continuation_responses
  AFTER INSERT OR UPDATE OR DELETE ON public.term_continuation_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('term_continuation_response');