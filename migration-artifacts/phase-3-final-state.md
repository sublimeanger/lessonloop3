# Phase 3 Final State — LessonLoop Supabase Data Migration

**Completed:** 2026-05-05
**Destination project:** `xmrhmxizpslhtkibqyfy` (West EU Ireland, Postgres 17.6.1.113)
**Phase 3 scope:** auth.users, storage objects, all 93 public tables (data load) — no Phase 5 work yet

---

## Executive summary

| | |
|---|---|
| Tables loaded (public) | **93 / 93** ✓ |
| Rows restored (public) | **81,473 / 81,473** ✓ (0 mismatches) |
| auth.users created | **129 / 129** ✓ |
| Storage objects uploaded | **11 / 11** ✓ across 4 buckets |
| FK orphan rows (all 253 constraints in public) | **0** ✓ |
| Phase 4 verification | **8 pass / 1 partial / 0 fail** — go for Phase 5 |
| Network constraint | HTTPS-only (Postgres direct ports firewalled); all loads via Management API |

---

## Per-table row counts (final reconciliation)

All 93 public tables match source manifest exactly (cumulative 81,473 rows). Top 20 by row count:

| table | source rows | dest rows | match |
|---|---|---|---|
| audit_log | 25,956 | 25,956 | ✓ |
| rate_limits | 14,148 | 14,148 | ✓ |
| ai_messages | 7,790 | 7,790 | ✓ |
| ai_conversations | 7,744 | 7,744 | ✓ |
| lesson_participants | 4,679 | 4,679 | ✓ |
| lessons | 4,677 | 4,677 | ✓ (incl. 1 grandfathered violator) |
| platform_audit_log | 3,836 | 3,836 | ✓ |
| students | 3,590 | 3,590 | ✓ |
| attendance_records | 3,208 | 3,208 | ✓ |
| message_log | 1,308 | 1,308 | ✓ |
| guardians | 631 | 631 | ✓ |
| student_guardians | 525 | 525 | ✓ |
| invoice_items | 428 | 428 | ✓ |
| closure_dates | 393 | 393 | ✓ |
| invoices | 345 | 345 | ✓ |
| student_teacher_assignments | 344 | 344 | ✓ |
| student_instruments | 315 | 315 | ✓ |
| recurrence_rules | 314 | 314 | ✓ |
| org_memberships | 147 | 147 | ✓ |
| profiles | 129 | 129 | ✓ |

29 tables had 0 rows in source (skip-empty); destination matches.

---

## auth.users state

| | |
|---|---|
| Total users | 129 (matches source) |
| Email-confirmed | 126 (matches source) |
| Phone numbers preserved | 0 (no source users had phones) |
| `created_at` preserved (pre-today) | 129 ✓ |
| `last_sign_in_at` preserved | matches source |
| `raw_user_meta_data` round-trip | 5/5 sample users match exactly |
| `raw_app_meta_data` round-trip | 5/5 sample users match exactly |
| `auth.identities` | empty (source dump empty) — 13 Google OAuth users will re-link on first sign-in |
| Bulk-create method | Supabase Admin API (`POST /auth/v1/admin/users`) |
| Password | each user got random 32-char temp; password reset flow needed for first login |

`confirmed_at` is a generated column on Supabase's modern auth schema (auto-derived from `email_confirmed_at`) — left to recompute itself.

---

## Storage state

| bucket | public | files | total bytes | source match |
|---|---|---|---|---|
| avatars | ✓ | 0 | 0 | source had 0 too |
| org-logos | ✓ | 6 | 409,986 | ✓ |
| invoice-pdfs | private | 1 | 16,848 | ✓ |
| teaching-resources | private | 4 | 3,574,855 | ✓ |
| **Total** | | **11** | **4,001,689** | ✓ |

Plus a 5th `migration-dump` bucket (chain artifact from idx 405; source-only purpose; harmless).

