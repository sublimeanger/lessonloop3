-- Create message_templates table
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'inapp')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_message_templates_org_id ON public.message_templates(org_id);

-- RLS policies for message_templates
CREATE POLICY "Org members can view message templates"
ON public.message_templates FOR SELECT
USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can create message templates"
ON public.message_templates FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can update message templates"
ON public.message_templates FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can delete message templates"
ON public.message_templates FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

-- Update message_log with additional columns for better tracking
ALTER TABLE public.message_log
ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'inapp', 'sms')),
ADD COLUMN IF NOT EXISTS sender_user_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS recipient_type text CHECK (recipient_type IN ('guardian', 'student', 'teacher', 'parent')),
ADD COLUMN IF NOT EXISTS recipient_id uuid;

-- Add indexes for better querying
CREATE INDEX IF NOT EXISTS idx_message_log_sender_user_id ON public.message_log(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_message_log_recipient_id ON public.message_log(recipient_id);
CREATE INDEX IF NOT EXISTS idx_message_log_recipient_type ON public.message_log(recipient_type);
CREATE INDEX IF NOT EXISTS idx_message_log_channel ON public.message_log(channel);

-- Update RLS for message_log to allow teachers to see messages they sent or for their students
CREATE POLICY "Teachers can view messages they sent"
ON public.message_log FOR SELECT
USING (sender_user_id = auth.uid());

CREATE POLICY "Teachers can insert messages"
ON public.message_log FOR INSERT
WITH CHECK (
  is_org_member(auth.uid(), org_id) 
  AND sender_user_id = auth.uid()
);

-- Parents can view messages related to their children
CREATE POLICY "Parents can view messages about their children"
ON public.message_log FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent'::app_role)
  AND recipient_type = 'guardian'
  AND recipient_id IN (
    SELECT id FROM public.guardians WHERE user_id = auth.uid()
  )
);

-- Trigger for updated_at on message_templates
CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();