-- Create internal_messages table for staff-to-staff communication
CREATE TABLE public.internal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('owner', 'admin', 'teacher')),
  recipient_user_id uuid NOT NULL,
  recipient_role text NOT NULL CHECK (recipient_role IN ('owner', 'admin', 'teacher')),
  subject text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX idx_internal_messages_org_id ON public.internal_messages(org_id);
CREATE INDEX idx_internal_messages_sender ON public.internal_messages(sender_user_id);
CREATE INDEX idx_internal_messages_recipient ON public.internal_messages(recipient_user_id);
CREATE INDEX idx_internal_messages_created ON public.internal_messages(created_at DESC);

-- RLS Policies

-- Staff can view messages where they are sender or recipient
CREATE POLICY "Staff can view own messages"
  ON public.internal_messages
  FOR SELECT
  USING (
    is_org_staff(auth.uid(), org_id)
    AND (sender_user_id = auth.uid() OR recipient_user_id = auth.uid())
  );

-- Admins/owners can view all internal messages in their org
CREATE POLICY "Admins can view all internal messages"
  ON public.internal_messages
  FOR SELECT
  USING (
    is_org_admin(auth.uid(), org_id)
  );

-- Staff can send messages (insert)
CREATE POLICY "Staff can send internal messages"
  ON public.internal_messages
  FOR INSERT
  WITH CHECK (
    is_org_staff(auth.uid(), org_id)
    AND sender_user_id = auth.uid()
  );

-- Recipients can mark messages as read (update read_at only)
CREATE POLICY "Recipients can mark messages read"
  ON public.internal_messages
  FOR UPDATE
  USING (
    recipient_user_id = auth.uid()
    AND is_org_member(auth.uid(), org_id)
  )
  WITH CHECK (
    recipient_user_id = auth.uid()
  );

-- Add audit logging trigger
CREATE TRIGGER audit_internal_messages
  AFTER INSERT OR UPDATE OR DELETE ON public.internal_messages
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();