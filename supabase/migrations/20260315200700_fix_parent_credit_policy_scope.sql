-- FIX 5D.2: Ensure parents only see credits for their own children
-- Replace function-based policy with explicit student-scoped check
-- to prevent any cross-org leakage via guardian records.

DROP POLICY IF EXISTS "Parents can view their children credits"
  ON public.make_up_credits;

CREATE POLICY "Parents see own children credits"
  ON public.make_up_credits FOR SELECT
  USING (
    student_id IN (
      SELECT sg.student_id FROM student_guardians sg
      JOIN guardians g ON g.id = sg.guardian_id
      WHERE g.user_id = auth.uid()
    )
  );
