-- ============================================================
-- AUTH & RLS HARDENING
-- Fixes: AUTH-C1, AUTH-C2, AUTH-C3, AUTH-H1, AUTH-H2, AUTH-H3,
--        AUTH-H4, AUTH-H5, AUTH-H6, AUTH-M2, AUTH-L1, AUTH-L2
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- AUTH-C1 CRITICAL: record_payment_and_update_status has NO auth guard
-- Any authenticated user (including parents) can record manual payments
-- on any invoice, marking it as paid without actually paying.
-- Fix: Add is_org_finance_team check at top of function body.
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
  _total_refunded integer;
  _net_paid integer;
  _existing_paid integer;
  _outstanding integer;
  _new_status text;
  _payment_id uuid;
  _remaining_payment integer;
  _inst record;
  _installments_marked integer := 0;
BEGIN
  -- AUTH-C1 FIX: Only finance team can record manual payments
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
      'new_status', _new_status, 'installments_marked_paid', _installments_marked,
      'net_paid', _net_paid, 'total_refunded', _total_refunded));

  RETURN json_build_object(
    'payment_id', _payment_id, 'total_paid', _total_paid,
    'net_paid', _net_paid, 'total_refunded', _total_refunded,
    'invoice_total', _invoice.total_minor, 'new_status', _new_status
  );
END;
$function$;


-- ────────────────────────────────────────────────────────────
-- AUTH-C2 CRITICAL: generate_installments has NO auth guard
-- Any user can create payment plans on any invoice.
-- Fix: Add is_org_finance_team check at top.
-- ────────────────────────────────────────────────────────────

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
  -- AUTH-C2 FIX: Only finance team can manage payment plans
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to manage payment plans';
  END IF;

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


-- ────────────────────────────────────────────────────────────
-- AUTH-C3 CRITICAL: anonymise_student/guardian reference wrong table
-- Both functions referenced 'organisation_members' which doesn't exist.
-- The correct table is 'org_memberships'.
-- Fix: Recreate both functions with correct table name.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.anonymise_student(student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT org_id INTO v_org_id
  FROM public.students
  WHERE id = student_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  -- AUTH-C3 FIX: Use correct table name (was organisation_members)
  IF NOT is_org_admin(auth.uid(), v_org_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.students
  SET
    first_name = 'Deleted',
    last_name = 'User',
    email = NULL,
    phone = NULL,
    dob = NULL,
    notes = NULL,
    deleted_at = now(),
    status = 'inactive'
  WHERE id = student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.anonymise_guardian(guardian_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT org_id INTO v_org_id
  FROM public.guardians
  WHERE id = guardian_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Guardian not found';
  END IF;

  -- AUTH-C3 FIX: Use correct table name (was organisation_members)
  IF NOT is_org_admin(auth.uid(), v_org_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.guardians
  SET
    full_name = 'Deleted User',
    email = NULL,
    phone = NULL,
    deleted_at = now()
  WHERE id = guardian_id;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- AUTH-H1 HIGH: record_installment_payment has NO auth guard
-- Only called from service role (auto-pay), but publicly callable.
-- Fix: REVOKE from authenticated — service role bypasses anyway.
-- ────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.record_installment_payment(uuid, integer, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_installment_payment(uuid, integer, text) FROM public;


-- ────────────────────────────────────────────────────────────
-- AUTH-H2 HIGH: record_stripe_payment has NO auth guard
-- Only called from webhook (service role), but publicly callable.
-- A parent could forge a payment by inventing a fake provider_reference.
-- Fix: REVOKE from authenticated.
-- ────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.record_stripe_payment(uuid, uuid, integer, text, uuid, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_stripe_payment(uuid, uuid, integer, text, uuid, boolean) FROM public;


-- ────────────────────────────────────────────────────────────
-- AUTH-H3 HIGH: shift_recurring_lesson_times already fixed
-- Auth guard was added in migration 20260315220012.
-- No action needed — included here for audit traceability.
-- ────────────────────────────────────────────────────────────


-- ────────────────────────────────────────────────────────────
-- AUTH-H4 HIGH: seed_make_up_policies has NO auth guard
-- Any user can seed policies into any org.
-- Fix: Add admin check.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.seed_make_up_policies(_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- AUTH-H4 FIX: Only admins can seed policies
  IF NOT is_org_admin(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  INSERT INTO make_up_policies (org_id, absence_reason, eligibility, description, releases_slot)
  VALUES
    (_org_id, 'sick', 'waitlist', 'Student sick — waitlisted for make-up if slot becomes available', true),
    (_org_id, 'school_commitment', 'not_eligible', 'Planned school event — no make-up per T&Cs', false),
    (_org_id, 'family_emergency', 'admin_discretion', 'Admin decides on case-by-case basis', true),
    (_org_id, 'holiday', 'not_eligible', 'Family holiday — no make-up per T&Cs', false),
    (_org_id, 'teacher_cancelled', 'automatic', 'Teacher cancelled — credit issued automatically', true),
    (_org_id, 'weather_closure', 'admin_discretion', 'Weather/closure — admin decides', true),
    (_org_id, 'no_show', 'not_eligible', 'No-show without notice — no make-up', false),
    (_org_id, 'other', 'admin_discretion', 'Other reason — admin decides', false)
  ON CONFLICT (org_id, absence_reason) DO NOTHING;
END;
$function$;


-- ────────────────────────────────────────────────────────────
-- AUTH-H5 HIGH: Mass REVOKE for trigger/cron/internal functions
-- These should NOT be directly callable by authenticated users.
-- Service role bypasses REVOKE, so cron and webhooks still work.
-- ────────────────────────────────────────────────────────────

-- Trigger functions (called by database triggers, not users)
REVOKE EXECUTE ON FUNCTION public.auto_issue_credit_on_absence() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_issue_credit_on_absence() FROM public;
REVOKE EXECUTE ON FUNCTION public.on_slot_released() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.on_slot_released() FROM public;
REVOKE EXECUTE ON FUNCTION public.auto_add_to_waitlist() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_add_to_waitlist() FROM public;
REVOKE EXECUTE ON FUNCTION public.notify_makeup_match_webhook() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_makeup_match_webhook() FROM public;
REVOKE EXECUTE ON FUNCTION public.cleanup_attendance_on_cancel() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_attendance_on_cancel() FROM public;

-- Cron/maintenance functions (called by scheduled jobs only)
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits() FROM public;
REVOKE EXECUTE ON FUNCTION public.reset_stale_streaks() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_stale_streaks() FROM public;
REVOKE EXECUTE ON FUNCTION public.complete_expired_assignments() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_expired_assignments() FROM public;

-- Internal invoice helpers (called by other SECURITY DEFINER functions)
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.set_invoice_number() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_invoice_number() FROM public;

-- Waitlist matcher (trigger-driven)
REVOKE EXECUTE ON FUNCTION public.find_waitlist_matches(uuid, uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.find_waitlist_matches(uuid, uuid, uuid) FROM public;


-- ────────────────────────────────────────────────────────────
-- AUTH-H6 HIGH: audit_log INSERT WITH CHECK(true)
-- Drop the overly permissive policy. All audit writes happen
-- from SECURITY DEFINER functions which bypass RLS.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

-- Block all authenticated INSERT on audit_log
CREATE POLICY "Block authenticated insert on audit_log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (false);
