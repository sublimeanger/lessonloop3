
DROP POLICY IF EXISTS "Parents can create practice logs for their children" ON public.practice_logs;

CREATE POLICY "Staff can create practice logs"
  ON public.practice_logs FOR INSERT
  WITH CHECK (public.is_org_staff(auth.uid(), org_id));

CREATE POLICY "Parents can create logs for own children"
  ON public.practice_logs FOR INSERT
  WITH CHECK (public.is_parent_of_student(auth.uid(), student_id));
