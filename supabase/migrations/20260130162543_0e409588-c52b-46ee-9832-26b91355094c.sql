-- Drop the security definer view and recreate with security invoker
DROP VIEW IF EXISTS public.teachers_with_pay;

CREATE VIEW public.teachers_with_pay 
WITH (security_invoker = on)
AS
SELECT 
  t.id,
  t.org_id,
  t.user_id,
  t.display_name,
  t.email,
  t.phone,
  t.instruments,
  t.employment_type,
  CASE 
    WHEN is_org_admin(auth.uid(), t.org_id) OR t.user_id = auth.uid()
    THEN t.pay_rate_type
    ELSE NULL
  END as pay_rate_type,
  CASE 
    WHEN is_org_admin(auth.uid(), t.org_id) OR t.user_id = auth.uid()
    THEN t.pay_rate_value
    ELSE NULL
  END as pay_rate_value,
  CASE 
    WHEN is_org_admin(auth.uid(), t.org_id) OR t.user_id = auth.uid()
    THEN t.payroll_notes
    ELSE NULL
  END as payroll_notes,
  t.bio,
  t.status,
  t.default_lesson_length_mins,
  t.created_at,
  t.updated_at
FROM public.teachers t;