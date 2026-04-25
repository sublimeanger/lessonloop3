-- Track 0.5 Phase 2 — Register cleanup-webhook-retention daily cron.
-- Canonical Pattern C (T08-P1). Schedule: 03:30 UTC daily — sits
-- between cleanup-orphaned-resources (03:00) and recurring-billing-
-- scheduler (04:00). Avoids the busier 06:00–09:00 morning window and
-- shares no minute slot with another cron.

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
