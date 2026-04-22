-- Journey 6 — consolidate status-flip logic in payment RPCs.
-- Replaces inline paid_minor/status/overpayment computation with delegation
-- to recalculate_invoice_paid, the single source of truth.

BEGIN;

-- ============================================================
-- record_payment_and_update_status
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_payment_and_update_status(
  _org_id uuid,
  _invoice_id uuid,
  _amount_minor integer,
  _currency_code text,
  _method text,
  _provider_reference text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _invoice record;
  _existing_paid integer;
  _total_refunded integer;
  _outstanding integer;
  _payment_id uuid;
  _remaining_payment integer;
  _inst record;
  _inst_applied integer;
  _inst_outstanding integer;
  _first_inst_id uuid := NULL;
  _installments_touched integer := 0;
  _recalc_result json;
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to record payments';
  END IF;

  SELECT id, total_minor, status, payment_plan_enabled INTO _invoice
  FROM public.invoices WHERE id = _invoice_id AND org_id = _org_id FOR UPDATE;
  IF _invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF _invoice.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'Cannot record payment on a % invoice', _invoice.status;
  END IF;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _existing_paid
  FROM public.payments WHERE invoice_id = _invoice_id;
  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_refunded
  FROM public.refunds WHERE invoice_id = _invoice_id AND status = 'succeeded';
  _outstanding := _invoice.total_minor - _existing_paid + _total_refunded;

  IF _amount_minor > _outstanding THEN
    RAISE EXCEPTION 'Payment of % exceeds outstanding amount of % (total: %, already paid: %, refunded: %)',
      _amount_minor, _outstanding, _invoice.total_minor, _existing_paid, _total_refunded;
  END IF;

  INSERT INTO public.payments (org_id, invoice_id, amount_minor, currency_code, method, provider, provider_reference)
  VALUES (_org_id, _invoice_id, _amount_minor, _currency_code, _method::payment_method, 'manual', _provider_reference)
  RETURNING id INTO _payment_id;

  IF _invoice.payment_plan_enabled THEN
    _remaining_payment := _amount_minor;
    FOR _inst IN
      SELECT * FROM invoice_installments
      WHERE invoice_id = _invoice_id
        AND status IN ('pending', 'overdue', 'partially_paid')
      ORDER BY installment_number ASC
      FOR UPDATE
    LOOP
      EXIT WHEN _remaining_payment <= 0;

      SELECT COALESCE(SUM(p.amount_minor), 0)
           - COALESCE((
               SELECT SUM(r.amount_minor)
               FROM refunds r
               JOIN payments p2 ON p2.id = r.payment_id
               WHERE p2.installment_id = _inst.id
                 AND r.status = 'succeeded'
             ), 0)
        INTO _inst_applied
      FROM payments p
      WHERE p.installment_id = _inst.id;

      _inst_outstanding := _inst.amount_minor - _inst_applied;
      IF _inst_outstanding <= 0 THEN CONTINUE; END IF;

      IF _first_inst_id IS NULL THEN
        _first_inst_id := _inst.id;
        UPDATE payments SET installment_id = _first_inst_id WHERE id = _payment_id;
      END IF;

      IF _remaining_payment >= _inst_outstanding THEN
        UPDATE invoice_installments
          SET payment_id = _payment_id,
              updated_at = NOW()
          WHERE id = _inst.id;
        PERFORM recalculate_installment_status(_inst.id);
        _remaining_payment := _remaining_payment - _inst_outstanding;
        _installments_touched := _installments_touched + 1;
      ELSE
        IF _first_inst_id = _inst.id THEN
          UPDATE invoice_installments
            SET updated_at = NOW()
            WHERE id = _inst.id;
          PERFORM recalculate_installment_status(_inst.id);
          _remaining_payment := 0;
          _installments_touched := _installments_touched + 1;
        END IF;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  _recalc_result := recalculate_invoice_paid(_invoice_id);

  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'payment_recorded', 'invoice', _invoice_id,
    jsonb_build_object(
      'payment_id', _payment_id,
      'amount_minor', _amount_minor,
      'method', _method,
      'new_status', _recalc_result->>'new_status',
      'installments_touched', _installments_touched,
      'net_paid', (_recalc_result->>'net_paid')::integer,
      'total_refunded', _total_refunded
    ));

  RETURN json_build_object(
    'payment_id', _payment_id,
    'net_paid', (_recalc_result->>'net_paid')::integer,
    'total_refunded', _total_refunded,
    'invoice_total', _invoice.total_minor,
    'new_status', _recalc_result->>'new_status',
    'overpayment_minor', (_recalc_result->>'overpayment_minor')::integer,
    'installments_touched', _installments_touched
  );
END;
$function$;


-- ============================================================
-- record_stripe_payment
-- ============================================================
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
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF _invoice.status IN ('void', 'cancelled') THEN
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
$function$;

COMMIT;