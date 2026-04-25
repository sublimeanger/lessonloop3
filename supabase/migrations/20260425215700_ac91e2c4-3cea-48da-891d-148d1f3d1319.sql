-- Track 0.8 Phase 1 patch (C5).

-- ─── 1. Drop the duplicate refresh-calendar-busy-blocks ───────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-calendar-busy-blocks') THEN
    PERFORM cron.unschedule('refresh-calendar-busy-blocks');
  END IF;
END $$;

-- ─── 2. calendar-refresh-busy — */15 * * * * ──────────────────────
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
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/calendar-refresh-busy',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- ─── 3. send-lesson-reminders — 0 * * * * ─────────────────────────
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
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/send-lesson-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);