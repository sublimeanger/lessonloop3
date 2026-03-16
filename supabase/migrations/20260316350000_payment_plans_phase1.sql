-- ============================================================
-- Payment Plans Phase 1: Org defaults, student preference,
-- update/cancel RPCs, record_installment_payment RPC
-- ============================================================

-- 1. Org-level payment plan defaults
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS default_plan_threshold_minor INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS default_plan_installments INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS default_plan_frequency TEXT NOT NULL DEFAULT 'monthly';

ALTER TABLE public.organisations
  ADD CONSTRAINT chk_org_plan_frequency
    CHECK (default_plan_frequency IN ('monthly', 'fortnightly', 'custom'));

ALTER TABLE public.organisations
  ADD CONSTRAINT chk_org_plan_installments
    CHECK (default_plan_installments BETWEEN 2 AND 12);

-- 2. Student-level plan preference
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS payment_plan_preference TEXT NOT NULL DEFAULT 'default';

ALTER TABLE public.students
  ADD CONSTRAINT chk_student_plan_pref
    CHECK (payment_plan_preference IN ('default', 'always', 'never'));

-- 3. update_payment_plan RPC
-- Preserves paid installments; re-splits remaining balance across new count
CREATE OR REPLACE FUNCTION public.update_payment_plan(
  p_invoice_id UUID,
  p_installments INTEGER,
  p_frequency TEXT DEFAULT 'monthly'
)
RETURNS SETOF public.invoice_installments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _invoice RECORD;
  _caller_id UUID;
  _paid_total INTEGER;
  _remaining INTEGER;
  _per_installment INTEGER;
  _last_amount INTEGER;
  _current_date DATE;
  _interval INTERVAL;
  _next_number INTEGER;
  i INTEGER;
BEGIN
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock and fetch invoice
  SELECT * INTO _invoice FROM invoices
    WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Verify caller is admin/owner/finance of invoice's org
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = _caller_id
      AND org_id = _invoice.org_id
      AND status = 'active'
      AND role IN ('owner', 'admin', 'finance')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Cannot modify paid/void invoices
  IF _invoice.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'Cannot modify payment plan on % invoice', _invoice.status;
  END IF;

  -- Validate inputs
  IF p_installments < 2 OR p_installments > 12 THEN
    RAISE EXCEPTION 'Installments must be between 2 and 12';
  END IF;

  IF p_frequency NOT IN ('monthly', 'fortnightly', 'custom') THEN
    RAISE EXCEPTION 'Invalid frequency';
  END IF;

  -- Sum already paid installments
  SELECT COALESCE(SUM(amount_minor), 0) INTO _paid_total
  FROM invoice_installments
  WHERE invoice_id = p_invoice_id AND status = 'paid';

  -- Delete only unpaid installments
  DELETE FROM invoice_installments
  WHERE invoice_id = p_invoice_id AND status IN ('pending', 'overdue');

  -- Calculate remaining balance to split
  _remaining := _invoice.total_minor - _paid_total;
  IF _remaining <= 0 THEN
    RAISE EXCEPTION 'No remaining balance to split';
  END IF;

  -- Get next installment number (after any paid ones)
  SELECT COALESCE(MAX(installment_number), 0) + 1 INTO _next_number
  FROM invoice_installments
  WHERE invoice_id = p_invoice_id;

  _per_installment := _remaining / p_installments;
  _last_amount := _remaining - (_per_installment * (p_installments - 1));

  _current_date := COALESCE(_invoice.due_date, CURRENT_DATE);
  -- If there were paid installments, start from today instead
  IF _paid_total > 0 THEN
    _current_date := CURRENT_DATE;
  END IF;

  _interval := CASE p_frequency
    WHEN 'fortnightly' THEN '14 days'::INTERVAL
    WHEN 'monthly' THEN '1 month'::INTERVAL
    ELSE '1 month'::INTERVAL
  END;

  FOR i IN 1 .. p_installments LOOP
    INSERT INTO invoice_installments (
      invoice_id, org_id, installment_number,
      amount_minor, due_date, status
    ) VALUES (
      p_invoice_id, _invoice.org_id, _next_number + i - 1,
      CASE WHEN i = 1 THEN _last_amount ELSE _per_installment END,
      _current_date,
      'pending'
    );
    _current_date := _current_date + _interval;
  END LOOP;

  -- Update invoice installment count (paid + new unpaid)
  UPDATE invoices SET
    payment_plan_enabled = true,
    installment_count = (
      SELECT COUNT(*) FROM invoice_installments WHERE invoice_id = p_invoice_id
    )
  WHERE id = p_invoice_id;

  RETURN QUERY SELECT * FROM invoice_installments
    WHERE invoice_id = p_invoice_id
    ORDER BY installment_number;
