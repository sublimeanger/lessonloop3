# Migration conventions

A reference for the conventions actually followed by migrations in this
repo. Not prescriptive policy — describes patterns you'll see when you
read recent commits, and the reasoning when reviewers might assume the
opposite. Cross-links to the canonical references for cron auth,
webhook dedup, and the platform audit log.

## Idempotency

Every migration must be safely re-runnable. Lovable mirrors each
applied migration under a UUID-named copy and may re-apply on a fresh
clone or rebuild; a migration that fails on a second run will block
the entire pipeline.

The patterns in use:

- Tables / columns / indexes: `CREATE TABLE IF NOT EXISTS`,
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
- Functions: `CREATE OR REPLACE FUNCTION`.
- RLS policies: `DROP POLICY IF EXISTS "name" ON table;` immediately
  before `CREATE POLICY "name" ON table ...`. Postgres has no
  `CREATE POLICY IF NOT EXISTS`, so drop-then-create is the
  established workaround. See
  `20260422150000_payment_disputes_table.sql` for an example.
- Cron registrations: `DO $$ BEGIN IF EXISTS (SELECT 1 FROM cron.job
  WHERE jobname = '...') THEN PERFORM cron.unschedule('...'); END IF;
  END $$;` then `SELECT cron.schedule(...)`. See `docs/CRON_AUTH.md`
  for the full template.
- Constraints / triggers: drop-if-exists then create, or wrap in a
  `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` block.

## `NOTIFY pgrst, 'reload schema'`

Required at the bottom of any migration that creates or alters a
table, view, or function exposed via PostgREST (anything that should
appear in the auto-generated REST API or in the regenerated
`src/integrations/supabase/types.ts`). Migrations that only touch
internal-only objects — cron jobs, RLS policies on existing tables,
indexes — do not need it.

T05-F11 noted that NOTIFY usage was inconsistent across recent
migrations. The rule above is the convention going forward; when in
doubt, include it. It's cheap and safe even when unnecessary.

Examples:

- Needs NOTIFY: `20260502120000_platform_audit_log.sql` (new table),
  `20260503100000_webhook_event_ttl.sql` (new function).
- Skip NOTIFY: `20260503100100_webhook_retention_cron.sql` (cron
  registration only, no schema change).

## RLS posture

Two patterns coexist and both are intentional:

### User-readable tables

`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` plus an explicit
`CREATE POLICY` for each user role that should have access. Standard
shape for org-scoped data (invoices, recurring templates, message
log, etc.). Without explicit policies, end-users get no access; this
posture is the default.

### Service-role-only tables

`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` with **no** `CREATE
POLICY` statements. This is intentional: `service_role` bypasses RLS,
so the service role still has full access while end-user roles
(`authenticated`, `anon`) get zero access. The table is invisible to
anything that goes through PostgREST as a logged-in user.

A future security audit may flag "RLS enabled, no policies" without
context, so every such table **must** carry an explanatory
`COMMENT ON TABLE` so the convention is discoverable from `psql`. Use
something like:

```sql
COMMENT ON TABLE public.my_table IS
  'Service-role only. RLS enabled with no policies is intentional — service_role bypasses RLS, end-users get zero access.';
```

T05-F12 noted that the convention existed in practice but was
undocumented. The rule above closes that gap. Existing examples:
`stripe_webhook_events`, `platform_audit_log`.

## Function security

For any function that mutates state across schemas or auth boundaries,
or that is intended to be called by a specific role only:

- `SECURITY DEFINER` with `SET search_path TO 'public'` to pin the
  schema resolution and prevent search-path attacks.
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC;` then explicit
  `GRANT EXECUTE ON FUNCTION ... TO <role>;` for the intended caller
  (`service_role`, `authenticated`, etc.).

References: `record_stripe_payment` (service-role),
`cleanup_webhook_retention` (service-role),
`recalc_continuation_summary` (authenticated).

## Cron auth

Canonical Pattern C only. See `docs/CRON_AUTH.md` for the full
template (vault `INTERNAL_CRON_SECRET` → `x-cron-secret` header →
`validateCronAuth` server-side). New crons must use the
unschedule-then-schedule `DO $$` block from that doc; do not invent
new cron auth shapes.

## Commit subject discipline

`type(scope): summary (J{N}-F{...} | J{N}-P{P}-C{M})` for journeys,
`type(scope): summary (T{NN}-F{...} | T{NN}-P{P}-C{M})` for tracks.
Body has a `Why` paragraph (intent / problem) and a `What` paragraph
(concrete change). Closing line follows the journey or track
convention, e.g. `Track 0.5 Phase 2 Commit 3 of 4`. Recent journeys
and tracks (J9, T05, T08) are good references.

## See also

- `docs/CRON_AUTH.md` — Pattern C cron auth template + rationale.
- `docs/CRON_JOBS.md` — registry of every production cron, schedule,
  purpose, and failure-mode.
- `docs/WEBHOOK_DEDUP.md` — two-phase dedup design for
  `stripe_webhook_events` and the new retention sweep.
- `docs/PLATFORM_AUDIT_LOG.md` — schema, severity ladder, and
  retention policy for `platform_audit_log`.
