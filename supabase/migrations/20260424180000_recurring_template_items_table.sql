-- Journey 9 Phase 1 · Commit 3
-- recurring_template_items: flat line items for hybrid and flat-fee-upfront templates.
-- Design ref: docs/RECURRING_BILLING_DESIGN.md §2.

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

NOTIFY pgrst, 'reload schema';
