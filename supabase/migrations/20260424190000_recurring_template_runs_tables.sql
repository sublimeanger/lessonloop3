-- Journey 9 Phase 1 · Commit 4
-- recurring_template_runs + recurring_template_run_errors: generator provenance + error logs.
-- Adds back-link FK recurring_invoice_templates.last_run_id → recurring_template_runs.id.
-- Design ref: docs/RECURRING_BILLING_DESIGN.md §2.

-- Runs: one row per generator invocation. Provenance anchor for every invoice
-- produced by that run (via invoices.generated_from_run_id, added in C5).
CREATE TABLE IF NOT EXISTS recurring_template_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE RESTRICT,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  run_date date NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  triggered_by text NOT NULL CHECK (triggered_by IN ('scheduler', 'manual', 'retry')),
  triggered_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  outcome text CHECK (outcome IN ('completed', 'partial', 'failed', 'running')) DEFAULT 'running',
  recipients_total integer NOT NULL DEFAULT 0,
  invoices_generated integer NOT NULL DEFAULT 0,
  recipients_skipped integer NOT NULL DEFAULT 0,
  error_summary text,
  audit_metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_rtr_runs_template
  ON recurring_template_runs (template_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_rtr_runs_org_recent
  ON recurring_template_runs (org_id, started_at DESC);

ALTER TABLE recurring_template_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance team views runs" ON recurring_template_runs;
CREATE POLICY "Finance team views runs"
  ON recurring_template_runs FOR SELECT
  USING (is_org_finance_team(auth.uid(), org_id));

DROP POLICY IF EXISTS "Service role manages runs" ON recurring_template_runs;
CREATE POLICY "Service role manages runs"
  ON recurring_template_runs FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

-- Run errors: per-recipient failure rows. Separate table so operator can
-- filter and the generator's savepoint-per-recipient isolation logs cleanly.
CREATE TABLE IF NOT EXISTS recurring_template_run_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES recurring_template_runs(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  error_code text NOT NULL,
  error_message text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rtre_run
  ON recurring_template_run_errors (run_id);

CREATE INDEX IF NOT EXISTS idx_rtre_org_recent
  ON recurring_template_run_errors (org_id, occurred_at DESC);

ALTER TABLE recurring_template_run_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance team views errors" ON recurring_template_run_errors;
CREATE POLICY "Finance team views errors"
  ON recurring_template_run_errors FOR SELECT
  USING (is_org_finance_team(auth.uid(), org_id));

DROP POLICY IF EXISTS "Service role manages errors" ON recurring_template_run_errors;
CREATE POLICY "Service role manages errors"
  ON recurring_template_run_errors FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

-- Back-link FK: recurring_invoice_templates.last_run_id → recurring_template_runs.id.
-- Column was added in C1; FK deferred until now to avoid forward reference.
ALTER TABLE recurring_invoice_templates
  DROP CONSTRAINT IF EXISTS recurring_invoice_templates_last_run_id_fkey;

ALTER TABLE recurring_invoice_templates
  ADD CONSTRAINT recurring_invoice_templates_last_run_id_fkey
  FOREIGN KEY (last_run_id) REFERENCES recurring_template_runs(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
