BEGIN;

-- Identify the 6 Pattern A invoices by predicate into a temp table
CREATE TEMP TABLE _pattern_a_invoices ON COMMIT DROP AS
SELECT i.id
FROM invoices i
WHERE i.status = 'paid'
  AND i.paid_minor = 0
  AND (SELECT COALESCE(SUM(p.amount_minor), 0) FROM payments p WHERE p.invoice_id = i.id) > 0;

-- ============================================================
-- Pattern A wipe (6 invoices: status='paid' but paid_minor=0)
-- Delete in FK order: installments -> items -> payments -> refunds -> invoices
-- ============================================================
DELETE FROM invoice_installments
WHERE invoice_id IN (SELECT id FROM _pattern_a_invoices);

DELETE FROM invoice_items
WHERE invoice_id IN (SELECT id FROM _pattern_a_invoices);

DELETE FROM payments
WHERE invoice_id IN (SELECT id FROM _pattern_a_invoices);

DELETE FROM refunds
WHERE invoice_id IN (SELECT id FROM _pattern_a_invoices);

DELETE FROM invoices
WHERE id IN (SELECT id FROM _pattern_a_invoices);

-- ============================================================
-- Cluster B: voided-with-payments (4 invoices)
-- Need to clear installments first (FK on payment_id), then payments, items, invoices
-- ============================================================
CREATE TEMP TABLE _voided_with_payments ON COMMIT DROP AS
SELECT id FROM invoices
WHERE status = 'void'
  AND EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = invoices.id);

DELETE FROM invoice_installments
WHERE invoice_id IN (SELECT id FROM _voided_with_payments);

DELETE FROM invoice_items
WHERE invoice_id IN (SELECT id FROM _voided_with_payments);

DELETE FROM payments
WHERE invoice_id IN (SELECT id FROM _voided_with_payments);

DELETE FROM refunds
WHERE invoice_id IN (SELECT id FROM _voided_with_payments);

DELETE FROM invoices
WHERE id IN (SELECT id FROM _voided_with_payments);

-- ============================================================
-- Cluster B: phantom paid_minor (15 invoices: paid_minor>0, no payments, no refunds)
-- ============================================================
CREATE TEMP TABLE _phantom_invoices ON COMMIT DROP AS
SELECT id FROM invoices
WHERE paid_minor > 0
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = invoices.id)
  AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.invoice_id = invoices.id);

DELETE FROM invoice_installments
WHERE invoice_id IN (SELECT id FROM _phantom_invoices);

DELETE FROM invoice_items
WHERE invoice_id IN (SELECT id FROM _phantom_invoices);

DELETE FROM invoices
WHERE id IN (SELECT id FROM _phantom_invoices);

-- ============================================================
-- Drop the temporary reconciliation notes table
-- ============================================================
DROP TABLE IF EXISTS data_reconciliation_notes CASCADE;

-- ============================================================
-- Sanity checks
-- ============================================================
DO $$
DECLARE
  _phantom_count integer;
  _orphan_count integer;
  _divergent_count integer;
  _pattern_a_count integer;
BEGIN
  SELECT COUNT(*) INTO _phantom_count
  FROM invoices
  WHERE paid_minor > 0
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = invoices.id)
    AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.invoice_id = invoices.id);

  IF _phantom_count > 0 THEN
    RAISE EXCEPTION 'Phantom paid_minor cleanup incomplete: % rows remain', _phantom_count;
  END IF;

  SELECT COUNT(*) INTO _orphan_count
  FROM invoices
  WHERE status = 'void'
  AND EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = invoices.id);

  IF _orphan_count > 0 THEN
    RAISE EXCEPTION 'Voided-with-payments cleanup incomplete: % rows remain', _orphan_count;
  END IF;

  SELECT COUNT(*) INTO _pattern_a_count
  FROM invoices i
  WHERE i.status = 'paid'
    AND i.paid_minor = 0
    AND (SELECT COALESCE(SUM(p.amount_minor), 0) FROM payments p WHERE p.invoice_id = i.id) > 0;

  IF _pattern_a_count > 0 THEN
    RAISE EXCEPTION 'Pattern A cleanup incomplete: % rows remain', _pattern_a_count;
  END IF;

  SELECT COUNT(*) INTO _divergent_count
  FROM invoices i
  WHERE i.paid_minor != (
    COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.invoice_id = i.id), 0)
    - COALESCE((SELECT SUM(r.amount_minor) FROM refunds r WHERE r.invoice_id = i.id AND r.status = 'succeeded'), 0)
  );

  IF _divergent_count > 0 THEN
    RAISE EXCEPTION 'Ledger identity still fails on % invoices after cleanup', _divergent_count;
  END IF;

  RAISE NOTICE 'Cleanup complete. Ledger identity holds on all remaining invoices.';
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;