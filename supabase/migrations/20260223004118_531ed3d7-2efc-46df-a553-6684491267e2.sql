
-- Add expired_at column to make_up_credits
ALTER TABLE public.make_up_credits ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

-- Update redeem_make_up_credit to also check expired_at
CREATE OR REPLACE FUNCTION public.redeem_make_up_credit(_credit_id uuid, _lesson_id uuid, _org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _credit RECORD;
BEGIN
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to redeem credits for this organisation';
  END IF;

  SELECT * INTO _credit
  FROM make_up_credits WHERE id = _credit_id AND org_id = _org_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Credit not found'; END IF;
  IF _credit.redeemed_at IS NOT NULL THEN RAISE EXCEPTION 'Credit has already been redeemed'; END IF;
  IF _credit.expired_at IS NOT NULL THEN RAISE EXCEPTION 'Credit has been marked as expired'; END IF;
  IF _credit.expires_at IS NOT NULL AND _credit.expires_at <= NOW() THEN RAISE EXCEPTION 'Credit has expired'; END IF;

  UPDATE make_up_credits SET
    redeemed_at = NOW(), redeemed_lesson_id = _lesson_id, updated_at = NOW()
  WHERE id = _credit_id;

  -- Audit log
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'credit_redeemed', 'make_up_credit', _credit_id,
    jsonb_build_object('lesson_id', _lesson_id, 'student_id', _credit.student_id, 'credit_value_minor', _credit.credit_value_minor));

  RETURN json_build_object('credit_id', _credit_id, 'lesson_id', _lesson_id, 'status', 'redeemed');
END;
$function$;

-- Also update create_invoice_with_items to check expired_at
-- The existing lock query already checks redeemed_at IS NULL; add expired_at IS NULL
CREATE OR REPLACE FUNCTION public.create_invoice_with_items(_org_id uuid, _due_date date, _payer_guardian_id uuid DEFAULT NULL::uuid, _payer_student_id uuid DEFAULT NULL::uuid, _notes text DEFAULT NULL::text, _credit_ids uuid[] DEFAULT '{}'::uuid[], _items jsonb DEFAULT '[]'::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _org RECORD;
  _subtotal integer;
  _tax_minor integer;
  _credit_offset integer := 0;
  _total_minor integer;
  _invoice RECORD;
  _item jsonb;
  _i integer := 0;
  _locked_credit_count integer;
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to create invoices for this organisation';
  END IF;

  IF NOT is_org_active(_org_id) THEN
    RAISE EXCEPTION 'Organisation is not active';
  END IF;

  SELECT vat_enabled, vat_rate, currency_code INTO _org
  FROM organisations WHERE id = _org_id;
  IF _org IS NULL THEN RAISE EXCEPTION 'Organisation not found'; END IF;

  IF _payer_guardian_id IS NULL AND _payer_student_id IS NULL THEN
    RAISE EXCEPTION 'Invoice must have a payer (guardian or student)';
  END IF;

  IF jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Invoice must have at least one item';
  END IF;

  SELECT COALESCE(SUM(
    (item->>'quantity')::integer * (item->>'unit_price_minor')::integer
  ), 0) INTO _subtotal
  FROM jsonb_array_elements(_items) AS item;

  IF _org.vat_enabled THEN
    _tax_minor := ROUND(_subtotal * _org.vat_rate / 100.0);
  ELSE
    _tax_minor := 0;
  END IF;

  IF array_length(_credit_ids, 1) > 0 THEN
    SELECT COUNT(*), COALESCE(SUM(credit_value_minor), 0)
    INTO _locked_credit_count, _credit_offset
    FROM make_up_credits
    WHERE id = ANY(_credit_ids)
      AND org_id = _org_id
      AND redeemed_at IS NULL
      AND expired_at IS NULL
    FOR UPDATE;

    IF _locked_credit_count <> array_length(_credit_ids, 1) THEN
      RAISE EXCEPTION 'One or more credits have already been redeemed, expired, or do not exist';
    END IF;
  END IF;

  _total_minor := GREATEST(0, _subtotal + _tax_minor - _credit_offset);

  INSERT INTO invoices (
    org_id, invoice_number, due_date,
    payer_guardian_id, payer_student_id, notes,
    vat_rate, subtotal_minor, tax_minor,
    credit_applied_minor, total_minor, currency_code
  ) VALUES (
    _org_id, '', _due_date,
    _payer_guardian_id, _payer_student_id, _notes,
    CASE WHEN _org.vat_enabled THEN _org.vat_rate ELSE 0 END,
    _subtotal, _tax_minor,
    _credit_offset, _total_minor, _org.currency_code
  ) RETURNING * INTO _invoice;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    INSERT INTO invoice_items (
      invoice_id, org_id, description, quantity,
      unit_price_minor, amount_minor,
      linked_lesson_id, student_id
    ) VALUES (
      _invoice.id, _org_id,
      _item->>'description',
      (_item->>'quantity')::integer,
      (_item->>'unit_price_minor')::integer,
      (_item->>'quantity')::integer * (_item->>'unit_price_minor')::integer,
      NULLIF(_item->>'linked_lesson_id', '')::uuid,
      NULLIF(_item->>'student_id', '')::uuid
    );
  END LOOP;

  IF array_length(_credit_ids, 1) > 0 THEN
    UPDATE make_up_credits
    SET redeemed_at = NOW(),
        applied_to_invoice_id = _invoice.id,
        notes = 'Applied to invoice ' || _invoice.invoice_number
    WHERE id = ANY(_credit_ids)
      AND org_id = _org_id
      AND redeemed_at IS NULL
      AND expired_at IS NULL;
  END IF;

  RETURN json_build_object(
    'id', _invoice.id,
    'invoice_number', _invoice.invoice_number,
    'total_minor', _total_minor,
    'subtotal_minor', _subtotal,
    'tax_minor', _tax_minor,
    'credit_applied_minor', _credit_offset,
    'status', _invoice.status
  );
END;
$function$;
