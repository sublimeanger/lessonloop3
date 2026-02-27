-- Term Adjustments: new table for mid-term withdrawals and day/time changes
-- Also adds credit note support columns to invoices

-- 1) term_adjustments table
CREATE TABLE public.term_adjustments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  adjustment_type         text NOT NULL CHECK (adjustment_type IN ('withdrawal', 'day_change', 'manual')),
  student_id              uuid NOT NULL REFERENCES public.students(id),
  term_id                 uuid REFERENCES public.terms(id),
  original_recurrence_id  uuid REFERENCES public.recurrence_rules(id),
  original_lessons_remaining integer NOT NULL DEFAULT 0,
  original_day_of_week    text,
  original_time           time,
  new_recurrence_id       uuid REFERENCES public.recurrence_rules(id),
  new_lessons_count       integer,
  new_day_of_week         text,
  new_time                time,
  new_teacher_id          uuid,
  new_location_id         uuid,
  lesson_rate_minor       integer NOT NULL,
  lessons_difference      integer NOT NULL,
  adjustment_amount_minor integer NOT NULL,
  currency_code           text NOT NULL DEFAULT 'GBP',
  credit_note_invoice_id  uuid REFERENCES public.invoices(id),
  cancelled_lesson_ids    uuid[] DEFAULT '{}',
  created_lesson_ids      uuid[] DEFAULT '{}',
  status                  text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  effective_date          date NOT NULL,
  notes                   text,
  created_by              uuid NOT NULL,
  confirmed_by            uuid,
  confirmed_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_term_adjustments_org_id ON public.term_adjustments(org_id);
CREATE INDEX idx_term_adjustments_student_id ON public.term_adjustments(student_id, org_id);
CREATE INDEX idx_term_adjustments_term_id ON public.term_adjustments(term_id);
CREATE INDEX idx_term_adjustments_status ON public.term_adjustments(status);

-- RLS
ALTER TABLE public.term_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org term adjustments"
  ON public.term_adjustments FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can create term adjustments"
  ON public.term_adjustments FOR INSERT
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can update term adjustments"
  ON public.term_adjustments FOR UPDATE
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can delete term adjustments"
  ON public.term_adjustments FOR DELETE
  USING (is_org_admin(auth.uid(), org_id));

-- Updated_at trigger
CREATE TRIGGER set_term_adjustments_updated_at
  BEFORE UPDATE ON public.term_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Add credit note columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_credit_note boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS related_invoice_id uuid REFERENCES public.invoices(id),
  ADD COLUMN IF NOT EXISTS adjustment_id uuid REFERENCES public.term_adjustments(id);
