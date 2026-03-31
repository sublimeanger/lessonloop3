-- Cleanup old webhook events (run manually or via periodic job)
-- DELETE FROM stripe_webhook_events WHERE processed_at < NOW() - INTERVAL '90 days';
COMMENT ON TABLE stripe_webhook_events IS
  'Stores Stripe webhook event IDs for deduplication. Events older than 90 days can be safely deleted.';
