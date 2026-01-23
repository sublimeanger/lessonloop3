-- Phase 5: Add read tracking for parent messages

-- Add read_at column to message_log for tracking unread messages
ALTER TABLE public.message_log
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;