-- Create student_teacher_assignments table
CREATE TABLE public.student_teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, student_id, teacher_user_id)
);

-- Create indexes for performance
CREATE INDEX idx_student_teacher_assignments_org_id ON public.student_teacher_assignments(org_id);
CREATE INDEX idx_student_teacher_assignments_student_id ON public.student_teacher_assignments(student_id);
CREATE INDEX idx_student_teacher_assignments_teacher_user_id ON public.student_teacher_assignments(teacher_user_id);

-- Enable RLS
ALTER TABLE public.student_teacher_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Org admins can manage assignments (insert/update/delete)
CREATE POLICY "Admins can create student teacher assignments"
ON public.student_teacher_assignments
FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can update student teacher assignments"
ON public.student_teacher_assignments
FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can delete student teacher assignments"
ON public.student_teacher_assignments
FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

-- Teachers can view assignments where they are the teacher
CREATE POLICY "Teachers can view their own assignments"
ON public.student_teacher_assignments
FOR SELECT
USING (teacher_user_id = auth.uid());

-- Admins can view all assignments in their org
CREATE POLICY "Admins can view all org assignments"
ON public.student_teacher_assignments
FOR SELECT
USING (is_org_admin(auth.uid(), org_id));