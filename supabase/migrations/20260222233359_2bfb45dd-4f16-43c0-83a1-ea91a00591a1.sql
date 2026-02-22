
-- 1) Unique constraint to prevent double-booking a student into the same lesson
ALTER TABLE public.lesson_participants
  ADD CONSTRAINT lesson_participants_lesson_student_unique UNIQUE (lesson_id, student_id);

-- 2) Atomic confirm_makeup_booking RPC
CREATE OR REPLACE FUNCTION public.confirm_makeup_booking(
  _waitlist_id uuid,
  _org_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _entry RECORD;
  _lesson RECORD;
  _already_participant BOOLEAN;
BEGIN
  -- Lock the waitlist row
  SELECT * INTO _entry
  FROM make_up_waitlist
  WHERE id = _waitlist_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found';
  END IF;

  -- Validate bookable status
  IF _entry.status NOT IN ('matched', 'offered', 'accepted') THEN
    RAISE EXCEPTION 'Waitlist entry is not in a bookable state (current: %)', _entry.status;
  END IF;

  -- Ensure matched_lesson_id is set
  IF _entry.matched_lesson_id IS NULL THEN
    RAISE EXCEPTION 'No matched lesson for this waitlist entry';
  END IF;

  -- Check lesson exists and is scheduled
  SELECT * INTO _lesson
  FROM lessons
  WHERE id = _entry.matched_lesson_id AND org_id = _org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matched lesson not found';
  END IF;

  IF _lesson.status != 'scheduled' THEN
    RAISE EXCEPTION 'Matched lesson is not in scheduled status (current: %)', _lesson.status;
  END IF;

  -- Check student isn't already a participant
  SELECT EXISTS (
    SELECT 1 FROM lesson_participants
    WHERE lesson_id = _entry.matched_lesson_id AND student_id = _entry.student_id
  ) INTO _already_participant;

  IF _already_participant THEN
    RAISE EXCEPTION 'Student is already a participant in this lesson';
  END IF;

  -- Insert participant
  INSERT INTO lesson_participants (lesson_id, student_id, org_id)
  VALUES (_entry.matched_lesson_id, _entry.student_id, _org_id);

  -- Update waitlist entry
  UPDATE make_up_waitlist SET
    status = 'booked',
    booked_lesson_id = _entry.matched_lesson_id,
    updated_at = NOW()
  WHERE id = _waitlist_id;

  RETURN json_build_object(
    'waitlist_id', _waitlist_id,
    'lesson_id', _entry.matched_lesson_id,
    'student_id', _entry.student_id,
    'status', 'booked'
  );
END;
$$;
