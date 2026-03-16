-- Fix SD-01: anonymise_student missing auth check
-- Fix SD-02: anonymise_guardian missing auth check
-- Fix SD-03: get_user_id_by_email enables user enumeration

-- SD-01: Recreate anonymise_student with admin/owner auth check
CREATE OR REPLACE FUNCTION public.anonymise_student(student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get the student's org_id
  SELECT org_id INTO v_org_id
  FROM public.students
  WHERE id = student_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  -- Verify caller is an admin or owner of the student's org
  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE user_id = auth.uid()
      AND org_id = v_org_id
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.students
  SET
    first_name = 'Deleted',
    last_name = 'User',
    email = NULL,
    phone = NULL,
    dob = NULL,
    notes = NULL,
    deleted_at = now(),
    status = 'inactive'
  WHERE id = student_id;
END;
$$;

-- SD-02: Recreate anonymise_guardian with admin/owner auth check
CREATE OR REPLACE FUNCTION public.anonymise_guardian(guardian_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get the guardian's org_id
  SELECT org_id INTO v_org_id
  FROM public.guardians
  WHERE id = guardian_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Guardian not found';
  END IF;

  -- Verify caller is an admin or owner of the guardian's org
  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE user_id = auth.uid()
      AND org_id = v_org_id
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.guardians
  SET
    full_name = 'Deleted User',
    email = NULL,
    phone = NULL,
    deleted_at = now()
  WHERE id = guardian_id;
END;
$$;

-- SD-03: Revoke EXECUTE on get_user_id_by_email from authenticated role
-- This function is only used as an internal helper by other SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM public;
