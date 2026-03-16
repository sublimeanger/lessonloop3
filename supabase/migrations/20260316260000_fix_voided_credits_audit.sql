-- ============================================================
-- Fix all CRITICAL and HIGH audit findings for make-up credits
-- Audit: audit-feature-17-makeup-credits.md
-- Fixes: CRD-C1, CRD-C2, CRD-C3, CRD-C4, CRD-H3, CRD-L2
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- CRD-C4 (part 1): Add voided_by column for audit trail
-- ────────────────────────────────────────────────────────────
ALTER TABLE make_up_credits
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id);

-- ────────────────────────────────────────────────────────────
-- CRD-C1 CRITICAL: available_credits view ignores voided_at
-- Fix: add 'voided' status to the CASE expression
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.available_credits AS
SELECT
  *,
  CASE
    WHEN voided_at IS NOT NULL THEN 'voided'
    WHEN redeemed_at IS NOT NULL THEN 'redeemed'
    WHEN expired_at IS NOT NULL THEN 'expired'
    WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
    ELSE 'available'
  END AS credit_status
FROM public.make_up_credits;

ALTER VIEW public.available_credits SET (security_invoker = on);

-- ────────────────────────────────────────────────────────────
-- CRD-C2 CRITICAL: confirm_makeup_booking() can redeem voided credits
-- Fix: add AND voided_at IS NULL to the credit lookup sub-SELECT
-- (Also carries forward all existing logic from the previous version)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_makeup_booking(_waitlist_id uuid, _org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _entry RECORD;
  _lesson RECORD;
  _participant_count INTEGER;
  _redeemed_credit_id UUID;
  _dismissed_count INTEGER;
BEGIN
  -- 1. Lock waitlist row
  SELECT * INTO _entry
  FROM make_up_waitlist
  WHERE id = _waitlist_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Waitlist entry not found'; END IF;

  IF _entry.status NOT IN ('matched', 'offered', 'accepted') THEN
    RAISE EXCEPTION 'Waitlist entry is not in a bookable status (current: %)', _entry.status;
  END IF;

  IF _entry.matched_lesson_id IS NULL THEN
    RAISE EXCEPTION 'No matched lesson for this waitlist entry';
  END IF;

  -- 2. Lock and fetch the target lesson
  SELECT * INTO _lesson
  FROM lessons
  WHERE id = _entry.matched_lesson_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Matched lesson not found'; END IF;

  IF _lesson.status = 'cancelled' THEN
    RAISE EXCEPTION 'Matched lesson has been cancelled';
  END IF;

  -- 3. Check duplicate participant
  IF EXISTS (
    SELECT 1 FROM lesson_participants
    WHERE lesson_id = _entry.matched_lesson_id AND student_id = _entry.student_id
  ) THEN
    RAISE EXCEPTION 'Student is already a participant in this lesson';
  END IF;

  -- 4. Capacity check
  IF _lesson.max_participants IS NOT NULL THEN
    SELECT COUNT(*) INTO _participant_count
    FROM lesson_participants
    WHERE lesson_id = _entry.matched_lesson_id;

    IF _participant_count >= _lesson.max_participants THEN
      RAISE EXCEPTION 'Lesson is full (% of % places taken)', _participant_count, _lesson.max_participants;
    END IF;
  END IF;

  -- 5. Schedule conflict check for this student
  IF EXISTS (
    SELECT 1 FROM lesson_participants lp
    JOIN lessons l ON l.id = lp.lesson_id
    WHERE lp.student_id = _entry.student_id
      AND l.status != 'cancelled'
      AND l.id != _entry.matched_lesson_id
      AND l.start_at < _lesson.end_at
      AND l.end_at > _lesson.start_at
  ) THEN
    RAISE EXCEPTION 'Student has a schedule conflict at this time';
  END IF;

  -- 6. Insert participant
  INSERT INTO lesson_participants (lesson_id, student_id, org_id)
  VALUES (_entry.matched_lesson_id, _entry.student_id, _org_id);

  -- 7. Redeem the oldest available credit for this student
  --    CRD-C2 FIX: added AND voided_at IS NULL
  UPDATE make_up_credits
  SET redeemed_at = NOW(),
      redeemed_lesson_id = _entry.matched_lesson_id,
      updated_at = NOW(),
      notes = COALESCE(notes, '') || ' [Redeemed for make-up lesson]'
  WHERE id = (
    SELECT id FROM make_up_credits
    WHERE student_id = _entry.student_id
      AND org_id = _org_id
      AND redeemed_at IS NULL
      AND expired_at IS NULL
      AND voided_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO _redeemed_credit_id;

  -- 8. Update waitlist
  UPDATE make_up_waitlist
  SET status = 'booked', booked_lesson_id = _entry.matched_lesson_id, updated_at = NOW()
  WHERE id = _waitlist_id;

  -- 9. Dismiss other matched entries for the same lesson (mutual exclusion)
  WITH dismissed AS (
    UPDATE make_up_waitlist
    SET status = 'unmatched',
        matched_lesson_id = NULL,
        matched_at = NULL,
        updated_at = NOW()
    WHERE matched_lesson_id = _entry.matched_lesson_id
      AND id != _waitlist_id
      AND status = 'matched'
    RETURNING id
  )
  SELECT COUNT(*) INTO _dismissed_count FROM dismissed;

  -- 10. Audit log
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'makeup_booked', 'make_up_waitlist', _waitlist_id,
    jsonb_build_object('student_id', _entry.student_id, 'lesson_id', _entry.matched_lesson_id,
      'redeemed_credit_id', _redeemed_credit_id, 'dismissed_matches', _dismissed_count));

  RETURN json_build_object('status', 'booked', 'lesson_id', _entry.matched_lesson_id,
    'redeemed_credit_id', _redeemed_credit_id, 'dismissed_matches', _dismissed_count);
END;
$function$;

-- ────────────────────────────────────────────────────────────
-- CRD-C3 CRITICAL: redeem_make_up_credit() ignores voided_at
-- Fix: add voided_at check after the FOR UPDATE lock
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_make_up_credit(_credit_id uuid, _lesson_id uuid, _org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _credit RECORD;
BEGIN
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to redeem credits for this organisation';
  END IF;

  SELECT * INTO _credit
  FROM make_up_credits WHERE id = _credit_id AND org_id = _org_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Credit not found'; END IF;
  IF _credit.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Credit has been voided'; END IF;
  IF _credit.redeemed_at IS NOT NULL THEN RAISE EXCEPTION 'Credit has already been redeemed'; END IF;
  IF _credit.expired_at IS NOT NULL THEN RAISE EXCEPTION 'Credit has been marked as expired'; END IF;
  IF _credit.expires_at IS NOT NULL AND _credit.expires_at <= NOW() THEN RAISE EXCEPTION 'Credit has expired'; END IF;

  UPDATE make_up_credits SET
    redeemed_at = NOW(), redeemed_lesson_id = _lesson_id, updated_at = NOW()
  WHERE id = _credit_id;

  -- Audit log
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'credit_redeemed', 'make_up_credit', _credit_id,
    jsonb_build_object('lesson_id', _lesson_id, 'student_id', _credit.student_id, 'credit_value_minor', _credit.credit_value_minor));

  RETURN json_build_object('credit_id', _credit_id, 'lesson_id', _lesson_id, 'status', 'redeemed');
END;
$function$;

-- ────────────────────────────────────────────────────────────
-- CRD-C4 CRITICAL: Create void_make_up_credit RPC
-- Replaces hard DELETE with a soft-void that preserves audit trail.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.void_make_up_credit(_credit_id uuid, _org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _credit RECORD;
  _waitlist_cancelled INTEGER := 0;
BEGIN
  -- Only org admins/owners can void credits
  IF NOT is_org_admin(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to void credits for this organisation';
  END IF;

  SELECT * INTO _credit
  FROM make_up_credits
  WHERE id = _credit_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Credit not found'; END IF;
  IF _credit.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Credit has already been voided'; END IF;
  IF _credit.redeemed_at IS NOT NULL THEN RAISE EXCEPTION 'Cannot void a redeemed credit'; END IF;

  -- Void the credit
  UPDATE make_up_credits
  SET voided_at = NOW(),
      voided_by = auth.uid(),
      updated_at = NOW()
  WHERE id = _credit_id;

  -- Cancel any active waitlist entries linked to this credit
  WITH cancelled AS (
    UPDATE make_up_waitlist
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE credit_id = _credit_id
      AND status IN ('waiting', 'matched', 'offered', 'accepted')
    RETURNING id
  )
  SELECT COUNT(*) INTO _waitlist_cancelled FROM cancelled;

  -- Audit log
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'credit_voided', 'make_up_credit', _credit_id,
    jsonb_build_object('student_id', _credit.student_id,
      'credit_value_minor', _credit.credit_value_minor,
      'waitlist_entries_cancelled', _waitlist_cancelled));

  RETURN json_build_object(
    'credit_id', _credit_id,
    'status', 'voided',
    'waitlist_entries_cancelled', _waitlist_cancelled
  );
END;
$function$;

-- ────────────────────────────────────────────────────────────
-- CRD-C4 (part 2): Drop DELETE policy on make_up_credits
-- Credits should never be hard-deleted; use void_make_up_credit() instead.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can delete make_up_credits in their org"
  ON public.make_up_credits;

-- ────────────────────────────────────────────────────────────
-- CRD-H3 HIGH: create_invoice_with_items() ignores voided_at
-- Fix: add AND voided_at IS NULL to both the lock query and the update query
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_invoice_with_items(_org_id uuid, _due_date date, _payer_guardian_id uuid DEFAULT NULL::uuid, _payer_student_id uuid DEFAULT NULL::uuid, _notes text DEFAULT NULL::text, _credit_ids uuid[] DEFAULT '{}'::uuid[], _items jsonb DEFAULT '[]'::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _org RECORD;
  _subtotal integer;
  _tax_minor integer;
  _credit_offset integer := 0;
  _total_minor integer;
  _invoice RECORD;
  _item jsonb;
  _i integer := 0;
  _locked_credit_count integer;
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to create invoices for this organisation';
  END IF;

  IF NOT is_org_active(_org_id) THEN
    RAISE EXCEPTION 'Organisation is not active';
  END IF;

  SELECT vat_enabled, vat_rate, currency_code INTO _org
  FROM organisations WHERE id = _org_id;
  IF _org IS NULL THEN RAISE EXCEPTION 'Organisation not found'; END IF;

  IF _payer_guardian_id IS NULL AND _payer_student_id IS NULL THEN
    RAISE EXCEPTION 'Invoice must have a payer (guardian or student)';
  END IF;

  IF jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Invoice must have at least one item';
  END IF;

  SELECT COALESCE(SUM(
    (item->>'quantity')::integer * (item->>'unit_price_minor')::integer
  ), 0) INTO _subtotal
  FROM jsonb_array_elements(_items) AS item;

  IF _org.vat_enabled THEN
    _tax_minor := ROUND(_subtotal * _org.vat_rate / 100.0);
  ELSE
    _tax_minor := 0;
  END IF;

  IF array_length(_credit_ids, 1) > 0 THEN
    -- CRD-H3 FIX: added AND voided_at IS NULL
    SELECT COUNT(*), COALESCE(SUM(credit_value_minor), 0)
    INTO _locked_credit_count, _credit_offset
    FROM make_up_credits
    WHERE id = ANY(_credit_ids)
      AND org_id = _org_id
      AND redeemed_at IS NULL
      AND expired_at IS NULL
      AND voided_at IS NULL
    FOR UPDATE;

    IF _locked_credit_count <> array_length(_credit_ids, 1) THEN
      RAISE EXCEPTION 'One or more credits have already been redeemed, expired, voided, or do not exist';
    END IF;
  END IF;

  _total_minor := GREATEST(0, _subtotal + _tax_minor - _credit_offset);

  INSERT INTO invoices (
    org_id, invoice_number, due_date,
    payer_guardian_id, payer_student_id, notes,
    vat_rate, subtotal_minor, tax_minor,
    credit_applied_minor, total_minor, currency_code
  ) VALUES (
    _org_id, '', _due_date,
    _payer_guardian_id, _payer_student_id, _notes,
    CASE WHEN _org.vat_enabled THEN _org.vat_rate ELSE 0 END,
    _subtotal, _tax_minor,
    _credit_offset, _total_minor, _org.currency_code
  ) RETURNING * INTO _invoice;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    INSERT INTO invoice_items (
      invoice_id, org_id, description, quantity,
      unit_price_minor, amount_minor,
      linked_lesson_id, student_id
    ) VALUES (
      _invoice.id, _org_id,
      _item->>'description',
      (_item->>'quantity')::integer,
      (_item->>'unit_price_minor')::integer,
      (_item->>'quantity')::integer * (_item->>'unit_price_minor')::integer,
      NULLIF(_item->>'linked_lesson_id', '')::uuid,
      NULLIF(_item->>'student_id', '')::uuid
    );
  END LOOP;

  IF array_length(_credit_ids, 1) > 0 THEN
    -- CRD-H3 FIX: added AND voided_at IS NULL
    UPDATE make_up_credits
    SET redeemed_at = NOW(),
        applied_to_invoice_id = _invoice.id,
        notes = 'Applied to invoice ' || _invoice.invoice_number
    WHERE id = ANY(_credit_ids)
      AND org_id = _org_id
      AND redeemed_at IS NULL
      AND expired_at IS NULL
      AND voided_at IS NULL;
  END IF;

  RETURN json_build_object(
    'id', _invoice.id,
    'invoice_number', _invoice.invoice_number,
    'total_minor', _total_minor,
    'subtotal_minor', _subtotal,
    'tax_minor', _tax_minor,
    'credit_applied_minor', _credit_offset,
    'status', _invoice.status
  );
END;
$function$;

-- ────────────────────────────────────────────────────────────
-- CRD-L2 LOW: Add audit log entry for auto-issued credits
-- Update auto_issue_credit_on_absence to log 'credit_issued' after INSERT
-- ────────────────────────────────────────────────────────────
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

  -- 2. Fall back to student's default rate card (major -> minor units)
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

  -- CRD-L2 FIX: Audit log entry for auto-issued credit
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

-- ────────────────────────────────────────────────────────────
-- SWEEP FIX: auto_add_to_waitlist credit-linking ignores voided_at
-- When linking a credit to a new waitlist entry, exclude voided credits.
-- ────────────────────────────────────────────────────────────
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

  -- Link any matching credit — exclude voided and expired credits
  SELECT id INTO _credit_id FROM make_up_credits
    WHERE student_id = NEW.student_id
      AND issued_for_lesson_id = NEW.lesson_id
      AND redeemed_at IS NULL
      AND expired_at IS NULL
      AND voided_at IS NULL
    ORDER BY created_at DESC LIMIT 1;

  IF _credit_id IS NOT NULL THEN
    UPDATE make_up_waitlist SET credit_id = _credit_id WHERE id = _waitlist_id;
  END IF;

  RETURN NEW;
END;
$function$;
