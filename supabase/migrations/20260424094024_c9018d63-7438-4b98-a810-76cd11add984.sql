-- Track 0.6 partial reconciliation — schedule three missing crons.
-- Uses vault.decrypted_secrets to avoid hardcoding any keys.

-- 1. auto-pay-upcoming-reminder — daily 08:00 UTC
SELECT cron.schedule(
  'auto-pay-upcoming-reminder-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/auto-pay-upcoming-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 2. stripe-auto-pay-installment — daily 09:00 UTC
SELECT cron.schedule(
  'stripe-auto-pay-installment-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/stripe-auto-pay-installment',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 3. credit-expiry — daily 02:00 UTC (uses internal cron secret, matches validateCronAuth)
SELECT cron.schedule(
  'credit-expiry-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/credit-expiry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);