-- Add batch_id column to message_log for linking bulk messages
ALTER TABLE public.message_log
ADD COLUMN batch_id uuid;

-- Create message_batches table
CREATE TABLE public.message_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  filter_criteria jsonb NOT NULL DEFAULT '{}',
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'completed', 'failed')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add foreign key from message_log.batch_id to message_batches.id
ALTER TABLE public.message_log
ADD CONSTRAINT message_log_batch_id_fkey
FOREIGN KEY (batch_id) REFERENCES public.message_batches(id) ON DELETE SET NULL;

-- Create index for faster batch queries
CREATE INDEX idx_message_log_batch_id ON public.message_log(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_message_batches_org_id ON public.message_batches(org_id);
CREATE INDEX idx_message_batches_created_at ON public.message_batches(created_at DESC);

-- Enable RLS on message_batches
ALTER TABLE public.message_batches ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_batches (only admins/owners can create and view)
CREATE POLICY "Org admins can view message batches"
ON public.message_batches
FOR SELECT
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can create message batches"
ON public.message_batches
FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can update message batches"
ON public.message_batches
FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));