-- FIX 4: Term deletion cascades destroy continuation history
-- Previously ON DELETE CASCADE, meaning deleting a term would destroy all
-- continuation run records. Changed to SET NULL to preserve history.
-- Also drop NOT NULL constraints so SET NULL can work.

ALTER TABLE public.term_continuation_runs
  ALTER COLUMN current_term_id DROP NOT NULL;

ALTER TABLE public.term_continuation_runs
  ALTER COLUMN next_term_id DROP NOT NULL;

ALTER TABLE public.term_continuation_runs
  DROP CONSTRAINT IF EXISTS term_continuation_runs_current_term_id_fkey,
  ADD CONSTRAINT term_continuation_runs_current_term_id_fkey
    FOREIGN KEY (current_term_id) REFERENCES public.terms(id) ON DELETE SET NULL;

ALTER TABLE public.term_continuation_runs
  DROP CONSTRAINT IF EXISTS term_continuation_runs_next_term_id_fkey,
  ADD CONSTRAINT term_continuation_runs_next_term_id_fkey
    FOREIGN KEY (next_term_id) REFERENCES public.terms(id) ON DELETE SET NULL;
