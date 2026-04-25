-- Track 0.5 Phase 1 — Add payment_id column + UNIQUE for receipt dedup.
--
-- send-payment-receipt is invoked from stripe-webhook handlers as
-- fire-and-forget. Without internal idempotency, a webhook retry that
-- re-runs the handler under the new two-phase dedup pattern would
-- re-invoke the receipt send and double-email the parent.
--
-- Adding payment_id (FK to payments) and a partial UNIQUE on
-- (payment_id) WHERE message_type='payment_receipt' is the cleanest
-- enforcement: the second insert hits 23505 and the function short-
-- circuits before sending Resend. Other message_types are unaffected
-- (payment_id remains NULL for them, partial index ignores NULLs).

ALTER TABLE public.message_log
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_message_log_payment_id
  ON public.message_log (payment_id)
  WHERE payment_id IS NOT NULL;

-- Partial UNIQUE: one payment_receipt row per payment_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_log_payment_receipt_dedup
  ON public.message_log (payment_id)
  WHERE message_type = 'payment_receipt' AND payment_id IS NOT NULL;
