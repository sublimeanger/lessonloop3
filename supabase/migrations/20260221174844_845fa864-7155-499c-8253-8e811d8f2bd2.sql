CREATE UNIQUE INDEX idx_one_primary_payer_per_student
  ON public.student_guardians (student_id)
  WHERE is_primary_payer = true;