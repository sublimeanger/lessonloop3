# LessonLoop Supabase Migration Journal

Single source of truth for everything destination has that the migration chain doesn't, plus every transform / record-only / surgical fix applied during Phase 2 replay.

## Destination project
- Ref: `xmrhmxizpslhtkibqyfy`
- URL: `https://xmrhmxizpslhtkibqyfy.supabase.co`
- Region: West EU (Ireland)

## schema_migrations bootstrap
- Table created via Management API (Phase 2, Batch 1 prep) with **no PRIMARY KEY** on `version`
  (canonical Supabase CLI shape; the PK was added in error during initial bootstrap and dropped during Batch 8 recovery — see "PK drop" below).

---

## Record-only migrations (DDL never executed; schema_migrations row recorded)

| version | filename | reason |
|---|---|---|
| 20260223100000 | calsync_cron_guardian_health.sql | nested `$$` cron block; non-cron DDL is supplied by 178 (column add) and 179 (`get_org_calendar_health`) |
| 20260225010707 | cf3a1354-21ba-4c4c-8bae-1e6652669c5e.sql | redundant with 194+195 combined (lead_pipeline + booking_pages) |
| 20260425093622 | f0390152-7351-443f-b860-59162565eccf.sql | nested `$$` cron block; function `backfill_guardian_default_pm_set` re-defined by `20260429100000_backfill_default_payment_method.sql` |
| 20260429080417 | 12d4e631-…sql | DML-only spotcheck with hardcoded source UUIDs (org `50357e06-…`, lessons `aaaa1111-…`, etc.); depends on source data, no DDL content. |
| 20260429100100 | schedule_auto_pay_final_reminder.sql | nested `$$` cron block; cron-only payload |
| 20260502060816 | a9efa577-…sql | DML-only CW-F4 trigger sanity test against hardcoded source invoice `d7041eeb-…`; depends on source data, no DDL content. |
| 20260516100000 | canary_walk_batch_1z_combined_fixes.sql | broken trigger DDL (transition tables 0A000); superseded by 20260516110000 corrected version |

## Scanner gaps (known limitations)

- **Predictive drift scanner v2:** can't resolve table aliases / FROM context, so it can't reliably scope a column reference (e.g. `status = 'X'`) to its specific table. Generates false positives for text-with-CHECK columns; useful only as a coarse first pass for enum-typed columns. Real enum drift surfaces as `22P02` errors at apply time.
- **Spotcheck scanner (idx 380-400):** `^CREATE/^ALTER/…` line-anchored regex doesn't match DDL inside `DO $$ … $$;` blocks. Flagged migrations 389 and 390 (`cron_auth_standardisation`/`_patch`) as candidates, but they're real cron migrations using `DO $$ PERFORM cron.schedule(...) $$;`. False positives — handled by manual inspection. For future scans: extend DDL detection to include patterns inside DO/PL/pgSQL bodies, or just check for `cron.schedule`/`PERFORM` markers as anti-signals.
- **Function-return-type scanner:** parses RETURNS clauses heuristically and normalizes (whitespace, type aliases). Found 0 candidates in 324-400 — no in-chain or destination-vs-chain conflicts beyond migration 268's already-handled case.

---

## In-memory transforms (file on disk unchanged; rewritten before sending to API)

| version | filename | transform | reason |
|---|---|---|---|
| 20260316240000 | fix_refund_audit_findings.sql | comment-out lines 19–31 (CREATE POLICY "Parents can view own refunds") | policy USING clause references `students.user_id`, which doesn't exist on source or destination. Other DDL in file is critical (3 functions + trigger) and applied normally. |
| 20260316300000 | fix_lesson_notes_audit_findings.sql | prepend `DROP FUNCTION IF EXISTS public.get_parent_lesson_notes(uuid, uuid[]) CASCADE;` and `DROP FUNCTION IF EXISTS public.get_lesson_notes_for_staff(uuid, uuid, text, jsonb) CASCADE;` before the CREATE OR REPLACE statements | both functions exist on destination with old return shapes; migration adds `engagement_rating SMALLINT` and other columns to TABLE return — Postgres rejects `CREATE OR REPLACE` for return-type changes (42P13). DROP CASCADE removes any policy/view that depended on the old version; the migration recreates them downstream. |
| 20260502071159 | e135f2eb-…sql | comment-out lines 1–104 (3 assertion DO blocks expecting 5 BOTH_SET + 2 NEITHER_SET violator rows on hardcoded source UUIDs) | data assertions assume source's `invoices` table is populated with specific violators of `invoices_payer_xor`. On empty destination, assertion fails. Surgically applied lines 106-128 (`ALTER TABLE … VALIDATE CONSTRAINT invoices_payer_xor` + post-check + NOTIFY); constraint now `convalidated=true`. |

---

## Auto-skipped at runtime (apply attempted; collision with prior schema; recorded)

(Pulled live from `/tmp/lessonloop-migration-tmp/auto-skip-log.json` after each batch.)

| version | filename | error_code | colliding object |
|---|---|---|---|
| 20260225011428 | e4e8beba-f283-44d8-ba1d-dd2984427bee.sql | 42710 | `Org staff can view payment notifications` (policy on payment_notifications) — already created by stripe_embedded_payments (idx 184) |

---

## Statement-split migrations (CONCURRENTLY DDL — sent unwrapped, one statement per API call)

