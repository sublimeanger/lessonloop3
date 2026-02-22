
-- Deduplication table for Stripe webhook events.
-- Stripe can retry webhooks up to ~100 times over 3 days;
-- this table ensures each event is processed exactly once.
CREATE TABLE public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for periodic cleanup of old events
CREATE INDEX idx_stripe_webhook_events_processed_at ON public.stripe_webhook_events (processed_at);

-- No RLS needed — only accessed by service_role from edge functions
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
