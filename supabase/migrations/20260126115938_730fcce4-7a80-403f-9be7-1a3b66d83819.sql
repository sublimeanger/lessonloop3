-- Add default teaching settings columns to students table
ALTER TABLE public.students 
ADD COLUMN default_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
ADD COLUMN default_teacher_user_id uuid,
ADD COLUMN default_rate_card_id uuid REFERENCES public.rate_cards(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX idx_students_default_location ON public.students(default_location_id) WHERE default_location_id IS NOT NULL;
CREATE INDEX idx_students_default_teacher ON public.students(default_teacher_user_id) WHERE default_teacher_user_id IS NOT NULL;
CREATE INDEX idx_students_default_rate_card ON public.students(default_rate_card_id) WHERE default_rate_card_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.students.default_location_id IS 'Default location/school where this student is taught';
COMMENT ON COLUMN public.students.default_teacher_user_id IS 'Default teacher assigned to this student for quick lesson creation';
COMMENT ON COLUMN public.students.default_rate_card_id IS 'Default billing rate card for this student';