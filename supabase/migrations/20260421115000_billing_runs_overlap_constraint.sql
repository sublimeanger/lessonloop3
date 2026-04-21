-- BR3: Prevent overlapping billing runs per org via exclusion constraint.
--
-- Uses btree_gist extension to support EXCLUDE USING gist with a
-- daterange computed from start_date/end_date. Non-failed runs only
-- (failed runs are historical artefacts and shouldn't block new
-- attempts).
--
-- This closes the race where two admins click "Run Billing" for the
-- same period near-simultaneously. Previously a pre-flight SELECT could
-- pass for both, leading to duplicate runs / duplicate invoices.

BEGIN;

-- Ensure btree_gist extension (for including org_id equality alongside
-- daterange overlap). Idempotent.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop if exists (idempotent for re-run)
ALTER TABLE billing_runs
  DROP CONSTRAINT IF EXISTS billing_runs_no_overlap_per_org;

-- Add exclusion constraint. Only applies to non-failed runs (failed
-- runs are kept for audit but don't block new attempts).
ALTER TABLE billing_runs
  ADD CONSTRAINT billing_runs_no_overlap_per_org
  EXCLUDE USING gist (
    org_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
  WHERE (status != 'failed');

NOTIFY pgrst, 'reload schema';

COMMIT;
