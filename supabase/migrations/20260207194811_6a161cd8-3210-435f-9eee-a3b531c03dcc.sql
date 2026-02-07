
-- =====================================================
-- SECURITY FIX: Remove parent access to teacher pay data
-- =====================================================
-- The "Parent can view teachers in org" policy allows parents to see
-- pay_rate_type, pay_rate_value, and payroll_notes on the teachers table.
-- Parents do NOT query the teachers table directly (confirmed via frontend audit).
-- Drop this policy entirely; parents use lesson joins for teacher names.

DROP POLICY IF EXISTS "Parent can view teachers in org" ON public.teachers;

-- =====================================================
-- Recreate teacher_profiles_public as SECURITY DEFINER view
-- so parents can query non-sensitive teacher info without
-- needing a SELECT policy on the base teachers table.
-- =====================================================
DROP VIEW IF EXISTS public.teacher_profiles_public;

CREATE VIEW public.teacher_profiles_public
WITH (security_barrier = true)
AS
SELECT
  t.id,
  t.org_id,
  t.user_id,
  t.display_name,
  t.employment_type,
  t.instruments,
  t.bio,
  t.status,
  t.created_at,
  t.updated_at
FROM public.teachers t
WHERE t.org_id IN (
  SELECT om.org_id FROM public.org_memberships om
  WHERE om.user_id = auth.uid()
  AND om.status = 'active'
);

-- Grant SELECT to authenticated users (RLS on base table still applies for staff,
-- but the view's WHERE clause restricts to org members only)
GRANT SELECT ON public.teacher_profiles_public TO authenticated;

-- =====================================================
-- Also restrict the teachers_with_pay view to admin/finance only
-- by ensuring it uses security_invoker (relies on base table RLS)
-- =====================================================
-- The teachers_with_pay view already uses security_invoker = on,
-- which means it relies on the base teachers table RLS.
-- Since we dropped the parent policy, parents can no longer
-- query teachers_with_pay either. This is correct behavior.
