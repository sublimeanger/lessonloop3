
-- Update auto_add_to_waitlist to set expires_at at end-of-day in the academy's timezone
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
  );

  RETURN NEW;
END;
$function$;

-- Also update auto_issue_credit_on_absence to use academy timezone for credit expiry
CREATE OR REPLACE FUNCTION public.auto_issue_credit_on_absence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _policy RECORD;
  _credit_value INTEGER;
  _org RECORD;
  _current_count INTEGER;
  _term_start DATE;
  _local_date DATE;
BEGIN
  IF NEW.attendance_status NOT IN ('absent', 'cancelled_by_student', 'cancelled_by_teacher') THEN RETURN NEW; END IF;
  IF NEW.absence_reason_category IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO _policy FROM make_up_policies
    WHERE org_id = NEW.org_id AND absence_reason = NEW.absence_reason_category;
  IF _policy IS NULL OR _policy.eligibility != 'automatic' THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM make_up_credits
    WHERE student_id = NEW.student_id AND issued_for_lesson_id = NEW.lesson_id) THEN RETURN NEW; END IF;

  SELECT COALESCE(ii.unit_price_minor, 0) INTO _credit_value
    FROM invoice_items ii
    WHERE ii.linked_lesson_id = NEW.lesson_id AND ii.student_id = NEW.student_id LIMIT 1;

  IF COALESCE(_credit_value, 0) <= 0 THEN RETURN NEW; END IF;

  SELECT max_credits_per_term, credit_expiry_days, timezone INTO _org
    FROM organisations WHERE id = NEW.org_id;

  IF _org.max_credits_per_term IS NOT NULL THEN
    _term_start := date_trunc('quarter', CURRENT_DATE)::date;
    SELECT COUNT(*) INTO _current_count
      FROM make_up_credits
      WHERE student_id = NEW.student_id AND org_id = NEW.org_id AND issued_at >= _term_start;
    IF _current_count >= _org.max_credits_per_term THEN
      INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
      VALUES (NEW.org_id, NEW.recorded_by, 'credit_cap_reached', 'make_up_credit', NEW.student_id,
        jsonb_build_object('student_id', NEW.student_id, 'lesson_id', NEW.lesson_id,
          'current_count', _current_count, 'max_per_term', _org.max_credits_per_term));
      RETURN NEW;
    END IF;
  END IF;

  -- Set credit expiry at end-of-day in the academy's timezone
  _local_date := (NOW() AT TIME ZONE COALESCE(_org.timezone, 'Europe/London'))::date
                 + COALESCE(_org.credit_expiry_days, 90);

  INSERT INTO make_up_credits (org_id, student_id, issued_for_lesson_id, credit_value_minor, expires_at, notes, created_by)
  VALUES (NEW.org_id, NEW.student_id, NEW.lesson_id, _credit_value,
    (_local_date::timestamp + INTERVAL '23 hours 59 minutes 59 seconds') AT TIME ZONE COALESCE(_org.timezone, 'Europe/London'),
    'Auto-issued: ' || REPLACE(NEW.absence_reason_category::text, '_', ' '),
    NEW.recorded_by);

  RETURN NEW;
END;
$function$;
