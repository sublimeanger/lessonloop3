-- Create message_log table for tracking sent emails/messages
CREATE TABLE public.message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  message_type text NOT NULL, -- 'invite', 'reminder', 'invoice', etc.
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  error_message text,
  related_id uuid, -- ID of related entity (invite_id, invoice_id, etc.)
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

-- Enable RLS
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_log
CREATE POLICY "Org admins can view message logs"
  ON public.message_log FOR SELECT
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "System can insert message logs"
  ON public.message_log FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), org_id));

-- Indexes
CREATE INDEX idx_message_log_org_id ON public.message_log(org_id);
CREATE INDEX idx_message_log_created_at ON public.message_log(created_at DESC);

-- Add function to get user_id by email for invite acceptance
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE email = _email LIMIT 1
$$;