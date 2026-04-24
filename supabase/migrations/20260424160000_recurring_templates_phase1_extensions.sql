-- Journey 9 Phase 1 · Commit 1
-- Recurring billing template schema extensions + J9-F2 policy reconciliation.
-- Design ref: docs/RECURRING_BILLING_DESIGN.md §2.

-- 1. Extend recurring_invoice_templates with Phase 1 config columns.
--    last_run_id FK added in Phase 1 Commit 4 (after recurring_template_runs exists).
ALTER TABLE recurring_invoice_templates
  ADD COLUMN IF NOT EXISTS delivered_statuses text[] NOT NULL DEFAULT '{attended}',
  ADD COLUMN IF NOT EXISTS upfront_source text CHECK (upfront_source IN ('scheduled_lessons', 'flat_fee')),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS due_date_offset_days integer,
  ADD COLUMN IF NOT EXISTS apply_credits_automatically boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_run_id uuid;

-- 2. Amend billing_mode CHECK to allow 'hybrid' (was 'delivered'|'upfront' from 20260224200200).
ALTER TABLE recurring_invoice_templates
  DROP CONSTRAINT IF EXISTS recurring_invoice_templates_billing_mode_check;

ALTER TABLE recurring_invoice_templates
  ADD CONSTRAINT recurring_invoice_templates_billing_mode_check
  CHECK (billing_mode IN ('delivered', 'upfront', 'hybrid'));

-- 3. J9-F2 policy reconciliation.
--    Migration 20260224200200 created "Staff can manage templates" (is_org_staff).
--    Migration 20260225001655 then added "Finance team can manage recurring templates" (is_org_finance_team).
--    Both policies currently exist; FOR ALL with OR semantics means staff-tier gate wins
--    (teachers currently have write access, contradicting design decision 1).
--    Canonicalise to finance-team-only per Phase 0 locked decision 1.
DROP POLICY IF EXISTS "Staff can manage templates" ON recurring_invoice_templates;
DROP POLICY IF EXISTS "Finance team can manage recurring templates" ON recurring_invoice_templates;

CREATE POLICY "Finance team manages templates"
  ON recurring_invoice_templates FOR ALL
  USING (is_org_finance_team(auth.uid(), org_id))
  WITH CHECK (is_org_finance_team(auth.uid(), org_id));

-- Note: scheduler due-date index already exists from 20260224200200
-- (idx_recurring_templates_next_run ON recurring_invoice_templates(next_run_date) WHERE active = true).
-- Not re-creating under a different name.

NOTIFY pgrst, 'reload schema';
