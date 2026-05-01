-- 20260516095000: drop dead 'cancelled' invoice_status references from three RPCs.

CREATE OR REPLACE FUNCTION public.recalculate_invoice_paid(_invoice_id uuid)
RETURNS json
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice record; _total_paid integer; _total_refunded integer;
  _net_paid integer; _new_status text; _overpayment integer; _inst_row record;
BEGIN
  SELECT id, org_id, total_minor, status, due_date INTO _invoice
  FROM invoices WHERE id = _invoice_id FOR UPDATE;
  IF _invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF auth.uid() IS NOT NULL AND NOT is_org_finance_team(auth.uid(), _invoice.org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_paid FROM payments WHERE invoice_id = _invoice_id;
  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_refunded FROM refunds WHERE invoice_id = _invoice_id AND status = 'succeeded';
  _net_paid := _total_paid - _total_refunded;
  _overpayment := GREATEST(0, _net_paid - _invoice.total_minor);
  _new_status := _invoice.status;
  IF _invoice.status != 'void' THEN
    IF _net_paid >= _invoice.total_minor THEN
      _new_status := 'paid';
    ELSIF _invoice.status = 'paid' AND _net_paid < _invoice.total_minor THEN
      IF _invoice.due_date IS NOT NULL AND _invoice.due_date < CURRENT_DATE THEN
        _new_status := 'overdue';
      ELSE
        _new_status := 'sent';
      END IF;
    END IF;
  END IF;
  UPDATE invoices
    SET paid_minor = _net_paid, status = _new_status::invoice_status, overpayment_minor = _overpayment
    WHERE id = _invoice_id;
  FOR _inst_row IN
    SELECT id FROM invoice_installments WHERE invoice_id = _invoice_id AND status != 'void'
  LOOP
    PERFORM recalculate_installment_status(_inst_row.id);
  END LOOP;
  RETURN json_build_object(
    'net_paid', _net_paid, 'total_minor', _invoice.total_minor,
    'new_status', _new_status, 'overpayment_minor', _overpayment
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_installment_payment(
  p_installment_id uuid,
  p_amount_minor integer,
  p_stripe_payment_intent_id text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _installment RECORD;
  _invoice RECORD;
  _total_inst_paid INTEGER;
  _all_paid BOOLEAN;
  _net_paid INTEGER;
  _total_refunded INTEGER;
BEGIN
  SELECT * INTO _installment FROM invoice_installments
    WHERE id = p_installment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found';
  END IF;

  IF _installment.status NOT IN ('pending', 'overdue') THEN
    RAISE EXCEPTION 'Installment is not payable (status: %)', _installment.status;
  END IF;

  SELECT * INTO _invoice FROM invoices
    WHERE id = _installment.invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent invoice not found';
  END IF;

  IF _invoice.status = 'void' THEN
    RETURN json_build_object('skipped', true, 'reason', 'Invoice is ' || _invoice.status);
  END IF;

  UPDATE invoice_installments SET
    status = 'paid',
    paid_at = NOW(),
    stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id)
  WHERE id = p_installment_id;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _net_paid
  FROM payments WHERE invoice_id = _installment.invoice_id;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_refunded
  FROM refunds WHERE invoice_id = _installment.invoice_id AND status = 'succeeded';

  _net_paid := _net_paid - _total_refunded;

  SELECT NOT EXISTS (
    SELECT 1 FROM invoice_installments
    WHERE invoice_id = _installment.invoice_id
      AND status IN ('pending', 'overdue')
  ) INTO _all_paid;

  IF _all_paid AND _net_paid >= _invoice.total_minor THEN
    UPDATE invoices SET paid_minor = _net_paid, status = 'paid'
    WHERE id = _installment.invoice_id;
  ELSE
    UPDATE invoices SET paid_minor = _net_paid
    WHERE id = _installment.invoice_id;
  END IF;

  RETURN json_build_object(
    'installment_id', p_installment_id,
    'invoice_id', _installment.invoice_id,
    'all_paid', _all_paid,
    'net_paid', _net_paid,
    'new_status', CASE WHEN _all_paid AND _net_paid >= _invoice.total_minor THEN 'paid' ELSE _invoice.status END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_stripe_payment(
  _invoice_id uuid,
  _org_id uuid,
  _amount_minor integer,
  _provider_reference text,
  _installment_id uuid DEFAULT NULL::uuid,
  _pay_remaining boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice record;
  _existing_payment_id uuid;
  _payment_id uuid;
  _inst_row record;
  _recalc_result json;
BEGIN
  SELECT id, org_id, total_minor, paid_minor, status, due_date
  INTO _invoice
  FROM invoices WHERE id = _invoice_id FOR UPDATE;
  IF _invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  IF _invoice.status = 'void' THEN
    RETURN json_build_object('skipped', true, 'reason', 'Invoice is ' || _invoice.status, 'payment_id', null);
  END IF;

  SELECT id INTO _existing_payment_id FROM payments WHERE provider_reference = _provider_reference;
  IF _existing_payment_id IS NOT NULL THEN
    _recalc_result := recalculate_invoice_paid(_invoice_id);
    RETURN json_build_object(
      'payment_id', _existing_payment_id,
      'duplicate', true,
      'net_paid', (_recalc_result->>'net_paid')::integer,
      'new_status', _recalc_result->>'new_status',
      'overpayment_minor', (_recalc_result->>'overpayment_minor')::integer
    );
  END IF;

  INSERT INTO payments (invoice_id, org_id, amount_minor, method, provider, provider_reference, paid_at, installment_id)
  VALUES (_invoice_id, _org_id, _amount_minor, 'card', 'stripe', _provider_reference, NOW(), _installment_id)
  RETURNING id INTO _payment_id;

  IF _pay_remaining THEN
    FOR _inst_row IN
      SELECT id FROM invoice_installments
      WHERE invoice_id = _invoice_id AND status IN ('pending', 'overdue', 'partially_paid')
    LOOP
      PERFORM recalculate_installment_status(_inst_row.id);
    END LOOP;
  END IF;

  IF _installment_id IS NOT NULL THEN
    UPDATE invoice_installments
      SET stripe_payment_intent_id = _provider_reference,
          payment_id = COALESCE(payment_id, _payment_id),
          updated_at = NOW()
      WHERE id = _installment_id;
    PERFORM recalculate_installment_status(_installment_id);
  END IF;

  _recalc_result := recalculate_invoice_paid(_invoice_id);

  RETURN json_build_object(
    'payment_id', _payment_id,
    'duplicate', false,
    'net_paid', (_recalc_result->>'net_paid')::integer,
    'new_status', _recalc_result->>'new_status',
    'overpayment_minor', (_recalc_result->>'overpayment_minor')::integer
  );
END;
$$;

NOTIFY pgrst, 'reload schema';