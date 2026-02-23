-- GRADE-002: Grade change history + practice assignment grade level link
-- Adds audit trail for grade changes and optional grade-level tagging on practice assignments.

----------------------------------------------------------------------
-- 1. Grade change history table
----------------------------------------------------------------------
CREATE TABLE public.grade_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_instrument_id UUID NOT NULL REFERENCES public.student_instruments(id) ON DELETE CASCADE,
  old_grade_id UUID REFERENCES public.grade_levels(id) ON DELETE SET NULL,
  new_grade_id UUID NOT NULL REFERENCES public.grade_levels(id),
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT
);

----------------------------------------------------------------------
-- 2. RLS on grade_change_history
----------------------------------------------------------------------
ALTER TABLE public.grade_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view grade change history"
  ON public.grade_change_history FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can create grade change records"
  ON public.grade_change_history FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

----------------------------------------------------------------------
-- 3. Add grade_level_id to practice_assignments
----------------------------------------------------------------------
ALTER TABLE public.practice_assignments
  ADD COLUMN grade_level_id UUID REFERENCES public.grade_levels(id) ON DELETE SET NULL;

----------------------------------------------------------------------
-- 4. Indexes for performance
----------------------------------------------------------------------
CREATE INDEX idx_grade_change_history_student ON public.grade_change_history(student_id);
CREATE INDEX idx_grade_change_history_instrument ON public.grade_change_history(student_instrument_id);
CREATE INDEX idx_practice_assignments_grade ON public.practice_assignments(grade_level_id)
  WHERE grade_level_id IS NOT NULL;
