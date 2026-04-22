-- Journey 5 Track B — Dispute data model.
--
-- Stripe chargeback infrastructure. Three event streams land here:
--   charge.dispute.created  → INSERT
--   charge.dispute.updated  → UPDATE status/evidence_due_by
--   charge.dispute.closed   → UPDATE status=won|lost, closed_at,
--                              outcome; if lost, compensating refund
--                              row inserted with refund_from_dispute_id
--                              pointing back here.
--
-- Invoice status stays 'paid' throughout active dispute. Dispute
-- state surfaces via UI banner + list flag, not via enum change.
-- If lost, compensating refund cascades through recalculate_invoice_paid
-- naturally (paid → sent/overdue via existing due-date-aware branch).

BEGIN;

CREATE TABLE IF NOT EXISTS payment_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Stripe-side identifiers (UNIQUE — dedup across webhook retries)
  stripe_dispute_id text NOT NULL,
  stripe_charge_id text,
  stripe_payment_intent_id text,

  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency_code text NOT NULL,

  -- Stripe reason enum (stored as text for forward-compat with new reasons).
  -- Common values: fraudulent, unrecognized, duplicate, subscription_canceled,
  --   product_not_received, product_unacceptable, unrecognized, credit_not_processed,
  --   general, incorrect_account_details, insufficient_funds, bank_cannot_process,
  --   debit_not_authorized, customer_initiated.
  reason text NOT NULL,
  network_reason_code text,

  -- Stripe status enum. needs_response/under_review/warning_needs_response/
  -- warning_under_review = active; won/lost/warning_closed/charge_refunded = terminal.
  status text NOT NULL,

  -- Set by Stripe at open. Operator must submit evidence via Stripe
  -- Dashboard by this time or the dispute defaults to lost.
  evidence_due_by timestamptz,

  -- Direct link to Stripe dashboard for operator one-click access.
  stripe_dashboard_url text,

  -- Terminal outcome — null until closed. Values: won, lost,
  -- warning_closed (informational warning, no money move), inquiry_closed.
  outcome text,

  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,

  -- Full Stripe event payload snapshot for forensics.
  stripe_metadata jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_payment_disputes_stripe_id ON payment_disputes (stripe_dispute_id);
CREATE INDEX idx_payment_disputes_payment ON payment_disputes (payment_id);
CREATE INDEX idx_payment_disputes_invoice ON payment_disputes (invoice_id);
CREATE INDEX idx_payment_disputes_org_status ON payment_disputes (org_id, status);
-- Partial index for active-dispute queries (dashboard urgent actions)
CREATE INDEX idx_payment_disputes_active
  ON payment_disputes (org_id, evidence_due_by)
  WHERE status IN ('needs_response', 'warning_needs_response');

ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;

-- Finance team can view disputes. Matches refunds / invoice RLS pattern.
CREATE POLICY "Finance team can view disputes"
  ON payment_disputes FOR SELECT
  USING (is_org_finance_team(auth.uid(), org_id));

-- Service role only writes (webhook path). No admin-facing INSERT/UPDATE
-- RPC in this journey — evidence submission happens via Stripe dashboard.
CREATE POLICY "Service role manages disputes"
  ON payment_disputes FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.payment_disputes_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_disputes_updated_at
  BEFORE UPDATE ON payment_disputes
  FOR EACH ROW EXECUTE FUNCTION payment_disputes_touch_updated_at();

-- ─── Refund FK back to dispute (for lost-dispute cascade) ────────────────

ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS refund_from_dispute_id uuid REFERENCES payment_disputes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_refunds_from_dispute ON refunds (refund_from_dispute_id)
  WHERE refund_from_dispute_id IS NOT NULL;

COMMENT ON COLUMN refunds.refund_from_dispute_id IS
'Non-null when this refund row was created automatically by the lost-dispute cascade. Distinguishes genuine refunds from chargeback reversals for reporting and messaging.';

-- ─── Finance-team read RPC for frontend ──────────────────────────────────

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

NOTIFY pgrst, 'reload schema';

COMMIT;
