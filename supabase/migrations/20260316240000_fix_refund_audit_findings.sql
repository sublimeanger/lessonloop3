-- ============================================================
-- Fix refund audit findings (REF-C1, REF-H2, REF-M5, REF-L1, REF-L2)
-- Audit: audit-feature-14-refunds.md
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- REF-C1 CRITICAL: Fix RLS on refunds table
-- The "Service role can manage refunds" policy used FOR ALL USING(true),
-- granting ANY authenticated user (including parents) full CRUD on refunds.
-- Service role already bypasses RLS — no permissive policy needed for it.
-- Fix: drop the broken policy; add proper scoped policies.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role can manage refunds" ON refunds;

-- Staff (owner/admin/teacher/finance) can view refunds for their org
-- (original SELECT policy kept as-is — is_org_staff already correct)

-- REF-L1: Parents can view refunds on their own invoices
CREATE POLICY "Parents can view own refunds"
  ON refunds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = refunds.invoice_id
      AND (
        i.payer_guardian_id IN (SELECT g.id FROM guardians g WHERE g.user_id = auth.uid())
        OR i.payer_student_id IN (SELECT s.id FROM students s WHERE s.user_id = auth.uid())
      )
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated users.
-- All refund mutations happen via:
--   1. stripe-process-refund edge function (service role)
--   2. stripe-webhook handler (service role)
-- Service role bypasses RLS entirely — no policy needed.


-- ────────────────────────────────────────────────────────────
-- REF-H2: Fix record_payment_and_update_status to account
-- for refunds in outstanding calculation.
-- Previously: _outstanding = total_minor - SUM(payments)
-- Now: _outstanding = total_minor - SUM(payments) + SUM(succeeded refunds)
-- This ensures refunded amounts free up outstanding balance.
-- Also uses recalculate_invoice_paid pattern for status determination.
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
  SELECT id, total_minor, status, payment_plan_enabled INTO _invoice
  FROM public.invoices WHERE id = _invoice_id AND org_id = _org_id FOR UPDATE;

  IF _invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF _invoice.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'Cannot record payment on a % invoice', _invoice.status;
  END IF;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _existing_paid
  FROM public.payments WHERE invoice_id = _invoice_id;

  -- REF-H2 FIX: Account for refunds in outstanding calculation.
  -- Refunded amounts free up outstanding balance.
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

  -- Recalculate net paid (payments minus refunds) for accurate status
  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_paid
  FROM public.payments WHERE invoice_id = _invoice_id;

  _net_paid := _total_paid - _total_refunded;

  -- Update paid_minor to net amount
  UPDATE invoices SET paid_minor = _net_paid WHERE id = _invoice_id;

  IF _net_paid >= _invoice.total_minor THEN
    _new_status := 'paid';
    UPDATE public.invoices SET status = 'paid' WHERE id = _invoice_id;
  ELSE
    _new_status := _invoice.status::text;
  END IF;

  -- Audit log
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
-- REF-M5: Tighten recalculate_invoice_paid auth check
-- from is_org_member (any role) to is_org_finance_team
-- (owner/admin/finance only). Teachers should not be able
-- to trigger invoice status changes.
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

  -- Auth check: allow service role (auth.uid() IS NULL) or finance team
  IF auth.uid() IS NOT NULL AND NOT is_org_finance_team(auth.uid(), _invoice.org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  -- REF-M6 POLICY: Make-up credits are NOT auto-restored on refund.
  -- Rationale: refund returns money but doesn't void the invoice relationship.
  -- Credits are only restored when an invoice is voided (via void_invoice RPC),
  -- which cancels the entire invoice. Refunds are a payment-level operation.

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


-- ────────────────────────────────────────────────────────────
-- REF-L2: Add trigger to validate refund amount <= payment amount
-- Prevents over-refund at the DB level as a safety net.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_refund_amount()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
  _payment_amount integer;
BEGIN
  SELECT amount_minor INTO _payment_amount
  FROM payments WHERE id = NEW.payment_id;

  IF _payment_amount IS NULL THEN
    RAISE EXCEPTION 'Payment not found for refund validation';
  END IF;

  IF NEW.amount_minor > _payment_amount THEN
    RAISE EXCEPTION 'Refund amount (%) exceeds payment amount (%)',
      NEW.amount_minor, _payment_amount;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_refund_amount ON refunds;
CREATE TRIGGER trg_validate_refund_amount
  BEFORE INSERT OR UPDATE OF amount_minor ON refunds
  FOR EACH ROW EXECUTE FUNCTION validate_refund_amount();
