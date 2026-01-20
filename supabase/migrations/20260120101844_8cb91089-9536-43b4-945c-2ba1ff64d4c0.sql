-- Performance indexes for frequently queried columns
-- Lessons table
CREATE INDEX IF NOT EXISTS idx_lessons_org_id ON public.lessons(org_id);
CREATE INDEX IF NOT EXISTS idx_lessons_start_at ON public.lessons(start_at);
CREATE INDEX IF NOT EXISTS idx_lessons_status ON public.lessons(status);
CREATE INDEX IF NOT EXISTS idx_lessons_teacher_user_id ON public.lessons(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_org_start ON public.lessons(org_id, start_at);
CREATE INDEX IF NOT EXISTS idx_lessons_org_teacher_start ON public.lessons(org_id, teacher_user_id, start_at);

-- Invoices table
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON public.invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON public.invoices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_due ON public.invoices(org_id, due_date);

-- Students table
CREATE INDEX IF NOT EXISTS idx_students_org_id ON public.students(org_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);
CREATE INDEX IF NOT EXISTS idx_students_org_status ON public.students(org_id, status);

-- Guardians table
CREATE INDEX IF NOT EXISTS idx_guardians_org_id ON public.guardians(org_id);
CREATE INDEX IF NOT EXISTS idx_guardians_user_id ON public.guardians(user_id);

-- Lesson participants table
CREATE INDEX IF NOT EXISTS idx_lesson_participants_lesson_id ON public.lesson_participants(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_participants_student_id ON public.lesson_participants(student_id);

-- Attendance records table
CREATE INDEX IF NOT EXISTS idx_attendance_records_lesson_id ON public.attendance_records(lesson_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id ON public.attendance_records(student_id);

-- Payments table
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON public.payments(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);

-- Org memberships table
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON public.org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id ON public.org_memberships(org_id);

-- Audit log table
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON public.audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at);

-- Closure dates table
CREATE INDEX IF NOT EXISTS idx_closure_dates_org_id ON public.closure_dates(org_id);
CREATE INDEX IF NOT EXISTS idx_closure_dates_date ON public.closure_dates(date);

-- Message log table
CREATE INDEX IF NOT EXISTS idx_message_log_org_id ON public.message_log(org_id);
CREATE INDEX IF NOT EXISTS idx_message_log_created_at ON public.message_log(created_at);