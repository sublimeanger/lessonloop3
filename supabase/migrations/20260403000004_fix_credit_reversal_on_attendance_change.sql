-- ============================================================
-- S5-CC1 MEDIUM: Auto-void credit when attendance reversed
-- from absent to present
-- ============================================================
--
-- Bug: The auto_issue_credit_on_absence() trigger only handled
-- transitions TO absence states. If a teacher marked a student
-- absent (credit auto-issued), then corrected to present, the
-- credit remained — a billing error.
--
-- Fix: Add a reversal block at the top of the trigger that voids
-- the auto-issued credit when changing FROM absence TO non-absence.

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
  _voided_credit_id UUID;
BEGIN
  -- ── REVERSAL: If changing FROM absence TO non-absence, void auto-issued credit ──
  IF TG_OP = 'UPDATE'
    AND OLD.attendance_status IN ('absent', 'cancelled_by_student', 'cancelled_by_teacher')
    AND NEW.attendance_status NOT IN ('absent', 'cancelled_by_student', 'cancelled_by_teacher')
  THEN
    -- Only void credits that were auto-issued for this specific lesson+student,
    -- not already voided, and not already redeemed
    UPDATE make_up_credits
    SET voided_at = NOW()
    WHERE student_id = NEW.student_id
      AND issued_for_lesson_id = NEW.lesson_id
      AND voided_at IS NULL
      AND redeemed_at IS NULL
      AND notes LIKE 'Auto-issued:%'
    RETURNING id INTO _voided_credit_id;

    -- Audit trail for the reversal
    IF _voided_credit_id IS NOT NULL THEN
      INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
      VALUES (NEW.org_id, NEW.recorded_by, 'credit_voided_attendance_reversal', 'make_up_credit', _voided_credit_id,
        jsonb_build_object('student_id', NEW.student_id, 'lesson_id', NEW.lesson_id,
          'old_status', OLD.attendance_status, 'new_status', NEW.attendance_status));
    END IF;

    RETURN NEW;
  END IF;

  -- ── FORWARD: Auto-issue credit on absence ──
  IF NEW.attendance_status NOT IN ('absent', 'cancelled_by_student', 'cancelled_by_teacher') THEN RETURN NEW; END IF;
  IF NEW.absence_reason_category IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO _policy FROM make_up_policies
    WHERE org_id = NEW.org_id AND absence_reason = NEW.absence_reason_category;
  IF _policy IS NULL OR _policy.eligibility != 'automatic' THEN RETURN NEW; END IF;

  -- Don't duplicate — exclude voided credits so re-issuing after void works
  IF EXISTS (SELECT 1 FROM make_up_credits
    WHERE student_id = NEW.student_id AND issued_for_lesson_id = NEW.lesson_id
    AND voided_at IS NULL) THEN RETURN NEW; END IF;

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

  -- 4. CRD-H2 FIX: Fall back to the lesson participant's rate_minor snapshot
  IF COALESCE(_credit_value, 0) <= 0 THEN
    SELECT COALESCE(lp.rate_minor, 0) INTO _credit_value
      FROM lesson_participants lp
      WHERE lp.lesson_id = NEW.lesson_id AND lp.student_id = NEW.student_id
      LIMIT 1;
  END IF;

  -- Still zero — genuinely no rate available, skip
  IF COALESCE(_credit_value, 0) <= 0 THEN RETURN NEW; END IF;

  SELECT max_credits_per_term, credit_expiry_days, timezone INTO _org
    FROM organisations WHERE id = NEW.org_id;

  -- Resolve cap: per-policy cap takes priority, then org-wide cap
  _max_cap := COALESCE(_policy.max_credits_per_term, _org.max_credits_per_term);

  IF _max_cap IS NOT NULL THEN
    -- CRD-H1 FIX: Look up the actual current term instead of using calendar quarters
    SELECT start_date INTO _term_start
      FROM terms
      WHERE org_id = NEW.org_id
        AND start_date <= CURRENT_DATE
        AND end_date >= CURRENT_DATE
      ORDER BY start_date DESC
      LIMIT 1;

    -- Fallback to 90 days ago if no term found (solo teachers without terms)
    IF _term_start IS NULL THEN
      _term_start := CURRENT_DATE - INTERVAL '90 days';
    END IF;

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

  -- Audit log entry for auto-issued credit
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (NEW.org_id, NEW.recorded_by, 'credit_issued', 'make_up_credit', _new_credit_id,
    jsonb_build_object('student_id', NEW.student_id, 'lesson_id', NEW.lesson_id,
      'credit_value_minor', _credit_value, 'source', 'auto_issue'));

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
