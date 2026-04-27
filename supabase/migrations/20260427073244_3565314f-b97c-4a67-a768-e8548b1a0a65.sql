-- T08-P2-C1: Surface net.http_post() request_id to cron.job_run_details.return_message

-- ─── 1. auto-pay-upcoming-reminder-daily ────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-pay-upcoming-reminder-daily') THEN
    PERFORM cron.unschedule('auto-pay-upcoming-reminder-daily');
  END IF;
END $$;
SELECT cron.schedule(
  'auto-pay-upcoming-reminder-daily',
  '0 8 * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/auto-pay-upcoming-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

-- ─── 2. stripe-auto-pay-installment-daily ───────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stripe-auto-pay-installment-daily') THEN
    PERFORM cron.unschedule('stripe-auto-pay-installment-daily');
  END IF;
END $$;
SELECT cron.schedule(
  'stripe-auto-pay-installment-daily',
  '0 9 * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/stripe-auto-pay-installment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

-- ─── 3. auto-pay-final-reminder-daily ───────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-pay-final-reminder-daily') THEN
    PERFORM cron.unschedule('auto-pay-final-reminder-daily');
  END IF;
END $$;
SELECT cron.schedule(
  'auto-pay-final-reminder-daily',
  '0 8 * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/auto-pay-final-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

-- ─── 4. overdue-reminders-daily ─────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'overdue-reminders-daily') THEN
    PERFORM cron.unschedule('overdue-reminders-daily');
  END IF;
END $$;
SELECT cron.schedule(
  'overdue-reminders-daily',
  '0 9 * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/overdue-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

-- ─── 5. recurring-billing-scheduler-daily ───────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recurring-billing-scheduler-daily') THEN
    PERFORM cron.unschedule('recurring-billing-scheduler-daily');
  END IF;
END $$;
SELECT cron.schedule(
  'recurring-billing-scheduler-daily',
  '0 4 * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/recurring-billing-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

-- ─── 6. credit-expiry-daily ─────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'credit-expiry-daily') THEN
    PERFORM cron.unschedule('credit-expiry-daily');
  END IF;
END $$;
SELECT cron.schedule(
  'credit-expiry-daily',
  '0 2 * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/credit-expiry',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

-- ─── 7. invoice-overdue-check ───────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoice-overdue-check') THEN
    PERFORM cron.unschedule('invoice-overdue-check');
  END IF;
END $$;
SELECT cron.schedule(
  'invoice-overdue-check',
  '30 5 * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/invoice-overdue-check',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

-- ─── 8. installment-overdue-check-daily ─────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'installment-overdue-check-daily') THEN
    PERFORM cron.unschedule('installment-overdue-check-daily');
  END IF;
END $$;
SELECT cron.schedule(
  'installment-overdue-check-daily',
  '0 6 * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/installment-overdue-check',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

-- ─── 9. installment-upcoming-reminder-daily ─────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'installment-upcoming-reminder-daily') THEN
    PERFORM cron.unschedule('installment-upcoming-reminder-daily');
  END IF;
END $$;
SELECT cron.schedule(
  'installment-upcoming-reminder-daily',
  '0 8 * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/installment-upcoming-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

-- ─── 10. credit-expiry-warning-daily ────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'credit-expiry-warning-daily') THEN
    PERFORM cron.unschedule('credit-expiry-warning-daily');
  END IF;
END $$;
SELECT cron.schedule(
  'credit-expiry-warning-daily',
  '0 8 * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/credit-expiry-warning',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

-- ─── 11. cleanup-orphaned-resources ─────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-orphaned-resources') THEN
    PERFORM cron.unschedule('cleanup-orphaned-resources');
  END IF;
END $$;
SELECT cron.schedule(
  'cleanup-orphaned-resources',
  '0 3 * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/cleanup-orphaned-resources',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

-- ─── 12. calendar-refresh-busy ──────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'calendar-refresh-busy') THEN
    PERFORM cron.unschedule('calendar-refresh-busy');
  END IF;
END $$;
SELECT cron.schedule(
  'calendar-refresh-busy',
  '*/15 * * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/calendar-refresh-busy',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

-- ─── 13. send-lesson-reminders ──────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-lesson-reminders') THEN
    PERFORM cron.unschedule('send-lesson-reminders');
  END IF;
END $$;
SELECT cron.schedule(
  'send-lesson-reminders',
  '0 * * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/send-lesson-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

-- ─── 14. webhook-retention-daily ────────────────────────────────────
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
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/cleanup-webhook-retention',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

-- ─── 15. invoice-pdf-orphan-sweep-daily ─────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoice-pdf-orphan-sweep-daily') THEN
    PERFORM cron.unschedule('invoice-pdf-orphan-sweep-daily');
  END IF;
END $$;
SELECT cron.schedule(
  'invoice-pdf-orphan-sweep-daily',
  '45 3 * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/cleanup-invoice-pdf-orphans',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id
  )
  SELECT request_id::text FROM req;
  $cron$
);

NOTIFY pgrst, 'reload schema';