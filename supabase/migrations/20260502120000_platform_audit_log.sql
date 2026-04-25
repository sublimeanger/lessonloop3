-- Track 0.5 Phase 1 — Platform-scoped audit log.
--
-- The existing public.audit_log table requires org_id NOT NULL — every
-- entry must be attributable to a tenant org. That contract is correct
-- and worth preserving (RLS policies depend on it; per-org export
-- queries assume it).
--
-- Some events are platform-level by nature: webhook stale-recovery,
-- cron health alerts (future T08-P2), vault rotation events, scheduled
-- maintenance markers. They have no org. They need their own audit
-- surface so they don't pollute audit_log's contract or get lost as
-- raw console output.
--
-- platform_audit_log is service-role-only (no RLS policies for users),
-- append-only by convention, structured payload in `details` jsonb,
-- and indexed for the queries operators will actually run (by action,
-- by recency).

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

-- RLS: enabled, no policies. Service-role bypasses RLS by design.
-- This is intentional: no end-user should ever read this table.
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
