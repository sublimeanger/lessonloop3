BEGIN;

ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS overpayment_minor integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN invoices.overpayment_minor IS
'Excess of net_paid over total_minor. Usually 0. Non-zero only in rare Stripe overpayment race cases where the charge completed before any guard could fire. Populated by recalculate_invoice_paid on every recalc.';

CREATE INDEX IF NOT EXISTS idx_invoices_overpayment_flagged 
  ON invoices (org_id) 
  WHERE overpayment_minor > 0;

CREATE OR REPLACE FUNCTION public.record_manual_payment(
  p_invoice_id uuid,
  p_amount_minor integer,
  p_method text,
  p_paid_at timestamptz DEFAULT now(),
  p_reference text DEFAULT NULL,
  p_installment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice invoices%ROWTYPE;
  _installment invoice_installments%ROWTYPE;
  _payment_id uuid;
  _current_paid_minor integer;
  _new_paid_minor integer;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;
  IF p_method NOT IN ('card', 'bank_transfer', 'cash', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_method
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO _invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id
      USING ERRCODE = 'P0002';
  END IF;
  IF NOT is_org_finance_team(auth.uid(), _invoice.org_id) THEN
    RAISE EXCEPTION 'Not authorised'
      USING ERRCODE = '42501';
  END IF;
  IF _invoice.status IN ('draft', 'void') THEN
    RAISE EXCEPTION 'Cannot record payment against a % invoice', _invoice.status
      USING ERRCODE = '22023';
  END IF;
  _current_paid_minor := COALESCE(_invoice.paid_minor, 0);
  _new_paid_minor := _current_paid_minor + p_amount_minor;
  IF _new_paid_minor > _invoice.total_minor THEN
    RAISE EXCEPTION 'Payment of % would exceed invoice balance of %',
      p_amount_minor,
      _invoice.total_minor - _current_paid_minor
      USING ERRCODE = '22023',
            HINT = 'Reduce the payment amount to at most the outstanding balance.';
  END IF;
  IF p_installment_id IS NOT NULL THEN
    SELECT * INTO _installment 
    FROM invoice_installments 
    WHERE id = p_installment_id FOR UPDATE;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Installment % not found', p_installment_id
        USING ERRCODE = 'P0002';
    END IF;
    
    IF _installment.invoice_id != p_invoice_id THEN
      RAISE EXCEPTION 'Installment does not belong to invoice %', p_invoice_id
        USING ERRCODE = '22023';
    END IF;
    
    IF _installment.status = 'void' THEN
      RAISE EXCEPTION 'Cannot record payment against a voided installment'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  INSERT INTO payments (
    invoice_id, org_id, amount_minor, currency_code,
    method, provider, provider_reference, paid_at, installment_id
  ) VALUES (
    p_invoice_id, _invoice.org_id, p_amount_minor, _invoice.currency_code,
    p_method::payment_method, 'manual'::payment_provider,
    p_reference, p_paid_at, p_installment_id
  )
  RETURNING id INTO _payment_id;
  PERFORM recalculate_invoice_paid(p_invoice_id);
  IF p_installment_id IS NOT NULL THEN
    PERFORM recalculate_installment_status(p_installment_id);
  END IF;
  RETURN _payment_id;
END;
$$;

REVOKE ALL ON FUNCTION record_manual_payment(uuid, integer, text, timestamptz, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_manual_payment(uuid, integer, text, timestamptz, text, uuid) TO authenticated;

COMMENT ON FUNCTION record_manual_payment(uuid, integer, text, timestamptz, text, uuid) IS 
'Atomic manual payment recording. Authorisation: is_org_finance_team. Hard-rejects overpayment. Replaces direct INSERTs from RecordPaymentModal.';

CREATE OR REPLACE FUNCTION public.record_stripe_payment(
  _invoice_id uuid, _org_id uuid, _amount_minor integer, 
  _provider_reference text, _installment_id uuid DEFAULT NULL::uuid, 
  _pay_remaining boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _invoice record; _existing_payment_id uuid; _payment_id uuid;
  _total_paid integer; _total_refunded integer; _net_paid integer;
  _new_status text; _overpayment integer; _inst_row record;
BEGIN
  SELECT id, org_id, total_minor, paid_minor, status, due_date 
  INTO _invoice
  FROM invoices WHERE id = _invoice_id FOR UPDATE;
  IF _invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  
  IF _invoice.status IN ('void', 'cancelled') THEN
    RETURN json_build_object('skipped', true, 'reason', 'Invoice is ' || _invoice.status, 'payment_id', null);
  END IF;
  SELECT id INTO _existing_payment_id FROM payments WHERE provider_reference = _provider_reference;
  IF _existing_payment_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount_minor), 0) INTO _total_paid FROM payments WHERE invoice_id = _invoice_id;
    SELECT COALESCE(SUM(amount_minor), 0) INTO _total_refunded FROM refunds WHERE invoice_id = _invoice_id AND status = 'succeeded';
    _net_paid := _total_paid - _total_refunded;
    _overpayment := GREATEST(0, _net_paid - _invoice.total_minor);
    _new_status := _invoice.status;
    
    IF _invoice.status NOT IN ('void', 'cancelled') THEN
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
      SET paid_minor = _net_paid, status = _new_status, overpayment_minor = _overpayment
      WHERE id = _invoice_id;
      
    RETURN json_build_object(
      'payment_id', _existing_payment_id, 'duplicate', true,
      'net_paid', _net_paid, 'new_status', _new_status,
      'overpayment_minor', _overpayment
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
  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_paid FROM payments WHERE invoice_id = _invoice_id;
  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_refunded FROM refunds WHERE invoice_id = _invoice_id AND status = 'succeeded';
  _net_paid := _total_paid - _total_refunded;
  _overpayment := GREATEST(0, _net_paid - _invoice.total_minor);
  _new_status := _invoice.status;
  IF _invoice.status NOT IN ('void', 'cancelled') THEN
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
    SET paid_minor = _net_paid, status = _new_status, overpayment_minor = _overpayment
    WHERE id = _invoice_id;
  RETURN json_build_object(
    'payment_id', _payment_id, 'duplicate', false,
    'net_paid', _net_paid, 'total_minor', _invoice.total_minor, 
    'new_status', _new_status, 'overpayment_minor', _overpayment
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_invoice_paid(_invoice_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  IF _invoice.status NOT IN ('void', 'cancelled') THEN
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
    SET paid_minor = _net_paid, status = _new_status, overpayment_minor = _overpayment
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
$function$;

NOTIFY pgrst, 'reload schema';