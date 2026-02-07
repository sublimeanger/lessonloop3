-- Make teacher_user_id nullable on lessons table to support unlinked teachers
ALTER TABLE public.lessons ALTER COLUMN teacher_user_id DROP NOT NULL;