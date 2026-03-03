-- Fix FK cascade on term_continuation_runs term references (4.6)
-- Without CASCADE, deleting a term would fail with a FK violation if continuation runs exist.

ALTER TABLE public.term_continuation_runs
  DROP CONSTRAINT IF EXISTS term_continuation_runs_current_term_id_fkey,
  ADD CONSTRAINT term_continuation_runs_current_term_id_fkey
    FOREIGN KEY (current_term_id) REFERENCES public.terms(id) ON DELETE CASCADE;

ALTER TABLE public.term_continuation_runs
  DROP CONSTRAINT IF EXISTS term_continuation_runs_next_term_id_fkey,
  ADD CONSTRAINT term_continuation_runs_next_term_id_fkey
    FOREIGN KEY (next_term_id) REFERENCES public.terms(id) ON DELETE CASCADE;
