-- Journey 5 Track B — Lost dispute cascade RPC.
--
-- When Stripe closes a dispute as LOST, the funds have permanently
-- moved from our Connect platform account back to the cardholder.
-- Local ledger must reflect this: insert a compensating refund row
-- with refund_from_dispute_id pointing at the dispute, then recalc.
--
-- Using the refunds table (not a new 'chargebacks' table) keeps a
-- single source of truth for paid_minor computation — recalculate_invoice_paid
-- already sums refunds.status='succeeded' and flips paid→sent/overdue
-- via the A4 due-date-aware branch. Zero changes needed in that path.
--
-- The compensating refund is flagged via refund_from_dispute_id so
-- reporting and messaging can distinguish it from a genuine refund.

BEGIN;

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
  -- No auth gate: this RPC is only called by the stripe-webhook
  -- edge fn running service-role. Adding an is_org_finance_team
  -- check would block it. Defence-in-depth: ensure auth.uid() IS NULL
  -- (service-role has no auth.uid()).
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

  -- Idempotency: if a cascade refund already exists for this dispute,
  -- return it. Prevents duplicate refund rows on webhook retries
  -- that arrive after the cascade has already run.
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

  -- Insert compensating refund. status=succeeded because the money
  -- has already moved on Stripe's side; this row just catches up
  -- our local ledger.
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
    NULL, -- no stripe_refund_id; this isn't a Stripe refund object
    NULL, -- no user actor; automated cascade
    _dispute_id
  )
  RETURNING id INTO _refund_id;

  -- Recalculate parent invoice. paid→sent (or overdue via due-date
  -- branch in recalculate_invoice_paid A4 logic) will fire naturally.
  SELECT recalculate_invoice_paid(_dispute.invoice_id) INTO _recalc_result;

  -- Audit log the cascade itself (separate from the generic
  -- dispute_closed entry written by the webhook handler).
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

-- Not granted to authenticated — service-role only.
REVOKE ALL ON FUNCTION public.apply_lost_dispute_cascade(uuid) FROM PUBLIC, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
