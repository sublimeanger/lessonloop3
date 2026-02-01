-- Add threading columns to message_log
ALTER TABLE public.message_log 
ADD COLUMN IF NOT EXISTS thread_id uuid,
ADD COLUMN IF NOT EXISTS parent_message_id uuid REFERENCES public.message_log(id) ON DELETE SET NULL;

-- Create index for thread lookups
CREATE INDEX IF NOT EXISTS idx_message_log_thread_id ON public.message_log(thread_id);
CREATE INDEX IF NOT EXISTS idx_message_log_parent_id ON public.message_log(parent_message_id);

-- Add threading columns to internal_messages
ALTER TABLE public.internal_messages 
ADD COLUMN IF NOT EXISTS thread_id uuid,
ADD COLUMN IF NOT EXISTS parent_message_id uuid REFERENCES public.internal_messages(id) ON DELETE SET NULL;

-- Create indexes for internal message threads
CREATE INDEX IF NOT EXISTS idx_internal_messages_thread_id ON public.internal_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_parent_id ON public.internal_messages(parent_message_id);