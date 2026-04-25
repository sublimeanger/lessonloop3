-- Track 0.5 Phase 2 — TTL retention for webhook surfaces.
--
-- stripe_webhook_events and platform_audit_log are both append-only
-- operator-observable tables that grow indefinitely without retention.
-- The previous TTL guidance migration (20260331170000_webhook_events_ttl_guidance.sql)
-- was advisory-only — a doc comment, no cron. T05-F10 closes that gap.
--
-- Retention windows:
--   stripe_webhook_events: 90 days. Sufficient for Stripe's max retry
--     window (~3 days) plus operator audit visibility.
--   platform_audit_log: 90 days for severity in (info, warning); 365
--     days for (error, critical). Real failures stay queryable for a
--     year; routine traffic recycles quarterly.
--
-- Daily cron at 03:30 UTC. Uses canonical Pattern C with x-cron-secret.
-- The cleanup itself is an SQL function called from an edge function so
-- the cron path matches every other cleanup cron in the codebase
-- (cleanup-orphaned-resources). Pure-SQL cron would also work but
-- breaks the canonical pattern.

-- ============================================================
-- SQL function: cleanup_webhook_retention()
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_webhook_retention()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _webhook_events_deleted integer;
  _platform_audit_routine_deleted integer;
  _result jsonb;
BEGIN
  -- stripe_webhook_events: 90-day retention.
  -- Targets only completed rows (processed_at IS NOT NULL). In-flight
  -- rows are managed by the two-phase dedup stale-recovery path and
  -- never get old enough to hit this retention window in practice.
  WITH deleted AS (
    DELETE FROM public.stripe_webhook_events
    WHERE processed_at IS NOT NULL
      AND processed_at < now() - interval '90 days'
    RETURNING event_id
  )
  SELECT count(*) INTO _webhook_events_deleted FROM deleted;

  -- platform_audit_log: 90-day for info/warning, 365-day for error/critical.
  WITH deleted AS (
    DELETE FROM public.platform_audit_log
    WHERE (severity IN ('info', 'warning') AND created_at < now() - interval '90 days')
       OR (severity IN ('error', 'critical') AND created_at < now() - interval '365 days')
    RETURNING id
  )
  SELECT count(*) INTO _platform_audit_routine_deleted FROM deleted;

  _result := jsonb_build_object(
    'webhook_events_deleted', _webhook_events_deleted,
    'platform_audit_log_deleted', _platform_audit_routine_deleted,
    'ran_at', now()
  );

  -- Self-audit: write the cleanup result to platform_audit_log so the
  -- retention sweeps are themselves observable.
  INSERT INTO public.platform_audit_log (action, source, severity, details)
  VALUES (
    'webhook_retention_sweep',
    'cleanup-webhook-retention',
    CASE
      WHEN _webhook_events_deleted = 0 AND _platform_audit_routine_deleted = 0 THEN 'info'
      ELSE 'info'
    END,
    _result
  );

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_webhook_retention() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_webhook_retention() TO service_role;

NOTIFY pgrst, 'reload schema';
