
DROP POLICY IF EXISTS "Org members can view practice logs" ON public.practice_logs;

CREATE POLICY "Staff can view practice logs"
  ON public.practice_logs FOR SELECT
  USING (public.is_org_staff(auth.uid(), org_id));

CREATE POLICY "Parents can view own children logs"
  ON public.practice_logs FOR SELECT
  USING (public.is_parent_of_student(auth.uid(), student_id));
