
-- Update auto_add_to_waitlist to link credit_id if a matching credit exists
CREATE OR REPLACE FUNCTION public.auto_add_to_waitlist()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _policy RECORD;
  _lesson RECORD;
  _guardian_id UUID;
  _duration INTEGER;
  _expiry_weeks INTEGER;
  _tz TEXT;
  _local_date DATE;
  _waitlist_id UUID;
  _credit_id UUID;
BEGIN
  IF NEW.attendance_status NOT IN ('absent', 'cancelled_by_student') THEN RETURN NEW; END IF;
  IF NEW.absence_reason_category IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO _policy FROM make_up_policies
    WHERE org_id = NEW.org_id AND absence_reason = NEW.absence_reason_category;
  IF _policy IS NULL OR _policy.eligibility != 'waitlist' THEN RETURN NEW; END IF;

  -- Don't duplicate
  IF EXISTS (SELECT 1 FROM make_up_waitlist
    WHERE student_id = NEW.student_id AND missed_lesson_id = NEW.lesson_id
      AND status NOT IN ('expired', 'cancelled')) THEN RETURN NEW; END IF;

  SELECT * INTO _lesson FROM lessons WHERE id = NEW.lesson_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  _duration := EXTRACT(EPOCH FROM (_lesson.end_at::timestamp - _lesson.start_at::timestamp)) / 60;

  SELECT g.id INTO _guardian_id FROM student_guardians sg
    JOIN guardians g ON g.id = sg.guardian_id
    WHERE sg.student_id = NEW.student_id AND sg.is_primary_payer = true LIMIT 1;

  SELECT make_up_waitlist_expiry_weeks, timezone INTO _expiry_weeks, _tz
    FROM organisations WHERE id = NEW.org_id;

  -- Calculate expiry at end-of-day in the academy's local timezone
  _local_date := (NOW() AT TIME ZONE COALESCE(_tz, 'Europe/London'))::date
                 + (COALESCE(_expiry_weeks, 8) * 7);

  INSERT INTO make_up_waitlist (
    org_id, student_id, guardian_id, missed_lesson_id, missed_lesson_date,
    absence_reason, attendance_record_id, teacher_id, lesson_duration_minutes,
    lesson_title, location_id, status, expires_at
  ) VALUES (
    NEW.org_id, NEW.student_id, _guardian_id, NEW.lesson_id, _lesson.start_at::date,
    NEW.absence_reason_category, NEW.id, _lesson.teacher_id, _duration,
    _lesson.title, _lesson.location_id, 'waiting',
    (_local_date::timestamp + INTERVAL '23 hours 59 minutes 59 seconds') AT TIME ZONE COALESCE(_tz, 'Europe/London')
  )
  RETURNING id INTO _waitlist_id;

  -- Link any matching credit created by auto_issue_credit_on_absence (or manually)
  SELECT id INTO _credit_id FROM make_up_credits
    WHERE student_id = NEW.student_id
      AND issued_for_lesson_id = NEW.lesson_id
      AND redeemed_at IS NULL
    ORDER BY created_at DESC LIMIT 1;

  IF _credit_id IS NOT NULL THEN
    UPDATE make_up_waitlist SET credit_id = _credit_id WHERE id = _waitlist_id;
  END IF;

  RETURN NEW;
END;
$function$;
