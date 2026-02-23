-- Prevent duplicate credits for the same student+lesson (race condition guard)
CREATE UNIQUE INDEX idx_make_up_credits_unique_per_lesson
  ON public.make_up_credits(student_id, issued_for_lesson_id)
  WHERE issued_for_lesson_id IS NOT NULL;