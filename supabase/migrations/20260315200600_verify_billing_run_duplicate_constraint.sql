-- FIX 5 [1.9]: Verify billing run duplicate constraint
-- A partial unique index already exists (migration 20260220012039):
--   CREATE UNIQUE INDEX idx_billing_runs_no_duplicate
--     ON public.billing_runs (org_id, start_date, end_date)
--     WHERE status != 'failed';
--
-- This prevents duplicate billing runs for the same org+period while
-- allowing re-runs of failed billing runs. This is correct behaviour.
-- No additional constraint needed.

-- Add a named constraint alias for documentation clarity
-- (the existing index already enforces this, this is a no-op guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_billing_runs_no_duplicate'
  ) THEN
    CREATE UNIQUE INDEX idx_billing_runs_no_duplicate
      ON public.billing_runs (org_id, start_date, end_date)
      WHERE status != 'failed';
  END IF;
END $$;
