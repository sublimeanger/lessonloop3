-- Add new columns to students table for batch import support
-- These fields are commonly exported by competitor software (MyMusicStaff, Opus1, etc.)

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'non_binary', 'other', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Index on tags for future filtering
CREATE INDEX IF NOT EXISTS idx_students_tags ON public.students USING GIN (tags) WHERE tags IS NOT NULL AND tags != '{}';
