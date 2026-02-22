
CREATE OR REPLACE FUNCTION public.generate_installments(
  _invoice_id UUID,
  _org_id UUID,
  _count INTEGER,
  _frequency TEXT DEFAULT 'monthly',
  _start_date DATE DEFAULT NULL,
  _custom_schedule JSONB DEFAULT NULL
)
RETURNS SETOF public.invoice_installments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _invoice RECORD;
  _remaining INTEGER;
  _per_installment INTEGER;
  _last_amount INTEGER;
  _current_date DATE;
  _interval INTERVAL;
  i INTEGER;
BEGIN
  -- Validate invoice exists and belongs to org
  SELECT * INTO _invoice FROM invoices
    WHERE id = _invoice_id AND org_id = _org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Cannot add plan to paid/void invoices
  IF _invoice.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'Cannot add payment plan to % invoice', _invoice.status;
  END IF;

  -- Delete any existing pending installments (allows re-generating)
  DELETE FROM invoice_installments
    WHERE invoice_id = _invoice_id AND status = 'pending';

  -- If custom schedule provided, use it directly
  IF _custom_schedule IS NOT NULL THEN
    FOR i IN 0 .. jsonb_array_length(_custom_schedule) - 1 LOOP
      INSERT INTO invoice_installments (
        invoice_id, org_id, installment_number,
        amount_minor, due_date, status
      ) VALUES (
        _invoice_id, _org_id, i + 1,
        (_custom_schedule->i->>'amount_minor')::INTEGER,
        (_custom_schedule->i->>'due_date')::DATE,
        'pending'
      );
    END LOOP;

    -- Update invoice with custom count
    UPDATE invoices SET
      payment_plan_enabled = true,
      installment_count = jsonb_array_length(_custom_schedule)
    WHERE id = _invoice_id;
  ELSE
    -- Auto-generate equal installments
    _remaining := _invoice.total_minor - COALESCE(_invoice.paid_minor, 0);
    _per_installment := _remaining / _count;
    _last_amount := _remaining - (_per_installment * (_count - 1));

    _current_date := COALESCE(_start_date, _invoice.due_date);
    _interval := CASE _frequency
      WHEN 'weekly' THEN '7 days'::INTERVAL
      WHEN 'fortnightly' THEN '14 days'::INTERVAL
      WHEN 'monthly' THEN '1 month'::INTERVAL
      ELSE '1 month'::INTERVAL
    END;

    FOR i IN 1 .. _count LOOP
      INSERT INTO invoice_installments (
        invoice_id, org_id, installment_number,
        amount_minor, due_date, status
      ) VALUES (
        _invoice_id, _org_id, i,
        CASE WHEN i = _count THEN _last_amount ELSE _per_installment END,
        _current_date,
        'pending'
      );
      _current_date := _current_date + _interval;
    END LOOP;

    -- Mark invoice as having a payment plan
    UPDATE invoices SET
      payment_plan_enabled = true,
      installment_count = _count
    WHERE id = _invoice_id;
  END IF;

  RETURN QUERY SELECT * FROM invoice_installments
    WHERE invoice_id = _invoice_id
    ORDER BY installment_number;
END;
$$;
