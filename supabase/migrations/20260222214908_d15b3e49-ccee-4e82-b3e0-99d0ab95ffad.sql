-- Allow finance role to read lessons for payroll reports
CREATE POLICY "Finance can view all lessons"
ON public.lessons
FOR SELECT
TO authenticated
USING (is_org_finance_team(auth.uid(), org_id));