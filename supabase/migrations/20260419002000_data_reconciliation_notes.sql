-- Fix 3: data_reconciliation_notes table
--
-- Documents historical data inconsistencies found during the 18 April
-- 2026 billing coherence audit, without mutating the underlying rows.
--
-- Two clusters identified in tonight's Section 5 diagnostics:
--
-- Cluster A (15 rows): invoices LL-2026-00027..00031 dated 11 April 2026,
-- paid_minor populated with no corresponding payment rows. Pattern
-- consistent with seed-demo-data writing paid_minor directly without
-- creating payments. Ledger identity fails: paid_minor > 0 but
-- SUM(payments) = 0.
--
-- Cluster B (6 rows): invoices voided before the A5 trigger shipped
-- (17 April 2026). Payment rows exist but paid_minor = 0. These were
-- direct-SQL voids that zeroed paid_minor without refunding payments.
-- Ledger identity fails: paid_minor = 0 but SUM(payments) > 0.
--
-- Rationale for NOT mutating:
-- - Fix 1+4 (record_manual_payment + recalculate_invoice_paid hardening)
--   and Fix 2 (void_invoice billing_run clear) prevent any new
--   divergence from this point forward.
-- - Changing historical paid_minor on Cluster B would alter teacher-
--   facing historical reports 3+ weeks after the fact with no
--   explanation. Invoices are voided; parents do not see them.
-- - Changing Cluster A paid_minor would alter demo/seed UX if those
--   invoices belong to a demo org.
-- - The 21 rows are a closed historical set. Documenting is sufficient.

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

-- Populate Cluster A: phantom paid_minor (invoices with paid_minor > 0
-- but zero payments and zero refunds)
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

-- Populate Cluster B: orphan payments (voided invoices with paid_minor = 0
-- but payment rows exist)
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

-- Sanity: the two inserts should cover exactly the 21 rows from the
-- Section 5 diagnostic. Verify via:
-- SELECT issue_class, COUNT(*) FROM data_reconciliation_notes
-- WHERE discovered_during = '2026-04-18 billing coherence audit'
-- GROUP BY issue_class;

NOTIFY pgrst, 'reload schema';

COMMIT;
