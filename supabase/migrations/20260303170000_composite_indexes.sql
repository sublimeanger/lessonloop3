-- PERF-L2: Add composite indexes for common query patterns on
-- attendance_records, practice_logs, and message_log.

-- attendance_records: student attendance within an org (reports, GDPR queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_records_org_student
  ON public.attendance_records(org_id, student_id);

-- practice_logs: student practice history sorted by date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_practice_logs_student_date
  ON public.practice_logs(student_id, practice_date DESC);

-- practice_logs: org-wide practice reports by date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_practice_logs_org_date
  ON public.practice_logs(org_id, practice_date DESC);

-- message_log: look up messages by related entity within an org (invoice emails, reminders)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_log_org_related
  ON public.message_log(org_id, related_id) WHERE related_id IS NOT NULL;

-- message_log: thread message ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_log_thread_created
  ON public.message_log(thread_id, created_at) WHERE thread_id IS NOT NULL;
