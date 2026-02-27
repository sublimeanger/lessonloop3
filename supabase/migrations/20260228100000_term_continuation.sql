-- Term Continuation: tables and org settings for term re-enrollment workflow
-- Allows admins to confirm which students return next term and process withdrawals

-- 1) term_continuation_runs — one per term transition
CREATE TABLE public.term_continuation_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  current_term_id       uuid NOT NULL REFERENCES public.terms(id),
  next_term_id          uuid NOT NULL REFERENCES public.terms(id),
  notice_deadline       date NOT NULL,
  reminder_schedule     integer[] DEFAULT '{7,14}',
  assumed_continuing    boolean DEFAULT true,
  status                text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent', 'reminding', 'deadline_passed', 'completed')),
  sent_at               timestamptz,
  deadline_passed_at    timestamptz,
  completed_at          timestamptz,
  summary               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by            uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tcr_org_status ON public.term_continuation_runs(org_id, status);
CREATE INDEX idx_tcr_next_term ON public.term_continuation_runs(next_term_id);
CREATE UNIQUE INDEX idx_tcr_unique_term_pair
  ON public.term_continuation_runs(org_id, current_term_id, next_term_id);

-- RLS
ALTER TABLE public.term_continuation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view continuation runs"
  ON public.term_continuation_runs FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can create continuation runs"
  ON public.term_continuation_runs FOR INSERT
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can update continuation runs"
  ON public.term_continuation_runs FOR UPDATE
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can delete continuation runs"
  ON public.term_continuation_runs FOR DELETE
  USING (is_org_admin(auth.uid(), org_id));

-- Updated_at trigger
CREATE TRIGGER set_tcr_updated_at
  BEFORE UPDATE ON public.term_continuation_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) term_continuation_responses — one per student per run
CREATE TABLE public.term_continuation_responses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  run_id                uuid NOT NULL REFERENCES public.term_continuation_runs(id) ON DELETE CASCADE,
  student_id            uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  guardian_id           uuid NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  lesson_summary        jsonb NOT NULL DEFAULT '[]'::jsonb,
  response              text NOT NULL DEFAULT 'pending'
                        CHECK (response IN ('pending', 'continuing', 'withdrawing', 'assumed_continuing', 'no_response')),
  response_at           timestamptz,
  response_method       text,
  response_token        text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  withdrawal_reason     text,
  withdrawal_notes      text,
  is_processed          boolean DEFAULT false,
  processed_at          timestamptz,
  term_adjustment_id    uuid REFERENCES public.term_adjustments(id),
  next_term_invoice_id  uuid REFERENCES public.invoices(id),
  initial_sent_at       timestamptz,
  reminder_1_sent_at    timestamptz,
  reminder_2_sent_at    timestamptz,
  reminder_count        integer DEFAULT 0,
  next_term_fee_minor   integer,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_tcr_response_unique
  ON public.term_continuation_responses(run_id, student_id);
CREATE INDEX idx_tcr_response_run_status
  ON public.term_continuation_responses(run_id, response);
CREATE INDEX idx_tcr_response_guardian
  ON public.term_continuation_responses(guardian_id, response)
  WHERE response = 'pending';
CREATE INDEX idx_tcr_response_student
  ON public.term_continuation_responses(student_id);
CREATE INDEX idx_tcr_response_token
  ON public.term_continuation_responses(response_token);

-- RLS
ALTER TABLE public.term_continuation_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view continuation responses"
  ON public.term_continuation_responses FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can manage continuation responses"
  ON public.term_continuation_responses FOR ALL
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Parents can view their own continuation responses"
  ON public.term_continuation_responses FOR SELECT
  USING (guardian_id IN (SELECT id FROM public.guardians WHERE user_id = auth.uid()));

CREATE POLICY "Parents can update their own continuation response"
  ON public.term_continuation_responses FOR UPDATE
  USING (guardian_id IN (SELECT id FROM public.guardians WHERE user_id = auth.uid()))
  WITH CHECK (
    guardian_id IN (SELECT id FROM public.guardians WHERE user_id = auth.uid())
    AND response IN ('continuing', 'withdrawing')
  );

-- Updated_at trigger
CREATE TRIGGER set_tcr_response_updated_at
  BEFORE UPDATE ON public.term_continuation_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Organisation settings for continuation defaults
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS continuation_notice_weeks integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS continuation_assumed_continuing boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS continuation_reminder_days integer[] DEFAULT '{7,14}';
