-- Fix 3: Add attendance_records and practice_logs to realtime publication
-- so the frontend can subscribe to changes and update dashboard counts live.

ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.practice_logs;
