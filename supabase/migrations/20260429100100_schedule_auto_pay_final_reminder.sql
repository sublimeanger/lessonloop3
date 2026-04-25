-- J10-F5 — schedule the 24-hour auto-pay final reminder cron.
-- Idempotent: unschedule first if it already exists, then re-schedule.
-- Same vault.decrypted_secrets pattern as 20260424094024 — Authorization
-- bearer = service_role_key matches the edge fn's authHeader.includes
-- guard.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-pay-final-reminder-daily') THEN
    PERFORM cron.unschedule('auto-pay-final-reminder-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'auto-pay-final-reminder-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/auto-pay-final-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
