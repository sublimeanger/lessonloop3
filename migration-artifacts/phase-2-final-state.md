# Phase 2 Final State — LessonLoop Supabase Migration

**Completed:** 2026-05-05  
**Destination project:** `xmrhmxizpslhtkibqyfy` (West EU Ireland, Postgres 17.6.1.113)  
**Phase 2 scope:** schema rebuild from `supabase/migrations/` (420 migrations) — no data import yet (Phase 3+)

---

## Executive summary

| | |
|---|---|
| Migrations replayed | **420 / 420** |
| `schema_migrations` rows | **420** (393 distinct versions, 6 duplicate-version groups → 7 extra rows) |
| Public tables built | **93** (== 93 in source dump) |
| Cross-check source vs destination tables | ✓ 0 diff (no extra tables either side) |
| Apply-time halts encountered | 7 (all resolved, see "Halts" below) |
| Ad-hoc destination-side drift fixes | 9 statements + 2 schema-bookkeeping ops |
| Network access used | HTTPS / Management API only (Postgres 5432/6543 firewalled) |

---

## Object inventory (post-Phase-2)

| Object | Count |
|---|---|
| Tables | 93 |
| Views | 3 |
| Materialized views | 1 (`invoice_stats_mv`) |
| Functions | 154 |
| Triggers (user) | 126 |
| Enum types | 24 |
| RLS policies | 326 |
| Indexes | 376 |
| Cron jobs | 16 (vs 18 source — see "Cron gap" below) |
| Extensions | 8 (`btree_gist`, `pg_cron`, `pg_net`, `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`) |

---

## Migration-by-disposition breakdown

| Disposition | Count | Files |
|---|---|---|
| **Applied normally** | **410** | DDL executed + schema_migrations row |
| **Record-only** | **7** | DDL skipped (file is broken / redundant / DML-only spotcheck against missing source data) |
| **Auto-skipped** | **3** | DDL attempted, hit "already exists" error, transaction rolled back, schema_migrations row inserted |
| **Total** | **420** | |

### Record-only files (7)

| version | file | reason |
|---|---|---|
| 20260223100000 | calsync_cron_guardian_health.sql | nested `$$` inside cron.schedule body (broken parser); migration 178 redoes column adds, 179 redoes function |
| 20260225010707 | cf3a1354-…sql | redundant — same content as migrations 194 (lead_pipeline) + 195 (booking_pages) combined |
| 20260425093622 | f0390152-…sql | nested `$$`; function `backfill_guardian_default_pm_set` re-defined by 20260429100000 |
| 20260429080417 | 12d4e631-…sql | DML-only spotcheck with hardcoded source UUIDs (org `50357e06-…`, lessons `aaaa1111-…`); requires populated source data |
| 20260429100100 | schedule_auto_pay_final_reminder.sql | nested `$$`, cron-only payload |
| 20260502060816 | a9efa577-…sql | DML-only CW-F4 trigger sanity test against hardcoded source invoice `d7041eeb-…` |
| 20260516100000 | canary_walk_batch_1z_combined_fixes.sql | broken triggers (transition tables `0A000`); superseded by `20260516110000_canary_walk_batch_1z_corrected.sql` |

### Auto-skips (3)

| idx | version | code | colliding object | reason |
|---|---|---|---|---|
| 198 | 20260225011428 | 42710 | policy `"Org staff can view payment notifications"` on `payment_notifications` | already created by idx 184 (stripe_embedded_payments) — migration is a redundant consolidation |
| 266 | 20260316260000 | 42P16 | type `credit_status` | enum already added by prior migration |
| 347 | 20260424204013 | 42710 | policy `"Finance team manages templates"` on `recurring_template_items` | already created by idx 344 (recurring_template_items_table) — redundant overlap |

### In-memory transforms (3 distinct cases)

