-- ============================================================
-- 20260502100000_webhook_dedup_two_phase.sql (reordered)
-- ============================================================
ALTER TABLE public.stripe_webhook_events
  ALTER COLUMN processed_at DROP NOT NULL;

ALTER TABLE public.stripe_webhook_events
  ALTER COLUMN processed_at DROP DEFAULT;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_in_flight
  ON public.stripe_webhook_events (event_id, created_at)
  WHERE processed_at IS NULL;

COMMENT ON COLUMN public.stripe_webhook_events.processed_at IS
  'NULL = in flight; non-NULL = completed successfully. Set by stripe-webhook on handler success.';
COMMENT ON COLUMN public.stripe_webhook_events.created_at IS
  'When the webhook was first received. Used for stale-row recovery (in flight > 90s = crashed).';

-- ============================================================
-- 20260502110000_message_log_payment_id.sql
-- ============================================================
ALTER TABLE public.message_log
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_message_log_payment_id
  ON public.message_log (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_log_payment_receipt_dedup
  ON public.message_log (payment_id)
  WHERE message_type = 'payment_receipt' AND payment_id IS NOT NULL;

-- ============================================================
-- 20260502120000_platform_audit_log.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  source text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_audit_log IS
  'Platform-scoped audit events with no org attribution. Service-role only.';
COMMENT ON COLUMN public.platform_audit_log.action IS
  'Snake_case event identifier, e.g. webhook_stale_recovery, cron_health_alert.';
COMMENT ON COLUMN public.platform_audit_log.source IS
  'Originating component, e.g. stripe-webhook, cron-watchdog.';
COMMENT ON COLUMN public.platform_audit_log.severity IS
  'info / warning / error / critical. Drives operator alerting downstream.';
COMMENT ON COLUMN public.platform_audit_log.details IS
  'Structured event payload. Schema is per-action and not enforced at the DB layer.';

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_action_created
  ON public.platform_audit_log (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_created
  ON public.platform_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_severity_created
  ON public.platform_audit_log (severity, created_at DESC)
  WHERE severity IN ('warning', 'error', 'critical');

ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';