-- Batch 2B: make-up flow integrity — J1-F4 + J1-F29
--
-- Why
-- ---
-- Two related findings on the parent make-up flow:
--
-- J1-F4: PortalHome.executeCancelMakeup does a raw UPDATE on make_up_waitlist
-- to flip status booked -> waiting. This bypasses trg_makeup_participant_removed
-- (which fires only on lesson_participants DELETE), so:
--   - the make-up credit stays redeemed against an orphaned lesson_id
--   - the ghost lesson_participants row stays on the teacher's calendar
--   - no audit_log entry is written for the cancellation
--
-- J1-F29: respond_to_makeup_offer (the SECURITY DEFINER RPC for parent
-- accept/decline) writes no audit_log at all. Combined with J1-F1 (which
-- proves the client-side fire-and-forget audit INSERT was RLS-blocked by
-- 20260401000000_auth_rls_hardening.sql line 408), parent accept/decline
-- has had zero audit coverage since 2026-03-15.
--
-- What
-- ----
-- 1. New SECURITY DEFINER RPC public.cancel_booked_makeup(_waitlist_id) that:
--    - locks the waitlist row, validates guardian ownership and status = 'booked'
--    - DELETEs the matched lesson_participants row inside the same transaction
--    - lets trg_makeup_participant_removed do the rest (restores credit,
--      resets waitlist row to 'waiting', writes audit_log 'makeup_credit_restored')
--    - writes a parent-intent 'makeup_booking_cancelled' audit_log entry on top
--    - returns json {status: 'waiting', id: _waitlist_id, lesson_id: <deleted>}
--
-- 2. Updated public.respond_to_makeup_offer that adds INSERT INTO audit_log
--    inside both the accept and decline branches. Action verbs:
--      - 'makeup_offer_accepted' on the accept branch
--      - 'makeup_offer_declined' on the decline branch
--    entity_type = 'make_up_waitlist' (singular — table name is already singular).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. cancel_booked_makeup RPC (new)
-- ─────────────────────────────────────────────────────────────────────────

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

  -- Resolve guardian for the current user
  SELECT g.id INTO _guardian_id
    FROM guardians g
    WHERE g.user_id = _user_id AND g.deleted_at IS NULL
    LIMIT 1;

  IF _guardian_id IS NULL THEN
    RAISE EXCEPTION 'Guardian record not found';
  END IF;

  -- Lock the waitlist row, validate ownership + status
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
    -- Defensive: a 'booked' row without booked_lesson_id is a data invariant
    -- violation. Surface it loudly rather than silently fixing.
    RAISE EXCEPTION 'Waitlist entry % is in booked status but has no booked_lesson_id', _waitlist_id;
  END IF;

  _deleted_lesson_id := _entry.booked_lesson_id;

  -- DELETE the matched participant. trg_makeup_participant_removed will:
  --   - restore the credit
  --   - reset the waitlist row to 'waiting'
  --   - write audit_log 'makeup_credit_restored'
  -- We rely on the trigger for those side effects — do NOT duplicate them
  -- here, or audit/credit state will diverge between this path and
  -- staff-side participant removal.
  DELETE FROM lesson_participants
  WHERE lesson_id = _deleted_lesson_id
    AND student_id = _entry.student_id;

  GET DIAGNOSTICS _deleted_count = ROW_COUNT;

  IF _deleted_count = 0 THEN
    -- Trigger never fired because there was no row to delete. The waitlist
    -- entry is in 'booked' status with a booked_lesson_id but no participant —
    -- another data invariant violation. Surface and bail; do not silently
    -- flip the waitlist row to 'waiting' (that would mask the real problem).
    RAISE EXCEPTION 'No lesson_participant found for waitlist % (lesson_id=%)', _waitlist_id, _deleted_lesson_id;
  END IF;

  -- Write a parent-action audit_log entry on top of the trigger's
  -- 'makeup_credit_restored'. The trigger captures the credit/lesson mechanics;
  -- this entry captures the parent's intent (cancellation request).
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

-- ─────────────────────────────────────────────────────────────────────────
-- 2. respond_to_makeup_offer (replace, add audit_log writes)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.respond_to_makeup_offer(
  _waitlist_id UUID,
  _action TEXT  -- 'accept' or 'decline'
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

NOTIFY pgrst, 'reload schema';
