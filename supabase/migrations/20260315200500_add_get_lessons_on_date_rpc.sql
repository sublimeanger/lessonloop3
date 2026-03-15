-- FIX 3.3: RPC to check which lessons exist on a given date
-- Used by frontend when adding closure dates after lessons already exist
CREATE OR REPLACE FUNCTION get_lessons_on_date(
  p_org_id UUID, p_date DATE
) RETURNS TABLE (id UUID, start_at TIMESTAMPTZ, student_name TEXT)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT l.id, l.start_at,
    COALESCE(s.first_name || ' ' || s.last_name, 'Open slot')
  FROM lessons l
  LEFT JOIN lesson_participants lp ON lp.lesson_id = l.id
  LEFT JOIN students s ON s.id = lp.student_id
  WHERE l.org_id = p_org_id
  AND l.start_at::date = p_date
  AND l.status NOT IN ('cancelled')
$$;