| idx | version | transform |
|---|---|---|
| 263 | 20260316240000 | comment-out lines 19–31 (`CREATE POLICY "Parents can view own refunds"` referencing nonexistent `students.user_id`); kept the 3 functions + trigger |
| 268 | 20260316300000 | prepend `DROP FUNCTION IF EXISTS public.{get_parent_lesson_notes(uuid, uuid[]), get_lesson_notes_for_staff(uuid, uuid, text, jsonb)} CASCADE;` — return-type changes (added `engagement_rating SMALLINT` etc.) |
| 397 | 20260502071159 | comment-out lines 1–104 (3 assertion DO blocks expecting source's specific violator-row UUIDs); kept `ALTER TABLE … VALIDATE CONSTRAINT invoices_payer_xor` (line 109) — succeeds on empty destination |

### Other transform classes
- **CONCURRENTLY no-wrap (statement-split):** 1 — idx 208 `composite_indexes.sql` (5× `CREATE INDEX CONCURRENTLY`)
- **BEGIN/COMMIT auto-wrap:** ~360 of 410 normal applies (skipped for files with own `BEGIN;` or CONCURRENTLY)
- **Dollar-quote `$$ → $cron$`:** 0 (all 3 candidate files were record-only'd from the start)

---

## Ad-hoc drift fixes (destination-side, NOT in supabase/migrations/)

These represent objects/columns/values that source has but the migration chain doesn't create. Documented in `/home/claude/ad_hoc_pre_cutover_drift_fixes.sql`.

| Section | When applied (relative to migration replay) | Statements |
|---|---|---|
| 1 | before idx 212 | `ALTER TABLE public.lead_students ADD COLUMN IF NOT EXISTS created_by uuid` |
| 2 | before idx 305 | `CREATE TABLE public.xero_connections (17 cols, FKs to organisations + auth.users + RLS)` |
| 2.5 | before idx 322 | `CREATE TABLE public.xero_entity_mappings (10 cols, FKs to organisations + xero_connections + RLS)` — schema inferred from `src/integrations/supabase/types.ts` |
| 3 | between idx 345 and 350 | 5 statements: rename `recurring_template_runs.invoices_generated → invoice_count`, rename `completed_at → finished_at`, add `source text`; add `recurring_template_items.unit_price integer`, `tax_rate numeric(5,2)` |
| 4 | before idx 217 | `ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'outstanding'` |

### Schema-bookkeeping interventions
- **Bootstrap PK fix:** `ALTER TABLE supabase_migrations.schema_migrations DROP CONSTRAINT schema_migrations_pkey` — initial bootstrap mistakenly added PK on `version`; canonical Supabase CLI schema has no PK, so it was dropped to allow the 7 expected duplicate-version rows.
- **Mid-flight rollback:** `cron.unschedule('refresh-calendar-busy-blocks')` + `DROP COLUMN guardian_id CASCADE` + `DROP FUNCTION (×2)` + recreate `calendar_connections_user_id_org_id_provider_key` constraint — needed because migration 177 was first attempted with `$$ → $cron$` transform (succeeded), conflicting with migration 178; rolled back, then re-applied as record-only.

---

## Source-vs-destination cross-check

### Tables (93 each, both sets identical)

`set(source_public_tables) ∩ set(destination_public_tables)` covers all 93. **No drift in table names** at this level. Column-level cross-checks were done ad-hoc during halts (e.g. `lead_students.created_by`, `recurring_template_runs.{invoice_count, finished_at, source}`, `recurring_template_items.{unit_price, tax_rate}`) and resolved via Section 1 / Section 3 of the ad-hoc fix plan.

### Cron gap (2 missing on destination)

Source has **18 active cron jobs**; destination has **16**. The 2 missing per migration `20260501100100_cron_auth_standardisation_patch.sql`'s comment block:
- `complete-expired-assignments` (SQL-only, no HTTP — out-of-band on source, never in chain)
- `reset-stale-practice-streaks` (same — SQL-only, never in chain)

Both are SQL-only crons (no HTTP target), so their absence won't cause auth or routing issues — they just don't run on destination. **Action for Phase 5:** schedule both manually if they're functionally required.

### Cron URL drift (16 of 16 jobs need patching)

**Every one of the 16 cron jobs on destination has its `net.http_post(url := …)` pointing at the source project URL `https://ximxgnkpcswbvfrkkmjq.supabase.co/...`** (the URLs are baked into the migration files and the chain replayed them as-is). They will silently 401-fail until Phase 5 cron-URL patching, because:
- Each cron sends `x-cron-secret: <destination's INTERNAL_CRON_SECRET>` (read from destination's vault)
- Source's edge function expects source's INTERNAL_CRON_SECRET → mismatch → 401

This is the cleanest pre-cutover state: destination cron is a dead-letter office until we point it at destination URLs in Phase 5.

---

## TODOs for post-Phase-2 (out-of-band parity work)

1. **Cron URL patching (Phase 5):** rewrite all 16 `cron.job` rows to use `https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/...`. Ideally as a follow-up SQL run; a generated migration file is overkill since this is a one-shot.
2. **2 missing SQL-only crons:** schedule `complete-expired-assignments` and `reset-stale-practice-streaks` manually if they're required by the operations team.
3. **xero_connections + xero_entity_mappings RLS policies + indexes:** chain enables RLS on both but creates no policies or indexes. Source has out-of-band additions. Re-create from source's actual definition before cutover.
4. **`get_calendar_error_count` function:** defined only in record-only migration 177. If frontend types.ts assumes it exists and the function is needed for some report, add manually.
5. **Phase 5 verification of inferred types:** call `generate_invoices_from_template()` against test data to confirm `recurring_template_items.{unit_price integer, tax_rate numeric(5,2)}` types are correct. Adjust if runtime errors surface.
6. **Edge function refactor (`LOVABLE_API_KEY`):** flagged in early Phase 1 context — replace any references in `supabase/functions/` before deploy. (Out of scope for Phase 2.)
7. **Destination Auth providers:** Google OAuth client ID + secret + SMTP/Resend config (for password-reset emails to 116 email/password users) — dashboard-level, not in migration chain.
8. **Manifest exposure on remote:** `lessonloop-dump-manifest.json` was committed in `d0a16ef` and pushed to `origin/claude/supabase-migration-setup-Pb4Eu`. Signed URLs (~7-day TTL) exposed there. Decision pending: rotate dump or wait for URL expiry.

---

## Files / artifacts

- **Apply driver:** `/tmp/apply_migrations.py` (1000+ lines: bootstrap, batch, multi, transforms, auto-skip, statement-split, fingerprint reporting)
- **Migration journal (operational SoT):** `/home/claude/migration-journal.md`
- **Sequenced fix plan (drift fixes):** `/home/claude/ad_hoc_pre_cutover_drift_fixes.sql`
- **Source schema fingerprint:** `/home/claude/source-fingerprint.json` (97 entries from JSON dumps, 50-row sample per non-empty table)
- **Cached partial dumps:** `/home/claude/migration-dump-cache/`
- **Per-migration temp DDL:** `/tmp/lessonloop-migration-tmp/*.sql` (for any inspection)

## Network constraint summary

- HTTPS (port 443) to `api.supabase.com`: **OPEN** — Management API works via `supabase db query --linked`
- TCP 5432/6543 to Postgres pooler: **BLOCKED** outbound from this sandbox
- Result: `supabase db push` cannot run from here. All migration replay was done via the Management API's `/v1/projects/{ref}/database/query` endpoint, one query per file (or per statement for CONCURRENTLY).

The destination's `schema_migrations` table now matches what the canonical Supabase CLI bootstrap creates (no PK), so once you run `supabase db push --include-all` from a network-reachable environment (e.g., your local machine), the CLI will see all 420 rows present and treat the project as fully up-to-date with the migration chain. No follow-up cleanup needed.

---

**Phase 2 complete. Awaiting Phase 3 (data import) instructions.**
