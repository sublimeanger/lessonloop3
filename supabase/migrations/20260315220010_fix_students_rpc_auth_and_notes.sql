-- STU-06 FIX: Add caller auth check to get_students_for_org()
-- The function is SECURITY DEFINER so RLS is bypassed.
-- Without an explicit membership check any authenticated user could
-- call it with any org_id and retrieve that org's student list.
--
-- STU-01 FIX: Hide student notes from parent role
-- The notes field may contain sensitive medical/learning information
-- that should only be visible to staff roles (owner, admin, teacher, finance).
-- Parents now receive NULL for notes.

CREATE OR REPLACE FUNCTION public.get_students_for_org(
  _org_id uuid,
  _role text DEFAULT NULL,
  _user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  dob date,
  notes text,
  status text,
  created_at timestamptz,
  guardian_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _caller_id uuid;
BEGIN
  -- STU-06: Verify the caller is an active member of the requested org
  _caller_id := auth.uid();

  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_org_member(_caller_id, _org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organisation';
  END IF;

  -- For teachers, only return assigned students
  IF _role = 'teacher' AND _user_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      s.id, s.first_name, s.last_name, s.email, s.phone, s.dob,
      -- STU-01: Hide notes from parent role
      CASE WHEN _role = 'parent' THEN NULL ELSE s.notes END,
      s.status::text, s.created_at,
      COALESCE((SELECT COUNT(*) FROM student_guardians sg WHERE sg.student_id = s.id), 0) AS guardian_count
    FROM students s
    INNER JOIN student_teacher_assignments sta ON sta.student_id = s.id AND sta.org_id = _org_id
    INNER JOIN teachers t ON t.id = sta.teacher_id AND t.user_id = _user_id AND t.org_id = _org_id
    WHERE s.org_id = _org_id
      AND s.deleted_at IS NULL
    ORDER BY s.last_name, s.first_name, s.id;
  ELSE
    -- For owner/admin/finance/parent, return all (or linked) students
    RETURN QUERY
    SELECT
      s.id, s.first_name, s.last_name, s.email, s.phone, s.dob,
      -- STU-01: Hide notes from parent role
      CASE WHEN _role = 'parent' THEN NULL ELSE s.notes END,
      s.status::text, s.created_at,
      COALESCE((SELECT COUNT(*) FROM student_guardians sg WHERE sg.student_id = s.id), 0) AS guardian_count
    FROM students s
    WHERE s.org_id = _org_id
      AND s.deleted_at IS NULL
    ORDER BY s.last_name, s.first_name, s.id;
  END IF;
END;
$$;
