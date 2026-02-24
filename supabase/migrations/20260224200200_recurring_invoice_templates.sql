CREATE TABLE IF NOT EXISTS recurring_invoice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'termly')),
  billing_mode text NOT NULL DEFAULT 'delivered' CHECK (billing_mode IN ('delivered', 'upfront')),
  auto_send boolean DEFAULT false,
  next_run_date date NOT NULL,
  last_run_at timestamptz,
  last_run_status text CHECK (last_run_status IN ('completed', 'partial', 'failed')),
  last_run_invoice_count integer DEFAULT 0,
  active boolean DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_recurring_templates_org ON recurring_invoice_templates(org_id);
CREATE INDEX idx_recurring_templates_next_run ON recurring_invoice_templates(next_run_date) WHERE active = true;

ALTER TABLE recurring_invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage templates"
  ON recurring_invoice_templates FOR ALL
  USING (is_org_staff(auth.uid(), org_id));
