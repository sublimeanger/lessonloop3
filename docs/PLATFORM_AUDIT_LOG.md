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

| Source          | Action                    | Severity  | Notes                                                            |
|-----------------|---------------------------|-----------|------------------------------------------------------------------|
| `stripe-webhook` | `webhook_stale_recovery` | `warning` | Stripe webhook event row in flight > 90s; orphan deleted + re-claimed. See [docs/WEBHOOK_DEDUP.md](WEBHOOK_DEDUP.md). |

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

### TTL guidance

No hard TTL today. Retention is operator preference. A 90-day window
mirroring `stripe_webhook_events` is a sensible default; revisit when
volume becomes meaningful.

## Canonical migration

- `supabase/migrations/20260502120000_platform_audit_log.sql`

## Related

- [`docs/WEBHOOK_DEDUP.md`](WEBHOOK_DEDUP.md) — first emitter context.
- [`docs/AUDIT_LOGGING.md`](AUDIT_LOGGING.md) — tenant-scoped audit log
  (different table, different contract).
