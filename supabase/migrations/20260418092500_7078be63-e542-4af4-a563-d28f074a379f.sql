-- Prerequisite: 20260303100000 was in repo but never applied to live DB.
-- A3 (20260417190000) references payments.installment_id; without this it fails at runtime.
-- Idempotent guard so re-runs are safe.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS installment_id uuid REFERENCES public.invoice_installments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_installment_id ON public.payments(installment_id);

-- =============================================================================
-- Migration 1: 20260417120000 — Snapshot rate_minor on confirm_makeup_booking
-- =============================================================================

CREATE OR REPLACE FUNCTION public.confirm_makeup_booking(_waitlist_id uuid, _org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _entry RECORD;
  _lesson RECORD;
  _participant_count INTEGER;
  _redeemed_credit_id UUID;
  _dismissed_count INTEGER;
  _rate_minor INTEGER;
BEGIN
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Access denied: not authorised to confirm bookings for this organisation';
  END IF;

  SELECT * INTO _entry FROM make_up_waitlist
  WHERE id = _waitlist_id AND org_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Waitlist entry not found'; END IF;
  IF _entry.status NOT IN ('matched', 'offered', 'accepted') THEN
    RAISE EXCEPTION 'Waitlist entry is not in a bookable status (current: %)', _entry.status;
  END IF;
  IF _entry.matched_lesson_id IS NULL THEN
    RAISE EXCEPTION 'No matched lesson for this waitlist entry';
  END IF;

  SELECT * INTO _lesson FROM lessons
  WHERE id = _entry.matched_lesson_id AND org_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matched lesson not found'; END IF;
  IF _lesson.status = 'cancelled' THEN RAISE EXCEPTION 'Matched lesson has been cancelled'; END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_participants
    WHERE lesson_id = _entry.matched_lesson_id AND student_id = _entry.student_id
  ) THEN
    RAISE EXCEPTION 'Student is already a participant in this lesson';
  END IF;

  IF _lesson.max_participants IS NOT NULL THEN
    SELECT COUNT(*) INTO _participant_count
    FROM lesson_participants WHERE lesson_id = _entry.matched_lesson_id;
    IF _participant_count >= _lesson.max_participants THEN
      RAISE EXCEPTION 'Lesson is full (% of % places taken)', _participant_count, _lesson.max_participants;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM lesson_participants lp
    JOIN lessons l ON l.id = lp.lesson_id
    WHERE lp.student_id = _entry.student_id
      AND l.status != 'cancelled' AND l.id != _entry.matched_lesson_id
      AND l.start_at < _lesson.end_at AND l.end_at > _lesson.start_at
  ) THEN
    RAISE EXCEPTION 'Student has a schedule conflict at this time';
  END IF;

  SELECT rate_minor INTO _rate_minor
  FROM lesson_participants
  WHERE lesson_id = _entry.missed_lesson_id AND student_id = _entry.student_id LIMIT 1;

  IF _rate_minor IS NULL THEN
    SELECT rate_amount::INTEGER INTO _rate_minor
    FROM rate_cards
    WHERE org_id = _org_id AND duration_mins = _entry.lesson_duration_minutes
    ORDER BY is_default DESC LIMIT 1;
  END IF;

  IF _rate_minor IS NULL THEN
    SELECT rate_amount::INTEGER INTO _rate_minor
    FROM rate_cards WHERE org_id = _org_id AND is_default = true LIMIT 1;
  END IF;

  INSERT INTO lesson_participants (lesson_id, student_id, org_id, rate_minor)
  VALUES (_entry.matched_lesson_id, _entry.student_id, _org_id, _rate_minor);

  UPDATE make_up_credits
  SET redeemed_at = NOW(), redeemed_lesson_id = _entry.matched_lesson_id,
      updated_at = NOW(), notes = COALESCE(notes, '') || ' [Redeemed for make-up lesson]'
  WHERE id = (
    SELECT id FROM make_up_credits
    WHERE student_id = _entry.student_id AND org_id = _org_id
      AND redeemed_at IS NULL AND expired_at IS NULL AND voided_at IS NULL
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
  ) RETURNING id INTO _redeemed_credit_id;

  UPDATE make_up_waitlist
  SET status = 'booked', booked_lesson_id = _entry.matched_lesson_id, updated_at = NOW()
  WHERE id = _waitlist_id;

  WITH dismissed AS (
    UPDATE make_up_waitlist
    SET status = 'waiting', matched_lesson_id = NULL, matched_at = NULL, updated_at = NOW()
    WHERE matched_lesson_id = _entry.matched_lesson_id
      AND id != _waitlist_id AND status = 'matched'
    RETURNING id
  ) SELECT COUNT(*) INTO _dismissed_count FROM dismissed;

  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'makeup_booked', 'make_up_waitlist', _waitlist_id,
    jsonb_build_object('student_id', _entry.student_id, 'lesson_id', _entry.matched_lesson_id,
      'redeemed_credit_id', _redeemed_credit_id, 'dismissed_matches', _dismissed_count));

  RETURN json_build_object('status', 'booked', 'lesson_id', _entry.matched_lesson_id,
    'redeemed_credit_id', _redeemed_credit_id, 'dismissed_matches', _dismissed_count);
