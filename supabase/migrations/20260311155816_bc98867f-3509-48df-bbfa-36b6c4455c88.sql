
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
BEGIN
  -- For teachers, only return assigned students
  IF _role = 'teacher' AND _user_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      s.id, s.first_name, s.last_name, s.email, s.phone, s.dob,
      s.notes, s.status::text, s.created_at,
      COALESCE((SELECT COUNT(*) FROM student_guardians sg WHERE sg.student_id = s.id), 0) AS guardian_count
    FROM students s
    INNER JOIN student_teacher_assignments sta ON sta.student_id = s.id AND sta.org_id = _org_id
    INNER JOIN teachers t ON t.id = sta.teacher_id AND t.user_id = _user_id AND t.org_id = _org_id
    WHERE s.org_id = _org_id
      AND s.deleted_at IS NULL
    ORDER BY s.last_name, s.first_name, s.id;
  ELSE
    -- For owner/admin/finance, return all students
    RETURN QUERY
    SELECT
      s.id, s.first_name, s.last_name, s.email, s.phone, s.dob,
      s.notes, s.status::text, s.created_at,
      COALESCE((SELECT COUNT(*) FROM student_guardians sg WHERE sg.student_id = s.id), 0) AS guardian_count
    FROM students s
    WHERE s.org_id = _org_id
      AND s.deleted_at IS NULL
    ORDER BY s.last_name, s.first_name, s.id;
  END IF;
END;
$$;
