-- FIX 7: Make enrolment waitlist → student conversion atomic
-- Previously 5 sequential database calls from the frontend without a transaction.
-- Partial failure would leave orphaned guardians/students.

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
