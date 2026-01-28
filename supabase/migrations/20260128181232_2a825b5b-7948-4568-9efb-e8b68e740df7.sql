-- Fix teacher_profiles: restrict pay rate visibility to admins and the teacher themselves
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view teacher profiles in their org" ON public.teacher_profiles;

-- Create two new policies:
-- 1. Admins can view all teacher profiles (including pay rates)
CREATE POLICY "Admins can view all teacher profiles"
ON public.teacher_profiles
FOR SELECT
USING (is_org_admin(auth.uid(), org_id));

-- 2. Teachers can view their own profile (including their own pay rates)
CREATE POLICY "Teachers can view their own profile"
ON public.teacher_profiles
FOR SELECT
USING (auth.uid() = user_id);

-- 3. Staff can view non-sensitive teacher info (we need a view for this)
-- For now, other staff can see basic info but NOT pay rates
-- We'll create a secure view for this

-- Create a view that excludes sensitive pay information for general staff viewing
CREATE OR REPLACE VIEW public.teacher_profiles_public
WITH (security_invoker = on) AS
SELECT 
  id,
  org_id,
  user_id,
  instruments,
  bio,
  employment_type,
  created_at,
  updated_at
  -- Excludes: pay_rate_type, pay_rate_value, payroll_notes
FROM public.teacher_profiles;

-- Grant access to the view
GRANT SELECT ON public.teacher_profiles_public TO authenticated;

-- Add comment explaining the view purpose
COMMENT ON VIEW public.teacher_profiles_public IS 'Public view of teacher profiles excluding sensitive pay information. Use this view for non-admin staff to see teacher info.';