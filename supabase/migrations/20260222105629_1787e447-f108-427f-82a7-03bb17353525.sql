
CREATE OR REPLACE FUNCTION public.record_payment_and_update_status(
  _org_id uuid,
  _invoice_id uuid,
  _amount_minor integer,
  _currency_code text,
  _method text,
  _provider_reference text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoice record;
  _total_paid integer;
  _new_status text;
  _payment_id uuid;
BEGIN
  -- Lock the invoice row to prevent concurrent modifications
  SELECT id, total_minor, status INTO _invoice
  FROM public.invoices
  WHERE id = _invoice_id AND org_id = _org_id
  FOR UPDATE;

  IF _invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF _invoice.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'Cannot record payment on a % invoice', _invoice.status;
  END IF;

  -- Insert the payment
  INSERT INTO public.payments (org_id, invoice_id, amount_minor, currency_code, method, provider, provider_reference)
  VALUES (_org_id, _invoice_id, _amount_minor, _currency_code, _method::payment_method, 'manual', _provider_reference)
  RETURNING id INTO _payment_id;

  -- Sum all payments for this invoice (including the one just inserted)
  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_paid
  FROM public.payments
  WHERE invoice_id = _invoice_id;

  -- Determine new status
  IF _total_paid >= _invoice.total_minor THEN
    _new_status := 'paid';
    UPDATE public.invoices SET status = 'paid' WHERE id = _invoice_id;
  ELSE
    _new_status := _invoice.status::text;
  END IF;

  RETURN json_build_object(
    'payment_id', _payment_id,
    'total_paid', _total_paid,
    'invoice_total', _invoice.total_minor,
    'new_status', _new_status
  );
END;
$$;
