-- =============================================================================
-- Fix ALL waitlist audit findings (WL-C1, WL-L5, WL-L6, WL-H1, WL-H3, WL-H4,
-- WL-H5, WL-H6, WL-M4, WL-M5, WL-M6, WL-M7, WL-L2, WL-L4)
-- Audit: audit-feature-18-waitlist.md
-- =============================================================================

-- =============================================================================
-- WL-C1 CRITICAL: confirm_makeup_booking() uses invalid status 'unmatched'
-- WL-L6 CRITICAL (escalated): No auth check on confirm_makeup_booking()
-- Fix: Change 'unmatched' to 'waiting' (valid CHECK value) + add auth check
-- =============================================================================

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
  -- WL-L6 FIX: Auth check — only org staff can confirm bookings
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Access denied: not authorised to confirm bookings for this organisation';
  END IF;

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

  -- 9. WL-C1 FIX: Dismiss other matched entries — use 'waiting' (valid CHECK value)
  --    instead of 'unmatched' which is not in the CHECK constraint.
  --    Reset to 'waiting' so they can be re-matched to another slot.
  WITH dismissed AS (
    UPDATE make_up_waitlist
    SET status = 'waiting',
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


-- =============================================================================
-- WL-L5 CRITICAL (escalated): convert_waitlist_to_student() has no auth check
-- Fix: Add is_org_admin check at start
-- =============================================================================

CREATE OR REPLACE FUNCTION public.convert_waitlist_to_student(
  p_entry_id UUID,
  p_org_id UUID,
  p_teacher_id UUID DEFAULT NULL
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_entry RECORD;
  v_student_id UUID;
  v_guardian_id UUID;
BEGIN
  -- WL-L5 FIX: Auth check — only org admins can convert waitlist entries
  IF NOT is_org_admin(auth.uid(), p_org_id) THEN
    RAISE EXCEPTION 'Access denied: not authorised to convert waitlist entries for this organisation';
  END IF;

  -- 1. Get and validate the waitlist entry
  SELECT * INTO v_entry FROM enrolment_waitlist
  WHERE id = p_entry_id AND org_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found';
  END IF;

  IF v_entry.status NOT IN ('waiting', 'offered', 'accepted') THEN
    RAISE EXCEPTION 'Waitlist entry is not in a convertible status (current: %)', v_entry.status;
  END IF;

  -- 2. Create or reuse guardian
  v_guardian_id := v_entry.guardian_id;
  IF v_guardian_id IS NULL THEN
    INSERT INTO guardians (org_id, full_name, email, phone)
    VALUES (p_org_id, v_entry.contact_name, v_entry.contact_email, v_entry.contact_phone)
    RETURNING id INTO v_guardian_id;
  END IF;

  -- 3. Create student
  INSERT INTO students (org_id, first_name, last_name, default_teacher_id, status)
  VALUES (
    p_org_id,
    v_entry.child_first_name,
    COALESCE(v_entry.child_last_name, ''),
    COALESCE(p_teacher_id, v_entry.offered_teacher_id, v_entry.preferred_teacher_id),
    'active'
  )
  RETURNING id INTO v_student_id;

  -- 4. Link student to guardian
  INSERT INTO student_guardians (org_id, student_id, guardian_id, relationship, is_primary_payer)
  VALUES (p_org_id, v_student_id, v_guardian_id, 'parent', true);

  -- 5. Mark waitlist entry as enrolled
  UPDATE enrolment_waitlist
  SET status = 'enrolled',
      converted_student_id = v_student_id,
      converted_at = NOW(),
      guardian_id = v_guardian_id
  WHERE id = p_entry_id;

  -- 6. Log activity
  INSERT INTO enrolment_waitlist_activity (org_id, waitlist_id, activity_type, description, metadata, created_by)
  VALUES (
    p_org_id,
    p_entry_id,
    'enrolled',
    'Converted to student: ' || v_entry.child_first_name || ' ' || COALESCE(v_entry.child_last_name, ''),
    jsonb_build_object('student_id', v_student_id, 'guardian_id', v_guardian_id),
    auth.uid()
  );

  RETURN json_build_object(
    'student_id', v_student_id,
    'guardian_id', v_guardian_id,
    'waitlist_id', p_entry_id
  );
END;
$$;


-- =============================================================================
-- WL-H1 HIGH: on_slot_released() hardcodes absence reasons
-- Fix: Consult make_up_policies.releases_slot instead of hardcoded list
-- =============================================================================

CREATE OR REPLACE FUNCTION public.on_slot_released()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _match RECORD;
  _releases BOOLEAN;
BEGIN
  IF NEW.attendance_status NOT IN ('absent', 'cancelled_by_student') THEN
    RETURN NEW;
  END IF;

  IF NEW.absence_reason_category IS NULL THEN
    RETURN NEW;
  END IF;

  -- WL-H1 FIX: Consult make_up_policies for releases_slot instead of hardcoding
  SELECT releases_slot INTO _releases
    FROM make_up_policies
    WHERE org_id = NEW.org_id AND absence_reason = NEW.absence_reason_category;

  IF NOT COALESCE(_releases, false) THEN
    RETURN NEW;
  END IF;

  FOR _match IN
    SELECT waitlist_id FROM find_waitlist_matches(NEW.lesson_id, NEW.student_id, NEW.org_id) LIMIT 3
  LOOP
    UPDATE make_up_waitlist SET
      status = 'matched', matched_lesson_id = NEW.lesson_id, matched_at = NOW()
    WHERE id = _match.waitlist_id;
  END LOOP;

  RETURN NEW;
END;
$$;


-- =============================================================================
-- WL-H3 HIGH: Create offer_makeup_slot() RPC for atomic offer transition
-- Prevents offering an already-offered/booked entry via race condition
-- =============================================================================

CREATE OR REPLACE FUNCTION public.offer_makeup_slot(_waitlist_id uuid, _org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _entry RECORD;
BEGIN
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Access denied: not authorised to offer slots for this organisation';
  END IF;

  -- Lock the waitlist entry and validate
  SELECT * INTO _entry
  FROM make_up_waitlist
  WHERE id = _waitlist_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found';
  END IF;

  IF _entry.status != 'matched' THEN
    RAISE EXCEPTION 'Waitlist entry is not in matched status (current: %)', _entry.status;
  END IF;

  -- Atomically update to offered
  UPDATE make_up_waitlist
  SET status = 'offered',
      offered_at = NOW(),
      updated_at = NOW()
  WHERE id = _waitlist_id;

  RETURN json_build_object('status', 'offered', 'id', _waitlist_id);
END;
$function$;


-- =============================================================================
-- WL-H4 HIGH: Create dismiss_makeup_match() RPC for atomic dismiss
-- Prevents dismissing an already-booked/offered entry
-- =============================================================================

CREATE OR REPLACE FUNCTION public.dismiss_makeup_match(_waitlist_id uuid, _org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _entry RECORD;
BEGIN
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Access denied: not authorised to dismiss matches for this organisation';
  END IF;

  -- Lock the waitlist entry and validate
  SELECT * INTO _entry
  FROM make_up_waitlist
  WHERE id = _waitlist_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found';
  END IF;

  IF _entry.status != 'matched' THEN
    RAISE EXCEPTION 'Waitlist entry is not in matched status (current: %)', _entry.status;
  END IF;

  -- Reset to waiting
  UPDATE make_up_waitlist
  SET status = 'waiting',
      matched_lesson_id = NULL,
      matched_at = NULL,
      updated_at = NOW()
  WHERE id = _waitlist_id;

  RETURN json_build_object('status', 'waiting', 'id', _waitlist_id);
END;
$function$;


-- =============================================================================
-- WL-H5 HIGH: Create respond_to_enrolment_offer() RPC for atomic response
-- Prevents race condition on concurrent accepts/declines
-- =============================================================================

CREATE OR REPLACE FUNCTION public.respond_to_enrolment_offer(
  _entry_id UUID,
  _org_id UUID,
  _action TEXT  -- 'accept' or 'decline'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _entry RECORD;
BEGIN
  IF _action NOT IN ('accept', 'decline') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be accept or decline.', _action;
  END IF;

  -- Lock the entry and validate
  SELECT * INTO _entry
  FROM enrolment_waitlist
  WHERE id = _entry_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found';
  END IF;

  IF _entry.status != 'offered' THEN
    RAISE EXCEPTION 'This offer is no longer available (current status: %)', _entry.status;
  END IF;

  -- Check if offer has expired
  IF _entry.offer_expires_at IS NOT NULL AND _entry.offer_expires_at < NOW() THEN
    -- Auto-expire the entry
    UPDATE enrolment_waitlist
    SET status = 'expired', updated_at = NOW()
    WHERE id = _entry_id;

    RAISE EXCEPTION 'This offer has expired';
  END IF;

  IF _action = 'accept' THEN
    UPDATE enrolment_waitlist
    SET status = 'accepted',
        responded_at = NOW(),
        updated_at = NOW()
    WHERE id = _entry_id;

    -- Log activity
    INSERT INTO enrolment_waitlist_activity (org_id, waitlist_id, activity_type, description, created_by)
    VALUES (_org_id, _entry_id, 'accepted', 'Offer accepted', auth.uid());

    RETURN json_build_object('status', 'accepted', 'id', _entry_id);
  ELSE
    UPDATE enrolment_waitlist
    SET status = 'declined',
        responded_at = NOW(),
        updated_at = NOW()
    WHERE id = _entry_id;

    -- Log activity
    INSERT INTO enrolment_waitlist_activity (org_id, waitlist_id, activity_type, description, created_by)
    VALUES (_org_id, _entry_id, 'declined', 'Offer declined', auth.uid());

    RETURN json_build_object('status', 'declined', 'id', _entry_id);
  END IF;
END;
$function$;


-- =============================================================================
-- WL-H6 HIGH: Create withdraw_from_enrolment_waitlist() RPC for atomic withdraw
-- Locks rows and recalculates positions in one transaction
-- =============================================================================

CREATE OR REPLACE FUNCTION public.withdraw_from_enrolment_waitlist(
  _entry_id UUID,
  _org_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _entry RECORD;
  _remaining RECORD;
BEGIN
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Access denied: not authorised to modify the waitlist for this organisation';
  END IF;

  -- Lock and fetch the entry
  SELECT * INTO _entry
  FROM enrolment_waitlist
  WHERE id = _entry_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found';
  END IF;

  IF _entry.status NOT IN ('waiting', 'offered') THEN
    RAISE EXCEPTION 'Entry cannot be withdrawn (current status: %)', _entry.status;
  END IF;

  -- Withdraw the entry
  UPDATE enrolment_waitlist
  SET status = 'withdrawn', updated_at = NOW()
  WHERE id = _entry_id;

  -- Reposition remaining waiting entries for the same instrument (locked)
  FOR _remaining IN
    SELECT id, position FROM enrolment_waitlist
    WHERE org_id = _org_id
      AND instrument_name = _entry.instrument_name
      AND status = 'waiting'
      AND position > _entry.position
    ORDER BY position ASC
    FOR UPDATE
  LOOP
    UPDATE enrolment_waitlist
    SET position = _remaining.position - 1
    WHERE id = _remaining.id;
  END LOOP;

  -- Log activity
  INSERT INTO enrolment_waitlist_activity (org_id, waitlist_id, activity_type, description, created_by)
  VALUES (_org_id, _entry_id, 'withdrawn', 'Withdrawn from waiting list', auth.uid());

  RETURN json_build_object('status', 'withdrawn', 'id', _entry_id);
END;
$function$;


-- =============================================================================
-- WL-M4 MEDIUM: Create add_to_enrolment_waitlist() RPC for atomic position calc
-- Prevents duplicate positions from concurrent adds
-- =============================================================================

CREATE OR REPLACE FUNCTION public.add_to_enrolment_waitlist(
  _org_id UUID,
  _contact_name TEXT,
  _child_first_name TEXT,
  _instrument_name TEXT,
  _contact_email TEXT DEFAULT NULL,
  _contact_phone TEXT DEFAULT NULL,
  _child_last_name TEXT DEFAULT NULL,
  _child_age INTEGER DEFAULT NULL,
  _instrument_id UUID DEFAULT NULL,
  _preferred_teacher_id UUID DEFAULT NULL,
  _preferred_location_id UUID DEFAULT NULL,
  _preferred_days TEXT[] DEFAULT NULL,
  _preferred_time_earliest TIME DEFAULT NULL,
  _preferred_time_latest TIME DEFAULT NULL,
  _experience_level TEXT DEFAULT NULL,
  _lesson_duration_mins INTEGER DEFAULT 30,
  _notes TEXT DEFAULT NULL,
  _priority TEXT DEFAULT 'normal',
  _source TEXT DEFAULT 'manual',
  _lead_id UUID DEFAULT NULL,
  _guardian_id UUID DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _next_position INTEGER;
  _entry_id UUID;
BEGIN
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Access denied: not authorised to add to waitlist for this organisation';
  END IF;

  -- WL-M4 FIX: Calculate position atomically with a locked read
  SELECT COALESCE(MAX(position), 0) + 1 INTO _next_position
  FROM enrolment_waitlist
  WHERE org_id = _org_id
    AND instrument_name = _instrument_name
    AND status = 'waiting'
  FOR UPDATE;

  INSERT INTO enrolment_waitlist (
    org_id, lead_id, contact_name, contact_email, contact_phone,
    guardian_id, child_first_name, child_last_name, child_age,
    instrument_id, instrument_name, preferred_teacher_id, preferred_location_id,
    preferred_days, preferred_time_earliest, preferred_time_latest,
    experience_level, lesson_duration_mins, position, status,
    notes, priority, source, created_by
  ) VALUES (
    _org_id, _lead_id, _contact_name, _contact_email, _contact_phone,
    _guardian_id, _child_first_name, _child_last_name, _child_age,
    _instrument_id, _instrument_name, _preferred_teacher_id, _preferred_location_id,
    _preferred_days, _preferred_time_earliest, _preferred_time_latest,
    _experience_level, _lesson_duration_mins, _next_position, 'waiting',
    _notes, _priority, _source, auth.uid()
  )
  RETURNING id INTO _entry_id;

  -- Log activity
  INSERT INTO enrolment_waitlist_activity (org_id, waitlist_id, activity_type, description, metadata, created_by)
  VALUES (
    _org_id,
    _entry_id,
    'created',
    _child_first_name || ' added to waiting list for ' || _instrument_name,
    jsonb_build_object('source', _source, 'position', _next_position),
    auth.uid()
  );

  RETURN json_build_object(
    'id', _entry_id,
    'position', _next_position,
    'status', 'waiting'
  );
END;
$function$;


-- =============================================================================
-- WL-M5 MEDIUM: Add offer_expires_at column to make_up_waitlist
-- Allows per-entry expiry instead of hardcoded 48h
-- =============================================================================

ALTER TABLE public.make_up_waitlist
  ADD COLUMN IF NOT EXISTS offer_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.make_up_waitlist.offer_expires_at IS
  'Deadline for parent to respond to this offer. Set when status transitions to offered. Used by waitlist-expiry cron.';

-- Index for efficient expiry queries
CREATE INDEX IF NOT EXISTS idx_waitlist_offer_expires
  ON public.make_up_waitlist(offer_expires_at)
  WHERE status = 'offered' AND offer_expires_at IS NOT NULL;

-- Update offer_makeup_slot to set offer_expires_at from org settings
CREATE OR REPLACE FUNCTION public.offer_makeup_slot(_waitlist_id uuid, _org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _entry RECORD;
  _expiry_hours INTEGER;
BEGIN
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Access denied: not authorised to offer slots for this organisation';
  END IF;

  -- Get org-specific expiry hours
  SELECT COALESCE(enrolment_offer_expiry_hours, 48)
    INTO _expiry_hours
    FROM organisations WHERE id = _org_id;

  -- Lock the waitlist entry and validate
  SELECT * INTO _entry
  FROM make_up_waitlist
  WHERE id = _waitlist_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found';
  END IF;

  IF _entry.status != 'matched' THEN
    RAISE EXCEPTION 'Waitlist entry is not in matched status (current: %)', _entry.status;
  END IF;

  -- Atomically update to offered with per-entry expiry
  UPDATE make_up_waitlist
  SET status = 'offered',
      offered_at = NOW(),
      offer_expires_at = NOW() + (_expiry_hours || ' hours')::INTERVAL,
      updated_at = NOW()
  WHERE id = _waitlist_id;

  RETURN json_build_object('status', 'offered', 'id', _waitlist_id,
    'offer_expires_at', (NOW() + (_expiry_hours || ' hours')::INTERVAL)::TEXT);
END;
$function$;


-- =============================================================================
-- WL-M6 MEDIUM: enrolment_waitlist.offered_teacher_id FK ON DELETE SET NULL
-- =============================================================================

ALTER TABLE public.enrolment_waitlist
  DROP CONSTRAINT IF EXISTS enrolment_waitlist_offered_teacher_id_fkey;

ALTER TABLE public.enrolment_waitlist
  ADD CONSTRAINT enrolment_waitlist_offered_teacher_id_fkey
  FOREIGN KEY (offered_teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;


-- =============================================================================
-- WL-M7 MEDIUM: make_up_waitlist FK ON DELETE cascades
-- teacher_id, matched_lesson_id, booked_lesson_id all default to RESTRICT
-- =============================================================================

-- teacher_id → ON DELETE SET NULL
ALTER TABLE public.make_up_waitlist
  DROP CONSTRAINT IF EXISTS make_up_waitlist_teacher_id_fkey;

ALTER TABLE public.make_up_waitlist
  ADD CONSTRAINT make_up_waitlist_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;

-- matched_lesson_id → ON DELETE SET NULL
ALTER TABLE public.make_up_waitlist
  DROP CONSTRAINT IF EXISTS make_up_waitlist_matched_lesson_id_fkey;

ALTER TABLE public.make_up_waitlist
  ADD CONSTRAINT make_up_waitlist_matched_lesson_id_fkey
  FOREIGN KEY (matched_lesson_id) REFERENCES public.lessons(id) ON DELETE SET NULL;

-- booked_lesson_id → ON DELETE SET NULL
ALTER TABLE public.make_up_waitlist
  DROP CONSTRAINT IF EXISTS make_up_waitlist_booked_lesson_id_fkey;

ALTER TABLE public.make_up_waitlist
  ADD CONSTRAINT make_up_waitlist_booked_lesson_id_fkey
  FOREIGN KEY (booked_lesson_id) REFERENCES public.lessons(id) ON DELETE SET NULL;


-- =============================================================================
-- WL-L2 LOW: Add CHECK constraint on enrolment_waitlist_activity.activity_type
-- =============================================================================

ALTER TABLE public.enrolment_waitlist_activity
  ADD CONSTRAINT chk_ewl_activity_type
  CHECK (activity_type IN (
    'created', 'position_changed', 'offered', 'offer_sent', 'offer_expired',
    'accepted', 'declined', 'enrolled', 'withdrawn', 'note_added',
    'priority_changed', 'lost'
  ));


-- =============================================================================
-- WL-L4 LOW: Add FK on enrolment_waitlist.created_by
-- =============================================================================

ALTER TABLE public.enrolment_waitlist
  DROP CONSTRAINT IF EXISTS enrolment_waitlist_created_by_fkey;

ALTER TABLE public.enrolment_waitlist
  ADD CONSTRAINT enrolment_waitlist_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
