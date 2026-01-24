-- Add cancellation notice hours setting to organisations
ALTER TABLE public.organisations 
ADD COLUMN IF NOT EXISTS cancellation_notice_hours integer NOT NULL DEFAULT 24;

-- Create make_up_credits table
CREATE TABLE public.make_up_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  issued_for_lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  redeemed_lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  credit_value_minor integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.make_up_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view make_up_credits in their org"
ON public.make_up_credits
FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM public.org_memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Admins can insert make_up_credits in their org"
ON public.make_up_credits
FOR INSERT
WITH CHECK (
  org_id IN (
    SELECT org_id FROM public.org_memberships 
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin', 'teacher')
  )
);

CREATE POLICY "Admins can update make_up_credits in their org"
ON public.make_up_credits
FOR UPDATE
USING (
  org_id IN (
    SELECT org_id FROM public.org_memberships 
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can delete make_up_credits in their org"
ON public.make_up_credits
FOR DELETE
USING (
  org_id IN (
    SELECT org_id FROM public.org_memberships 
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
  )
);

-- Index for efficient queries
CREATE INDEX idx_make_up_credits_org_student ON public.make_up_credits(org_id, student_id);
CREATE INDEX idx_make_up_credits_student_available ON public.make_up_credits(student_id) WHERE redeemed_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER update_make_up_credits_updated_at
BEFORE UPDATE ON public.make_up_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();