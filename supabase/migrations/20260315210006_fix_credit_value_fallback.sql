-- FIX 6 [6A.3]: Fall back to rate card when no invoice item for credit value
--
-- When auto-issuing a credit, if no invoice_item exists for the lesson
-- (e.g. lesson not yet invoiced), the credit value is 0 and the credit
-- is silently skipped. Students who cancel before invoicing get no credit.
--
-- Fix: Fall back to student's default rate card, then any org default
-- rate card. rate_cards.rate_amount is in major units (£), so multiply
-- by 100 to get minor units (pence).

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
  _new_credit_id UUID;
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

  -- 1. Try invoice item amount (already in minor units)
  SELECT ii.unit_price_minor INTO _credit_value
    FROM invoice_items ii
    WHERE ii.linked_lesson_id = NEW.lesson_id AND ii.student_id = NEW.student_id
    LIMIT 1;

  -- 2. Fall back to student's default rate card (major → minor units)
  IF COALESCE(_credit_value, 0) <= 0 THEN
    SELECT (rc.rate_amount * 100)::INTEGER INTO _credit_value
      FROM students s
      JOIN rate_cards rc ON rc.id = s.default_rate_card_id
      WHERE s.id = NEW.student_id AND s.default_rate_card_id IS NOT NULL;
  END IF;

  -- 3. Fall back to org default rate card (is_default = true)
  IF COALESCE(_credit_value, 0) <= 0 THEN
    SELECT (rc.rate_amount * 100)::INTEGER INTO _credit_value
      FROM rate_cards rc
      WHERE rc.org_id = NEW.org_id AND rc.is_default = true
      LIMIT 1;
  END IF;

  -- Still zero — genuinely no rate available, skip
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
    NEW.recorded_by)
  RETURNING id INTO _new_credit_id;

  -- Link the new credit to any existing waitlist entry for this student+lesson
  UPDATE make_up_waitlist
  SET credit_id = _new_credit_id, updated_at = NOW()
  WHERE student_id = NEW.student_id
    AND missed_lesson_id = NEW.lesson_id
    AND credit_id IS NULL
    AND status NOT IN ('expired', 'cancelled', 'booked');

  RETURN NEW;
END;
$function$;
