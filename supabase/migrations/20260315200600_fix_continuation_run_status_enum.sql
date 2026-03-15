-- FIX 2E.1: Allow 'failed' and 'partial' status on continuation runs
-- When all emails fail the run should be 'failed', not 'sent'.
-- When some emails fail, status should be 'partial'.

ALTER TABLE public.term_continuation_runs
  DROP CONSTRAINT IF EXISTS term_continuation_runs_status_check;

ALTER TABLE public.term_continuation_runs
  ADD CONSTRAINT term_continuation_runs_status_check
  CHECK (status IN ('draft', 'sent', 'partial', 'failed', 'reminding', 'deadline_passed', 'completed'));
