-- Cluster B cleanup: wipe test invoices + drop reconciliation table.
--
-- With zero real customers, documenting historical test data is
-- ceremonial. Better to wipe cleanly so production launch starts with
-- a known-clean DB.
--
-- What gets deleted:
-- - 15 phantom_paid_minor invoices (LL-2026-00027..00031 across 3
--   demo Crescendo orgs)
-- - 4 voided-with-payments invoices + their payment rows
-- - The data_reconciliation_notes table itself
--
-- What stays:
-- - Fix 1+4 and Fix 2 RPC improvements (these are logic, not data)
-- - All other invoices, payments, refunds
-- - All RLS policies, triggers, functions

BEGIN;

-- Delete payments linked to voided invoices that had unrefunded payments.
-- These are the 4 Cluster B invoices.
DELETE FROM payments
WHERE invoice_id IN (
  SELECT id FROM invoices
  WHERE status = 'void'
  AND EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = invoices.id)
);

-- Delete the 4 voided-with-payments invoices.
DELETE FROM invoices
WHERE status = 'void'
AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = invoices.id)
AND id IN (
  SELECT entity_id FROM data_reconciliation_notes
  WHERE issue_class = 'voided_with_unrefunded_payments'
);

-- Delete the 15 phantom_paid_minor invoices (paid_minor > 0 with no
-- payments and no refunds).
DELETE FROM invoice_items
WHERE invoice_id IN (
  SELECT id FROM invoices
  WHERE paid_minor > 0
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = invoices.id)
    AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.invoice_id = invoices.id)
);

DELETE FROM invoice_installments
WHERE invoice_id IN (
  SELECT id FROM invoices
  WHERE paid_minor > 0
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = invoices.id)
    AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.invoice_id = invoices.id)
);

DELETE FROM invoices
WHERE paid_minor > 0
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = invoices.id)
  AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.invoice_id = invoices.id);

-- Drop the reconciliation notes table — no longer needed.
DROP TABLE IF EXISTS data_reconciliation_notes CASCADE;

-- Sanity-check invariants post-cleanup. Raise if anything unexpected.
DO $$
DECLARE
  _phantom_count integer;
  _orphan_count integer;
  _divergent_count integer;
BEGIN
  -- Should be 0 phantom paid_minor remaining
  SELECT COUNT(*) INTO _phantom_count
  FROM invoices
  WHERE paid_minor > 0
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = invoices.id)
    AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.invoice_id = invoices.id);

  IF _phantom_count > 0 THEN
    RAISE EXCEPTION 'Phantom paid_minor cleanup incomplete: % rows remain', _phantom_count;
  END IF;

  -- Should be 0 voided invoices with payments
  SELECT COUNT(*) INTO _orphan_count
  FROM invoices
  WHERE status = 'void'
  AND EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = invoices.id);

  IF _orphan_count > 0 THEN
    RAISE EXCEPTION 'Voided-with-payments cleanup incomplete: % rows remain', _orphan_count;
  END IF;

  -- Ledger identity check across all remaining invoices
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
