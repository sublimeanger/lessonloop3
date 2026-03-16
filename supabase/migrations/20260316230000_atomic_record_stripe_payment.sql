-- ============================================================
-- PAY-H1: Atomic Stripe payment recording
-- Audit: audit-feature-13-stripe-payments.md
--
-- Combines payment insert + installment reconciliation +
-- recalculate_invoice_paid into a single transaction with
-- FOR UPDATE row locking. Idempotent: returns existing payment
-- if provider_reference already exists.
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_stripe_payment(
  _invoice_id uuid,
  _org_id uuid,
  _amount_minor integer,
  _provider_reference text,
  _installment_id uuid DEFAULT NULL,
  _pay_remaining boolean DEFAULT false
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _invoice record;
  _existing_payment_id uuid;
  _payment_id uuid;
  _total_paid integer;
  _total_refunded integer;
  _net_paid integer;
  _new_status text;
BEGIN
  -- Lock the invoice row to prevent concurrent payment races
  SELECT id, org_id, total_minor, status INTO _invoice
  FROM invoices WHERE id = _invoice_id FOR UPDATE;

  IF _invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Guard: skip payment on voided or cancelled invoices
  IF _invoice.status IN ('void', 'cancelled') THEN
    RETURN json_build_object(
      'skipped', true,
      'reason', 'Invoice is ' || _invoice.status,
      'payment_id', null
    );
  END IF;

  -- Idempotency: if payment with this provider_reference already exists, return it
  SELECT id INTO _existing_payment_id
  FROM payments WHERE provider_reference = _provider_reference;

  IF _existing_payment_id IS NOT NULL THEN
    -- Payment already recorded — just ensure recalc is up to date
    SELECT COALESCE(SUM(amount_minor), 0) INTO _total_paid
    FROM payments WHERE invoice_id = _invoice_id;

    SELECT COALESCE(SUM(amount_minor), 0) INTO _total_refunded
    FROM refunds WHERE invoice_id = _invoice_id AND status = 'succeeded';

    _net_paid := _total_paid - _total_refunded;

    _new_status := _invoice.status;
    IF _invoice.status NOT IN ('void', 'cancelled') THEN
      IF _net_paid >= _invoice.total_minor THEN
        _new_status := 'paid';
      ELSIF _invoice.status = 'paid' AND _net_paid < _invoice.total_minor THEN
        _new_status := 'sent';
      END IF;
    END IF;

    UPDATE invoices SET paid_minor = _net_paid, status = _new_status WHERE id = _invoice_id;

    RETURN json_build_object(
      'payment_id', _existing_payment_id,
      'duplicate', true,
      'net_paid', _net_paid,
      'new_status', _new_status
    );
  END IF;

  -- Insert the payment
  INSERT INTO payments (invoice_id, org_id, amount_minor, method, provider, provider_reference, paid_at, installment_id)
  VALUES (_invoice_id, _org_id, _amount_minor, 'card', 'stripe', _provider_reference, NOW(), _installment_id)
  RETURNING id INTO _payment_id;

  -- Installment reconciliation
  IF _pay_remaining THEN
    UPDATE invoice_installments
    SET status = 'paid', paid_at = NOW()
    WHERE invoice_id = _invoice_id AND status IN ('pending', 'overdue');
  END IF;

  IF _installment_id IS NOT NULL THEN
    UPDATE invoice_installments
    SET stripe_payment_intent_id = _provider_reference, status = 'paid', paid_at = NOW()
    WHERE id = _installment_id;
  END IF;

  -- Recalculate paid_minor (same logic as recalculate_invoice_paid)
  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_paid
  FROM payments WHERE invoice_id = _invoice_id;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_refunded
  FROM refunds WHERE invoice_id = _invoice_id AND status = 'succeeded';

  _net_paid := _total_paid - _total_refunded;

  _new_status := _invoice.status;
  IF _invoice.status NOT IN ('void', 'cancelled') THEN
    IF _net_paid >= _invoice.total_minor THEN
      _new_status := 'paid';
    ELSIF _invoice.status = 'paid' AND _net_paid < _invoice.total_minor THEN
      _new_status := 'sent';
    END IF;
  END IF;

  UPDATE invoices SET paid_minor = _net_paid, status = _new_status WHERE id = _invoice_id;

  RETURN json_build_object(
    'payment_id', _payment_id,
    'duplicate', false,
    'net_paid', _net_paid,
    'total_minor', _invoice.total_minor,
    'new_status', _new_status
  );
END;
$$;
