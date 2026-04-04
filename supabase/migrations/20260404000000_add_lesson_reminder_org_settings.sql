-- Add lesson reminder settings to organisations table
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS reminder_lesson_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_lesson_hours integer NOT NULL DEFAULT 24;

COMMENT ON COLUMN public.organisations.reminder_lesson_enabled IS
  'When true, the send-lesson-reminders cron function will send email reminders to guardians before upcoming lessons.';

COMMENT ON COLUMN public.organisations.reminder_lesson_hours IS
  'Number of hours before a lesson starts to send the reminder email. Default 24 hours.';
