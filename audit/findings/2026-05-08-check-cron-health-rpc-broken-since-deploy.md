# `check_cron_health()` RPC has been silently 500'ing since deployment — three-bug chain

**Severity:** high
**Status:** fixed (Class A working; Class B still no-op pending follow-up)
**Area:** crons / observability
**Discovered:** 2026-05-08
**Fixed:** 2026-05-08
**Fixed in:** migration `20260508120000_fix_check_cron_health_interval_seconds_type.sql`
**Affected components:** `public.check_cron_health()`, `cron-health-watchdog` edge function, daily 09:30 UTC alert path

## Symptom

`platform_audit_log(source='cron-health-watchdog')` is **completely empty**. Zero rows since deployment. No alert email has ever been sent. The watchdog's daily run at 09:30 UTC has been returning HTTP 500 every single day since `20260508100100` was applied — verified via `net._http_response`:

```
status_code | count | first_seen           | last_seen
500         | 1     | 2026-05-08 09:30:... | 2026-05-08 09:30:...
```

Direct invocation of the RPC reproduced the failure:

```
ERROR: 42804: structure of query does not match function result type
DETAIL: Returned type integer does not match expected type bigint in column 7.
```

## Root cause — three-bug chain

### Bug 1 — type mismatch (the visible 500)

`RETURNS TABLE` declared `expected_interval_seconds bigint`, but the source CTE computed `interval_seconds` from a `CASE` returning plain integer literals (`30 * 60`, `90 * 60`, `36 * 3600`). PostgreSQL infers the CASE result as `integer`, mismatching the declared `bigint`. `RETURN QUERY` raised 42804 before any rows were emitted.

### Bug 2 — short-circuit assumption (would have surfaced after fixing Bug 1)

The `http_24h` CTE joined on `nhr.id = jrd.return_message::bigint` with a guard `jrd.return_message ~ '^[0-9]+$'` in the same `ON` clause. PostgreSQL's planner is free to reorder predicates, and in practice **evaluates the cast before the regex filter** — so non-numeric `return_message` values (e.g. `'1 row'`) trigger ERROR 22P02. Discovered after fixing Bug 1, on the next direct invocation.

### Bug 3 — broken correlation basis (would have surfaced after fixing Bugs 1+2)

`pg_cron` populates `cron.job_run_details.return_message` with the SQL row-count string returned by the cron command — for the `WITH req AS (SELECT net.http_post(...))` pattern used by 16 of 18 jobs, that's literally `'1 row'`. **The HTTP request_id is never surfaced.** The intended `nhr.id = jrd.return_message::bigint` join therefore matches **zero rows for every job**, leaving every row in the LEFT JOIN with `nhr.status_code = NULL`, which the original `FILTER (WHERE nhr.status_code IS NULL OR nhr.status_code >= 400)` counted as a failure. Even with Bugs 1+2 fixed, every job would have been misreported as `B_http_failing`.

Three bugs, layered. Only Bug 1 produced an error visible to the watchdog.

## Fix

Single migration `20260508120000_fix_check_cron_health_interval_seconds_type.sql`:

1. Cast `ja.interval_seconds::bigint AS expected_interval_seconds` at SELECT time.
2. Wrap the request_id cast in a `CASE` so non-numeric return_message values resolve to `NULL` before the cast runs.
3. Tighten the FILTER to `nhr.status_code IS NOT NULL AND nhr.status_code >= 400` and count `http_total_24h` only when `nhr.id IS NOT NULL`. Unmatched join rows no longer register as failures.

Class A (stopped-firing) detection now works correctly. Class B (HTTP-failing) detection is currently a **no-op** — it will never report a failure until cron commands are rewritten to surface the request_id. Tracked separately at `2026-05-08-cron-class-b-detection-no-op.md`.

## Verification

- Direct RPC call returns 18 rows, all `severity='info'`, no errors:

```sql
SELECT jobname, severity, failure_class FROM public.check_cron_health() WHERE severity <> 'info';
-- 0 rows
```

- Next watchdog run (tomorrow 09:30 UTC) should write a row to `platform_audit_log(action='cron_health_check_run')` and return 200.
- `net._http_response` should record a 200 instead of 500 for the watchdog's request.

## Lessons / follow-ups

- `RETURNS TABLE` type declarations are not coerced from the SELECT — explicit casts at projection are required when source CTEs use ambiguous numeric literals.
- PostgreSQL `LEFT JOIN ... ON A AND B` does not guarantee that A short-circuits B. When B can panic on non-matching A, wrap B in a `CASE`.
- Operator-facing observability features must have a smoke test that confirms a single end-to-end run before claiming "complete". Watchdog should be a tier-0 launch-readiness item — if your alerting is broken, you cannot trust any other "no failures observed" claim downstream.
- **Class B detection rewrite** is now P1 follow-up: every cron command needs to surface the actual `net.http_post` request_id (likely via `INTO request_id` and a NOTIFY/insert pattern) before HTTP-failure detection works. Until then, alerting catches "cron stopped firing" but NOT "cron is firing into a 500 wall".
