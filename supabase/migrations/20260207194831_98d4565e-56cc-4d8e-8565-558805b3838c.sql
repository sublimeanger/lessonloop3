
-- Fix linter warning: replace SECURITY DEFINER view with SECURITY INVOKER
-- Parents don't query teacher_profiles_public directly, so security_invoker is fine.
-- Staff/admin will use it via their existing teachers table RLS policies.

DROP VIEW IF EXISTS public.teacher_profiles_public;

CREATE VIEW public.teacher_profiles_public
WITH (security_invoker = on, security_barrier = true)
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
FROM public.teachers t;

GRANT SELECT ON public.teacher_profiles_public TO authenticated;
