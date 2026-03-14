-- Secure access to teacher pay data via RPC with explicit role check.
-- The teachers_with_pay view already has security_invoker=on and CASE
-- column masking, but this RPC adds an explicit deny for unauthorized
-- roles and includes 'finance' which is_org_admin() does not cover.

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
BEGIN
  -- Only owner, admin, or finance may view pay data
  IF NOT EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND role IN ('owner', 'admin', 'finance')
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied: insufficient role for payroll data';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.display_name,
    t.pay_rate_type::TEXT,
    t.pay_rate_value
  FROM public.teachers t
  WHERE t.org_id = p_org_id
    AND t.id = ANY(p_teacher_ids);
END;
$$;

-- Grant execute to authenticated users (the function body enforces role check)
GRANT EXECUTE ON FUNCTION public.get_teachers_with_pay(UUID, UUID[]) TO authenticated;