END;
$$;

-- 4. cancel_payment_plan RPC
CREATE OR REPLACE FUNCTION public.cancel_payment_plan(
  p_invoice_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _invoice RECORD;
  _caller_id UUID;
  _paid_count INTEGER;
BEGIN
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock and fetch invoice
  SELECT * INTO _invoice FROM invoices
    WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Verify caller is admin/owner/finance of invoice's org
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = _caller_id
      AND org_id = _invoice.org_id
      AND status = 'active'
      AND role IN ('owner', 'admin', 'finance')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Check if any installments are paid
  SELECT COUNT(*) INTO _paid_count
  FROM invoice_installments
  WHERE invoice_id = p_invoice_id AND status = 'paid';

  IF _paid_count > 0 THEN
    RAISE EXCEPTION 'Cannot cancel plan with paid installments';
  END IF;

  -- Delete all installment records
  DELETE FROM invoice_installments
  WHERE invoice_id = p_invoice_id;

  -- Reset invoice to single-payment mode
  UPDATE invoices SET
    payment_plan_enabled = false,
    installment_count = NULL
  WHERE id = p_invoice_id;
END;
$$;

-- 5. record_installment_payment RPC
-- Atomic: updates installment + parent invoice + status
CREATE OR REPLACE FUNCTION public.record_installment_payment(
  p_installment_id UUID,
  p_amount_minor INTEGER,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _installment RECORD;
  _invoice RECORD;
  _total_inst_paid INTEGER;
  _all_paid BOOLEAN;
  _net_paid INTEGER;
  _total_refunded INTEGER;
BEGIN
  -- Lock and fetch installment
  SELECT * INTO _installment FROM invoice_installments
    WHERE id = p_installment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found';
  END IF;

  IF _installment.status NOT IN ('pending', 'overdue') THEN
    RAISE EXCEPTION 'Installment is not payable (status: %)', _installment.status;
  END IF;

  -- Lock parent invoice
  SELECT * INTO _invoice FROM invoices
    WHERE id = _installment.invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent invoice not found';
  END IF;

  IF _invoice.status IN ('void', 'cancelled') THEN
    RETURN json_build_object('skipped', true, 'reason', 'Invoice is ' || _invoice.status);
  END IF;

  -- Update installment
  UPDATE invoice_installments SET
    status = 'paid',
    paid_at = NOW(),
    stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id)
  WHERE id = p_installment_id;

  -- Recalculate invoice paid_minor from all payments
  SELECT COALESCE(SUM(amount_minor), 0) INTO _net_paid
  FROM payments WHERE invoice_id = _installment.invoice_id;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _total_refunded
  FROM refunds WHERE invoice_id = _installment.invoice_id AND status = 'succeeded';

  _net_paid := _net_paid - _total_refunded;

  -- Check if all installments are paid
  SELECT NOT EXISTS (
    SELECT 1 FROM invoice_installments
    WHERE invoice_id = _installment.invoice_id
      AND status IN ('pending', 'overdue')
  ) INTO _all_paid;

  -- Update invoice
  IF _all_paid AND _net_paid >= _invoice.total_minor THEN
    UPDATE invoices SET paid_minor = _net_paid, status = 'paid'
    WHERE id = _installment.invoice_id;
  ELSE
    UPDATE invoices SET paid_minor = _net_paid
    WHERE id = _installment.invoice_id;
  END IF;

  RETURN json_build_object(
    'installment_id', p_installment_id,
    'invoice_id', _installment.invoice_id,
    'all_paid', _all_paid,
    'net_paid', _net_paid,
    'new_status', CASE WHEN _all_paid AND _net_paid >= _invoice.total_minor THEN 'paid' ELSE _invoice.status END
  );
END;
$$;
