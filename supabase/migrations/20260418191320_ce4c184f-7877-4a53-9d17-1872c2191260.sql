BEGIN;

CREATE TABLE IF NOT EXISTS data_reconciliation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logged_at timestamptz NOT NULL DEFAULT now(),
  discovered_during text NOT NULL,
  issue_class text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  org_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  remediation text,
  CONSTRAINT data_reconciliation_notes_issue_class_chk 
    CHECK (issue_class IN (
      'ledger_identity_divergence',
      'orphan_payment',
      'phantom_paid_minor',
      'other'
    ))
);

CREATE INDEX IF NOT EXISTS idx_data_reconciliation_notes_entity 
  ON data_reconciliation_notes (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_data_reconciliation_notes_org 
  ON data_reconciliation_notes (org_id);

COMMENT ON TABLE data_reconciliation_notes IS
'Documents known historical data inconsistencies. Append-only log — do not mutate historical business data; document it here instead.';

INSERT INTO data_reconciliation_notes (
  discovered_during, issue_class, entity_type, entity_id, org_id, 
  details, remediation
)
SELECT 
  '2026-04-18 billing coherence audit',
  'phantom_paid_minor',
  'invoice',
  i.id,
  i.org_id,
  jsonb_build_object(
    'invoice_number', i.invoice_number,
    'invoice_status', i.status,
    'paid_minor_recorded', i.paid_minor,
    'payments_sum', 0,
    'refunds_sum', 0,
    'total_minor', i.total_minor,
    'created_at', i.created_at
  ),
  'No remediation. Fix 1+4 prevents recurrence. Historical row left as-is.'
FROM invoices i
WHERE i.paid_minor > 0
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = i.id)
  AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.invoice_id = i.id);

INSERT INTO data_reconciliation_notes (
  discovered_during, issue_class, entity_type, entity_id, org_id, 
  details, remediation
)
SELECT 
  '2026-04-18 billing coherence audit',
  'orphan_payment',
  'invoice',
  i.id,
  i.org_id,
  jsonb_build_object(
    'invoice_number', i.invoice_number,
    'invoice_status', i.status,
    'paid_minor_recorded', i.paid_minor,
    'payments_sum', (SELECT COALESCE(SUM(p.amount_minor), 0) FROM payments p WHERE p.invoice_id = i.id),
    'payments_count', (SELECT COUNT(*) FROM payments p WHERE p.invoice_id = i.id),
    'total_minor', i.total_minor,
    'voided_before_a5_trigger', true,
    'created_at', i.created_at
  ),
  'No remediation. Invoices voided before A5 trigger existed (17 April 2026). Fix 2 prevents recurrence. Historical row left as-is; payments remain linked to voided invoice.'
FROM invoices i
WHERE i.status = 'void'
  AND i.paid_minor = 0
  AND EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = i.id);

-- Enable RLS — append-only audit table, finance team read-only
ALTER TABLE data_reconciliation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance team can read reconciliation notes"
  ON data_reconciliation_notes
  FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL OR is_org_finance_team(auth.uid(), org_id)
  );

NOTIFY pgrst, 'reload schema';

COMMIT;