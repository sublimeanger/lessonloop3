
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Org members can view practice assignments" ON public.practice_assignments;

-- Staff (owner/admin/teacher/finance) can view all assignments in their org
CREATE POLICY "Staff can view practice assignments"
  ON public.practice_assignments FOR SELECT
  USING (public.is_org_staff(auth.uid(), org_id));

-- Parents can only view their own children's assignments
CREATE POLICY "Parents can view own children assignments"
  ON public.practice_assignments FOR SELECT
  USING (public.is_parent_of_student(auth.uid(), student_id));
