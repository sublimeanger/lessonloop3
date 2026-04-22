-- Journey 5 audit fix — dispute-cascade trigger bypass.
--
-- Post-close audit surfaced a real rejection scenario: the SUM gate
-- added to validate_refund_amount (Commit 1, 20260422120000) would
-- reject apply_lost_dispute_cascade's INSERT whenever ANY prior
-- partial refund existed on the same payment. Stripe's dispute.amount
-- is the full charge amount — it does NOT reduce by prior refunds —
-- so a £100 payment with a £1 prior refund + £100 dispute lost would
-- try to insert a £100 refund and fail the 1+100>100 check.
--
-- Fix: bypass the SUM check for refund rows originating from a
-- dispute cascade (refund_from_dispute_id IS NOT NULL). These
-- represent money Stripe has already moved back to the cardholder;
-- the local over-refund gate is a safety net against Stripe/RPC
-- initiating refunds above the paid amount, which does not apply
-- to cascades catching up to a completed chargeback.
--
-- Payment existence, amount > 0, and single-row amount <= payment_amount
-- checks are retained — the cascade still shouldn't produce an
-- individual refund exceeding the parent payment's face amount.

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_refund_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _payment_amount integer;
  _existing_refunds integer;
  _total_after integer;
BEGIN
  -- Lock the payment row to serialise concurrent refund INSERTs
  -- against the same payment. Two sessions inserting simultaneously
  -- will queue here; the second reads an updated SUM.
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

  -- Dispute-cascade bypass. Stripe has already moved the money;
  -- this row exists to catch up the local ledger. The SUM check
  -- below would produce false rejection whenever prior partial
  -- refunds exist, because dispute.amount isn't reduced by them.
  IF NEW.refund_from_dispute_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Sum all non-failed refunds EXCLUDING the current row (if this is
  -- an UPDATE). Pending counts toward the total — a pending refund
  -- represents an in-flight claim on the payment; allowing another
  -- INSERT that ignores it can result in Stripe-level over-refund
  -- if both pending rows succeed.
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

COMMIT;
