-- Add configurable upcoming reminder days to organisations
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS upcoming_reminder_days INTEGER[] DEFAULT '{7, 1}';

COMMENT ON COLUMN public.organisations.upcoming_reminder_days IS
  'Days before due date to send upcoming payment reminders (e.g., {7, 1} = 7 days before and 1 day before)';
