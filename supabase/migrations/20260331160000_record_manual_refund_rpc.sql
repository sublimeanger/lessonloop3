-- ============================================================
-- FIN-C2: record_manual_refund RPC
-- Replaces direct INSERT into refunds table (blocked by RLS)
-- with a SECURITY DEFINER RPC that validates auth + business rules.
-- ============================================================

CREATE OR REPLACE FUNCTION record_manual_refund(
  _payment_id UUID,
  _invoice_id UUID,
  _org_id UUID,
  _amount_minor INTEGER DEFAULT NULL,
  _reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  _payment RECORD;
  _invoice RECORD;
  _total_refunded INTEGER;
  _max_refundable INTEGER;
  _refund_amount INTEGER;
  _refund_id UUID;
BEGIN
  -- Auth check: must be finance team
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to process refunds';
  END IF;

  -- Fetch and lock payment
  SELECT id, invoice_id, org_id, amount_minor, method
  INTO _payment
  FROM payments
  WHERE id = _payment_id AND org_id = _org_id
  FOR UPDATE;

  IF _payment IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  -- Check invoice status
  SELECT id, status INTO _invoice
  FROM invoices WHERE id = _invoice_id FOR UPDATE;

  IF _invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF _invoice.status = 'void' THEN RAISE EXCEPTION 'Cannot refund a voided invoice'; END IF;
  IF _invoice.status = 'draft' THEN RAISE EXCEPTION 'Cannot refund an unpaid invoice'; END IF;

  -- Calculate refundable amount
  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_refunded
  FROM refunds
  WHERE payment_id = _payment_id AND status = 'succeeded';

  _max_refundable := _payment.amount_minor - _total_refunded;

  IF _max_refundable <= 0 THEN
    RAISE EXCEPTION 'Payment already fully refunded';
  END IF;

  _refund_amount := COALESCE(_amount_minor, _max_refundable);
  IF _refund_amount <= 0 THEN RAISE EXCEPTION 'Refund amount must be positive'; END IF;
  IF _refund_amount > _max_refundable THEN
    RAISE EXCEPTION 'Refund amount (%) exceeds refundable amount (%)', _refund_amount, _max_refundable;
  END IF;

  -- Insert refund
  INSERT INTO refunds (payment_id, invoice_id, org_id, amount_minor, reason, status, refunded_by)
  VALUES (_payment_id, _invoice_id, _org_id, _refund_amount, _reason, 'succeeded', auth.uid())
  RETURNING id INTO _refund_id;

  -- Recalculate invoice
  PERFORM recalculate_invoice_paid(_invoice_id);

  -- Audit log
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'manual_refund_recorded', 'invoice', _invoice_id,
    jsonb_build_object('refund_id', _refund_id, 'payment_id', _payment_id,
      'amount_minor', _refund_amount, 'reason', _reason));

  RETURN json_build_object(
    'success', true,
    'refund_id', _refund_id,
    'amount_minor', _refund_amount,
    'status', 'succeeded'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_manual_refund TO authenticated;
