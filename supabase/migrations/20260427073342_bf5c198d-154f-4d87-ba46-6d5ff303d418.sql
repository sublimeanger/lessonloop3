CREATE OR REPLACE FUNCTION public.check_cron_health()
RETURNS TABLE (
  jobname text,
  schedule text,
  active boolean,
  failure_class text,
  severity text,
  last_run_at timestamptz,
  expected_interval_seconds bigint,
  age_since_last_run_seconds bigint,
  http_failures_24h integer,
  http_total_24h integer,
  http_failure_rate numeric,
  evidence jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron', 'net', 'pg_catalog'
AS $$
BEGIN
  RETURN QUERY
  WITH job_intervals AS (
    SELECT
      j.jobid,
      j.jobname,
      j.schedule,
      j.active,
      CASE
        WHEN j.schedule = '*/15 * * * *' THEN 30 * 60
        WHEN j.schedule = '0 * * * *' THEN 90 * 60
        WHEN j.schedule LIKE '%* * * *' AND j.schedule NOT LIKE '*/%' THEN 36 * 3600
        ELSE 36 * 3600
      END AS interval_seconds
    FROM cron.job j
  ),
  job_last_runs AS (
    SELECT
      jrd.jobid,
      max(jrd.start_time) AS last_run_at,
      (array_agg(jrd.return_message ORDER BY jrd.start_time DESC))[1] AS last_return_message
    FROM cron.job_run_details jrd
    GROUP BY jrd.jobid
  ),
  job_age AS (
    SELECT
      ji.jobid,
      ji.jobname,
      ji.schedule,
      ji.active,
      ji.interval_seconds,
      jlr.last_run_at,
      EXTRACT(EPOCH FROM (now() - jlr.last_run_at))::bigint AS age_since_last_run_seconds
    FROM job_intervals ji
    LEFT JOIN job_last_runs jlr ON jlr.jobid = ji.jobid
  ),
  http_24h AS (
    SELECT
      jrd.jobid,
      count(*) FILTER (WHERE nhr.status_code BETWEEN 200 AND 299) AS http_ok_24h,
      count(*) FILTER (WHERE nhr.status_code IS NULL OR nhr.status_code >= 400) AS http_fail_24h,
      count(*) AS http_total_24h
    FROM cron.job_run_details jrd
    LEFT JOIN net._http_response nhr
      ON jrd.return_message IS NOT NULL
     AND jrd.return_message ~ '^[0-9]+$'
     AND nhr.id = jrd.return_message::bigint
    WHERE jrd.start_time > now() - interval '24 hours'
    GROUP BY jrd.jobid
  )
  SELECT
    ja.jobname,
    ja.schedule,
    ja.active,
    CASE
      WHEN ja.active AND (ja.last_run_at IS NULL OR ja.age_since_last_run_seconds > (ja.interval_seconds * 1.5)::bigint)
        THEN 'A_stopped_firing'
      WHEN COALESCE(h.http_fail_24h, 0) >= 5
        OR (COALESCE(h.http_total_24h, 0) >= 12 AND COALESCE(h.http_fail_24h, 0)::numeric / NULLIF(h.http_total_24h, 0) > 0.5)
        THEN 'B_http_failing'
      WHEN COALESCE(h.http_fail_24h, 0) BETWEEN 1 AND 4
        THEN 'B_http_failing'
      ELSE NULL
    END AS failure_class,
    CASE
      WHEN ja.active AND (ja.last_run_at IS NULL OR ja.age_since_last_run_seconds > (ja.interval_seconds * 1.5)::bigint)
        THEN 'critical'
      WHEN COALESCE(h.http_fail_24h, 0) >= 5
        OR (COALESCE(h.http_total_24h, 0) >= 12 AND COALESCE(h.http_fail_24h, 0)::numeric / NULLIF(h.http_total_24h, 0) > 0.5)
        THEN 'critical'
      WHEN COALESCE(h.http_fail_24h, 0) BETWEEN 1 AND 4
        THEN 'warning'
      ELSE 'info'
    END AS severity,
    ja.last_run_at,
    ja.interval_seconds AS expected_interval_seconds,
    ja.age_since_last_run_seconds,
    COALESCE(h.http_fail_24h, 0)::integer AS http_failures_24h,
    COALESCE(h.http_total_24h, 0)::integer AS http_total_24h,
    CASE
      WHEN COALESCE(h.http_total_24h, 0) > 0
      THEN round(COALESCE(h.http_fail_24h, 0)::numeric / h.http_total_24h, 3)
      ELSE 0
    END AS http_failure_rate,
    jsonb_build_object(
      'last_run_at', ja.last_run_at,
      'age_seconds', ja.age_since_last_run_seconds,
      'interval_seconds', ja.interval_seconds,
      'http_ok_24h', COALESCE(h.http_ok_24h, 0),
      'http_fail_24h', COALESCE(h.http_fail_24h, 0),
      'http_total_24h', COALESCE(h.http_total_24h, 0)
    ) AS evidence
  FROM job_age ja
  LEFT JOIN http_24h h ON h.jobid = ja.jobid
  ORDER BY
    CASE
      WHEN ja.active AND (ja.last_run_at IS NULL OR ja.age_since_last_run_seconds > (ja.interval_seconds * 1.5)::bigint) THEN 0
      WHEN COALESCE(h.http_fail_24h, 0) >= 5 THEN 1
      WHEN COALESCE(h.http_fail_24h, 0) BETWEEN 1 AND 4 THEN 2
      ELSE 3
    END,
    ja.jobname;
END;
$$;

REVOKE ALL ON FUNCTION public.check_cron_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_cron_health() TO service_role;

COMMENT ON FUNCTION public.check_cron_health() IS
'Surveys all cron jobs and returns failure/health status. Class A = stopped firing; Class B = HTTP failing. Used by cron-health-watchdog edge fn (T08-P2).';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cron-health-watchdog-daily') THEN
    PERFORM cron.unschedule('cron-health-watchdog-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'cron-health-watchdog-daily',
  '30 9 * * *',
  $cron$
  WITH req AS (
    SELECT net.http_post(
      url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/cron-health-watchdog',
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