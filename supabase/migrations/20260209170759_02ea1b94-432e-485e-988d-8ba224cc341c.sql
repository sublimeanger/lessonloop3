
-- New terms table
CREATE TABLE public.terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  UNIQUE(org_id, name)
);

CREATE INDEX idx_terms_org_dates ON public.terms(org_id, start_date);

-- RLS policies for terms
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view terms"
  ON public.terms FOR SELECT
  USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Admin can manage terms"
  ON public.terms FOR ALL
  USING (is_org_admin(auth.uid(), org_id));

-- Add term_id to invoices
ALTER TABLE public.invoices
  ADD COLUMN term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL;

-- Add billing_mode and term_id to billing_runs
ALTER TABLE public.billing_runs
  ADD COLUMN billing_mode text NOT NULL DEFAULT 'delivered'
  CHECK (billing_mode IN ('delivered', 'upfront'));

ALTER TABLE public.billing_runs
  ADD COLUMN term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL;
