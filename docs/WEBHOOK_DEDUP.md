# Stripe webhook deduplication

Reference for the two-phase dedup pattern used by `stripe-webhook` and the
receipt idempotency pattern used by `send-payment-receipt`. Closed in
Track 0.5 Phase 1 (May 2026).

## Why this exists

Stripe retries webhooks aggressively — up to ~100 attempts over 3 days for
unacknowledged deliveries, ~16 attempts for 5xx responses. The function
must be idempotent on `event.id`, and must distinguish three cases:

1. We've already successfully processed this event → ack `200 duplicate=true`.
2. Another invocation is currently processing this event → return `409 in_flight`.
3. The event hasn't been processed yet (or a previous attempt crashed) → process it.

The previous pattern (insert a dedup row at handler entry, branch on 23505)
collapsed cases 1 and 3 together: any handler that threw left an orphan row,
and Stripe's retry hit the 23505 short-circuit and never re-ran the
handler. Real-money risk on transient DB errors during
`record_stripe_payment`, refund INSERTs, etc.

## Schema (canonical migration)

`supabase/migrations/20260502100000_webhook_dedup_two_phase.sql`

```
stripe_webhook_events
  event_id      TEXT PRIMARY KEY
  event_type    TEXT NOT NULL
  processed_at  TIMESTAMPTZ            -- NULL = in flight; non-NULL = completed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()

idx_stripe_webhook_events_in_flight
  ON (event_id, created_at) WHERE processed_at IS NULL
```

## Flow

```
┌──────────────┐
│ Stripe POSTs │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Phase 1: claim                       │
│  INSERT (event_id, type,             │
│          processed_at=NULL).select() │
└──────┬───────────────────────────────┘
       │
       ├── 23505 conflict → re-read existing row
       │   ├── processed_at non-NULL  → return 200 duplicate=true
       │   ├── processed_at NULL, age <90s → return 409 in_flight=true
       │   └── processed_at NULL, age ≥90s → log webhook_stale_recovery,
       │                                     DELETE orphan, re-claim, fall through
       │
       └── ok → fall through
                │
                ▼
┌──────────────────────────────────────┐
│ Phase 2: dispatch (try {} catch {})  │
│  switch (event.type) → handler       │
└──────┬───────────────────────────────┘
       │
       ├── handler throws → catch:
       │     DELETE WHERE event_id=… AND processed_at IS NULL
       │     return 500
       │
       └── handler returns:
             UPDATE processed_at = now()
                WHERE event_id=… AND processed_at IS NULL
             return 200
```

The `is null` predicate on the success UPDATE and the failure DELETE is
critical: it prevents a racing release-on-failure from a different attempt
from clobbering a row another attempt has just marked complete, and vice
versa.

## Stale-row recovery (90s threshold)

If a previous attempt crashed (process killed, edge fn timeout, OOM)
before its catch block could DELETE the in-flight row, the row sits with
`processed_at IS NULL` indefinitely. Without recovery, every subsequent
retry of the same event would see "in flight" and return 409.

The 90s threshold is chosen against the Supabase edge fn timeout (150s):
anything in flight longer than 90s is by definition crashed. Recovery
DELETEs the orphan and re-claims; if another instance won the race after
the DELETE, the re-claim returns 409 and Stripe retries.

Because `audit_log.org_id` is `NOT NULL` and webhook events are
platform-level (no associated org until handler dispatch), stale recoveries
write to `platform_audit_log` (action: `webhook_stale_recovery`, severity:
`warning`). See [docs/PLATFORM_AUDIT_LOG.md](PLATFORM_AUDIT_LOG.md).

A `console.error` fallback fires only if the `platform_audit_log` insert
itself fails — operators never lose the signal.

## Receipt idempotency

`supabase/migrations/20260502110000_message_log_payment_id.sql`

```
ALTER TABLE message_log ADD COLUMN payment_id uuid
  REFERENCES payments(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_message_log_payment_receipt_dedup
  ON message_log (payment_id)
  WHERE message_type = 'payment_receipt' AND payment_id IS NOT NULL;
```

`send-payment-receipt`:
1. Pre-check `message_log` for `(message_type='payment_receipt',
   payment_id=$1)`. If a row exists, return `200 duplicate=true`
   without sending.
2. INSERT the row with `payment_id` set. If 23505, a concurrent
   invocation is sending — return `200 duplicate=true` with `race=true`.
3. After Resend, UPDATE the row keyed on `payment_id` (uniquely
   addressable now).

Other `message_type` values are unaffected — `payment_id` stays NULL
for them and the partial UNIQUE ignores NULLs.

## Operator queries

### In-flight events older than 30 seconds (live bug check)

```sql
SELECT event_id,
       event_type,
       created_at,
       now() - created_at AS age
FROM stripe_webhook_events
WHERE processed_at IS NULL
ORDER BY created_at;
```

Anything older than ~3 minutes is suspicious — either the stale-recovery
path is broken, or no Stripe retry has arrived for that event yet.

### Stale recoveries in the last 24 hours

```sql
SELECT created_at, details
FROM platform_audit_log
WHERE action = 'webhook_stale_recovery'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;
```

A spike in `webhook_stale_recovery` rows means handler crashes are
clustering — check the `details->>'event_type'` distribution to localise
(e.g. all `payment_intent.succeeded` → look at `record_stripe_payment`
retries, refund insert errors, etc.). See
[docs/PLATFORM_AUDIT_LOG.md](PLATFORM_AUDIT_LOG.md) for the full audit
surface.

### Webhook event volume by type, 24h

```sql
SELECT event_type,
       count(*)                                   AS events,
       count(*) FILTER (WHERE processed_at IS NOT NULL) AS completed,
       count(*) FILTER (WHERE processed_at IS NULL)     AS in_flight
FROM stripe_webhook_events
WHERE created_at > now() - interval '24 hours'
GROUP BY event_type
ORDER BY events DESC;
```

### TTL cleanup (manual)

```sql
DELETE FROM stripe_webhook_events
WHERE processed_at IS NOT NULL
  AND processed_at < now() - interval '90 days';
```

Per `supabase/migrations/20260331170000_webhook_events_ttl_guidance.sql`.

## Canonical migrations

- `supabase/migrations/20260502100000_webhook_dedup_two_phase.sql` — schema.
- `supabase/migrations/20260502110000_message_log_payment_id.sql` — receipt UNIQUE.
- `supabase/migrations/20260502120000_platform_audit_log.sql` — stale-recovery audit surface.

## Code

- `supabase/functions/stripe-webhook/index.ts` — claim / dispatch / mark|release.
- `supabase/functions/send-payment-receipt/index.ts` — payment_id pre-check + UNIQUE catch.
