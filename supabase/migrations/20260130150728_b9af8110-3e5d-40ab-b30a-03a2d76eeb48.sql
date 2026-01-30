-- Add the missing related_student_id column to invites table
-- This enables parent invitations to be linked directly to a student

ALTER TABLE public.invites 
ADD COLUMN related_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.invites.related_student_id IS 'Optional link to a student for parent invites';