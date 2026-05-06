# Phase 5 Final State — LessonLoop Supabase Edge Functions, Secrets, Cron

**Completed:** 2026-05-06
**Destination project:** `xmrhmxizpslhtkibqyfy` (West EU Ireland, Pro tier, Postgres 17.6.1.113)
**Phase 5 scope:** edge function deploys, third-party + internal secrets, cron job scheduling, and the auth/key-model adjustments needed to make all of the above work together.

---

## Executive summary

| | |
|---|---|
| Edge functions deployed | **103 / 103** ✓ all `ACTIVE` |
| `verify_jwt = false` functions | **65** (was 41 in source config; +24 added Phase 5) |
| `verify_jwt = true` functions | **38** (user-JWT-authenticated) |
| Secrets set | **31** (15 real values + 16 placeholders pending fetch) |
| HTTP-triggered cron jobs | **16 / 16** patched to destination URL |
| SQL-only cron jobs | **2** (newly scheduled — absent from migration chain) |
| Cron auth verified end-to-end | ✓ (3 functions invoked + 1 negative control) |
| GRANT P0 fix applied | ✓ all 93 public tables, default privileges set |
| Data loss event | 1 incident, fully recovered (see anomaly section) |

---

## Edge function deployment

All 103 functions deployed to destination project via `supabase functions deploy --use-api` (Docker bundle bypass — Phase 5 sandbox has no Docker). All show `ACTIVE` status in the Mgmt API.

Two functions modified before deploy (Lovable AI gateway dependency removed):
- `csv-import-mapping/index.ts` — direct Gemini API (`gemini-flash-latest`) replacing Lovable's `LOVABLE_API_KEY` proxy.
- `marketing-chat/index.ts` — same conversion, also dropped streaming path; returns OpenAI-shape `{choices:[{message:{content}}]}` wrapper for compatibility.

Two seed functions hardened with destination project ref in production-guard list:
- `seed-demo-data/index.ts`, `seed-e2e-data/index.ts` — both reject any URL containing `xmrhmxizpslhtkibqyfy` or `lessonloop` (unless `local`). `ALLOW_SEED=false` provides a second-line backstop.

24 functions had `verify_jwt = false` added during Phase 5 to resolve the sb_secret/JWT-format incompatibility (see anomaly section).

---

## Secrets

31 secrets set via `supabase secrets set --project-ref xmrhmxizpslhtkibqyfy`:

**Real values (15):**
- `INTERNAL_CRON_SECRET` — fresh 64-char hex generated for destination; vault-stored copy for `pg_net.http_post` calls from cron jobs.
- `WAITLIST_JWT_SECRET` — fresh 64-char hex.
- `SITE_URL`, `APP_DOMAIN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_URL` — environment configuration.
- 9 platform-managed automatically: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`, `SUPABASE_ANON_KEY` (legacy), and supporting keys.

**Placeholders pending fetch (16):**
Set to `PENDING_*_FETCH` strings; user has secret-fetch-checklist.md for replacement. Categories:
- Stripe: `STRIPE_SECRET_KEY` + 6 price IDs (Teacher/Studio/Agency × Monthly/Yearly)
- Stripe webhook secret: deferred to Phase 7 cutover
- Xero: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`
- Zoom: `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`
- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Email: `RESEND_API_KEY`
- AI: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

Until placeholders are replaced, the functions that depend on them will fail with provider auth errors at invocation, but they are deployed and reachable. This is intentional for the cutover sequence.

---

## Cron jobs

**18 jobs total** running on destination:
- **16 HTTP-triggered jobs** patched from source ref to destination ref (`xmrhmxizpslhtkibqyfy.supabase.co`). Each carries `x-cron-secret: <INTERNAL_CRON_SECRET>` header. Schedules preserved from source (per pg_cron `schedule` column).
- **2 SQL-only jobs** scheduled fresh (absent from migration chain — added on source out-of-band):
  - `complete-expired-assignments` — `0 4 * * *` — calls `public.complete_expired_assignments()`.
  - `reset-stale-practice-streaks` — `0 3 * * *` — calls `public.reset_stale_streaks()`.
  - Schedules currently placeholder; verify against source's actual cron schedules in Phase 6 prep.

Cron auth verified end-to-end during Phase 5 (W5 sample):
- `invoke-overdue-check` with `x-cron-secret: <correct>` → HTTP 200, recalculated 8 invoices.
- `credit-expiry` → HTTP 200, no expirations to process.
- `recurring-billing-scheduler` → HTTP 200, no templates due.
- Negative control with wrong secret → HTTP 401.

The full destination cron pipeline is now operational. Next scheduled fires happen at 02:00–09:00 UTC daily; first real run depends on what time of day the cron daemon evaluates next.

---

## Phase 5 anomalies + interventions

Three notable incidents during Phase 5; all resolved. Detailed root cause + fix in `migration-journal.md` "Phase 5 anomalies" section:

### A. GRANT P0 — public schema missing role grants
- Discovered during smoke test of `profile-ensure` (HTTP 500 with PostgREST `42501: permission denied`). All 93 public tables had only `REFERENCES, TRIGGER, TRUNCATE` for `anon/authenticated/service_role` — no DML.
- Root cause: Supabase platform's default privilege grants for the public schema were either not applied at destination project setup or were absent before chain replay; migration files contained no explicit grants.
- Fix: canonical `GRANT ALL ON ALL TABLES/FUNCTIONS/SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;` + matching `ALTER DEFAULT PRIVILEGES` block as a single transaction.
- Severity assessment: would have caused total app failure post-cutover (every PostgREST/supabase-js call from frontend would 42501). Caught at smoke test.

