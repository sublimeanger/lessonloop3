
-- Create org_messaging_settings table
CREATE TABLE public.org_messaging_settings (
  org_id UUID PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  parent_can_initiate BOOLEAN NOT NULL DEFAULT true,
  parent_can_message_owner BOOLEAN NOT NULL DEFAULT true,
  parent_can_message_admin BOOLEAN NOT NULL DEFAULT true,
  parent_can_message_teacher BOOLEAN NOT NULL DEFAULT false,
  auto_assign_to_teacher BOOLEAN NOT NULL DEFAULT false,
  notify_staff_on_new_message BOOLEAN NOT NULL DEFAULT true,
  notify_parent_on_reply BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.org_messaging_settings ENABLE ROW LEVEL SECURITY;

-- Only org admins can read
CREATE POLICY "Org admins can read messaging settings"
ON public.org_messaging_settings FOR SELECT
USING (public.is_org_admin(auth.uid(), org_id));

-- Only org admins can insert
CREATE POLICY "Org admins can insert messaging settings"
ON public.org_messaging_settings FOR INSERT
WITH CHECK (public.is_org_admin(auth.uid(), org_id));

-- Only org admins can update
CREATE POLICY "Org admins can update messaging settings"
ON public.org_messaging_settings FOR UPDATE
USING (public.is_org_admin(auth.uid(), org_id));

-- Org staff can read (for enforcement in edge functions via service role, but also for parent portal checks)
CREATE POLICY "Org members can read messaging settings"
ON public.org_messaging_settings FOR SELECT
USING (public.is_org_member(auth.uid(), org_id));

-- Updated_at trigger
CREATE TRIGGER update_org_messaging_settings_updated_at
BEFORE UPDATE ON public.org_messaging_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
