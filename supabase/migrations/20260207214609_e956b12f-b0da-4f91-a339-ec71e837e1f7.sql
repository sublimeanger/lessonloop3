-- Make teacher_user_id nullable to support unlinked teachers
ALTER TABLE public.student_teacher_assignments 
ALTER COLUMN teacher_user_id DROP NOT NULL;