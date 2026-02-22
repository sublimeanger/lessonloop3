
CREATE OR REPLACE FUNCTION public.auto_add_to_waitlist()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _policy RECORD;
  _lesson RECORD;
  _guardian_id UUID;
  _duration INTEGER;
  _expiry_weeks INTEGER;
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

  SELECT make_up_waitlist_expiry_weeks INTO _expiry_weeks FROM organisations WHERE id = NEW.org_id;

  INSERT INTO make_up_waitlist (
    org_id, student_id, guardian_id, missed_lesson_id, missed_lesson_date,
    absence_reason, attendance_record_id, teacher_id, lesson_duration_minutes,
    lesson_title, location_id, status, expires_at
  ) VALUES (
    NEW.org_id, NEW.student_id, _guardian_id, NEW.lesson_id, _lesson.start_at::date,
    NEW.absence_reason_category, NEW.id, _lesson.teacher_id, _duration,
    _lesson.title, _lesson.location_id, 'waiting',
    NOW() + (COALESCE(_expiry_weeks, 8) || ' weeks')::INTERVAL
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_waitlist
  AFTER INSERT OR UPDATE OF attendance_status, absence_reason_category
  ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION auto_add_to_waitlist();
