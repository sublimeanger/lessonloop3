-- Practice assignments table (teacher assigns practice to students)
CREATE TABLE public.practice_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_minutes_per_day INTEGER DEFAULT 30,
  target_days_per_week INTEGER DEFAULT 5,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Practice logs table (students/parents log practice sessions)
CREATE TABLE public.practice_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.practice_assignments(id) ON DELETE SET NULL,
  logged_by_user_id UUID NOT NULL,
  practice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  notes TEXT,
  teacher_feedback TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.practice_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_logs ENABLE ROW LEVEL SECURITY;

-- Practice assignments policies
CREATE POLICY "Org members can view practice assignments"
ON public.practice_assignments FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM public.org_memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Teachers and admins can create assignments"
ON public.practice_assignments FOR INSERT
WITH CHECK (
  org_id IN (
    SELECT org_id FROM public.org_memberships 
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin', 'teacher')
  )
);

CREATE POLICY "Teachers and admins can update assignments"
ON public.practice_assignments FOR UPDATE
USING (
  org_id IN (
    SELECT org_id FROM public.org_memberships 
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin', 'teacher')
  )
);

CREATE POLICY "Teachers and admins can delete assignments"
ON public.practice_assignments FOR DELETE
USING (
  org_id IN (
    SELECT org_id FROM public.org_memberships 
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin', 'teacher')
  )
);

-- Practice logs policies
CREATE POLICY "Org members can view practice logs"
ON public.practice_logs FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM public.org_memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  )
  OR
  student_id IN (
    SELECT student_id FROM public.student_guardians 
    WHERE guardian_id IN (
      SELECT id FROM public.guardians WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Parents can create practice logs for their children"
ON public.practice_logs FOR INSERT
WITH CHECK (
  student_id IN (
    SELECT student_id FROM public.student_guardians 
    WHERE guardian_id IN (
      SELECT id FROM public.guardians WHERE user_id = auth.uid()
    )
  )
  OR
  org_id IN (
    SELECT org_id FROM public.org_memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Teachers can update practice logs for feedback"
ON public.practice_logs FOR UPDATE
USING (
  org_id IN (
    SELECT org_id FROM public.org_memberships 
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin', 'teacher')
  )
);

-- Indexes for performance
CREATE INDEX idx_practice_assignments_student ON public.practice_assignments(student_id);
CREATE INDEX idx_practice_assignments_org ON public.practice_assignments(org_id);
CREATE INDEX idx_practice_assignments_teacher ON public.practice_assignments(teacher_user_id);
CREATE INDEX idx_practice_logs_student ON public.practice_logs(student_id);
CREATE INDEX idx_practice_logs_org ON public.practice_logs(org_id);
CREATE INDEX idx_practice_logs_date ON public.practice_logs(practice_date);
CREATE INDEX idx_practice_logs_assignment ON public.practice_logs(assignment_id);

-- Trigger for updated_at
CREATE TRIGGER update_practice_assignments_updated_at
BEFORE UPDATE ON public.practice_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();