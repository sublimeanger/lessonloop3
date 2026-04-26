# Platform audit log

Reference for `platform_audit_log` — the audit surface for events that
have no tenant org. Introduced in Track 0.5 Phase 1 (May 2026) to close
T05-F9.

## Purpose

The existing `public.audit_log` table requires `org_id NOT NULL`. Every
entry must be attributable to a tenant org — RLS policies depend on it,
per-org export queries assume it, and the contract is correct for
business-domain events (invoice edits, refund actions, dispute
transitions).

Some events are platform-level by nature: webhook stale-recovery, cron
health alerts, vault rotation events, scheduled-maintenance markers.
They have no org. Stuffing them into `audit_log` with a synthetic org_id
would either pollute one tenant's audit history or require relaxing the
NOT NULL constraint and cascading the consequences through every consumer
of the table.

`platform_audit_log` keeps the two surfaces separate.

## Schema

`supabase/migrations/20260502120000_platform_audit_log.sql`

```
platform_audit_log
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
  action      text NOT NULL                 -- snake_case event identifier
  source      text NOT NULL                 -- originating component
  severity    text NOT NULL DEFAULT 'info'  -- info | warning | error | critical
  details     jsonb NOT NULL DEFAULT '{}'   -- structured payload
  created_at  timestamptz NOT NULL DEFAULT now()

idx_platform_audit_log_action_created   ON (action, created_at DESC)
idx_platform_audit_log_created          ON (created_at DESC)
idx_platform_audit_log_severity_created ON (severity, created_at DESC)
                                        WHERE severity IN ('warning', 'error', 'critical')
```

## Severity ladder

| Severity   | Meaning                                                                  | Operator response                                       |
|------------|--------------------------------------------------------------------------|---------------------------------------------------------|
| `info`     | Routine event, useful for retrospective audit only.                      | None — read on demand.                                  |
| `warning`  | Self-healed degradation; system continued correctly.                     | Spot-check daily; investigate if frequency rises.       |
| `error`    | Component degraded; manual reconciliation may be required.               | Investigate same-day.                                   |
| `critical` | Component down or data integrity at risk; on-call escalation justified. | Page on-call.                                           |

Convention: do not use `error` or `critical` for self-recovering paths.
Stale-recovery is `warning` — the system handled it, but operators should
notice if it happens often.

## Current emitters

| Source              | Action                    | Severity  | Notes                                                            |
|---------------------|---------------------------|-----------|------------------------------------------------------------------|
| `stripe-webhook`    | `webhook_stale_recovery`  | `warning` | Stripe webhook event row in flight > 90s; orphan deleted + re-claimed. See [docs/WEBHOOK_DEDUP.md](WEBHOOK_DEDUP.md). |
| `profiles_trigger`  | `profile_change`          | `info`    | Per-row INSERT/UPDATE/DELETE on `public.profiles`. T01-P2 — see [docs/MIGRATION_CONVENTIONS.md](MIGRATION_CONVENTIONS.md). |

Role-change auditing lives on the org-scoped `audit_log` surface via
the `audit_org_memberships` trigger (created 2026-01-20, one of the 9
grandfathered triggers preserved by T01-P1; T01-P3 normalises it to the
singular pattern). The legacy `user_roles` table was dropped on
15 March 2026; the role surface is now `org_memberships`.

## Future emitters (planned)

- `cron-watchdog` (T08-P2): cron health alerts when a scheduled job has
  not run within its expected interval.

## RLS posture

Row-level security is **enabled** with **no policies**. Service-role
bypasses RLS by design. End-user reads are out of contract — no UI
surface should ever query this table.

## Append-only convention

No `UPDATE` or `DELETE` call sites today, and no triggers enforcing
append-only at the DB layer. Operators with service-role can repair if
absolutely needed (e.g. PII redaction on a malformed payload). Treat any
mutation as exceptional and document it.

## Operator queries

### Last 24h of stale recoveries

```sql
SELECT created_at, details
FROM platform_audit_log
WHERE action = 'webhook_stale_recovery'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;
```

A spike means handler crashes are clustering — check the `details.event_type`
distribution to localise (e.g. all `payment_intent.succeeded` → look at
`record_stripe_payment` retries).

### All warnings/errors/critical in the last 7 days

```sql
SELECT created_at, source, action, severity, details
FROM platform_audit_log
WHERE severity IN ('warning', 'error', 'critical')
  AND created_at > now() - interval '7 days'
ORDER BY created_at DESC;
```

Backed by the partial index — fast even as the table grows.

### Recent role changes (privilege-movement filter)

Role grants/revokes/changes are audited on the org-scoped `audit_log`
table via `audit_org_memberships` (the role surface is `org_memberships`,
not `platform_audit_log`). Query against `audit_log` instead:

```sql
SELECT created_at,
       action,
       entity_id,
       new_data->>'role' AS role,
       actor_user_id
FROM audit_log
WHERE entity_type IN ('org_memberships', 'org_membership')
ORDER BY created_at DESC
LIMIT 50;
```

The `entity_type IN (..., 'org_membership')` covers the post-T01-P3
singular form alongside the current plural form.

### Volume by action, last 30 days

```sql
SELECT action,
       source,
       severity,
       count(*) AS events
FROM platform_audit_log
WHERE created_at > now() - interval '30 days'
GROUP BY action, source, severity
ORDER BY events DESC;
```

## Retention

Swept daily by the `webhook-retention-daily` cron at 03:30 UTC (the
same sweep that retains `stripe_webhook_events`). Two-tier policy:

| Severity                  | Retention |
|---------------------------|-----------|
| `info`, `warning`         | 90 days   |
| `error`, `critical`       | 365 days  |

Routine traffic (sweep self-audit, stale-recovery warnings) recycles
quarterly. Real failures stay queryable for a year, long enough to
investigate intermittent issues against the same audit row that first
caught them.

Each sweep itself writes a `webhook_retention_sweep` row (severity
`info`) with the per-table delete counts in `details`, so the
retention process is itself observable. A failed sweep writes
`webhook_retention_sweep_failed` (severity `error`) from the edge fn
fallback path — kept for the longer 365-day window so post-mortems
have the trail.

Migrations: `supabase/migrations/20260503100000_webhook_event_ttl.sql`
(`cleanup_webhook_retention()` SQL function) +
`supabase/migrations/20260503100100_webhook_retention_cron.sql` (cron).
See [`docs/CRON_JOBS.md`](CRON_JOBS.md) for the registry entry and
[`docs/WEBHOOK_DEDUP.md`](WEBHOOK_DEDUP.md) for the companion sweep
on `stripe_webhook_events`.

### Manual cleanup (operator escape hatch)

```sql
SELECT public.cleanup_webhook_retention();
```

Service-role only. Equivalent to one cron tick.

## Canonical migration

- `supabase/migrations/20260502120000_platform_audit_log.sql`

## Related

- [`docs/WEBHOOK_DEDUP.md`](WEBHOOK_DEDUP.md) — first emitter context.
- [`docs/AUDIT_LOGGING.md`](AUDIT_LOGGING.md) — tenant-scoped audit log
  (different table, different contract).
