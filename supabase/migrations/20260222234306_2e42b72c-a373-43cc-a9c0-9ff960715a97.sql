
-- Add audit logging to generate_installments
CREATE OR REPLACE FUNCTION public.generate_installments(
  _invoice_id uuid,
  _org_id uuid,
  _count integer,
  _frequency text DEFAULT 'monthly'::text,
  _start_date date DEFAULT NULL::date,
  _custom_schedule jsonb DEFAULT NULL::jsonb
)
 RETURNS SETOF invoice_installments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _invoice RECORD;
  _remaining INTEGER;
  _per_installment INTEGER;
  _last_amount INTEGER;
  _current_date DATE;
  _interval INTERVAL;
  _custom_sum INTEGER;
  _final_count INTEGER;
  i INTEGER;
BEGIN
  SELECT * INTO _invoice FROM invoices
    WHERE id = _invoice_id AND org_id = _org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  IF _invoice.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'Cannot add payment plan to % invoice', _invoice.status;
  END IF;

  DELETE FROM invoice_installments
    WHERE invoice_id = _invoice_id AND status = 'pending';

  _remaining := _invoice.total_minor - COALESCE(_invoice.paid_minor, 0);

  IF _custom_schedule IS NOT NULL THEN
    SELECT COALESCE(SUM((item->>'amount_minor')::INTEGER), 0) INTO _custom_sum
    FROM jsonb_array_elements(_custom_schedule) AS item;

    IF _custom_sum != _remaining THEN
      RAISE EXCEPTION 'Custom installment amounts (%) do not equal remaining balance (%)', _custom_sum, _remaining;
    END IF;

    FOR i IN 0 .. jsonb_array_length(_custom_schedule) - 1 LOOP
      INSERT INTO invoice_installments (
        invoice_id, org_id, installment_number, amount_minor, due_date, status
      ) VALUES (
        _invoice_id, _org_id, i + 1,
        (_custom_schedule->i->>'amount_minor')::INTEGER,
        (_custom_schedule->i->>'due_date')::DATE, 'pending'
      );
    END LOOP;

    _final_count := jsonb_array_length(_custom_schedule);
    UPDATE invoices SET payment_plan_enabled = true, installment_count = _final_count WHERE id = _invoice_id;
  ELSE
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
        invoice_id, org_id, installment_number, amount_minor, due_date, status
      ) VALUES (
        _invoice_id, _org_id, i,
        CASE WHEN i = _count THEN _last_amount ELSE _per_installment END,
        _current_date, 'pending'
      );
      _current_date := _current_date + _interval;
    END LOOP;

    _final_count := _count;
    UPDATE invoices SET payment_plan_enabled = true, installment_count = _final_count WHERE id = _invoice_id;
  END IF;

  -- Audit log
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'payment_plan_created', 'invoice', _invoice_id,
    jsonb_build_object('installment_count', _final_count, 'frequency', _frequency, 'remaining_minor', _remaining));

  RETURN QUERY SELECT * FROM invoice_installments
    WHERE invoice_id = _invoice_id ORDER BY installment_number;
END;
$$;

-- Add audit logging to record_payment_and_update_status
CREATE OR REPLACE FUNCTION public.record_payment_and_update_status(_org_id uuid, _invoice_id uuid, _amount_minor integer, _currency_code text, _method text, _provider_reference text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _invoice record;
  _total_paid integer;
  _existing_paid integer;
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

  IF _existing_paid + _amount_minor > _invoice.total_minor * 1.01 THEN
    RAISE EXCEPTION 'Payment of % would exceed invoice total of % (already paid: %)', _amount_minor, _invoice.total_minor, _existing_paid;
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

-- Add audit logging to void_invoice
CREATE OR REPLACE FUNCTION public.void_invoice(_invoice_id uuid, _org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _invoice RECORD;
  _installments_voided integer;
  _credits_restored integer;
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;

  SELECT id, status, credit_applied_minor, payment_plan_enabled INTO _invoice
  FROM invoices WHERE id = _invoice_id AND org_id = _org_id FOR UPDATE;

  IF _invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF _invoice.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'Cannot void a % invoice', _invoice.status;
  END IF;

  UPDATE invoices SET status = 'void', payment_plan_enabled = false WHERE id = _invoice_id;

  UPDATE invoice_installments SET status = 'void', updated_at = NOW()
  WHERE invoice_id = _invoice_id AND status IN ('pending', 'overdue');
  GET DIAGNOSTICS _installments_voided = ROW_COUNT;

  _credits_restored := 0;
  IF _invoice.credit_applied_minor > 0 THEN
    UPDATE make_up_credits
    SET redeemed_at = NULL, applied_to_invoice_id = NULL, notes = 'Credit restored — invoice voided'
    WHERE applied_to_invoice_id = _invoice_id AND org_id = _org_id AND redeemed_at IS NOT NULL;
    GET DIAGNOSTICS _credits_restored = ROW_COUNT;
  END IF;

  -- Audit log
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'invoice_voided', 'invoice', _invoice_id,
    jsonb_build_object('installments_voided', _installments_voided, 'credits_restored', _credits_restored,
      'credit_applied_minor', _invoice.credit_applied_minor));
END;
$function$;

-- Add audit logging to confirm_makeup_booking
CREATE OR REPLACE FUNCTION public.confirm_makeup_booking(_waitlist_id uuid, _org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _entry RECORD;
BEGIN
  SELECT * INTO _entry
  FROM make_up_waitlist
  WHERE id = _waitlist_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Waitlist entry not found'; END IF;

  IF _entry.status NOT IN ('matched', 'offered', 'accepted') THEN
    RAISE EXCEPTION 'Waitlist entry is not in a bookable status (current: %)', _entry.status;
  END IF;

  IF _entry.matched_lesson_id IS NULL THEN
    RAISE EXCEPTION 'No matched lesson for this waitlist entry';
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_participants
    WHERE lesson_id = _entry.matched_lesson_id AND student_id = _entry.student_id
  ) THEN
    RAISE EXCEPTION 'Student is already a participant in this lesson';
  END IF;

  INSERT INTO lesson_participants (lesson_id, student_id, org_id)
  VALUES (_entry.matched_lesson_id, _entry.student_id, _org_id);

  UPDATE make_up_waitlist
  SET status = 'booked', booked_lesson_id = _entry.matched_lesson_id, updated_at = NOW()
  WHERE id = _waitlist_id;

  -- Audit log
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'makeup_booked', 'make_up_waitlist', _waitlist_id,
    jsonb_build_object('student_id', _entry.student_id, 'lesson_id', _entry.matched_lesson_id));

  RETURN json_build_object('status', 'booked', 'lesson_id', _entry.matched_lesson_id);
END;
$function$;

-- Add audit logging to redeem_make_up_credit
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