| version | filename | reason |
|---|---|---|
| 20260303170000 | composite_indexes.sql | 5× `CREATE INDEX CONCURRENTLY` — Management API wraps multi-statement queries in implicit transaction |

---

## Surgical schema-drift fixes (destination-side; NOT in supabase/migrations/)

These represent objects/columns that source has but our migration chain does not create. Applied directly via Management API at the time the chain reaches the migration that depends on them.

Sequenced SQL plan: `/home/claude/ad_hoc_pre_cutover_drift_fixes.sql`

| applied | object/change | timing | rationale |
|---|---|---|---|
| 2026-05-04 | `ALTER TABLE public.lead_students ADD COLUMN IF NOT EXISTS created_by uuid` | before migration 212 | source has the column (per migration 212's FK reference); no migration in chain adds it |
| 2026-05-04 | `CREATE TABLE public.xero_connections (17 cols, FKs to organisations + auth.users + RLS)` | before migration 305 | comment in migration 305 explicitly says table was created out-of-band; not in any migration |
| 2026-05-04 | `CREATE TABLE public.xero_entity_mappings (10 cols, FKs to organisations + xero_connections + RLS)` | before migration 322 | table created out-of-band on source; not in any migration. Schema inferred from `src/integrations/supabase/types.ts` lines 6400-6437. |
| 2026-05-04 | `ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'outstanding'` | before migration 217 | migration 217's materialised view filters on `'outstanding'` but no migration adds the enum value; source has it out-of-band (no live data uses it) |
| pending | `ALTER TABLE public.recurring_template_runs RENAME COLUMN invoices_generated TO invoice_count` | between 345 and 350 | runtime correctness; migration 350's function bodies reference `invoice_count`. **Applied 2026-05-04, verified column present, old name absent.** |
| pending | `ALTER TABLE public.recurring_template_runs RENAME COLUMN completed_at TO finished_at` | between 345 and 350 | same as above; references `finished_at`. **Applied 2026-05-04, verified column present, old name absent.** |
| pending | `ALTER TABLE public.recurring_template_runs ADD COLUMN IF NOT EXISTS source text` | between 345 and 350 | function body's INSERT references missing column. **Applied 2026-05-04, verified.** |
| pending | `ALTER TABLE public.recurring_template_items ADD COLUMN IF NOT EXISTS unit_price integer` | between 345 and 350 | runtime correctness; `generate_invoices_from_template()` body references `ti.unit_price`. **Type inferred** — minor-unit integer convention (cf. `amount_minor`, `total_minor`). Source dump empty so actual type unconfirmed. Verify in Phase 5. **Applied 2026-05-04, verified.** |
| pending | `ALTER TABLE public.recurring_template_items ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2)` | between 345 and 350 | runtime correctness; `generate_invoices_from_template()` body references `ti.tax_rate`. **Type inferred** — `numeric(5,2)` to match `organisations.vat_rate`. Source dump empty so actual type unconfirmed. Verify in Phase 5. **Applied 2026-05-04, verified.** |

## Source fingerprint

Built 2026-05-04 from JSON dumps (50-row sample per table). Stored at `/home/claude/source-fingerprint.json`. 97 entries: 67 with column data, 30 empty (source had 0 rows in those tables, so no fingerprint).

Cached partial dump files: `/home/claude/migration-dump-cache/`

---

## TODOs for post-Phase-2 (out-of-band parity work)

- **xero_connections RLS policies + indexes:** the migration chain enables RLS but creates no policies or indexes on this table. Source has out-of-band schema additions not in migration history. Re-create from source's actual definition before cutover.
- **`get_calendar_error_count` function:** defined only in record-only migration 177. If source has this function and the frontend needs it, add manually.
- **Cron URL patching:** 21 migrations contain hardcoded source ref `ximxgnkpcswbvfrkkmjq` in `net.http_post` URLs. Patch destination's `cron.job` rows to point at destination URL before re-enabling cron jobs (Phase 5).
- **`schema_migrations` PK:** initial bootstrap added `version text PRIMARY KEY`; this was dropped during Batch 8 recovery (canonical Supabase schema has no PK; 6 duplicate-version groups in chain).
- **Manifest exposure:** `lessonloop-dump-manifest.json` was committed in `d0a16ef` and pushed to `origin/claude/supabase-migration-setup-Pb4Eu`. Signed URLs (~7-day TTL) are exposed there. Decision: rotate dump or wait for URL expiry.
- **`get_calendar_error_count`:** referenced by `src/integrations/supabase/types.ts` but not called by app code. Function dropped during 177 rollback; may need manual re-add if you want types.ts to regenerate identically.

## Phase 5 deferred work

- **Recreate SQL-only cron jobs absent from chain:**
  - `complete-expired-assignments` (calls `public.complete_expired_assignments()`)
  - `reset-stale-practice-streaks` (calls `public.reset_stale_streaks()`)
  - Both SQL-only, no HTTP, added on source out-of-band; not in any migration file.
- **Patch all 16 cron job URLs on destination** from `ximxgnkpcswbvfrkkmjq.supabase.co` to `xmrhmxizpslhtkibqyfy.supabase.co`. Until done, every cron silently 401-fails (destination's `INTERNAL_CRON_SECRET` doesn't match source's). Approach: either `cron.unschedule()` + `cron.schedule()` per job with edited URL, or direct `UPDATE cron.job SET command = REPLACE(command, 'ximxgnkpcswbvfrkkmjq', 'xmrhmxizpslhtkibqyfy')`.
