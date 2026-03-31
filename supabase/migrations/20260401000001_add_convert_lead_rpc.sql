-- PIP-H1: Atomic lead conversion RPC
-- Replaces sequential frontend calls with a single atomic transaction.

CREATE OR REPLACE FUNCTION public.convert_lead(
  _lead_id UUID,
  _org_id UUID,
  _students JSONB  -- array of {lead_student_id, first_name, last_name, teacher_id?}
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  _lead RECORD;
  _guardian_id UUID;
  _new_student_id UUID;
  _converted_count INTEGER := 0;
  _student_input JSONB;
BEGIN
  -- Auth check
  IF NOT is_org_admin(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  -- Lock and fetch lead
  SELECT * INTO _lead FROM leads
    WHERE id = _lead_id AND org_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
  IF _lead.stage = 'enrolled' THEN RAISE EXCEPTION 'Lead already enrolled'; END IF;

  -- Find or create guardian
  IF _lead.contact_email IS NOT NULL THEN
    SELECT id INTO _guardian_id FROM guardians
      WHERE org_id = _org_id AND email = _lead.contact_email LIMIT 1;
  END IF;

  IF _guardian_id IS NULL THEN
    INSERT INTO guardians (org_id, full_name, email, phone)
    VALUES (_org_id, _lead.contact_name, _lead.contact_email, _lead.contact_phone)
    RETURNING id INTO _guardian_id;
  END IF;

  -- Create students
  FOR _student_input IN SELECT * FROM jsonb_array_elements(_students)
  LOOP
    INSERT INTO students (org_id, first_name, last_name, default_teacher_id, status)
    VALUES (
      _org_id,
      _student_input->>'first_name',
      _student_input->>'last_name',
      NULLIF(_student_input->>'teacher_id', '')::UUID,
      'active'
    )
    RETURNING id INTO _new_student_id;

    INSERT INTO student_guardians (org_id, student_id, guardian_id, relationship, is_primary_payer)
    VALUES (_org_id, _new_student_id, _guardian_id, 'guardian', true);

    UPDATE lead_students SET converted_student_id = _new_student_id
    WHERE id = (_student_input->>'lead_student_id')::UUID AND org_id = _org_id;

    _converted_count := _converted_count + 1;
  END LOOP;

  -- Mark lead enrolled
  UPDATE leads SET stage = 'enrolled', converted_at = NOW()
  WHERE id = _lead_id;

  -- Activity log
  INSERT INTO lead_activities (lead_id, org_id, activity_type, description, created_by)
  VALUES (_lead_id, _org_id, 'converted',
    format('Lead converted: %s student(s) enrolled', _converted_count),
    auth.uid());

  RETURN json_build_object(
    'lead_id', _lead_id,
    'guardian_id', _guardian_id,
    'students_created', _converted_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION convert_lead TO authenticated;
