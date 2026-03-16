-- =============================================================================
-- PAY-02: Allow teachers to view their own pay data via get_teachers_with_pay
-- Previously the RPC denied all teacher-role users. Now teachers can see
-- their own record only (matched via user_id -> teachers.user_id).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_teachers_with_pay(
  p_org_id UUID,
  p_teacher_ids UUID[]
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  pay_rate_type TEXT,
  pay_rate_value NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role TEXT;
  _teacher_id UUID;
BEGIN
  -- Look up the caller's role in this org
  SELECT om.role INTO _role
  FROM public.org_memberships om
  WHERE om.user_id = auth.uid()
    AND om.org_id = p_org_id
    AND om.status = 'active'
  LIMIT 1;

  -- Owner, admin, finance: full access to all requested teachers
  IF _role IN ('owner', 'admin', 'finance') THEN
    RETURN QUERY
    SELECT t.id, t.display_name, t.pay_rate_type::TEXT, t.pay_rate_value
    FROM public.teachers t
    WHERE t.org_id = p_org_id
      AND t.id = ANY(p_teacher_ids);
    RETURN;
  END IF;

  -- Teacher role: only return their own record
  IF _role = 'teacher' THEN
    SELECT t.id INTO _teacher_id
    FROM public.teachers t
    WHERE t.org_id = p_org_id
      AND t.user_id = auth.uid();

    IF _teacher_id IS NOT NULL AND _teacher_id = ANY(p_teacher_ids) THEN
      RETURN QUERY
      SELECT t.id, t.display_name, t.pay_rate_type::TEXT, t.pay_rate_value
      FROM public.teachers t
      WHERE t.id = _teacher_id;
    END IF;
    RETURN;
  END IF;

  -- All other roles: denied
  RAISE EXCEPTION 'Access denied: insufficient role for payroll data';
END;
$$;
