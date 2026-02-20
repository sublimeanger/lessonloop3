-- Prevent duplicate billing runs for the same date range within an org
CREATE UNIQUE INDEX idx_billing_runs_no_duplicate
  ON public.billing_runs (org_id, start_date, end_date)
  WHERE status != 'failed';