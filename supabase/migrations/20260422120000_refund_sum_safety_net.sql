-- Journey 5 Track A — Refund SUM safety net at DB layer.
--
-- Today validate_refund_amount only checks the new row's amount
-- against the parent payment. Two concurrent partial refunds can
-- each individually pass and collectively over-refund the payment.
-- Application-layer checks in record_manual_refund (RPC) and
-- stripe-process-refund (edge fn) both compute SUM pre-INSERT;
-- neither is concurrency-safe for the edge function path (no row
-- lock) and neither catches direct service-role inserts.
--
-- Fix: upgrade the trigger to check SUM of all non-failed refunds
-- (pending + succeeded) plus NEW.amount_minor against payment.
-- Service-role-safe; concurrency-safe by virtue of the existing
-- SERIALIZABLE-equivalent INSERT path taking a row lock on payment
-- implicitly via the subquery in many paths — but explicit for the
-- safety net: add a payment-row lock inside the trigger itself.

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

-- Trigger already exists (20260316240000); CREATE OR REPLACE FUNCTION
-- above is sufficient to pick up the new body. No trigger DDL needed.

COMMIT;
