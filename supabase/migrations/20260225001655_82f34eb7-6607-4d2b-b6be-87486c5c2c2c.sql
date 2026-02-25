
-- Add missing columns to lessons
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS recap_url TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;

-- Create lesson_notes table
CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id),
  org_id UUID NOT NULL REFERENCES public.organisations(id),
  content_covered TEXT,
  homework TEXT,
  focus_areas TEXT,
  engagement_rating INTEGER CHECK (engagement_rating IS NULL OR (engagement_rating >= 1 AND engagement_rating <= 5)),
  teacher_private_notes TEXT,
  parent_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view lesson notes in their org" ON public.lesson_notes
  FOR SELECT USING (public.is_org_staff(auth.uid(), org_id));

CREATE POLICY "Teachers can insert lesson notes" ON public.lesson_notes
  FOR INSERT WITH CHECK (public.is_org_staff(auth.uid(), org_id));

CREATE POLICY "Teachers can update own lesson notes" ON public.lesson_notes
  FOR UPDATE USING (
    teacher_id = public.get_teacher_id_for_user(auth.uid(), org_id)
    OR public.is_org_admin(auth.uid(), org_id)
  );

CREATE POLICY "Admins can delete lesson notes" ON public.lesson_notes
  FOR DELETE USING (public.is_org_admin(auth.uid(), org_id));

-- Parents can view lesson notes marked as parent_visible for their children
CREATE POLICY "Parents can view visible lesson notes for their children" ON public.lesson_notes
  FOR SELECT USING (
    parent_visible = true
    AND EXISTS (
      SELECT 1 FROM public.lesson_participants lp
      WHERE lp.lesson_id = lesson_notes.lesson_id
        AND public.is_parent_of_student(auth.uid(), lp.student_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_lesson_notes_lesson_id ON public.lesson_notes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_student_id ON public.lesson_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_org_id ON public.lesson_notes(org_id);

-- Create recurring_invoice_templates table
CREATE TABLE IF NOT EXISTS public.recurring_invoice_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organisations(id),
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  billing_mode TEXT NOT NULL DEFAULT 'per_lesson',
  auto_send BOOLEAN NOT NULL DEFAULT false,
  next_run_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance team can manage recurring templates" ON public.recurring_invoice_templates
  FOR ALL USING (public.is_org_finance_team(auth.uid(), org_id))
  WITH CHECK (public.is_org_finance_team(auth.uid(), org_id));

CREATE INDEX IF NOT EXISTS idx_recurring_templates_org ON public.recurring_invoice_templates(org_id);
