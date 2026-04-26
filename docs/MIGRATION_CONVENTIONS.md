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

## Audit triggers

Track 0.1 Phase 1 (May 2026) added 16 audit triggers across the
remaining business-critical tables and introduced a canonical helper.
The conventions below codify what new tables in this class should do.

### When to add an audit trigger

Default-add for any business-critical or money-adjacent table. The
threshold isn't "user-facing" — it's "would an out-of-band edit on
this row matter to an operator investigating a discrepancy?" If yes,
trigger. The walk in `docs/AUDIT_LOG_AUDIT_2026-04-26.md` documents
the criteria used for the existing T01-P1 scope and is the reference
for borderline cases.

### Which pattern to use

Three patterns cover every shape that has come up:

- **Org-scoped tables with `org_id` on the row.** Use
  `public.log_audit_event_singular(<entity_type_singular>)` from
  `20260505100000_audit_triggers_t01_p1_parent_tables.sql`. Pass the
  singular entity type as `TG_ARGV[0]`. This is the default; 16 of
  the 16 T01-P1 tables use it.
- **Per-user tables with no `org_id`** (`profiles`, `user_roles`, and
  any future auth-mirror table). Write to `platform_audit_log`, not
  `audit_log` — the cross-org reality matches the platform-event
  shape T05-P1-C6 introduced. T01-P2 ships the canonical pair of
  triggers; until then, see `docs/PLATFORM_AUDIT_LOG.md` for the
  destination schema.
- **Child tables whose `org_id` lives only via a parent foreign
  key.** Write a custom trigger function that resolves `org_id` via
  a JOIN against the parent. None of the 16 T01-P1 tables actually
  needed this (the recurring-template family denormalises `org_id`
  on child rows), but the brief carries the design for future
  child tables that don't.

### `entity_type` is singular

New triggers MUST write singular (`'invoice'`, not `'invoices'`).
The canonical helper takes the type via `TG_ARGV[0]` so the singular
form is explicit at trigger creation rather than derived from
`TG_TABLE_NAME` (which is plural). The 9 existing triggers using the
older `log_audit_event` helper write plural; T01-P3 normalises them
alongside a backfill UPDATE on historical `audit_log` rows. New code
in the meantime stays singular.

### DELETE-safety and action verb

Always:

- `COALESCE(NEW.org_id, OLD.org_id)` for `org_id`.
- `COALESCE(NEW.id, OLD.id)` for `entity_id`.
- `LOWER(TG_OP)` for `action` — yields `'insert'` / `'update'` /
  `'delete'`. Do NOT write `'create'`; the older `log_audit_event`
  emits `'create'` on insert and that's another T01-P3 normalisation.
- Return `OLD` on `TG_OP = 'DELETE'`, `NEW` otherwise.

### Idempotency

Trigger registrations follow the convention from the "Idempotency"
section above:

```sql
DROP TRIGGER IF EXISTS audit_<table> ON public.<table>;
CREATE TRIGGER audit_<table>
  AFTER INSERT OR UPDATE OR DELETE ON public.<table>
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('<entity_type_singular>');
```

The helper itself uses `CREATE OR REPLACE FUNCTION`. Re-applying
either migration is a no-op.

## See also

- `docs/CRON_AUTH.md` — Pattern C cron auth template + rationale.
- `docs/CRON_JOBS.md` — registry of every production cron, schedule,
  purpose, and failure-mode.
- `docs/WEBHOOK_DEDUP.md` — two-phase dedup design for
  `stripe_webhook_events` and the new retention sweep.
- `docs/PLATFORM_AUDIT_LOG.md` — schema, severity ladder, and
  retention policy for `platform_audit_log`.
- `docs/AUDIT_LOG_AUDIT_2026-04-26.md` — Track 0.1 Phase 0 walk that
  drove the audit-trigger conventions above.
