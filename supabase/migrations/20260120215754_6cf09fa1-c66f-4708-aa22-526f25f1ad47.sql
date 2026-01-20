-- ============================================
-- B1) STUDENTS TABLE - Updated RLS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view deleted students" ON public.students;
DROP POLICY IF EXISTS "Only org admins can delete students" ON public.students;
DROP POLICY IF EXISTS "Org admins can create students" ON public.students;
DROP POLICY IF EXISTS "Org admins can update students" ON public.students;
DROP POLICY IF EXISTS "Org members can view org students" ON public.students;
DROP POLICY IF EXISTS "Org members can view students" ON public.students;
DROP POLICY IF EXISTS "Parents can view their linked students" ON public.students;

-- SELECT policies
-- Admin/Owner can view all (including deleted)
CREATE POLICY "Admin can view all students"
ON public.students FOR SELECT
USING (
  deleted_at IS NULL 
  AND is_org_admin(auth.uid(), org_id)
);

CREATE POLICY "Admin can view deleted students"
ON public.students FOR SELECT
USING (
  deleted_at IS NOT NULL 
  AND is_org_admin(auth.uid(), org_id)
);

-- Teacher can only view assigned students
CREATE POLICY "Teacher can view assigned students"
ON public.students FOR SELECT
USING (
  deleted_at IS NULL
  AND has_org_role(auth.uid(), org_id, 'teacher')
  AND is_assigned_teacher(auth.uid(), org_id, id)
);

-- Finance can view students (for invoice context)
CREATE POLICY "Finance can view students"
ON public.students FOR SELECT
USING (
  deleted_at IS NULL
  AND has_org_role(auth.uid(), org_id, 'finance')
);

-- Parent can view linked students
CREATE POLICY "Parent can view linked students"
ON public.students FOR SELECT
USING (
  deleted_at IS NULL 
  AND is_parent_of_student(auth.uid(), id)
);

-- INSERT: Admin only
CREATE POLICY "Admin can create students"
ON public.students FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));

-- UPDATE: Admin only
CREATE POLICY "Admin can update students"
ON public.students FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

-- DELETE: Admin only
CREATE POLICY "Admin can delete students"
ON public.students FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

-- ============================================
-- B2) GUARDIANS TABLE - Updated RLS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view deleted guardians" ON public.guardians;
DROP POLICY IF EXISTS "Only org admins can delete guardians" ON public.guardians;
DROP POLICY IF EXISTS "Org members can create guardians" ON public.guardians;
DROP POLICY IF EXISTS "Org members can update guardians" ON public.guardians;
DROP POLICY IF EXISTS "Org members can view guardians" ON public.guardians;
DROP POLICY IF EXISTS "Parents can view their guardian record" ON public.guardians;

-- SELECT policies
-- Admin can view all
CREATE POLICY "Admin can view all guardians"
ON public.guardians FOR SELECT
USING (
  deleted_at IS NULL 
  AND is_org_admin(auth.uid(), org_id)
);

CREATE POLICY "Admin can view deleted guardians"
ON public.guardians FOR SELECT
USING (
  deleted_at IS NOT NULL 
  AND is_org_admin(auth.uid(), org_id)
);

-- Teacher can view guardians of assigned students
CREATE POLICY "Teacher can view guardians of assigned students"
ON public.guardians FOR SELECT
USING (
  deleted_at IS NULL
  AND has_org_role(auth.uid(), org_id, 'teacher')
  AND EXISTS (
    SELECT 1 FROM public.student_guardians sg
    JOIN public.student_teacher_assignments sta ON sta.student_id = sg.student_id
    WHERE sg.guardian_id = guardians.id
      AND sta.teacher_user_id = auth.uid()
      AND sta.org_id = guardians.org_id
  )
);

-- Finance can view guardians (for invoice context)
CREATE POLICY "Finance can view guardians"
ON public.guardians FOR SELECT
USING (
  deleted_at IS NULL
  AND has_org_role(auth.uid(), org_id, 'finance')
);

-- Parent can view their own guardian record
CREATE POLICY "Parent can view own guardian record"
ON public.guardians FOR SELECT
USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE: Admin only
CREATE POLICY "Admin can create guardians"
ON public.guardians FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can update guardians"
ON public.guardians FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can delete guardians"
ON public.guardians FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

-- ============================================
-- B3) STUDENT_GUARDIANS TABLE - Updated RLS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Only org admins can delete student_guardians" ON public.student_guardians;
DROP POLICY IF EXISTS "Org members can create student_guardians" ON public.student_guardians;
DROP POLICY IF EXISTS "Org members can update student_guardians" ON public.student_guardians;
DROP POLICY IF EXISTS "Org members can view student_guardians" ON public.student_guardians;
DROP POLICY IF EXISTS "Parents can view their student guardian links" ON public.student_guardians;

-- SELECT policies
-- Admin can view all
CREATE POLICY "Admin can view student guardians"
ON public.student_guardians FOR SELECT
USING (is_org_admin(auth.uid(), org_id));

-- Teacher can view for assigned students
CREATE POLICY "Teacher can view student guardians for assigned students"
ON public.student_guardians FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'teacher')
  AND is_assigned_teacher(auth.uid(), org_id, student_id)
);

-- Finance can view (for billing context)
CREATE POLICY "Finance can view student guardians"
ON public.student_guardians FOR SELECT
USING (has_org_role(auth.uid(), org_id, 'finance'));

-- Parent can view their own links
CREATE POLICY "Parent can view own student guardian links"
ON public.student_guardians FOR SELECT
USING (is_parent_of_student(auth.uid(), student_id));

-- INSERT/UPDATE/DELETE: Admin only
CREATE POLICY "Admin can create student guardians"
ON public.student_guardians FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can update student guardians"
ON public.student_guardians FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can delete student guardians"
ON public.student_guardians FOR DELETE
USING (is_org_admin(auth.uid(), org_id));