### B. DATA LOSS EVENT — account-delete invoked during smoke test
- Smoke-test harness iterated 40 "pure-DB" functions with admin user JWT + empty body. First function alphabetically (`account-delete`) deleted the JWT bearer's own account.
- Damage: `auth.users` 129 → 128. Profile cascaded (auto-recreated by trigger with default values). `org_memberships` cascaded. `guardians` row's user_id set to NULL (FK is `ON DELETE SET NULL`). `audit_log` row preserved. 27 other auth.users-referencing FKs had no matching rows.
- Restoration: `POST /auth/v1/admin/users` recreating original UUID + Mgmt API `UPDATE auth.users` for source timestamps + replica-mode txn restoring profile values + INSERT org_memberships + UPDATE guardians.user_id back. All values match source dump.
- Severity assessment: **zero customer impact** — `demo-solo-parent-2@lessonloop.test` is a seeded demo user. Fully recoverable from source dump.
- Policy change: "pure-DB" classification ≠ "safe to invoke." Updated smoke-test scope to a small read-only/idempotent set; all destructive/state-mutating functions excluded from unattended runs.

### C. sb_secret + verify_jwt incompatibility — 24 functions reconfigured
- Discovered during Y resumption smoke test of `generate-invoice-pdf` (HTTP 401 regardless of bearer format).
- Root cause (per Supabase docs — *"Edge Functions only support JWT verification via the anon and service_role JWT-based API keys. You will need to use the --no-verify-jwt option when using publishable and secret keys"*): destination project uses the new "Publishable + Secret" key model; platform-injected `SUPABASE_SERVICE_ROLE_KEY` resolves to the `sb_secret_*` value; gateway `verify_jwt = true` requires JWT-format Bearer; these are mutually exclusive.
- Fix: added `verify_jwt = false` to 24 functions in `supabase/config.toml` and re-deployed. Two categories:
  - 7 service-role-Bearer functions: `generate-invoice-pdf`, `send-auto-pay-alert`, `send-auto-pay-failure-notification`, `send-dispute-notification`, `send-invoice-email-internal`, `send-recurring-billing-alert`, `send-refund-notification`
  - 17 cron-secret-only functions: `admin-backfill-default-pm`, `auto-pay-final-reminder`, `cleanup-invoice-pdf-orphans`, `cleanup-orphaned-resources`, `cleanup-webhook-retention`, `credit-expiry`, `credit-expiry-warning`, `cron-health-watchdog`, `ical-expiry-reminder`, `overdue-reminders`, `recurring-billing-scheduler`, `streak-notification`, `trial-expired`, `trial-reminder-1day`/`-3day`/`-7day`, `trial-winback`
- Verification: `generate-invoice-pdf` now returns 200 with signed PDF URL. Cron functions reachable via x-cron-secret. No regressions on functions previously set to `verify_jwt = false`.
- Pattern for Phase 6+ developments: any new function intended for `pg_cron` invocation or service-to-service Bearer-SR auth must have `verify_jwt = false` in config.toml.

---

## Outstanding Phase 5 deferred items (carried into Phase 6/cutover)

1. **16 third-party secret values** — placeholder strings to be replaced with real values per `secret-fetch-checklist.md`. Without these, the corresponding integrations (Stripe payments, Xero sync, Zoom OAuth, Google Calendar, Resend email, AI features) will fail at invocation. This is the user's manual fetch step.
2. **`STRIPE_WEBHOOK_SECRET`** — deferred to Phase 7 cutover. Created when destination's webhook endpoint is registered with Stripe.
3. **2 SQL-only cron schedules** — `complete-expired-assignments` and `reset-stale-practice-streaks` are running on placeholder schedules; verify against source's actual schedules and adjust if different.
4. **xero_connections RLS policies + indexes** — table created out-of-band on source; migration chain enables RLS but creates no policies. Re-create from source's actual definition before Phase 7 cutover.
5. **`storage.objects.owner` is NULL** for all 11 migrated rows — source dump tool didn't include the `owner` column. Confirm storage RLS doesn't depend on `owner` for these rows; populate retroactively if it does.
6. **`get_calendar_error_count` function** — referenced by `src/integrations/supabase/types.ts` but dropped during Batch 8. Manual re-add if frontend codegen requires it.
7. **`migration-dump` bucket** — chain artifact from migration 405; harmless but should be dropped during post-cutover cleanup.
8. **`seed-demo-data` deployed-but-inert** — could be `supabase functions delete`'d for extra hygiene if you don't want it visible in the project's function list.

---

## Phase 5 → Phase 6 readiness assessment

**Ready to proceed:**
- All 103 functions deployed and configured correctly for the new key model.
- All 18 cron jobs configured with destination URLs and reachable auth path.
- All 93 public tables have correct DML grants.
- Data state restored to 81,473 rows + 129 users (matches Phase 4 reconciliation).

**Blocking Phase 6 work:**
- Third-party secrets must be filled in before testing OAuth flows or payment paths. Without `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` you can't test Google Sign-In; without `STRIPE_*` you can't test the checkout flow.
- After secrets are in place, verify each integration end-to-end against destination (Phase 6 plan: auth provider tests, Stripe sandbox transaction, Resend test email, Xero OAuth handshake).

**Non-blocking:**
- Items 3–8 in the deferred list above can be addressed during Phase 6/7 without blocking the main cutover sequence.
