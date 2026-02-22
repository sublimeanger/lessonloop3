
CREATE OR REPLACE FUNCTION public.auto_issue_credit_on_absence()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _policy RECORD;
  _credit_value INTEGER;
BEGIN
  IF NEW.attendance_status NOT IN ('absent', 'cancelled_by_student', 'cancelled_by_teacher') THEN RETURN NEW; END IF;
  IF NEW.absence_reason_category IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO _policy FROM make_up_policies
    WHERE org_id = NEW.org_id AND absence_reason = NEW.absence_reason_category;
  IF _policy IS NULL OR _policy.eligibility != 'automatic' THEN RETURN NEW; END IF;

  -- Don't duplicate
  IF EXISTS (SELECT 1 FROM make_up_credits
    WHERE student_id = NEW.student_id AND issued_for_lesson_id = NEW.lesson_id) THEN RETURN NEW; END IF;

  -- Get credit value from invoice item for this lesson, or default to 0
  SELECT COALESCE(ii.unit_price_minor, 0) INTO _credit_value
    FROM invoice_items ii
    WHERE ii.linked_lesson_id = NEW.lesson_id AND ii.student_id = NEW.student_id LIMIT 1;

  INSERT INTO make_up_credits (org_id, student_id, issued_for_lesson_id, credit_value_minor, notes, created_by)
  VALUES (NEW.org_id, NEW.student_id, NEW.lesson_id, COALESCE(_credit_value, 0),
    'Auto-issued: teacher cancellation', NEW.recorded_by);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_credit
  AFTER INSERT OR UPDATE OF attendance_status, absence_reason_category
  ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION auto_issue_credit_on_absence();
