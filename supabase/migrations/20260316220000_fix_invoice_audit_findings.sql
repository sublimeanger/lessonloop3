-- ============================================================
-- Fix invoice audit findings (INV-M2, INV-M5)
-- Audit: audit-feature-12-invoices.md
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- INV-M2: Remove 1% overpayment tolerance from record_payment_and_update_status
-- Minor unit amounts are integers — rounding tolerance is unnecessary.
-- Payment must not exceed outstanding amount (total_minor - existing paid).
-- ────────────────────────────────────────────────────────────
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
  _total_paid integer;
  _existing_paid integer;
  _outstanding integer;
  _new_status text;
  _payment_id uuid;
  _remaining_payment integer;
  _inst record;
  _installments_marked integer := 0;
BEGIN
  SELECT id, total_minor, status, payment_plan_enabled INTO _invoice
  FROM public.invoices WHERE id = _invoice_id AND org_id = _org_id FOR UPDATE;

  IF _invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF _invoice.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'Cannot record payment on a % invoice', _invoice.status;
  END IF;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _existing_paid
  FROM public.payments WHERE invoice_id = _invoice_id;

  _outstanding := _invoice.total_minor - _existing_paid;

  -- INV-M2 FIX: Exact check — no tolerance. Minor units are integers.
  IF _amount_minor > _outstanding THEN
    RAISE EXCEPTION 'Payment of % exceeds outstanding amount of % (total: %, already paid: %)',
      _amount_minor, _outstanding, _invoice.total_minor, _existing_paid;
  END IF;

  INSERT INTO public.payments (org_id, invoice_id, amount_minor, currency_code, method, provider, provider_reference)
  VALUES (_org_id, _invoice_id, _amount_minor, _currency_code, _method::payment_method, 'manual', _provider_reference)
  RETURNING id INTO _payment_id;

  IF _invoice.payment_plan_enabled THEN
    _remaining_payment := _amount_minor;
    FOR _inst IN
      SELECT * FROM invoice_installments
      WHERE invoice_id = _invoice_id AND status IN ('pending', 'overdue')
      ORDER BY installment_number ASC
    LOOP
      EXIT WHEN _remaining_payment <= 0;
      IF _remaining_payment >= _inst.amount_minor THEN
        UPDATE invoice_installments SET
          status = 'paid', paid_at = NOW(), payment_id = _payment_id, updated_at = NOW()
        WHERE id = _inst.id;
        _remaining_payment := _remaining_payment - _inst.amount_minor;
        _installments_marked := _installments_marked + 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;
  END IF;

  UPDATE invoices SET paid_minor = COALESCE(paid_minor, 0) + _amount_minor WHERE id = _invoice_id;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_paid
  FROM public.payments WHERE invoice_id = _invoice_id;

  IF _total_paid >= _invoice.total_minor THEN
    _new_status := 'paid';
    UPDATE public.invoices SET status = 'paid' WHERE id = _invoice_id;
  ELSE
    _new_status := _invoice.status::text;
  END IF;

  -- Audit log
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'payment_recorded', 'invoice', _invoice_id,
    jsonb_build_object('payment_id', _payment_id, 'amount_minor', _amount_minor, 'method', _method,
      'new_status', _new_status, 'installments_marked_paid', _installments_marked));

  RETURN json_build_object(
    'payment_id', _payment_id, 'total_paid', _total_paid,
    'invoice_total', _invoice.total_minor, 'new_status', _new_status
  );
END;
$function$;


-- ────────────────────────────────────────────────────────────
-- INV-M5: Add auth check to recalculate_invoice_paid
-- Previously had NO auth check — any authenticated user could
-- call this SECURITY DEFINER RPC with any invoice ID.
-- Now verifies the caller is a member of the org that owns
-- the invoice. Also allows service role (auth.uid() IS NULL)
-- since the Stripe webhook calls this via service role.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_invoice_paid(_invoice_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _invoice record;
  _total_paid integer;
  _total_refunded integer;
  _net_paid integer;
  _new_status text;
BEGIN
  SELECT id, org_id, total_minor, status INTO _invoice
  FROM invoices WHERE id = _invoice_id FOR UPDATE;

  IF _invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Auth check: allow service role (auth.uid() IS NULL) or org members
  IF auth.uid() IS NOT NULL AND NOT is_org_member(auth.uid(), _invoice.org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_paid
  FROM payments WHERE invoice_id = _invoice_id;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_refunded
  FROM refunds WHERE invoice_id = _invoice_id AND status = 'succeeded';

  _net_paid := _total_paid - _total_refunded;

  _new_status := _invoice.status;
  -- Never change status on void/cancelled invoices
  IF _invoice.status NOT IN ('void', 'cancelled') THEN
    IF _net_paid >= _invoice.total_minor THEN
      _new_status := 'paid';
    ELSIF _invoice.status = 'paid' AND _net_paid < _invoice.total_minor THEN
      -- Reopen after refund
      _new_status := 'sent';
    END IF;
  END IF;

  UPDATE invoices SET paid_minor = _net_paid, status = _new_status WHERE id = _invoice_id;

  RETURN json_build_object(
    'net_paid', _net_paid,
    'total_minor', _invoice.total_minor,
    'new_status', _new_status
  );
END;
$$;
