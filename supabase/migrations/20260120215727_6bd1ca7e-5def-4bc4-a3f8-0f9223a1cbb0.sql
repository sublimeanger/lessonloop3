-- ============================================
-- A) CREATE SECURITY DEFINER HELPER FUNCTIONS
-- ============================================

-- is_org_staff: checks if user is staff (owner/admin/teacher/finance) with active membership
CREATE OR REPLACE FUNCTION public.is_org_staff(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND role IN ('owner', 'admin', 'teacher', 'finance')
      AND status = 'active'
  )
$$;

-- is_org_scheduler: checks if user can schedule lessons (owner/admin/teacher)
CREATE OR REPLACE FUNCTION public.is_org_scheduler(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND role IN ('owner', 'admin', 'teacher')
      AND status = 'active'
  )
$$;

-- is_org_finance_team: checks if user has finance access (owner/admin/finance)
CREATE OR REPLACE FUNCTION public.is_org_finance_team(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND role IN ('owner', 'admin', 'finance')
      AND status = 'active'
  )
$$;

-- is_assigned_teacher: checks if user is assigned to specific student
CREATE OR REPLACE FUNCTION public.is_assigned_teacher(_user_id uuid, _org_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_teacher_assignments
    WHERE teacher_user_id = _user_id
      AND org_id = _org_id
      AND student_id = _student_id
  )
$$;

-- is_lesson_teacher: checks if user teaches this lesson
CREATE OR REPLACE FUNCTION public.is_lesson_teacher(_user_id uuid, _lesson_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lessons
    WHERE id = _lesson_id
      AND teacher_user_id = _user_id
  )
$$;