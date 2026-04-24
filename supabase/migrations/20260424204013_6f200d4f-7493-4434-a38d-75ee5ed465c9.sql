-- Journey 9 Phase 1 · Bundle of 6 migrations (20260424160000 → 20260424210000)

-- ============================================================
-- C1: 20260424160000_recurring_templates_phase1_extensions.sql
-- ============================================================
ALTER TABLE recurring_invoice_templates
  ADD COLUMN IF NOT EXISTS delivered_statuses text[] NOT NULL DEFAULT '{attended}',
  ADD COLUMN IF NOT EXISTS upfront_source text CHECK (upfront_source IN ('scheduled_lessons', 'flat_fee')),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS due_date_offset_days integer,
  ADD COLUMN IF NOT EXISTS apply_credits_automatically boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_run_id uuid;

ALTER TABLE recurring_invoice_templates
  DROP CONSTRAINT IF EXISTS recurring_invoice_templates_billing_mode_check;

ALTER TABLE recurring_invoice_templates
  ADD CONSTRAINT recurring_invoice_templates_billing_mode_check
  CHECK (billing_mode IN ('delivered', 'upfront', 'hybrid'));

DROP POLICY IF EXISTS "Staff can manage templates" ON recurring_invoice_templates;
DROP POLICY IF EXISTS "Finance team can manage recurring templates" ON recurring_invoice_templates;

CREATE POLICY "Finance team manages templates"
  ON recurring_invoice_templates FOR ALL
  USING (is_org_finance_team(auth.uid(), org_id))
  WITH CHECK (is_org_finance_team(auth.uid(), org_id));

-- ============================================================
-- C2: 20260424170000_recurring_template_recipients_table.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS recurring_template_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paused_reason text,
  UNIQUE (template_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_rtr_template_active
  ON recurring_template_recipients (template_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_rtr_student
  ON recurring_template_recipients (student_id);

ALTER TABLE recurring_template_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance team manages recipients" ON recurring_template_recipients;
CREATE POLICY "Finance team manages recipients"
  ON recurring_template_recipients FOR ALL
  USING (is_org_finance_team(auth.uid(), org_id))
  WITH CHECK (is_org_finance_team(auth.uid(), org_id));

-- ============================================================
-- C3: 20260424180000_recurring_template_items_table.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS recurring_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  tax_code text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rti_template
  ON recurring_template_items (template_id, order_index);

ALTER TABLE recurring_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance team manages items" ON recurring_template_items;
CREATE POLICY "Finance team manages items"
  ON recurring_template_items FOR ALL
  USING (is_org_finance_team(auth.uid(), org_id))
  WITH CHECK (is_org_finance_team(auth.uid(), org_id));

-- ============================================================
-- C4: 20260424190000_recurring_template_runs_tables.sql
-- ============================================================
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

ALTER TABLE recurring_invoice_templates
  DROP CONSTRAINT IF EXISTS recurring_invoice_templates_last_run_id_fkey;

ALTER TABLE recurring_invoice_templates
  ADD CONSTRAINT recurring_invoice_templates_last_run_id_fkey
  FOREIGN KEY (last_run_id) REFERENCES recurring_template_runs(id) ON DELETE SET NULL;

-- ============================================================
-- C5: 20260424200000_invoices_recurring_extensions.sql
-- ============================================================
DO $$
DECLARE
  _dup_count integer;
BEGIN
  SELECT COUNT(*) INTO _dup_count FROM (
    SELECT linked_lesson_id
    FROM invoice_items
    WHERE linked_lesson_id IS NOT NULL
    GROUP BY linked_lesson_id
    HAVING COUNT(*) > 1
  ) dupes;

  IF _dup_count > 0 THEN
    RAISE EXCEPTION
      'Duplicate linked_lesson_id values exist (% groups); partial unique index would fail. Reconcile data first.',
      _dup_count;
  END IF;
END $$;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS generated_from_template_id uuid
    REFERENCES recurring_invoice_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generated_from_run_id uuid
    REFERENCES recurring_template_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_from_template
  ON invoices (generated_from_template_id)
  WHERE generated_from_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_from_run
  ON invoices (generated_from_run_id)
  WHERE generated_from_run_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_items_linked_lesson_unique
  ON invoice_items (linked_lesson_id)
  WHERE linked_lesson_id IS NOT NULL;

-- ============================================================
-- C6: 20260424210000_recurring_templates_phase1_pause_existing.sql
-- ============================================================
UPDATE recurring_invoice_templates
SET active = false,
    notes = COALESCE(notes || ' | ', '') || 'Auto-paused 24 April 2026 — recurring billing feature rebuilt in Phase 1 schema; please reconfigure recipients and items before resuming.',
    updated_at = now()
WHERE active = true
  AND (notes IS NULL OR notes NOT LIKE '%Auto-paused 24 April 2026%');

NOTIFY pgrst, 'reload schema';