**Path corrections during upload:** the dump's `storage.objects.json` had stale `prefix` values for the 5 private files (e.g., `50357e06-…/file.pdf` instead of the actual `ce918a03-…/file.pdf`). Source's metadata table had drifted from filesystem reality. We migrated the corrected paths (matching what's actually stored on source) — files are accessible via signed URL on destination.

---

## Anomalies / surgical events during Phase 3

### 1. lessons.chk_lesson_time_range NOT VALID grandfathering
- 1 source row (`672d594d-5461-4808-92ff-bdcbb2ef542e`, "Lesson – Studen Five") had `end_at < start_at` (5h timezone-bug DST transition).
- Replica mode does NOT bypass CHECK constraints (only triggers + FKs).
- Drop-load-readd-NOT-VALID pattern: `DROP CONSTRAINT chk_lesson_time_range`, load all 4,677 lessons including the violator, `ADD CONSTRAINT … NOT VALID`. New INSERTs ARE still rejected; only this row exempt.

### 2. TRUNCATE CASCADE → DELETE FROM in replica mode
- Initial loader used `TRUNCATE table CASCADE` for pre-existing rows (e.g., chain seeds in instruments/exam_boards/grade_levels).
- TRUNCATE's CASCADE is **syntax-level**, NOT controlled by `session_replication_role`. It walked the FK graph forward.
- Discovered `organisations.default_exam_board_id → exam_boards.id` — TRUNCATE exam_boards CASCADE walked DOWN to organisations and then to all 50+ tables that FK to organisations, wiping previously-loaded data.
- Switched to `DELETE FROM table` in replica mode (FK constraint triggers ARE replica-mode-disabled → no cascade).
- Re-loaded affected tables.

### 3. Cache size validation auto-redownload
- The Phase 1 fingerprint script truncated dumps with `Range: bytes=0-499999`.
- Initial loader's "use cache if size > 0" caused a JSON parse error on the first large file (ai_conversations).
- Added 90% size-match threshold; auto-redownloads truncated cache files.
- Triggered re-downloads for: lessons (4 MB), lesson_participants (1.2 MB), ai_conversations (2 MB), ai_messages (3 MB), attendance_records (1.3 MB), audit_log (23 MB), rate_limits (3.3 MB), platform_audit_log (4 MB).

### 4. Storage path correction
- Source's `storage.objects` table had stale rows pointing at outdated paths for the 5 private files.
- Examples: source row said `invoice-pdfs/50357e06-…/9f698294-…pdf` but actual stored file was at `5b905216-…/9f698294-…pdf`.
- Corrected paths obtained from fresh signed URLs (Phase 3 Stage 5 Part B).
- Did NOT migrate the stale source rows; uploaded files at corrected paths (which auto-create new rows on destination).

### 5. Pre-existing chain-seed rows cleared before re-load
Tables that had data BEFORE the load (from migration chain seeds OR triggers fired during Stage 2 auth.users creation):
- profiles: 129 (auth.users INSERT trigger `handle_new_user`)
- instruments: 34 (chain seed migration `20260223002034`)
- exam_boards: 6 (same)
- grade_levels: 36 (same)
- platform_audit_log: 131 (chain seed)
- _spotcheck_log: 3 (chain seed)
- lessons (during failed-load recovery): 1500 partial rows from interrupted batch
All cleared via DELETE-in-replica-mode before fresh load. Source data prevails on destination.

### 6. session_replication_role + auth.users.confirmed_at generated column
- `auth.users.confirmed_at` is a generated column (modern Supabase auth schema) — auto-derives from `email_confirmed_at`. UPDATE on it errors with `428C9`. Workaround: skip `confirmed_at`; only restore `email_confirmed_at`, `last_sign_in_at`, `created_at`. Updates the journal's earlier P3.3 finding ("0 generated columns") which was scoped to `public` only.

---

## Phase 4 Verification Summary

| Check | Status |
|---|---|
| V1 — per-table row count reconciliation | ✓ pass (0 mismatches) |
| V2 — FK integrity sweep (253 constraints) | ✓ pass (0 orphans) |
| V3 — trigger state + replication role | ✓ pass (`origin`, 0 disabled) |
| V4 — row-level data spot-checks (10 tables × 3 rows) | ✓ pass (0 field diffs) |
| V5 — sequence verification | ✓ pass |
| V6 — CHECK constraint compliance | ✓ pass (0 violators) |
| V7 — auth.users sanity | ✓ pass (129, metadata round-trip clean) |
| V8 — storage integrity | ✓ pass (11 files, ~3.8 MB) |
| V9 — schema diff vs source fingerprint | ⚠ partial (4 tables with drift) |

V9 drift findings (4 tables; documented as Phase 5 follow-ups):
- `lead_students.created_by` — INTENTIONAL (Phase 2 ad-hoc fix Section 1)
- `students.import_batch_id` — chain has it; source doesn't (likely dropped post-chain on source)
- `make_up_credits.voided_by` — source has out-of-band
- `organisations.reminder_*` (6 cols) — source has out-of-band reminder config columns

Full verification report: `/home/claude/phase-4-verification.md`.

**Go/no-go: GO for Phase 5.**

---

## Open TODOs

### Phase 5 (cron, secrets, schema parity)

- **Cron URL patching** — all 16 destination cron jobs target `ximxgnkpcswbvfrkkmjq.supabase.co` (source ref). Patch to `xmrhmxizpslhtkibqyfy.supabase.co` via either `cron.unschedule()`+`cron.schedule()` per job or `UPDATE cron.job SET command = REPLACE(command, '<src_ref>', '<dest_ref>')`.
- **2 SQL-only crons need recreation** (not in migration chain — added on source out-of-band):
  - `complete-expired-assignments` calling `public.complete_expired_assignments()`
  - `reset-stale-practice-streaks` calling `public.reset_stale_streaks()`
- **25 source-project secret values to fetch from third-party dashboards** (Stripe, Xero, Twilio, Zoom, Resend, Anthropic, Google) and `supabase secrets set` on destination.
- **Generate fresh secrets:** `INTERNAL_CRON_SECRET`, `WAITLIST_JWT_SECRET`, `STRIPE_WEBHOOK_SECRET`.
- **Replace LOVABLE_API_KEY references** in edge function code (use a different provider's key).
- **xero_connections + xero_entity_mappings RLS policies + indexes** — RLS enabled by ad-hoc fix but no policies/indexes from chain. Recreate from source's actual definition.
- **storage.objects.owner is NULL for all 11 migrated rows** — verify storage RLS doesn't gate on `owner`; populate retroactively if it does. Source dump tool didn't include this column.
- **recurring_template_items.unit_price + tax_rate** — added with inferred types (`integer`, `numeric(5,2)`). Verify at runtime when `generate_invoices_from_template()` is first called.
- **`generate_invoices_from_template()` body runtime verification** — function references columns we added during Phase 2 Section 3 fix. Confirm function executes correctly post-cutover.
- **Schema drift items from V9:**
  - `make_up_credits.voided_by` — add column matching source's type (likely uuid REFERENCES auth.users)
  - `organisations.reminder_before_due_days`, `reminder_before_due_enabled`, `reminder_escalation_days`, `reminder_escalation_enabled`, `reminder_overdue_days`, `reminder_overdue_enabled` — 6 reminder-config columns
  - `students.import_batch_id` — chain has it; source doesn't. Decide whether to drop on destination (matches source) or keep (chain consistency).
- **`get_calendar_error_count` function** — defined only in record-only migration 177. If frontend types.ts assumes it exists and the function is needed, add manually.
- **Regenerate types.ts post-migration** — clean up stale references (e.g., `get_calendar_error_count`).
- **`migration-dump` bucket cleanup** — chain artifact from idx 405; harmless. Drop on destination + source after cutover.

### Phase 6 (Auth + email)

- **Google OAuth provider config on destination** — clientID + secret + redirect URI in destination's Auth settings (dashboard).
- **SMTP/Resend email config** for sending password-reset emails to 116 email/password users.
- **13 Google OAuth users** will re-link on first sign-in (auto-creation of identity row when OAuth flow finds matching auth.users by email — no manual identity migration needed).

### Phase 7 (Frontend cutover)

- **`.env` update** — `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` → destination values.
- **`src/integrations/supabase/client.ts`** — hardcoded creds update if any.
- **`supabase/config.toml` `project_id`** — currently still `ximxgnkpcswbvfrkkmjq`; update to `xmrhmxizpslhtkibqyfy`.
- **iOS app rebuild** — with new creds (separate exercise; not Claude Code).
- **Stripe webhook endpoint update** in Stripe dashboard — point at destination's `stripe-webhook` edge function URL.

---

## Files / artifacts

- **Apply driver:** `/tmp/apply_migrations.py` (Phase 2)
- **Data loader:** `/tmp/load_data.py` (Phase 3 Stage 3)
- **Org-logos uploader:** `/tmp/upload_org_logos.py` (Phase 3 Stage 5 Part A)
- **Phase 4 verifier:** `/tmp/phase4_verify.py`
- **Migration journal (operational SoT):** `/home/claude/migration-journal.md`
- **Sequenced fix plan:** `/home/claude/ad_hoc_pre_cutover_drift_fixes.sql`
- **Phase 2 final state:** `/home/claude/phase-2-final-state.md`
- **Phase 3 final state:** `/home/claude/phase-3-final-state.md` (this file)
- **Phase 4 verification:** `/home/claude/phase-4-verification.md`
- **Source schema fingerprint:** `/home/claude/source-fingerprint.json`
- **Cached partial dumps:** `/home/claude/migration-dump-cache/`
- **Cached private files:** `/home/claude/migration-dump-cache/private-files/`
- **Auth users bulk-create log:** `/home/claude/auth-users-bulk-create.json`

---

**Phase 3 complete. Phase 4 verification passed. Awaiting Phase 5 instructions.**
