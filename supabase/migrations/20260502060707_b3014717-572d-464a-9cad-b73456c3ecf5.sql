-- CW-F9 follow-up: one-row remediation for LL-2026-00008
--
-- Why
-- ---
-- The CW-F9 backfill (in 20260516110000_canary_walk_batch_1z_corrected.sql)
-- correctly allocated the orphan payment to pending installments by
-- (due_date ASC, id ASC). However for LL-2026-00008
-- (d7041eeb-6e4d-488a-af82-5c7a70cafea8), the legacy code path that
-- originally wrote the payment had marked inst #1 as status='paid'
-- WITHOUT attaching a payment row to it (a pre-CW-F9 RPC bug).
-- The backfill's WHERE status IN ('pending', 'overdue', 'partially_paid')
-- filter therefore skipped inst #1, allocating to inst #2 and #3 instead.
-- The downstream recalculate_installment_status fan-out then demoted
-- inst #1 from 'paid' to 'pending' (zero payments attached).
--
-- Net effect: cash moved off the earliest-due installment.
--
-- This migration corrects the allocation by moving the two existing
-- payment rows to attach to inst #1 (3333) and inst #2 (1667),
-- then re-running recalculate_installment_status on all three to
-- propagate.
--
-- Idempotent: pre-flight guard checks the affected invoice's current
-- state matches the broken state before remediating. If state has
-- already been corrected (or no longer matches), the migration is
-- a no-op.
DO $$
DECLARE
  _invoice_id uuid := 'd7041eeb-6e4d-488a-af82-5c7a70cafea8';
  _inst_1_id uuid;
  _inst_2_id uuid;
  _inst_3_id uuid;
  _payment_3333_id uuid;
  _payment_1667_id uuid;
  _current_drift integer;
BEGIN
  SELECT i.paid_minor - COALESCE((
    SELECT SUM(amount_minor) FROM invoice_installments
    WHERE invoice_id = i.id AND status = 'paid'
  ), 0) INTO _current_drift
  FROM invoices i
  WHERE i.id = _invoice_id;

  IF _current_drift IS NULL OR _current_drift = 0 THEN
    RAISE NOTICE 'CW-F9 LL-2026-00008 remediation: invoice not in broken state, skipping';
    RETURN;
  END IF;

  SELECT id INTO _inst_1_id FROM invoice_installments
    WHERE invoice_id = _invoice_id AND installment_number = 1;
  SELECT id INTO _inst_2_id FROM invoice_installments
    WHERE invoice_id = _invoice_id AND installment_number = 2;
  SELECT id INTO _inst_3_id FROM invoice_installments
    WHERE invoice_id = _invoice_id AND installment_number = 3;

  SELECT id INTO _payment_3333_id FROM payments
    WHERE invoice_id = _invoice_id
      AND amount_minor = 3333
      AND installment_id = _inst_2_id;
  SELECT id INTO _payment_1667_id FROM payments
    WHERE invoice_id = _invoice_id
      AND amount_minor = 1667
      AND installment_id = _inst_3_id;

  IF _payment_3333_id IS NULL OR _payment_1667_id IS NULL THEN
    RAISE EXCEPTION 'CW-F9 LL-2026-00008 remediation: expected payment rows not found; state has shifted, ABORTING';
  END IF;

  UPDATE payments SET installment_id = _inst_1_id WHERE id = _payment_3333_id;
  UPDATE payments SET installment_id = _inst_2_id WHERE id = _payment_1667_id;

  PERFORM recalculate_installment_status(_inst_1_id);
  PERFORM recalculate_installment_status(_inst_2_id);
  PERFORM recalculate_installment_status(_inst_3_id);

  RAISE NOTICE 'CW-F9 LL-2026-00008 remediation: payments reallocated to inst #1 (3333) and inst #2 (1667); installment statuses recalculated';
END $$;