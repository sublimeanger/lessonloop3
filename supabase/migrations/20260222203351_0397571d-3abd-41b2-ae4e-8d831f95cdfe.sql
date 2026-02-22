
CREATE INDEX IF NOT EXISTS idx_attendance_records_org_lesson ON public.attendance_records(org_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_org_status ON public.attendance_records(org_id, attendance_status) WHERE attendance_status IN ('absent', 'cancelled_by_student');
