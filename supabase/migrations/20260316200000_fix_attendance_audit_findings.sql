-- Fix attendance audit findings ATT-01 through ATT-07
-- See audit-feature-10-attendance-register.md for details.

-- ============================================================
-- ATT-01 HIGH: is_lesson_teacher() only checks teacher_user_id
-- Fix: also check via lessons.teacher_id → teachers.user_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_lesson_teacher(_user_id uuid, _lesson_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lessons l
    WHERE l.id = _lesson_id
      AND (
        l.teacher_user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.teachers t
          WHERE t.id = l.teacher_id
            AND t.user_id = _user_id
        )
      )
  )
$$;

-- ============================================================
-- ATT-02 HIGH: can_edit_lesson() has the same gap
-- Fix: also check via lessons.teacher_id → teachers.user_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_edit_lesson(_user_id uuid, _lesson_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = _lesson_id
      AND (
        l.teacher_user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.teachers t
          WHERE t.id = l.teacher_id
            AND t.user_id = _user_id
        )
        OR is_org_admin(_user_id, l.org_id)
      )
  )
$$;

-- ============================================================
-- ATT-03 HIGH: Future attendance guard is client-only
-- Fix: DB trigger that prevents marking attendance for future
-- lessons UNLESS the lesson has already been marked 'completed'.
-- Allows a 15-minute buffer so teachers can mark as students arrive.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_attendance_not_future()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_start timestamptz;
  v_status text;
BEGIN
  SELECT start_at, status INTO v_start, v_status
    FROM public.lessons
    WHERE id = NEW.lesson_id;

  -- Allow attendance for completed lessons (Mark Complete backfill)
  IF v_status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Block if lesson starts more than 15 minutes in the future
  IF v_start > NOW() + INTERVAL '15 minutes' THEN
    RAISE EXCEPTION 'Cannot record attendance for a lesson that has not started yet';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attendance_not_future
  BEFORE INSERT OR UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.check_attendance_not_future();

-- ============================================================
-- ATT-04 MEDIUM: Drop duplicate RLS policies on attendance_records
-- The older specific policies from migration 20260120215818 are
-- superseded by the newer "Staff can create/update" policies
-- from migration 20260222202654. Drop the duplicates.
-- ============================================================
DROP POLICY IF EXISTS "Admin can create attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Teacher can record attendance for own lessons" ON public.attendance_records;
DROP POLICY IF EXISTS "Admin can update attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Teacher can update attendance for own lessons" ON public.attendance_records;

-- ============================================================
-- ATT-07 MEDIUM: Add missing index on attendance_records.student_id
-- The parent RLS policy is_parent_of_student(auth.uid(), student_id)
-- needs this index for efficient lookups.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id
  ON public.attendance_records(student_id);
