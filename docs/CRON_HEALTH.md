# Cron Health Monitoring

The `cron-health-watchdog-daily` cron surveys all registered crons daily
at 09:30 UTC and emails the operator (`OPERATOR_ALERT_EMAIL`) when any
cron is detected as unhealthy.

## Failure classes

### Class A — stopped firing

`cron.job.active = true` AND `cron.job_run_details.last_run_at IS NOT NULL`
AND `last_run_at` is older than `1.5×` the cron's expected interval.

The `last_run_at IS NOT NULL` requirement is intentional — pg_cron does not
expose a reliable registration timestamp, so freshly-registered crons (where
`last_run_at IS NULL`) cannot be distinguished from pathological silence.
T08-P2-C4 suppresses Class A in that case to avoid false positives during
re-registration deploys. A cron that registers but never fires will not
raise Class A; this trade-off is acceptable because the original Track 0.8
problem space is Class B (cron fires but HTTP fails), and pg_cron-level
breakage manifests in many other ways.

Severity: **CRITICAL**. Emailed daily until resolved.

### Class B — HTTP failing

Cron firing fine at the SQL layer, but the resulting HTTP call to the edge
fn is returning 4xx/5xx OR timing out (NULL `status_code` in
`net._http_response`).

Severity scaling:
- **CRITICAL** (emailed daily until resolved): ≥5 failures in last 24h, OR
  ≥12 firings in 24h with >50% failure rate.
- **WARNING** (emailed weekly, Monday only): 1–4 transient failures in
  last 24h.

The split exists because hourly/15-min crons can have occasional transient
failures (today's example: `send-lesson-reminders` had 4 `pg_net` timeouts
in 24h while 22 other firings completed successfully). Daily-emailing those
would create alert fatigue. Weekly digest catches sustained issues without
day-to-day noise.

### Class C — work not completing despite 200 OK

**Out of scope.** Per-edge-fn application-level outcome monitoring would
require each edge fn to write a self-audit signal. Filed as future work.

## How correlation works

`cron.job_run_details` and `net._http_response` are linked via
`return_message` ↔ `id`. T08-P2-C1 wraps every cron command in:

```sql
WITH req AS (SELECT net.http_post(...) AS request_id)
SELECT request_id::text FROM req;
```

pg_cron writes the SELECT's text output to `job_run_details.return_message`,
which the watchdog SQL casts to `bigint` and joins to `net._http_response.id`.

## Severity policy summary

| Class | Condition | Severity | Email cadence |
|---|---|---|---|
| A | last_run > 1.5× interval AND created > 2× interval | CRITICAL | Daily |
| A | last_run_at IS NULL (never fired) | suppressed | None |
| B | ≥5 failures/24h OR >50% rate over 12+ firings | CRITICAL | Daily |
| B | 1-4 transient failures in 24h | WARNING | Weekly (Monday) |
| Healthy | No failures | INFO | Silent (no email) |

## Silent success

When all crons are healthy, the watchdog runs, writes a row to
`platform_audit_log` (severity `info`), and sends no email. Operators rely
on the absence of email as the healthy signal, with `platform_audit_log`
providing the audit trail.

A "watchdog-watching-watchdog" deadman is not in scope for T08-P2. If the
watchdog itself fails silently, the absence of daily email is the only
signal. Acceptable trade-off given operational scale.

## Verification queries

Most recent watchdog runs (last 7):
```sql
SELECT created_at, severity, details->>'critical_count' AS critical,
       details->>'warning_count' AS warning
FROM platform_audit_log
WHERE action = 'cron_health_check_run'
ORDER BY created_at DESC
LIMIT 7;
```

Current cron health snapshot:
```sql
SELECT jobname, severity, failure_class, age_since_last_run_seconds,
       http_failures_24h, http_total_24h
FROM check_cron_health()
WHERE failure_class IS NOT NULL OR severity != 'info';
```

## Configuration

Required env vars:
- `RESEND_API_KEY` — already configured.
- `OPERATOR_ALERT_EMAIL` — destination for alerts. Set in Lovable secrets.
- `FRONTEND_URL` — already configured.
