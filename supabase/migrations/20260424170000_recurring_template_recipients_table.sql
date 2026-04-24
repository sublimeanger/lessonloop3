-- Journey 9 Phase 1 · Commit 2
-- recurring_template_recipients: explicit per-template student list.
-- Design ref: docs/RECURRING_BILLING_DESIGN.md §2 (Recipient model, §11 decision 1).

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

NOTIFY pgrst, 'reload schema';
