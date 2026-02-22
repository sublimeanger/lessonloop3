ALTER TABLE public.practice_logs DROP CONSTRAINT IF EXISTS practice_logs_duration_minutes_check;
ALTER TABLE public.practice_logs ADD CONSTRAINT practice_logs_duration_minutes_check
  CHECK (duration_minutes > 0 AND duration_minutes <= 720);