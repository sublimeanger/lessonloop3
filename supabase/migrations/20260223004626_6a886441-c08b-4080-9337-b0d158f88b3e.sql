
-- Add credit cap and expiry settings to organisations
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS max_credits_per_term INTEGER DEFAULT NULL;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS credit_expiry_days INTEGER DEFAULT 90;

-- Update auto-credit trigger to enforce cap and use credit_expiry_days
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
BEGIN
  IF NEW.attendance_status NOT IN ('absent', 'cancelled_by_student', 'cancelled_by_teacher') THEN RETURN NEW; END IF;
  IF NEW.absence_reason_category IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO _policy FROM make_up_policies
    WHERE org_id = NEW.org_id AND absence_reason = NEW.absence_reason_category;
  IF _policy IS NULL OR _policy.eligibility != 'automatic' THEN RETURN NEW; END IF;

  -- Don't duplicate
  IF EXISTS (SELECT 1 FROM make_up_credits
    WHERE student_id = NEW.student_id AND issued_for_lesson_id = NEW.lesson_id) THEN RETURN NEW; END IF;

  -- Get credit value from invoice item for this lesson
  SELECT COALESCE(ii.unit_price_minor, 0) INTO _credit_value
    FROM invoice_items ii
    WHERE ii.linked_lesson_id = NEW.lesson_id AND ii.student_id = NEW.student_id LIMIT 1;

  -- Skip if no billable value
  IF COALESCE(_credit_value, 0) <= 0 THEN RETURN NEW; END IF;

  -- Get org settings
  SELECT max_credits_per_term, credit_expiry_days INTO _org
    FROM organisations WHERE id = NEW.org_id;

  -- Enforce per-term credit cap if configured
  IF _org.max_credits_per_term IS NOT NULL THEN
    -- Use current calendar quarter as term boundary
    _term_start := date_trunc('quarter', CURRENT_DATE)::date;

    SELECT COUNT(*) INTO _current_count
      FROM make_up_credits
      WHERE student_id = NEW.student_id
        AND org_id = NEW.org_id
        AND issued_at >= _term_start;

    IF _current_count >= _org.max_credits_per_term THEN
      -- Log that cap was reached but don't insert a credit
      INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
      VALUES (NEW.org_id, NEW.recorded_by, 'credit_cap_reached', 'make_up_credit', NEW.student_id,
        jsonb_build_object('student_id', NEW.student_id, 'lesson_id', NEW.lesson_id,
          'current_count', _current_count, 'max_per_term', _org.max_credits_per_term));
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO make_up_credits (org_id, student_id, issued_for_lesson_id, credit_value_minor, expires_at, notes, created_by)
  VALUES (NEW.org_id, NEW.student_id, NEW.lesson_id, _credit_value,
    NOW() + (COALESCE(_org.credit_expiry_days, 90) || ' days')::INTERVAL,
    'Auto-issued: ' || REPLACE(NEW.absence_reason_category::text, '_', ' '),
    NEW.recorded_by);

  RETURN NEW;
END;
$function$;
