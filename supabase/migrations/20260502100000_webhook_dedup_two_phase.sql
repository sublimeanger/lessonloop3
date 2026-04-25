-- Track 0.5 Phase 1 — Two-phase webhook dedup.
--
-- The previous dedup pattern inserted a row at handler entry. If the
-- handler then threw, the row remained, and Stripe's retry hit the
-- 23505 short-circuit and never re-ran the handler. Real money risk
-- on transient DB errors during record_stripe_payment.
--
-- New semantics:
--   processed_at IS NULL  → in flight (received, handler not complete)
--   processed_at IS NOT NULL → completed successfully, dedup
--
-- Failure path DELETEs the in-flight row so Stripe's retry can re-INSERT
-- and re-run the handler. Stale rows (in flight > 90s) are recoverable
-- because the Supabase edge fn timeout is 150s — anything older is by
-- definition crashed.

-- Drop NOT NULL. Existing rows already have processed_at set; this is
-- additive and idempotent.
ALTER TABLE public.stripe_webhook_events
  ALTER COLUMN processed_at DROP NOT NULL;

-- Default removed too — webhooks are now responsible for setting it
-- explicitly on success. Existing rows unaffected (DEFAULT only fires
-- on INSERT without explicit value).
ALTER TABLE public.stripe_webhook_events
  ALTER COLUMN processed_at DROP DEFAULT;

-- Partial index for efficient stale-row scans. Without this, the
-- "find in-flight row older than 90s" check would seq-scan the whole
-- table on every webhook arrival.
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_in_flight
  ON public.stripe_webhook_events (event_id, created_at)
  WHERE processed_at IS NULL;

-- Add created_at column if not present. The original schema relied on
-- processed_at as both "received" and "completed" — separating them
-- means we need a true "received" timestamp for stale detection.
ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.stripe_webhook_events.processed_at IS
  'NULL = in flight; non-NULL = completed successfully. Set by stripe-webhook on handler success.';
COMMENT ON COLUMN public.stripe_webhook_events.created_at IS
  'When the webhook was first received. Used for stale-row recovery (in flight > 90s = crashed).';
