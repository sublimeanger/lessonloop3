-- =============================================================================
-- Snapshot rate_minor on confirm_makeup_booking
--
-- Audit: BILLING_FORENSICS.md Section 3b — rate snapshot HIGH finding.
-- Scope doc: RATE_SNAPSHOT_FIX_SCOPE.md row 10.
-- Supersedes: 20260316270000_fix_waitlist_audit_findings.sql:13-144
--   (identical body except for steps 6 and 7 below).
--
-- Rate source (matches scope doc option (a) with (b) as fallback):
--   1. The originating missed lesson's lesson_participants.rate_minor.
--      Rationale: a make-up is a replacement for the missed lesson, so its
--      rate should equal the rate the student was paying for that lesson.
--      This preserves the invariant that a credit-issued → credit-redeemed
--      cycle is zero-sum at the original rate, not repriced at today's rate.
--   2. rate_cards lookup by the waitlist entry's lesson_duration_minutes.
--      Same semantics as create-billing-run/findRateForDuration.
--   3. rate_cards default (is_default = true).
--   4. NULL — column stays unset; create-billing-run will live-fallback.
--
-- Idempotency: this migration is a pure CREATE OR REPLACE FUNCTION with no
-- one-time-only statements. Safe to re-run.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.confirm_makeup_booking(_waitlist_id uuid, _org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _entry RECORD;
  _lesson RECORD;
  _participant_count INTEGER;
  _redeemed_credit_id UUID;
  _dismissed_count INTEGER;
  _rate_minor INTEGER;
BEGIN
  -- Auth check — only org staff can confirm bookings
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Access denied: not authorised to confirm bookings for this organisation';
  END IF;

  -- 1. Lock waitlist row
  SELECT * INTO _entry
  FROM make_up_waitlist
  WHERE id = _waitlist_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Waitlist entry not found'; END IF;

  IF _entry.status NOT IN ('matched', 'offered', 'accepted') THEN
    RAISE EXCEPTION 'Waitlist entry is not in a bookable status (current: %)', _entry.status;
  END IF;

  IF _entry.matched_lesson_id IS NULL THEN
    RAISE EXCEPTION 'No matched lesson for this waitlist entry';
  END IF;

  -- 2. Lock and fetch the target lesson
  SELECT * INTO _lesson
  FROM lessons
  WHERE id = _entry.matched_lesson_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Matched lesson not found'; END IF;

  IF _lesson.status = 'cancelled' THEN
    RAISE EXCEPTION 'Matched lesson has been cancelled';
  END IF;

  -- 3. Check duplicate participant
  IF EXISTS (
    SELECT 1 FROM lesson_participants
    WHERE lesson_id = _entry.matched_lesson_id AND student_id = _entry.student_id
  ) THEN
    RAISE EXCEPTION 'Student is already a participant in this lesson';
  END IF;

  -- 4. Capacity check
  IF _lesson.max_participants IS NOT NULL THEN
    SELECT COUNT(*) INTO _participant_count
    FROM lesson_participants
    WHERE lesson_id = _entry.matched_lesson_id;

    IF _participant_count >= _lesson.max_participants THEN
      RAISE EXCEPTION 'Lesson is full (% of % places taken)', _participant_count, _lesson.max_participants;
    END IF;
  END IF;

  -- 5. Schedule conflict check for this student
  IF EXISTS (
    SELECT 1 FROM lesson_participants lp
    JOIN lessons l ON l.id = lp.lesson_id
    WHERE lp.student_id = _entry.student_id
      AND l.status != 'cancelled'
      AND l.id != _entry.matched_lesson_id
      AND l.start_at < _lesson.end_at
      AND l.end_at > _lesson.start_at
  ) THEN
    RAISE EXCEPTION 'Student has a schedule conflict at this time';
  END IF;

  -- 6. Resolve rate_minor for the new participant row.
  --    Priority: missed lesson's snapshot → rate_cards by duration → default card → NULL.
  SELECT rate_minor INTO _rate_minor
  FROM lesson_participants
  WHERE lesson_id = _entry.missed_lesson_id
    AND student_id = _entry.student_id
  LIMIT 1;

  IF _rate_minor IS NULL THEN
    SELECT rate_amount::INTEGER INTO _rate_minor
    FROM rate_cards
    WHERE org_id = _org_id
      AND duration_mins = _entry.lesson_duration_minutes
    ORDER BY is_default DESC
    LIMIT 1;
  END IF;

  IF _rate_minor IS NULL THEN
    SELECT rate_amount::INTEGER INTO _rate_minor
    FROM rate_cards
    WHERE org_id = _org_id
      AND is_default = true
    LIMIT 1;
  END IF;

  -- 7. Insert participant with resolved rate_minor (may still be NULL;
  --    create-billing-run live-fallback will apply in that case).
  INSERT INTO lesson_participants (lesson_id, student_id, org_id, rate_minor)
  VALUES (_entry.matched_lesson_id, _entry.student_id, _org_id, _rate_minor);

  -- 8. Redeem the oldest available credit for this student
  UPDATE make_up_credits
  SET redeemed_at = NOW(),
      redeemed_lesson_id = _entry.matched_lesson_id,
      updated_at = NOW(),
      notes = COALESCE(notes, '') || ' [Redeemed for make-up lesson]'
  WHERE id = (
    SELECT id FROM make_up_credits
    WHERE student_id = _entry.student_id
      AND org_id = _org_id
      AND redeemed_at IS NULL
      AND expired_at IS NULL
      AND voided_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO _redeemed_credit_id;

  -- 9. Update waitlist
  UPDATE make_up_waitlist
  SET status = 'booked', booked_lesson_id = _entry.matched_lesson_id, updated_at = NOW()
  WHERE id = _waitlist_id;

  -- 10. Dismiss other matched entries — use 'waiting' (valid CHECK value)
  --     instead of 'unmatched' which is not in the CHECK constraint.
  --     Reset to 'waiting' so they can be re-matched to another slot.
  WITH dismissed AS (
    UPDATE make_up_waitlist
    SET status = 'waiting',
        matched_lesson_id = NULL,
        matched_at = NULL,
        updated_at = NOW()
    WHERE matched_lesson_id = _entry.matched_lesson_id
      AND id != _waitlist_id
      AND status = 'matched'
    RETURNING id
  )
  SELECT COUNT(*) INTO _dismissed_count FROM dismissed;

  -- 11. Audit log
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'makeup_booked', 'make_up_waitlist', _waitlist_id,
    jsonb_build_object('student_id', _entry.student_id, 'lesson_id', _entry.matched_lesson_id,
      'redeemed_credit_id', _redeemed_credit_id, 'dismissed_matches', _dismissed_count));

  RETURN json_build_object('status', 'booked', 'lesson_id', _entry.matched_lesson_id,
    'redeemed_credit_id', _redeemed_credit_id, 'dismissed_matches', _dismissed_count);
END;
$function$;
