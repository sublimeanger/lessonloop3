-- Atomic recalculation of invoice paid_minor from payments table.
-- Uses FOR UPDATE to prevent concurrent race conditions on paid_minor.
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
  SELECT id, total_minor, status INTO _invoice
  FROM invoices WHERE id = _invoice_id FOR UPDATE;

  IF _invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
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
