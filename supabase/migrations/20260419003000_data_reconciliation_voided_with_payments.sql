-- Fix 3b: Correct the Cluster B documentation.
--
-- Fix 3 (20260419002000) used a stale predicate (paid_minor = 0 on
-- voided invoices). Live data shows 4 voided invoices where paid_minor
-- correctly equals payments_sum — ledger identity holds — but the
-- invoices were voided without the payments being refunded. A5 trigger
-- (17 April 2026) now blocks this pattern.
--
-- These are a distinct anomaly class from orphan_payment: not a ledger
-- identity failure, but a policy failure. Money was received, invoice
-- was voided, money was never returned.
--
-- Also adds the data_reconciliation_notes RLS policy that should have
-- been part of Fix 3.

BEGIN;

-- Extend issue_class CHECK to include new category
ALTER TABLE data_reconciliation_notes
  DROP CONSTRAINT IF EXISTS data_reconciliation_notes_issue_class_chk;

ALTER TABLE data_reconciliation_notes
  ADD CONSTRAINT data_reconciliation_notes_issue_class_chk
  CHECK (issue_class IN (
    'ledger_identity_divergence',
    'orphan_payment',
    'phantom_paid_minor',
    'voided_with_unrefunded_payments',
    'other'
  ));

-- Log the 4 voided-with-payments anomalies
INSERT INTO data_reconciliation_notes (
  discovered_during, issue_class, entity_type, entity_id, org_id,
  details, remediation
)
SELECT
  '2026-04-18 billing coherence audit',
  'voided_with_unrefunded_payments',
  'invoice',
  i.id,
  i.org_id,
  jsonb_build_object(
    'invoice_number', i.invoice_number,
    'invoice_status', i.status,
    'paid_minor', i.paid_minor,
    'payments_sum', (SELECT COALESCE(SUM(p.amount_minor), 0) FROM payments p WHERE p.invoice_id = i.id),
    'payments_count', (SELECT COUNT(*) FROM payments p WHERE p.invoice_id = i.id),
    'refunds_sum', (SELECT COALESCE(SUM(r.amount_minor), 0) FROM refunds r WHERE r.invoice_id = i.id AND r.status = 'succeeded'),
    'total_minor', i.total_minor,
    'voided_before_a5_trigger', true,
    'created_at', i.created_at
  ),
  'Ledger identity holds (paid_minor = payments_sum). However, invoice was voided before A5 trigger (17 April 2026) without refunding the payments — a policy violation. Money received and retained by org. A5 guard now blocks this path. Historical row left as-is; any actual refund should be recorded through record_manual_refund against the original invoice if required.'
FROM invoices i
WHERE i.status = 'void'
  AND EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = i.id)
  AND NOT EXISTS (
    SELECT 1 FROM data_reconciliation_notes drn
    WHERE drn.entity_type = 'invoice'
      AND drn.entity_id = i.id
      AND drn.issue_class = 'voided_with_unrefunded_payments'
  );

-- Add the RLS SELECT policy that Fix 3 should have included.
-- Idempotent via DROP IF EXISTS.
ALTER TABLE data_reconciliation_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance team can read reconciliation notes"
  ON data_reconciliation_notes;

CREATE POLICY "Finance team can read reconciliation notes"
  ON data_reconciliation_notes
  FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL OR is_org_finance_team(auth.uid(), org_id)
  );

-- No INSERT/UPDATE/DELETE policies — table is admin-write-only via
-- migrations. Future operational inserts would go via a dedicated RPC
-- if needed.

NOTIFY pgrst, 'reload schema';

COMMIT;
