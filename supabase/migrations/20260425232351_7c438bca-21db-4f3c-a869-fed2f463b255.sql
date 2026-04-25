-- ============================================================
-- Migration 1: 20260503100000_webhook_event_ttl.sql
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
  WITH deleted AS (
    DELETE FROM public.stripe_webhook_events
    WHERE processed_at IS NOT NULL
      AND processed_at < now() - interval '90 days'
    RETURNING event_id
  )
  SELECT count(*) INTO _webhook_events_deleted FROM deleted;

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

-- ============================================================
-- Migration 2: 20260503100100_webhook_retention_cron.sql
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'webhook-retention-daily') THEN
    PERFORM cron.unschedule('webhook-retention-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'webhook-retention-daily',
  '30 3 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/cleanup-webhook-retention',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

NOTIFY pgrst, 'reload schema';