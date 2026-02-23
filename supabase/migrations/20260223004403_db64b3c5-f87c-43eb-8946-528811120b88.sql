-- Add capacity and schedule conflict checks to confirm_makeup_booking
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
BEGIN
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

  -- 6. Insert participant
  INSERT INTO lesson_participants (lesson_id, student_id, org_id)
  VALUES (_entry.matched_lesson_id, _entry.student_id, _org_id);

  -- 7. Update waitlist
  UPDATE make_up_waitlist
  SET status = 'booked', booked_lesson_id = _entry.matched_lesson_id, updated_at = NOW()
  WHERE id = _waitlist_id;

  -- 8. Audit log
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'makeup_booked', 'make_up_waitlist', _waitlist_id,
    jsonb_build_object('student_id', _entry.student_id, 'lesson_id', _entry.matched_lesson_id));

  RETURN json_build_object('status', 'booked', 'lesson_id', _entry.matched_lesson_id);
END;
$function$;