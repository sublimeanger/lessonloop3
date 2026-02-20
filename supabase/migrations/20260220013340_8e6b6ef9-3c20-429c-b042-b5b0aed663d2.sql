
-- 1. Create helper function
CREATE OR REPLACE FUNCTION public.is_org_active(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN subscription_status = 'active' THEN true
    WHEN subscription_status = 'trialing' AND trial_ends_at > NOW() THEN true
    ELSE false
  END
  FROM organisations WHERE id = _org_id;
$$;

-- 2. Block lesson INSERT when trial expired
CREATE POLICY "block_expired_trial_lesson_insert" ON public.lessons
FOR INSERT
WITH CHECK (
  is_org_active(org_id)
);

-- 3. Block student INSERT when trial expired
CREATE POLICY "block_expired_trial_student_insert" ON public.students
FOR INSERT
WITH CHECK (
  is_org_active(org_id)
);

-- 4. Block invoice INSERT when trial expired
CREATE POLICY "block_expired_trial_invoice_insert" ON public.invoices
FOR INSERT
WITH CHECK (
  is_org_active(org_id)
);
