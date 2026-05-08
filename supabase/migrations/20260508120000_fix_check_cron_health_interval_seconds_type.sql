-- Three-bug-chain fix for public.check_cron_health() — was 500'ing on
-- every cron-health-watchdog run since 20260508100100.
--
-- Bug 1: `expected_interval_seconds bigint` declared in RETURNS TABLE,
--        but CASE expression in CTE returned plain integer. Triggered
--        ERROR 42804 on RETURN QUERY. Fix: cast `ja.interval_seconds`
--        to bigint at SELECT time.
--
-- Bug 2: `nhr.id = jrd.return_message::bigint` cast was evaluated even
--        for non-numeric return_message values like "1 row" (planner
--        does not short-circuit AND across LEFT JOIN). Triggered
--        ERROR 22P02 on the cast. Fix: wrap the cast in a CASE that
--        returns NULL for non-numeric return_message strings.
--
-- Bug 3: pg_cron records `return_message = '1 row'` (the SQL row-count
--        message from net.http_post()), NEVER the http request_id. The
--        LEFT JOIN against net._http_response therefore matched zero
--        rows for every cron job, causing the original FILTER
--        (`status_code IS NULL OR status_code >= 400`) to count every
--        unmatched join row as a failure — every job reported as
--        B_http_failing. Fix: tighten FILTER to `status_code IS NOT
--        NULL AND status_code >= 400`, and count http_total_24h only
--        when the join matched. Result: Class B HTTP-failure detection
--        is currently a no-op until cron commands are rewritten to
--        surface the request_id (separate finding); Class A
--        (stopped-firing) detection works correctly.
--
-- Effect prior to this migration (verified 2026-05-08): every
-- cron-health-watchdog run since deployment 500'd. Zero rows in
-- platform_audit_log(source='cron-health-watchdog'). Zero alert emails
-- ever sent. Watchdog has been silently broken since deployment.
--
-- Re-deploy of the cron-health-watchdog edge fn is NOT required (no
-- code change there).

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
      max(jrd.start_time) AS last_run_at
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
      count(*) FILTER (WHERE nhr.status_code IS NOT NULL AND nhr.status_code >= 400) AS http_fail_24h,
      count(*) FILTER (WHERE nhr.id IS NOT NULL) AS http_total_24h
    FROM cron.job_run_details jrd
    LEFT JOIN net._http_response nhr
      ON nhr.id = (
        CASE
          WHEN jrd.return_message ~ '^[0-9]+$'
          THEN jrd.return_message::bigint
          ELSE NULL
        END
      )
    WHERE jrd.start_time > now() - interval '24 hours'
    GROUP BY jrd.jobid
  )
  SELECT
    ja.jobname,
    ja.schedule,
    ja.active,
    CASE
      WHEN ja.active AND ja.last_run_at IS NOT NULL
       AND ja.age_since_last_run_seconds > (ja.interval_seconds * 1.5)::bigint
        THEN 'A_stopped_firing'
      WHEN COALESCE(h.http_fail_24h, 0) >= 5
        OR (COALESCE(h.http_total_24h, 0) >= 12 AND COALESCE(h.http_fail_24h, 0)::numeric / NULLIF(h.http_total_24h, 0) > 0.5)
        THEN 'B_http_failing'
      WHEN COALESCE(h.http_fail_24h, 0) BETWEEN 1 AND 4
        THEN 'B_http_failing'
      ELSE NULL
    END AS failure_class,
    CASE
      WHEN ja.active AND ja.last_run_at IS NOT NULL
       AND ja.age_since_last_run_seconds > (ja.interval_seconds * 1.5)::bigint
        THEN 'critical'
      WHEN COALESCE(h.http_fail_24h, 0) >= 5
        OR (COALESCE(h.http_total_24h, 0) >= 12 AND COALESCE(h.http_fail_24h, 0)::numeric / NULLIF(h.http_total_24h, 0) > 0.5)
        THEN 'critical'
      WHEN COALESCE(h.http_fail_24h, 0) BETWEEN 1 AND 4
        THEN 'warning'
      ELSE 'info'
    END AS severity,
    ja.last_run_at,
    ja.interval_seconds::bigint AS expected_interval_seconds,
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
      WHEN ja.active AND ja.last_run_at IS NOT NULL
       AND ja.age_since_last_run_seconds > (ja.interval_seconds * 1.5)::bigint THEN 0
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
'Surveys all cron jobs and returns failure/health status. Class A = stopped firing (only when run history exists); Class B = HTTP failing (currently no-op pending request_id surfacing rewrite). Type-fixed 2026-05-08.';

NOTIFY pgrst, 'reload schema';
