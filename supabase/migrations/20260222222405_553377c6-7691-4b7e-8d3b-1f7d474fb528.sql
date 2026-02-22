
-- Create cancellation feedback table
CREATE TABLE public.cancellation_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organisations(id),
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cancellation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view cancellation feedback"
  ON public.cancellation_feedback
  FOR SELECT
  USING (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can insert cancellation feedback"
  ON public.cancellation_feedback
  FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));
