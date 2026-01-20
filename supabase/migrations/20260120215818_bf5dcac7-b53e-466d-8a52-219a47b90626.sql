-- ============================================
-- B4) LESSONS TABLE - Updated RLS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Only admins can delete lessons" ON public.lessons;
DROP POLICY IF EXISTS "Org members can create lessons" ON public.lessons;
DROP POLICY IF EXISTS "Org members can view lessons" ON public.lessons;
DROP POLICY IF EXISTS "Parents can view their children lessons" ON public.lessons;
DROP POLICY IF EXISTS "Teachers can update their lessons, admins can update all" ON public.lessons;

-- SELECT policies
-- Admin can view all
CREATE POLICY "Admin can view all lessons"
ON public.lessons FOR SELECT
USING (is_org_admin(auth.uid(), org_id));

-- Teacher can view own lessons
CREATE POLICY "Teacher can view own lessons"
ON public.lessons FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'teacher')
  AND teacher_user_id = auth.uid()
);

-- Parent can view their children's lessons
CREATE POLICY "Parent can view children lessons"
ON public.lessons FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent')
  AND EXISTS (
    SELECT 1 FROM public.lesson_participants lp
    WHERE lp.lesson_id = lessons.id
      AND is_parent_of_student(auth.uid(), lp.student_id)
  )
);

-- INSERT: Schedulers only (admin/owner/teacher), teacher must be self
CREATE POLICY "Scheduler can create lessons"
ON public.lessons FOR INSERT
WITH CHECK (
  is_org_scheduler(auth.uid(), org_id)
  AND (
    is_org_admin(auth.uid(), org_id)
    OR teacher_user_id = auth.uid()
  )
);

-- UPDATE: Admin can update all, teacher only own
CREATE POLICY "Admin can update all lessons"
ON public.lessons FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Teacher can update own lessons"
ON public.lessons FOR UPDATE
USING (
  has_org_role(auth.uid(), org_id, 'teacher')
  AND teacher_user_id = auth.uid()
);

-- DELETE: Admin only
CREATE POLICY "Admin can delete lessons"
ON public.lessons FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

-- ============================================
-- B5) LESSON_PARTICIPANTS TABLE - Updated RLS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Org members can add lesson participants" ON public.lesson_participants;
DROP POLICY IF EXISTS "Org members can remove lesson participants" ON public.lesson_participants;
DROP POLICY IF EXISTS "Org members can update lesson participants" ON public.lesson_participants;
DROP POLICY IF EXISTS "Org members can view lesson participants" ON public.lesson_participants;
DROP POLICY IF EXISTS "Parents can view their children lesson participants" ON public.lesson_participants;

-- SELECT policies
-- Admin can view all
CREATE POLICY "Admin can view all lesson participants"
ON public.lesson_participants FOR SELECT
USING (is_org_admin(auth.uid(), org_id));

-- Teacher can view for own lessons
CREATE POLICY "Teacher can view participants for own lessons"
ON public.lesson_participants FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'teacher')
  AND is_lesson_teacher(auth.uid(), lesson_id)
);

-- Parent can view their children's participation
CREATE POLICY "Parent can view child lesson participants"
ON public.lesson_participants FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent')
  AND is_parent_of_student(auth.uid(), student_id)
);

-- INSERT/UPDATE/DELETE: Admin or lesson teacher
CREATE POLICY "Admin can manage lesson participants"
ON public.lesson_participants FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Teacher can add participants to own lessons"
ON public.lesson_participants FOR INSERT
WITH CHECK (
  has_org_role(auth.uid(), org_id, 'teacher')
  AND is_lesson_teacher(auth.uid(), lesson_id)
);

CREATE POLICY "Admin can update lesson participants"
ON public.lesson_participants FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Teacher can update participants for own lessons"
ON public.lesson_participants FOR UPDATE
USING (
  has_org_role(auth.uid(), org_id, 'teacher')
  AND is_lesson_teacher(auth.uid(), lesson_id)
);

CREATE POLICY "Admin can delete lesson participants"
ON public.lesson_participants FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Teacher can delete participants from own lessons"
ON public.lesson_participants FOR DELETE
USING (
  has_org_role(auth.uid(), org_id, 'teacher')
  AND is_lesson_teacher(auth.uid(), lesson_id)
);

-- ============================================
-- B6) ATTENDANCE_RECORDS TABLE - Updated RLS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can delete attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Org members can create attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Org members can update attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Org members can view attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Parents can view their children attendance" ON public.attendance_records;

-- SELECT policies
-- Admin can view all
CREATE POLICY "Admin can view all attendance"
ON public.attendance_records FOR SELECT
USING (is_org_admin(auth.uid(), org_id));

-- Teacher can view for own lessons
CREATE POLICY "Teacher can view attendance for own lessons"
ON public.attendance_records FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'teacher')
  AND is_lesson_teacher(auth.uid(), lesson_id)
);

-- Parent can view their children's attendance
CREATE POLICY "Parent can view child attendance"
ON public.attendance_records FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent')
  AND is_parent_of_student(auth.uid(), student_id)
);

-- INSERT/UPDATE: Admin or lesson teacher
CREATE POLICY "Admin can create attendance"
ON public.attendance_records FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Teacher can record attendance for own lessons"
ON public.attendance_records FOR INSERT
WITH CHECK (
  has_org_role(auth.uid(), org_id, 'teacher')
  AND is_lesson_teacher(auth.uid(), lesson_id)
  AND recorded_by = auth.uid()
);

CREATE POLICY "Admin can update attendance"
ON public.attendance_records FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Teacher can update attendance for own lessons"
ON public.attendance_records FOR UPDATE
USING (
  has_org_role(auth.uid(), org_id, 'teacher')
  AND is_lesson_teacher(auth.uid(), lesson_id)
);

-- DELETE: Admin only
CREATE POLICY "Admin can delete attendance"
ON public.attendance_records FOR DELETE
USING (is_org_admin(auth.uid(), org_id));