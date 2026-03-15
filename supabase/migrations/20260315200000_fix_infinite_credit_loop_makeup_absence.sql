-- FIX 1: Prevent infinite credit loop via make-up absence
-- When a student is absent from a MAKE-UP lesson, the auto-issue trigger
-- creates a second credit because it only checks for duplicate credits on the
-- same lesson_id (and the make-up has a different ID). This creates a loop:
-- cancel → credit → waitlist → make-up → absent → credit → repeat
--
-- Fix: Before issuing a credit, check if the lesson was booked as a make-up
-- via the make_up_waitlist table. If so, do NOT issue a new credit.

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
  _is_makeup_lesson BOOLEAN;
BEGIN
  IF NEW.attendance_status NOT IN ('absent', 'cancelled_by_student', 'cancelled_by_teacher') THEN RETURN NEW; END IF;
  IF NEW.absence_reason_category IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO _policy FROM make_up_policies
    WHERE org_id = NEW.org_id AND absence_reason = NEW.absence_reason_category;
  IF _policy IS NULL OR _policy.eligibility != 'automatic' THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM make_up_credits
    WHERE student_id = NEW.student_id AND issued_for_lesson_id = NEW.lesson_id) THEN RETURN NEW; END IF;

  -- Prevent infinite loop: do NOT issue credit if this lesson was itself a make-up booking
  SELECT EXISTS (
    SELECT 1 FROM make_up_waitlist
    WHERE booked_lesson_id = NEW.lesson_id
      AND student_id = NEW.student_id
      AND status = 'booked'
  ) INTO _is_makeup_lesson;

  IF _is_makeup_lesson THEN
    INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
    VALUES (NEW.org_id, NEW.recorded_by, 'credit_skipped_makeup_lesson', 'make_up_credit', NEW.student_id,
      jsonb_build_object('student_id', NEW.student_id, 'lesson_id', NEW.lesson_id,
        'reason', 'Lesson was a make-up booking; no credit issued to prevent infinite loop'));
    RETURN NEW;
  END IF;

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
