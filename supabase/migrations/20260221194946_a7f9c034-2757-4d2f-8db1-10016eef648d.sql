
-- time_off_blocks: add teacher_id, backfill, index
ALTER TABLE public.time_off_blocks
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE;

UPDATE public.time_off_blocks tob
SET teacher_id = t.id
FROM public.teachers t
WHERE tob.teacher_user_id = t.user_id AND tob.org_id = t.org_id
  AND tob.teacher_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_time_off_blocks_teacher_id ON public.time_off_blocks(teacher_id);

-- practice_assignments: add teacher_id, backfill, index
ALTER TABLE public.practice_assignments
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE;

UPDATE public.practice_assignments pa
SET teacher_id = t.id
FROM public.teachers t
WHERE pa.teacher_user_id = t.user_id AND pa.org_id = t.org_id
  AND pa.teacher_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_practice_assignments_teacher_id ON public.practice_assignments(teacher_id);
