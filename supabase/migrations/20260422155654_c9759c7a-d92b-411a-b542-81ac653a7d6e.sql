-- =================================================================
-- Journey 5 — Refunds & Disputes (4 migrations bundled in order)
-- =================================================================

-- =================================================================
-- Migration 1: 20260422120000_refund_sum_safety_net.sql
-- =================================================================
CREATE OR REPLACE FUNCTION public.validate_refund_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _payment_amount integer;
  _existing_refunds integer;
  _total_after integer;
BEGIN
  SELECT amount_minor INTO _payment_amount
  FROM payments WHERE id = NEW.payment_id FOR UPDATE;

  IF _payment_amount IS NULL THEN
    RAISE EXCEPTION 'Payment not found for refund validation';
  END IF;

  IF NEW.amount_minor <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;

  IF NEW.amount_minor > _payment_amount THEN
    RAISE EXCEPTION 'Refund amount (%) exceeds payment amount (%)',
      NEW.amount_minor, _payment_amount;
  END IF;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _existing_refunds
  FROM refunds
  WHERE payment_id = NEW.payment_id
    AND status IN ('pending', 'succeeded')
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  _total_after := _existing_refunds + NEW.amount_minor;

  IF _total_after > _payment_amount THEN
    RAISE EXCEPTION 'Total refunded (%) would exceed payment amount (%). Already claimed: %',
      _total_after, _payment_amount, _existing_refunds;
  END IF;

  RETURN NEW;
END;
$$;

