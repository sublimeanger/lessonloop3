-- Fix 5: Add org membership check to get_lessons_on_date RPC
-- The function is SECURITY DEFINER but lacked auth.uid() verification,
-- allowing any authenticated user to query any org's lesson data.
CREATE OR REPLACE FUNCTION get_lessons_on_date(
  p_org_id UUID, p_date DATE
) RETURNS TABLE (id UUID, start_at TIMESTAMPTZ, student_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  -- Verify caller belongs to the org
  IF NOT EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organisation';
  END IF;

  RETURN QUERY
  SELECT l.id, l.start_at,
    COALESCE(s.first_name || ' ' || s.last_name, 'Open slot')
  FROM lessons l
  LEFT JOIN lesson_participants lp ON lp.lesson_id = l.id
  LEFT JOIN students s ON s.id = lp.student_id
  WHERE l.org_id = p_org_id
  AND l.start_at::date = p_date
  AND l.status NOT IN ('cancelled');
END;
$$;