END;
$function$;

-- =============================================================================
-- Migration 2: 20260417180000 — xero_connections schema sync (idempotent)
-- =============================================================================

ALTER TABLE public.xero_connections
  ADD COLUMN IF NOT EXISTS connected_by uuid REFERENCES auth.users(id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'xero_connections'
      AND column_name = 'user_id' AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE public.xero_connections ALTER COLUMN user_id DROP NOT NULL';
  END IF;
END;
$$;

-- =============================================================================
-- Migration 3: 20260417190000 — Installment partially_paid state
-- =============================================================================

ALTER TABLE public.invoice_installments
  DROP CONSTRAINT IF EXISTS invoice_installments_status_check;

ALTER TABLE public.invoice_installments
  ADD CONSTRAINT invoice_installments_status_check
  CHECK (status IN ('pending', 'paid', 'overdue', 'void', 'partially_paid'));

CREATE OR REPLACE FUNCTION public.recalculate_installment_status(_installment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _inst RECORD; _applied INTEGER; _new_status TEXT;
BEGIN
  SELECT id, amount_minor, status, paid_at, due_date INTO _inst
  FROM invoice_installments WHERE id = _installment_id FOR UPDATE;
  IF _inst IS NULL THEN RETURN; END IF;
  IF _inst.status = 'void' THEN RETURN; END IF;

  SELECT COALESCE(SUM(p.amount_minor), 0)
       - COALESCE((
           SELECT SUM(r.amount_minor) FROM refunds r
           JOIN payments p2 ON p2.id = r.payment_id
           WHERE p2.installment_id = _installment_id AND r.status = 'succeeded'
         ), 0)
    INTO _applied
  FROM payments p WHERE p.installment_id = _installment_id;

  IF _applied <= 0 THEN
    IF _inst.status = 'overdue' THEN _new_status := 'overdue';
    ELSE _new_status := 'pending'; END IF;
    UPDATE invoice_installments SET status = _new_status, paid_at = NULL WHERE id = _installment_id;
  ELSIF _applied < _inst.amount_minor THEN
    UPDATE invoice_installments SET status = 'partially_paid', paid_at = NULL WHERE id = _installment_id;
  ELSE
    UPDATE invoice_installments SET status = 'paid',
      paid_at = COALESCE(_inst.paid_at, NOW()) WHERE id = _installment_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalculate_installment_status(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_installment_status(uuid) FROM public;

CREATE OR REPLACE FUNCTION public.record_payment_and_update_status(
  _org_id uuid, _invoice_id uuid, _amount_minor integer, _currency_code text,
  _method text, _provider_reference text DEFAULT NULL::text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _invoice record; _total_paid integer; _total_refunded integer; _net_paid integer;
  _existing_paid integer; _outstanding integer; _new_status text; _payment_id uuid;
  _remaining_payment integer; _inst record; _inst_applied integer; _inst_outstanding integer;
  _first_inst_id uuid := NULL; _installments_touched integer := 0;
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
      WHERE invoice_id = _invoice_id AND status IN ('pending', 'overdue', 'partially_paid')
      ORDER BY installment_number ASC FOR UPDATE
    LOOP
      EXIT WHEN _remaining_payment <= 0;
      SELECT COALESCE(SUM(p.amount_minor), 0)
           - COALESCE((
               SELECT SUM(r.amount_minor) FROM refunds r
               JOIN payments p2 ON p2.id = r.payment_id
               WHERE p2.installment_id = _inst.id AND r.status = 'succeeded'
             ), 0)
        INTO _inst_applied
      FROM payments p WHERE p.installment_id = _inst.id;
      _inst_outstanding := _inst.amount_minor - _inst_applied;
      IF _inst_outstanding <= 0 THEN CONTINUE; END IF;

      IF _first_inst_id IS NULL THEN
        _first_inst_id := _inst.id;
        UPDATE payments SET installment_id = _first_inst_id WHERE id = _payment_id;
      END IF;

      IF _remaining_payment >= _inst_outstanding THEN
        UPDATE invoice_installments
          SET payment_id = _payment_id, updated_at = NOW() WHERE id = _inst.id;
        PERFORM recalculate_installment_status(_inst.id);
        _remaining_payment := _remaining_payment - _inst_outstanding;
        _installments_touched := _installments_touched + 1;
      ELSE
        IF _first_inst_id = _inst.id THEN
          UPDATE invoice_installments SET updated_at = NOW() WHERE id = _inst.id;
          PERFORM recalculate_installment_status(_inst.id);
          _remaining_payment := 0;
          _installments_touched := _installments_touched + 1;
        END IF;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_paid
  FROM public.payments WHERE invoice_id = _invoice_id;
  _net_paid := _total_paid - _total_refunded;
  UPDATE invoices SET paid_minor = _net_paid WHERE id = _invoice_id;

  IF _net_paid >= _invoice.total_minor THEN
    _new_status := 'paid';
    UPDATE public.invoices SET status = 'paid' WHERE id = _invoice_id;
  ELSE
    _new_status := _invoice.status::text;
  END IF;

  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'payment_recorded', 'invoice', _invoice_id,
    jsonb_build_object('payment_id', _payment_id, 'amount_minor', _amount_minor, 'method', _method,
      'new_status', _new_status, 'installments_touched', _installments_touched,
      'net_paid', _net_paid, 'total_refunded', _total_refunded));

  RETURN json_build_object('payment_id', _payment_id, 'total_paid', _total_paid,
    'net_paid', _net_paid, 'total_refunded', _total_refunded,
    'invoice_total', _invoice.total_minor, 'new_status', _new_status,
    'installments_touched', _installments_touched);
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_stripe_payment(
  _invoice_id uuid, _org_id uuid, _amount_minor integer, _provider_reference text,
  _installment_id uuid DEFAULT NULL, _pay_remaining boolean DEFAULT false
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _invoice record; _existing_payment_id uuid; _payment_id uuid;
  _total_paid integer; _total_refunded integer; _net_paid integer;
  _new_status text; _inst_row record;
BEGIN
  SELECT id, org_id, total_minor, status INTO _invoice
  FROM invoices WHERE id = _invoice_id FOR UPDATE;
  IF _invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF _invoice.status IN ('void', 'cancelled') THEN
    RETURN json_build_object('skipped', true, 'reason', 'Invoice is ' || _invoice.status, 'payment_id', null);
  END IF;
  IF _invoice.status = 'paid' THEN
    RETURN json_build_object('skipped', true, 'reason', 'Invoice is already paid', 'payment_id', null);
  END IF;

  SELECT id INTO _existing_payment_id FROM payments WHERE provider_reference = _provider_reference;
  IF _existing_payment_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount_minor), 0) INTO _total_paid FROM payments WHERE invoice_id = _invoice_id;
    SELECT COALESCE(SUM(amount_minor), 0) INTO _total_refunded FROM refunds WHERE invoice_id = _invoice_id AND status = 'succeeded';
    _net_paid := _total_paid - _total_refunded;
    _new_status := _invoice.status;
    IF _invoice.status NOT IN ('void', 'cancelled') THEN
      IF _net_paid >= _invoice.total_minor THEN _new_status := 'paid';
      ELSIF _invoice.status = 'paid' AND _net_paid < _invoice.total_minor THEN _new_status := 'sent'; END IF;
    END IF;
    UPDATE invoices SET paid_minor = _net_paid, status = _new_status WHERE id = _invoice_id;
    RETURN json_build_object('payment_id', _existing_payment_id, 'duplicate', true,
      'net_paid', _net_paid, 'new_status', _new_status);
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

  _new_status := _invoice.status;
  IF _invoice.status NOT IN ('void', 'cancelled') THEN
    IF _net_paid >= _invoice.total_minor THEN _new_status := 'paid';
    ELSIF _invoice.status = 'paid' AND _net_paid < _invoice.total_minor THEN _new_status := 'sent'; END IF;
  END IF;

  UPDATE invoices SET paid_minor = _net_paid, status = _new_status WHERE id = _invoice_id;

  RETURN json_build_object('payment_id', _payment_id, 'duplicate', false,
    'net_paid', _net_paid, 'total_minor', _invoice.total_minor, 'new_status', _new_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_stripe_payment(uuid, uuid, integer, text, uuid, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_stripe_payment(uuid, uuid, integer, text, uuid, boolean) FROM public;

CREATE OR REPLACE FUNCTION public.recalculate_invoice_paid(_invoice_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _invoice record; _total_paid integer; _total_refunded integer;
  _net_paid integer; _new_status text; _inst_row record;
BEGIN
  SELECT id, org_id, total_minor, status INTO _invoice
  FROM invoices WHERE id = _invoice_id FOR UPDATE;
  IF _invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  IF auth.uid() IS NOT NULL AND NOT is_org_finance_team(auth.uid(), _invoice.org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_paid FROM payments WHERE invoice_id = _invoice_id;
  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_refunded FROM refunds WHERE invoice_id = _invoice_id AND status = 'succeeded';
  _net_paid := _total_paid - _total_refunded;
  _new_status := _invoice.status;
  IF _invoice.status NOT IN ('void', 'cancelled') THEN
    IF _net_paid >= _invoice.total_minor THEN _new_status := 'paid';
    ELSIF _invoice.status = 'paid' AND _net_paid < _invoice.total_minor THEN _new_status := 'sent'; END IF;
  END IF;

  UPDATE invoices SET paid_minor = _net_paid, status = _new_status WHERE id = _invoice_id;

  FOR _inst_row IN
    SELECT id FROM invoice_installments WHERE invoice_id = _invoice_id AND status != 'void'
  LOOP
    PERFORM recalculate_installment_status(_inst_row.id);
  END LOOP;

  RETURN json_build_object('net_paid', _net_paid, 'total_minor', _invoice.total_minor, 'new_status', _new_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_payment_plan(p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE _invoice RECORD; _caller_id UUID; _settled_count INTEGER;
BEGIN
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = _caller_id AND org_id = _invoice.org_id
      AND status = 'active' AND role IN ('owner', 'admin', 'finance')
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT COUNT(*) INTO _settled_count
  FROM invoice_installments WHERE invoice_id = p_invoice_id AND status IN ('paid', 'partially_paid');

  IF _settled_count > 0 THEN
    RAISE EXCEPTION 'Cannot cancel plan with paid or partially_paid installments';
  END IF;

  DELETE FROM invoice_installments WHERE invoice_id = p_invoice_id;
  UPDATE invoices SET payment_plan_enabled = false, installment_count = NULL WHERE id = p_invoice_id;

  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_invoice.org_id, _caller_id, 'payment_plan_cancelled', 'invoice', p_invoice_id,
    jsonb_build_object('prev_installment_count', _invoice.installment_count));
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_installments(
  _invoice_id uuid, _org_id uuid, _count integer,
  _frequency text DEFAULT 'monthly'::text, _start_date date DEFAULT NULL::date,
  _custom_schedule jsonb DEFAULT NULL::jsonb
) RETURNS SETOF invoice_installments
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _invoice RECORD; _remaining INTEGER; _per_installment INTEGER; _last_amount INTEGER;
  _current_date DATE; _interval INTERVAL; _custom_sum INTEGER;
  _final_count INTEGER; _partial_count INTEGER; i INTEGER;
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to manage payment plans';
  END IF;

  SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id AND org_id = _org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF _invoice.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'Cannot add payment plan to % invoice', _invoice.status;
  END IF;

  SELECT COUNT(*) INTO _partial_count
  FROM invoice_installments WHERE invoice_id = _invoice_id AND status = 'partially_paid';
  IF _partial_count > 0 THEN
    RAISE EXCEPTION 'Cannot regenerate plan: % installment(s) have partial payments attributed. Resolve those first.', _partial_count;
  END IF;

  DELETE FROM invoice_installments WHERE invoice_id = _invoice_id AND status = 'pending';
  _remaining := _invoice.total_minor - COALESCE(_invoice.paid_minor, 0);

  IF _custom_schedule IS NOT NULL THEN
    SELECT COALESCE(SUM((item->>'amount_minor')::INTEGER), 0) INTO _custom_sum
    FROM jsonb_array_elements(_custom_schedule) AS item;
    IF _custom_sum != _remaining THEN
      RAISE EXCEPTION 'Custom installment amounts (%) do not equal remaining balance (%)', _custom_sum, _remaining;
    END IF;
    FOR i IN 0 .. jsonb_array_length(_custom_schedule) - 1 LOOP
      INSERT INTO invoice_installments (invoice_id, org_id, installment_number, amount_minor, due_date, status)
      VALUES (_invoice_id, _org_id, i + 1,
        (_custom_schedule->i->>'amount_minor')::INTEGER,
        (_custom_schedule->i->>'due_date')::DATE, 'pending');
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
      ELSE '1 month'::INTERVAL END;
    FOR i IN 1 .. _count LOOP
      INSERT INTO invoice_installments (invoice_id, org_id, installment_number, amount_minor, due_date, status)
      VALUES (_invoice_id, _org_id, i,
        CASE WHEN i = _count THEN _last_amount ELSE _per_installment END,
        _current_date, 'pending');
      _current_date := _current_date + _interval;
    END LOOP;
    _final_count := _count;
    UPDATE invoices SET payment_plan_enabled = true, installment_count = _final_count WHERE id = _invoice_id;
  END IF;

  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'payment_plan_created', 'invoice', _invoice_id,
    jsonb_build_object('installment_count', _final_count, 'frequency', _frequency, 'remaining_minor', _remaining));

  RETURN QUERY SELECT * FROM invoice_installments
    WHERE invoice_id = _invoice_id ORDER BY installment_number;
END;
$$;

-- =============================================================================
-- Migration 4: 20260417200000 — paid → sent on refund
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_invoice_status_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF OLD.status = 'void' THEN
    RAISE EXCEPTION 'Invalid status transition from void to % (void is terminal)', NEW.status;
  END IF;
  IF OLD.status = 'paid' THEN
    IF NEW.status = 'sent' AND NEW.paid_minor < NEW.total_minor THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Invalid status transition from paid to % (paid_minor=%, total_minor=%). Refund-driven paid→sent allowed only when paid_minor < total_minor.',
      NEW.status, NEW.paid_minor, NEW.total_minor;
  END IF;
  -- A5: block any transition to void when paid_minor > 0
  IF NEW.status = 'void' AND COALESCE(NEW.paid_minor, 0) > 0 THEN
    RAISE EXCEPTION 'Cannot void invoice: paid_minor=% > 0. Refund payments first, then void.', NEW.paid_minor;
  END IF;
  IF OLD.status = 'draft' AND NEW.status NOT IN ('sent', 'void') THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;
  IF OLD.status = 'sent' AND NEW.status NOT IN ('paid', 'overdue', 'void') THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;
  IF OLD.status = 'overdue' AND NEW.status NOT IN ('paid', 'sent', 'void') THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- Migration 5: 20260417210000 — Block void on partial paid
-- (trigger already updated above with combined A4+A5 logic; just add the RPC)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.void_invoice(_invoice_id uuid, _org_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _invoice RECORD; _installments_voided integer; _credits_restored integer;
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;

  SELECT id, status, credit_applied_minor, payment_plan_enabled, paid_minor INTO _invoice
  FROM invoices WHERE id = _invoice_id AND org_id = _org_id FOR UPDATE;
  IF _invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF _invoice.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'Cannot void a % invoice', _invoice.status;
  END IF;

  IF COALESCE(_invoice.paid_minor, 0) > 0 THEN
    RAISE EXCEPTION 'Cannot void invoice with £% in paid payments. Refund the payments first, then void.',
      to_char(_invoice.paid_minor / 100.0, 'FM999,999,999.00');
  END IF;

  UPDATE invoice_items SET linked_lesson_id = NULL WHERE invoice_id = _invoice_id;
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

  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'invoice_voided', 'invoice', _invoice_id,
    jsonb_build_object('installments_voided', _installments_voided, 'credits_restored', _credits_restored,
      'credit_applied_minor', _invoice.credit_applied_minor));
END;
$function$;

-- =============================================================================
-- Migration 6: 20260417220000 — fix parent dashboard outstanding (A6)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_parent_dashboard_data(_user_id uuid, _org_id uuid)
 RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _guardian_id UUID; _student_ids UUID[]; _result JSON;
BEGIN
  IF _user_id != auth.uid() THEN RAISE EXCEPTION 'Unauthorized: user_id mismatch'; END IF;

  SELECT id INTO _guardian_id FROM guardians
  WHERE user_id = _user_id AND org_id = _org_id LIMIT 1;
  IF _guardian_id IS NULL THEN
    RETURN json_build_object('children', '[]'::json, 'next_lesson', null,
      'outstanding_balance', 0, 'overdue_count', 0, 'oldest_unpaid_invoice_id', null);
  END IF;

  SELECT array_agg(student_id) INTO _student_ids
  FROM student_guardians WHERE guardian_id = _guardian_id;
  IF _student_ids IS NULL THEN
    RETURN json_build_object('children', '[]'::json, 'next_lesson', null,
      'outstanding_balance', 0, 'overdue_count', 0, 'oldest_unpaid_invoice_id', null);
  END IF;

  SELECT json_build_object(
    'guardian_id', _guardian_id,
    'children', (
      SELECT COALESCE(json_agg(child_row), '[]'::json)
      FROM (
        SELECT s.id, s.first_name, s.last_name, s.status, s.dob,
          COALESCE((
            SELECT COUNT(*)::int FROM lesson_participants lp
            JOIN lessons l ON l.id = lp.lesson_id
            WHERE lp.student_id = s.id AND l.start_at >= now() AND l.status = 'scheduled'
          ), 0) AS upcoming_lesson_count,
          (
            SELECT json_build_object('id', l.id, 'title', l.title, 'start_at', l.start_at, 'end_at', l.end_at)
            FROM lesson_participants lp JOIN lessons l ON l.id = lp.lesson_id
            WHERE lp.student_id = s.id AND l.start_at >= now() AND l.status = 'scheduled'
            ORDER BY l.start_at ASC LIMIT 1
          ) AS next_lesson,
          COALESCE((
            SELECT SUM(i.total_minor - COALESCE(i.paid_minor, 0))::int
            FROM invoices i WHERE i.payer_student_id = s.id
              AND i.status IN ('sent', 'overdue') AND i.org_id = _org_id
          ), 0) AS outstanding_balance
        FROM students s WHERE s.id = ANY(_student_ids)
          AND s.status = 'active' AND s.deleted_at IS NULL
        ORDER BY s.first_name
      ) child_row
    ),
    'next_lesson', (
      SELECT json_build_object('id', l.id, 'title', l.title, 'start_at', l.start_at, 'end_at', l.end_at, 'location_name', loc.name)
      FROM lesson_participants lp JOIN lessons l ON l.id = lp.lesson_id
      LEFT JOIN locations loc ON loc.id = l.location_id
      WHERE lp.student_id = ANY(_student_ids) AND l.start_at >= now() AND l.status = 'scheduled'
      ORDER BY l.start_at ASC LIMIT 1
    ),
    'outstanding_balance', COALESCE((
      SELECT SUM(total_minor - COALESCE(paid_minor, 0))::int FROM invoices
      WHERE payer_guardian_id = _guardian_id AND status IN ('sent', 'overdue') AND org_id = _org_id
    ), 0),
    'overdue_count', (
      SELECT COUNT(*)::int FROM invoices
      WHERE payer_guardian_id = _guardian_id AND status = 'overdue' AND org_id = _org_id
    ),
    'oldest_unpaid_invoice_id', (
      SELECT id FROM invoices
      WHERE payer_guardian_id = _guardian_id AND status IN ('sent', 'overdue') AND org_id = _org_id
      ORDER BY due_date ASC LIMIT 1
    )
  ) INTO _result;

  RETURN _result;
END;
$function$;

NOTIFY pgrst, 'reload schema';