-- =================================================================
-- Migration 2: 20260422150000_payment_disputes_table.sql
-- =================================================================
CREATE TABLE IF NOT EXISTS payment_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  stripe_dispute_id text NOT NULL,
  stripe_charge_id text,
  stripe_payment_intent_id text,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency_code text NOT NULL,
  reason text NOT NULL,
  network_reason_code text,
  status text NOT NULL,
  evidence_due_by timestamptz,
  stripe_dashboard_url text,
  outcome text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  stripe_metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_disputes_stripe_id ON payment_disputes (stripe_dispute_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_payment ON payment_disputes (payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_invoice ON payment_disputes (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_org_status ON payment_disputes (org_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_active
  ON payment_disputes (org_id, evidence_due_by)
  WHERE status IN ('needs_response', 'warning_needs_response');

ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance team can view disputes" ON payment_disputes;
CREATE POLICY "Finance team can view disputes"
  ON payment_disputes FOR SELECT
  USING (is_org_finance_team(auth.uid(), org_id));

DROP POLICY IF EXISTS "Service role manages disputes" ON payment_disputes;
CREATE POLICY "Service role manages disputes"
  ON payment_disputes FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE OR REPLACE FUNCTION public.payment_disputes_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_disputes_updated_at ON payment_disputes;
CREATE TRIGGER trg_payment_disputes_updated_at
  BEFORE UPDATE ON payment_disputes
  FOR EACH ROW EXECUTE FUNCTION payment_disputes_touch_updated_at();

ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS refund_from_dispute_id uuid REFERENCES payment_disputes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_refunds_from_dispute ON refunds (refund_from_dispute_id)
  WHERE refund_from_dispute_id IS NOT NULL;

COMMENT ON COLUMN refunds.refund_from_dispute_id IS
'Non-null when this refund row was created automatically by the lost-dispute cascade. Distinguishes genuine refunds from chargeback reversals for reporting and messaging.';

CREATE OR REPLACE FUNCTION public.get_disputes_for_invoice(
  _invoice_id uuid,
  _org_id uuid
)
RETURNS SETOF payment_disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  SELECT * FROM payment_disputes
  WHERE invoice_id = _invoice_id AND org_id = _org_id
  ORDER BY opened_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_disputes_for_invoice(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_active_disputes_for_org(
  _org_id uuid
)
RETURNS SETOF payment_disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  SELECT * FROM payment_disputes
  WHERE org_id = _org_id
    AND status IN ('needs_response', 'warning_needs_response', 'under_review', 'warning_under_review')
  ORDER BY evidence_due_by ASC NULLS LAST, opened_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_active_disputes_for_org(uuid) TO authenticated;

-- =================================================================
-- Migration 3: 20260422160000_apply_lost_dispute_cascade_rpc.sql
-- =================================================================
CREATE OR REPLACE FUNCTION public.apply_lost_dispute_cascade(
  _dispute_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _dispute payment_disputes%ROWTYPE;
  _refund_id uuid;
  _recalc_result json;
  _existing_cascade_refund uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'apply_lost_dispute_cascade is service-role-only';
  END IF;

  SELECT * INTO _dispute FROM payment_disputes WHERE id = _dispute_id FOR UPDATE;
  IF _dispute IS NULL THEN
    RAISE EXCEPTION 'Dispute not found: %', _dispute_id;
  END IF;

  IF _dispute.outcome IS DISTINCT FROM 'lost' THEN
    RAISE EXCEPTION 'Cascade only applies to lost disputes, got outcome=%', _dispute.outcome;
  END IF;

  SELECT id INTO _existing_cascade_refund
  FROM refunds
  WHERE refund_from_dispute_id = _dispute_id
    AND status = 'succeeded'
  LIMIT 1;

  IF _existing_cascade_refund IS NOT NULL THEN
    RETURN json_build_object(
      'already_applied', true,
      'refund_id', _existing_cascade_refund
    );
  END IF;

  INSERT INTO refunds (
    payment_id, invoice_id, org_id, amount_minor, reason, status,
    stripe_refund_id, refunded_by, refund_from_dispute_id
  )
  VALUES (
    _dispute.payment_id,
    _dispute.invoice_id,
    _dispute.org_id,
    _dispute.amount_minor,
    format('Chargeback lost: %s', _dispute.reason),
    'succeeded',
    NULL,
    NULL,
    _dispute_id
  )
  RETURNING id INTO _refund_id;

  SELECT recalculate_invoice_paid(_dispute.invoice_id) INTO _recalc_result;

  INSERT INTO audit_log (
    org_id, actor_user_id, action, entity_type, entity_id, after
  )
  VALUES (
    _dispute.org_id,
    NULL,
    'dispute_lost_cascade_applied',
    'invoice',
    _dispute.invoice_id,
    jsonb_build_object(
      'dispute_id', _dispute_id,
      'refund_id', _refund_id,
      'amount_minor', _dispute.amount_minor,
      'recalc_result', _recalc_result
    )
  );

  RETURN json_build_object(
    'already_applied', false,
    'refund_id', _refund_id,
    'recalc_result', _recalc_result
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_lost_dispute_cascade(uuid) FROM PUBLIC, authenticated;

-- =================================================================
-- Migration 4: 20260422170000_refund_trigger_dispute_cascade_bypass.sql
-- =================================================================
CREATE OR REPLACE FUNCTION public.validate_refund_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _payment_amount integer;
  _existing_refunds integer;
  _total_after integer;
BEGIN
  SELECT amount_minor INTO _payment_amount
  FROM payments WHERE id = NEW.payment_id FOR UPDATE;

  IF _payment_amount IS NULL THEN
    RAISE EXCEPTION 'Payment not found for refund validation';
  END IF;

  IF NEW.amount_minor <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;

  IF NEW.amount_minor > _payment_amount THEN
    RAISE EXCEPTION 'Refund amount (%) exceeds payment amount (%)',
      NEW.amount_minor, _payment_amount;
  END IF;

  -- Dispute-cascade bypass.
  IF NEW.refund_from_dispute_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount_minor), 0) INTO _existing_refunds
  FROM refunds
  WHERE payment_id = NEW.payment_id
    AND status IN ('pending', 'succeeded')
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  _total_after := _existing_refunds + NEW.amount_minor;

  IF _total_after > _payment_amount THEN
    RAISE EXCEPTION 'Total refunded (%) would exceed payment amount (%). Already claimed: %',
      _total_after, _payment_amount, _existing_refunds;
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';