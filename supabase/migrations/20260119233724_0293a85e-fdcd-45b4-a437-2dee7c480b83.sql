-- Create closure_dates table for UK term/closure scheduling
CREATE TABLE public.closure_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  date date NOT NULL,
  reason text NOT NULL,
  applies_to_all_locations boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE(org_id, location_id, date)
);

-- Enable RLS
ALTER TABLE public.closure_dates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Org members can view closure dates"
  ON public.closure_dates FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can create closure dates"
  ON public.closure_dates FOR INSERT
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can update closure dates"
  ON public.closure_dates FOR UPDATE
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can delete closure dates"
  ON public.closure_dates FOR DELETE
  USING (is_org_admin(auth.uid(), org_id));

-- Add org setting for blocking scheduling on closure dates
ALTER TABLE public.organisations 
ADD COLUMN block_scheduling_on_closures boolean NOT NULL DEFAULT true;

-- Index for performance
CREATE INDEX idx_closure_dates_org_date ON public.closure_dates(org_id, date);
CREATE INDEX idx_closure_dates_location ON public.closure_dates(location_id);