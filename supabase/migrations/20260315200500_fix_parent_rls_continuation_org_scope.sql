-- FIX 1D.1: Parent RLS on continuation_responses not scoped by org_id
-- The existing policy lets parents see responses across all orgs if they
-- share a guardian record. Scope to responses whose org_id matches the
-- run's org via the guardian's own org membership.

DROP POLICY IF EXISTS "Parents can view their own continuation responses"
  ON public.term_continuation_responses;

CREATE POLICY "Parents see own responses"
  ON public.term_continuation_responses FOR SELECT
  USING (
    guardian_id IN (
      SELECT sg.guardian_id FROM student_guardians sg
      JOIN guardians g ON g.id = sg.guardian_id
      WHERE g.user_id = auth.uid()
    )
    AND org_id = (SELECT tcr.org_id FROM term_continuation_runs tcr WHERE tcr.id = run_id)
  );
