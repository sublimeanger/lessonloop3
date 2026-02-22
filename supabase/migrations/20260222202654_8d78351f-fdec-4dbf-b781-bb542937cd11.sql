
-- [ATT-001] Restrict attendance_records INSERT/UPDATE to teachers and admins only
-- Parents and finance users should only be able to read attendance, not write it.

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Org members can create attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Org members can update attendance records" ON public.attendance_records;

-- Recreate INSERT policy: only the lesson's teacher or an org admin can create records
CREATE POLICY "Staff can create attendance records"
ON public.attendance_records
FOR INSERT
TO authenticated
WITH CHECK (
  can_edit_lesson(auth.uid(), lesson_id)
  OR is_org_admin(auth.uid(), org_id)
);

-- Recreate UPDATE policy: same restriction
CREATE POLICY "Staff can update attendance records"
ON public.attendance_records
FOR UPDATE
TO authenticated
USING (
  can_edit_lesson(auth.uid(), lesson_id)
  OR is_org_admin(auth.uid(), org_id)
);
