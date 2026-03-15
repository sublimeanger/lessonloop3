-- FIX 1 [7A.1]: Enforce max credits per student per term
--
-- Issues:
--   1. make_up_policies lacks per-policy max_credits_per_term
--   2. Credit count includes redeemed/expired — should only count active credits
--   3. No voided_at column on make_up_credits for admin voiding
--
-- Fix: Add max_credits_per_term to make_up_policies, add voided_at to
-- make_up_credits, update trigger to count only active credits and check
-- per-policy cap before falling back to org-wide cap.

-- 1. Add per-policy cap column
ALTER TABLE make_up_policies
  ADD COLUMN IF NOT EXISTS max_credits_per_term INTEGER DEFAULT NULL;

COMMENT ON COLUMN make_up_policies.max_credits_per_term
  IS 'Max active credits per student per term for this absence reason. NULL = use org default.';

-- 2. Add voided_at to make_up_credits for admin voiding
ALTER TABLE make_up_credits
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Update the auto-issue trigger to count only active credits
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
  _max_cap INTEGER;
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

  -- Resolve cap: per-policy cap takes priority, then org-wide cap
  _max_cap := COALESCE(_policy.max_credits_per_term, _org.max_credits_per_term);

  IF _max_cap IS NOT NULL THEN
    _term_start := date_trunc('quarter', CURRENT_DATE)::date;

    -- Count only ACTIVE credits (not redeemed, expired, or voided)
    SELECT COUNT(*) INTO _current_count
      FROM make_up_credits
      WHERE student_id = NEW.student_id
        AND org_id = NEW.org_id
        AND issued_at >= _term_start
        AND redeemed_at IS NULL
        AND expired_at IS NULL
        AND voided_at IS NULL;

    IF _current_count >= _max_cap THEN
      INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
      VALUES (NEW.org_id, NEW.recorded_by, 'credit_cap_reached', 'make_up_credit', NEW.student_id,
        jsonb_build_object('student_id', NEW.student_id, 'lesson_id', NEW.lesson_id,
          'current_count', _current_count, 'max_per_term', _max_cap,
          'source', CASE WHEN _policy.max_credits_per_term IS NOT NULL THEN 'policy' ELSE 'org' END));
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
