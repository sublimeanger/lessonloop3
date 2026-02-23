
CREATE OR REPLACE FUNCTION public.auto_issue_credit_on_absence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _policy RECORD;
  _credit_value INTEGER;
  _expiry_weeks INTEGER;
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

  SELECT make_up_waitlist_expiry_weeks INTO _expiry_weeks FROM organisations WHERE id = NEW.org_id;

  INSERT INTO make_up_credits (org_id, student_id, issued_for_lesson_id, credit_value_minor, expires_at, notes, created_by)
  VALUES (NEW.org_id, NEW.student_id, NEW.lesson_id, _credit_value,
    NOW() + (COALESCE(_expiry_weeks, 8) || ' weeks')::INTERVAL,
    'Auto-issued: ' || REPLACE(NEW.absence_reason_category::text, '_', ' '),
    NEW.recorded_by);

  RETURN NEW;
END;
$function$;
