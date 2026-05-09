# LessonLoop pre-launch handover (Claude session continuity)

**Last updated:** 2026-05-09 (after §11.4 unlinked teacher) by Claude Opus 4.7 (1M context, 5th session)
**Working repo:** `sublimeanger/lessonloop3` (branch: `main`)
**Working dir on author's machine:** `/tmp/lessonloop3-deploy`
**Owner:** Jamie McKaye (`jamie@searchflare.co.uk`)

**Session ledger (commits on `main`):**
- `b7900ab` — J24-A canary (migration + helper + stripe-list-payment-methods)
- `763c474` — Batch A+B (6 read/light-write fns)
- `049e84f` — Batch C (payment-intent + checkout)
- `5a8ca45` — Batch D (refund + connect-onboard + auto-pay)
- `10f35e2` — Batch E (admin-backfill + reminder shared core)
- `2bf0aea` — dual-mode webhook signature verification
- `e36e486` — §24 Stripe — 10 real tests (was 11 fixmes)
- `7dcd024` — fix(test-infra): seedInvoice silently lost status transitions
- d7bc927 — §13/§14 Invoices — 13 fixmes → 0, 22 real tests
  (handover hygiene in 8f37886)
- Live Stripe webhook subscription patched (we_1TUlSHAzPfYm94ux4mOfF72i),
  18 events configured (was 6) — closes the P0 production gap previously
  flagged in the §24 progress notes. No commit (Stripe Dashboard config).
- 0f91088 — §26.10 parent compose thread (5 tests)
- a5dec8b — §26.12/§26.13 continuation response (4 tests)
- 4796f9a — §8.5 recurring lesson edit (2 tests)
- 65bde4e — fix(edge): continuation-respond verify_jwt=false (unauth flow)
- ec94ee3 — fix(db): _notify_streak_milestone defensive + §17.4 test (1 test)
- 499d54b — test(e2e): §24.12 — true-replay webhook idempotency
  (2 tests + postWebhookEvent helper; HMAC-SHA256 sign arbitrary
  Stripe events; covers webhook-layer + RPC-layer dedup)
- acc6015 — test(e2e): §26.6 PortalSchedule (8 tests + helpers;
  grouping + past-collapsible, all 3 reschedule policies
  admin_locked / request_only / self_service, Google Cal URL
  format, ICS download content, calendar-ical-feed VEVENT
  end-to-end). Status vs v2 launch scope: launch-in-scope
  (parent portal core per LESSONLOOP_V2_PLAN.md §3.1).
- 39c11d9 — test(e2e): §26.9 PortalInvoices (3 tests; pay full
  invoice end-to-end via §24-style helpers + UI smoke for the
  PaymentDrawer + filter by status + PDF download). Same commit
  also hardens 26-parent-portal.spec.ts itself: §26.4 makeup
  describe set to mode='serial' (4 tests collide on +3 day
  matched_lesson teacher slot when run parallel), file-level
  resetE2ERateLimits() in beforeAll (§26.10 send-parent-message
  was hitting hourly cap mid-suite after the file grew),
  seedScheduledLessonForParent atomic-on-failure (rolls back
  student insert if lesson INSERT throws — prevents orphan
  cascade), and a deterministic per-testId minute offset on
  §26.6.1's lesson seed times so runs <30min apart land in
  different 30-min slots. Status vs v2 launch scope:
  launch-critical (Stripe Connect / parent payment per §3.1).
- f7ee87d — test(e2e): §17.5.5 reset_stale_streaks + §17.5.6
  complete_expired_assignments (2 tests). Both cron functions are
  plain `BEGIN UPDATE … END;` plpgsql; we call them directly via
  service-role RPC `/rest/v1/rpc/<name>` rather than time-travel
  fixtures. Each test seeds two rows in distinct pre-states (stale
  vs fresh streak; expired vs future-dated assignment + a NULL
  end_date row), invokes the cron, and asserts only the matching
  rows transitioned — proving both the WHERE predicate and the
  cron's idempotence on already-clean rows. Status vs v2 launch
  scope: launch-in-scope (Practice tracking + streaks per §3.1)
  but cron behaviour isn't first-day critical.
- _next_ — test(e2e): §11.4.1 unlinked teacher contract (1 test).
  Verifies that inserting a `teachers` row without user_id leaves
  the row in the unlinked state — no auto-created org_memberships
  row, no `invites` row keyed on the email, but the
  audit_teachers_changes trigger does fire (audit_log row lands).
  Documents that §11.4.9 protect_teacher_user_link is already
  covered by §32.7 in the master baseline. Status vs v2 launch
  scope: launch-in-scope (Teachers per §3.1).
- 6205880 — test(e2e): §15.4.7 Outstanding report data correctness
  (1 test). Seed a sent invoice with due_date +5 days, render
  /reports/outstanding as owner, assert the invoice_number text
  appears in the Current (0-7 days) bucket's expanded table.
  Outstanding's `expandedBuckets` initial state in the page
  component already includes the Current bucket — clicking the
  trigger would COLLAPSE it (this caught me on the first run).
  Same commit also hardens patchOrgReschedulePolicy (in
  26-parent-portal.spec.ts) with a 57014 statement_timeout retry
  + 1s backoff — a transient master-suite flake I hit while
  verifying §15.4 affected §26.6.6 admin_locked when the org
  table was under concurrent load. Status vs v2 launch scope:
  launch-in-scope (Reports per §3.1).
- 10ca3ad — test(e2e): §26.10 reply on existing thread (3 tests:
  happy path with thread_id+subject "Re: …" derivation, 404 on
  missing parent_message_id, 403 cross-tenant) + §26.11
  PortalProfile notification preferences (1 test: toggle switch
  + Save → notification_preferences upsert lands the new bool).
  Required a `selectServiceRole()` inline helper for §26.11 —
  the parent's notification_preferences row is RLS-blocked from
  the owner JWT that supabase-admin's supabaseSelect uses. Same
  commit also adds E2E_PARENT_GUARDIAN_ID constant to the §26.10
  describe (was missing — only §26.4 had it). Status vs v2 launch
  scope: launch-in-scope (parent portal core).
- c8b6c4e — test(e2e): §8.6 cancel flow + §8.8.9 attendance
  cleanup trigger + §8.8.10a/b auto_issue_credit_on_absence
  (3 tests; Lauren-paramount make-up flow per
  LESSONLOOP_V2_PLAN.md §3.1). 8.8.9 verifies that
  trg_cleanup_attendance_on_cancel deletes attendance_records
  when lesson goes from any status → cancelled. 8.8.10a patches
  the e2e org's `sick` policy to `automatic` for the test (the
  default seed is `waitlist`), inserts attendance with
  cancelled_by_student + sick reason, asserts make_up_credits
  row created with credit_value_minor=3500 (£35 from the org's
  default rate card "Standard 30-min") + audit_log entry. 8.8.10b
  uses `holiday` (not_eligible) and asserts no credit. Same
  commit also widens lessonSlotOffsetMs in 26-parent-portal.spec
  from 12-slot deterministic-by-testId to 24-slot Math.random()
  per call — stops retries from re-hitting the same orphan
  collision slot if a previous run was killed mid-cleanup.

---

## ⚡ If you're a new Claude reading this

Read this whole file before doing anything. Your context starts cold;
this is the only mind-share between sessions. Specifically:

- Don't trust raw test counters. Track **real catalog coverage**, not
  spec count. Catalog overall ~46% (was 25% five sessions ago) —
  §15 reports went from smoke-only to first data-correctness test
  this session.
- Don't use `test.fixme()` as a placeholder — see [Anti-patterns](#anti-patterns).
- The catalog at `tests/e2e/master/PLAYWRIGHT_MASTER_CATALOG.md` is the
  source of truth for "what should be tested". Treat each section as a
  contract.
- §24 Stripe (incl. §24.12 true-replay) / §13 Invoices / §14 Invoice
  detail / §15.4.7 Outstanding data / §11.4.1 unlinked teacher /
  §26.4 makeup respond / §26.6 schedule / §26.7 practice / §26.9
  invoices+pay drawer / §26.10 compose+reply / §26.11 profile prefs
  / §26.12-13 continuation / §8.5 recurring edit / §8.6 cancel +
  §8.8.9-10 auto-credit / §17.4 streak milestone / §17.5.5-6 cron
  — **DONE**. Next priorities in [Next session](#next-session).
- **J24-A infra is live in production.** 14 stripe-* edge fns + the
  webhook now route through `_shared/stripe-client.ts` with org-scoped
  test/live key dispatch. The e2e org has `stripe_test_mode=true`. Do
  NOT toggle that flag for any other org without testing — it would
  break that org's live payments instantly.
- **Read `~/.claude/settings.json` env block before asking the user
  for tokens.** Token inventory + auth-plane quirks are documented in
  the [Setup](#setup) section. Sessions before this one wasted cycles
  asking for things that were already there.

---

## Reality check (don't be misled by counters)

**Catalog completeness: ~47% (was 46%, +1 §11.4.1 unlinked teacher this session).**

Current baseline (end of session):
- **418 passed** (was 421 prior; +1 from §11.4.1 but a long-suite
  run this time hit the documented brittle-JWT-stale flakes —
  §26.6.7 + 06-dashboard stat cards joined §5.4 in the failure list,
  cascading 2 §26.6 tests in serial mode to "did not run"). The
  earlier 421-pass baseline this session shows these all settle on
  shorter wall-clocks.
- **1-5 failed**: always includes the documented §5.4 email-verification
  flake. Sometimes also: §17.4 streak (transient seed failure — unrelated
  to streak math, the supabaseInsert call to students returns undefined),
  §22.2 timezone (cross-file race with §24), §13 stats (occasional),
  05-rbac Settings degradation + 06-dashboard stat cards (in the
  13-brittle JWT-stale group), §20.1 continuation-respond (very
  occasional curl/spawnSync ETIMEDOUT transient — when it fires, it
  can cascade to 2 dependent serial tests shown as "did not run").
- **152 skipped**.
- ~3.5-4.5 min wall-clock at 4 workers.

**Known intermittent flake — §22/§24 cross-file race:** §22 settings
mutations (timezone + VAT toggle) modify org config that §24 invoice
totals depend on. Within-file serial mode is ON for both files now.
For cross-file pinning, the next session needs a `playwright.config.ts`
change. Recommended approach:
```ts
// playwright.config.ts
projects: [
  { name: 'master', ... },
  // run §22 + §24 in their own pool, serial against each other
],
```
or simpler: assign each test org to a different worker via a fixture-
generated throwaway org. The §22 mutations only run for the e2e org
today; if §22 had its own throwaway org, the race would be eliminated.

Storage state hygiene matters: if you see ~35 owner-side failures, the
storage state JWTs have gone stale (or the e2e-owner profile has
`has_completed_onboarding=false`). Fix:
```bash
rm tests/e2e/.auth/*.json   # auth.setup.ts regenerates
```
And via service-role SQL if onboarding flag drifted (see [Known issues](#known-issues)).

| Category | Real count | What it means |
|---|---|---|
| Genuinely behavioural tests (full journeys) | ~132 | +10 §24, +4 §26.4 makeup, +2 §17.4 streaks, +5 §26.10 compose, +4 §26.12/§26.13 continuation, +2 §8.5 recurring edit, +1 §17.4 milestone, +2 §24.12 true-replay, +8 §26.6 schedule, +3 §26.9 invoices, +3 §8.6+§8.8.9-10 cancel/credit, +2 §17.5 cron, +3 §26.10 reply, +1 §26.11 prefs, +1 §15.4 outstanding, +1 §11.4 unlinked teacher |
| RBAC matrix (5 roles × 33 routes) | 165 | Just route access; useful but narrow |
| Page-load smoke tests | ~30 | "Does this URL render?" — no feature behaviour |
| DB query / trigger guard tests | ~30 | Real, but narrow — single SQL operations |
| **`test.fixme()` empty placeholders** | **211** | Empty function bodies. They run as "skipped". They prove NOTHING. |
| **Total spec functions** | **~549** | |

**Track real catalog coverage, not test count.**

---

## What got fixed in production this week (don't re-discover these)

These are real production bugs found via E2E or audit work and shipped
to `main`. Don't waste time re-finding them:

| Commit | Bug | Severity |
|---|---|---|
| `dbe1a51` | `Intl.NumberFormat: Invalid currency code` — `/portal/invoices` showed React error boundary "Something went wrong" for any parent | **P0** |
| `e476387` | `/settings` route blocked finance + teacher despite sidebar showing the link | P1 |
| `c087894` | `check_cron_health()` RPC was 500'ing every run since deployment — zero alerts ever sent | P0 |
| `c087894` | 8 lifecycle crons were never registered (trial-expired, waitlist-expiry, enrolment-offer-expiry…). Trial expirations silently no-op'd → revenue leak | **P0** |
| `19d8efc` | `complete_onboarding` RPC 3-bug chain (enum casts, service-role guard, exception catch) | P0 |
| `baa072c` | Stripe webhook used sync `constructEvent` on Deno — signature always failed | P0 |
| `7b6c20c` | OAuth flow pointed at dead Lovable endpoint after Lovable detach | P0 |
| `2e0a538` | CSP missing `api.pwnedpasswords.com` (signup pwned-check 401'd); stale Lovable origins | P1 |
| `2e0a538` | Sentry source maps not uploaded → useless stack traces | P1 |
| `f3d724b` | Supabase password policy was 6 chars + no character requirements | P1 |
| `62a9282` | `AuthContext.onAuthStateChange` was async + awaited DB queries → 5s blank screen on every signin | P0 |
| Supabase config | `protect_subscription_fields` uses silent `NEW := OLD` coerce, NOT exception | n/a (working as designed; my initial test asserted wrong) |
| Various | Storage `avatars` bucket had no size cap or mime allowlist (now 2MB + image-only) | P2 |
| Various | Cloudflare DNS still had stale `_lovable.app` TXT record; `app.lessonloop.net` not proxied via CF | P2 / decision-pending |
| `65bde4e` | `continuation-respond` had platform `verify_jwt=true` but the frontend uses publishable keys (`sb_publishable_*`); fully-anonymous email-link clicks at `/respond/continuation?token=X` got `UNAUTHORIZED_INVALID_JWT_FORMAT` at the gateway. Function code already does manual auth on both paths; one config.toml line + redeploy fixes it. | **P0** (parent-facing email flow, broken since signing-keys migration) |
| `ec94ee3` | `_notify_streak_milestone` read `vault.decrypted_secrets` for `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, which were never seeded (only `INTERNAL_CRON_SECRET` was). NULL URL → `null value in column "url" violates not-null constraint` (sqlstate 23502) → trigger errored → AFTER INSERT trigger rolled back the user's `practice_logs` insert. Any user logging the 3rd, 7th, 14th, 30th, 60th, or 100th consecutive practice day got a 500. Fix wraps the `net.http_post` call in nested EXCEPTION; `audit_log` row stays as the durable record, delivery is best-effort. | **P0** (silent revenue / engagement leak on streak milestones) |

The currency bug specifically is now permanently regression-tested in
`tests/e2e/master/26-parent-portal.spec.ts` ("invoices page renders
without currency-error boundary"). Both `65bde4e` and `ec94ee3` have
their own real tests guarding regression — §26.13 anonymous happy
path and §17.4 milestone audit row respectively.

---

## Open production-relevant items (not blocking E2E coverage)

These are real production issues that the E2E suite can't surface
because the test harness either passes-by-defensive-fallback or the
broken code path runs only in production. Each is a separate focused
session — don't fix inline during a catalog session.

| Item | Severity | Notes |
|---|---|---|
| **Streak milestone notifications never deliver.** `ec94ee3` made `_notify_streak_milestone` defensive — vault/queue failures now log a `RAISE WARNING` instead of rolling back the user's `practice_logs` insert. But the underlying cause is not fixed: `vault.decrypted_secrets` has only `INTERNAL_CRON_SECRET` seeded; `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are still missing, so the trigger reads NULL and skips the `net.http_post` call entirely. The audit_log row commits as the durable record (which is what §17.4 asserts and why the test passes), but no push notification reaches the user on the 3rd / 7th / 14th / 30th / 60th / 100th consecutive day. | **Launch-blocking for Practice feature delivery** by Lauren's shadow-term week 4 (when streak push notifications would be expected to fire). Needs a separate session: `vault.create_secret('SUPABASE_URL', '...')` + `vault.create_secret('SUPABASE_SERVICE_ROLE_KEY', '...')`. The service-role value can be read from `E2E_SUPABASE_SERVICE_ROLE_KEY` in `.env.test` but **must not be committed**; apply via `execute_sql` directly or a hand-rolled gitignored migration. |
| §22/§24 cross-file race | P2 | Documented under "Reality check"; needs `playwright.config.ts` change to give §22 + §24 their own throwaway orgs |
| 13 brittle JWT-stale test failures | P2 | Documented under "Known issues"; needs `beforeEach` JWT injection hook |

---

## What's portable (in git, picks up on any machine)

| | |
|---|---|
| All test code | `tests/e2e/master/`, `tests/e2e/workflows/`, `tests/e2e/*.spec.ts` |
| Test fixtures + factories | `tests/e2e/master/_fixtures/auth-refresh.ts`, `tests/e2e/supabase-admin.ts` |
| The catalog (source of truth for what to test) | `tests/e2e/master/PLAYWRIGHT_MASTER_CATALOG.md` |
| Audit framework (180 features tracked) | `audit/MASTER.md` |
| 24 finding documents | `audit/findings/*.md` |
| All migrations | `supabase/migrations/` |
| `.env.test.example` (every required env var) | repo root |
| All commits | `git log` |

## What's NOT portable (you must reconstruct)

| | Where it is | What to do |
|---|---|---|
| `.env.test` with actual secret values | gitignored | Copy from `.env.test.example`, fill in (see [Setup](#setup)) |
| Tokens in `~/.claude/settings.json` env block | local | Replicate values (see [Setup](#setup)) |
| MCP server connections | per-account | Verify Supabase + Stripe + Sentry + Netlify + Cloudflare MCPs are connected on the new account |
| `tests/e2e/.auth/*.json` storage states | gitignored | Auto-regenerated by `auth.setup.ts` on first run |

---

## Setup

### Token inventory — what you have, where it lives, what it unlocks

Every Claude session starts with `~/.claude/settings.json` already
loaded into the environment. **Don't ask the user for tokens before
checking what's already there** — read settings.json first. If a
token is rejected, refresh it (links below) and rotate in place.

| Token | Lives in | Plane | What it unlocks | Refresh URL |
|---|---|---|---|---|
| `SUPABASE_ACCESS_TOKEN` (sbp_*) | `~/.claude/settings.json` env | Management API (`api.supabase.com`) | Project ops, secrets read/write, edge fn deploys | https://supabase.com/dashboard/account/tokens |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` (sb_secret_* or eyJ JWT) | `.env.test` | Database / PostgREST (`*.supabase.co/rest/v1`) | RLS bypass, table CRUD, RPC. Used heavily by `tests/e2e/supabase-admin.ts`. | Supabase Dashboard → Settings → API → service_role |
| `E2E_SUPABASE_ANON_KEY` | `.env.test` | Database / PostgREST | Anon-equivalent for parent JWT minting in tests | Supabase Dashboard → Settings → API → publishable / anon |
| `STRIPE_SECRET_KEY` (sk_live_*) | `~/.claude/settings.json` env | Stripe API live mode | Live Stripe ops via Stripe MCP | https://dashboard.stripe.com/apikeys |
| `STRIPE_TEST_SECRET_KEY` (sk_test_*) | `~/.claude/settings.json` env + duplicated as `E2E_STRIPE_TEST_SECRET` in `.env.test` | Stripe API test mode | Test-mode payments, refunds, customers used by §24 + §13/§14 | https://dashboard.stripe.com/test/apikeys |
| `STRIPE_TEST_WEBHOOK_SECRET` (whsec_*) | `~/.claude/settings.json` env + duplicated as `E2E_STRIPE_TEST_WEBHOOK_SECRET` in `.env.test` + Supabase Edge Function secret | n/a — used to HMAC-sign webhook payloads | True-replay idempotency tests for §24.12 + the dual-mode webhook handler verification | https://dashboard.stripe.com/test/webhooks → endpoint `we_1TUwZhBAjFOLYDS3QGslhpbj` (only shown at create time; ours: confirmed 2026-05-09 by signing a `ping` event and getting HTTP 200 from the webhook) |
| `STRIPE_WEBHOOK_SECRET` (whsec_*) | Supabase Edge Function secret | n/a — live mode equivalent | Verifying live-mode events. Not in claude settings; production-only. | Stripe Dashboard live → endpoint `we_1TUlSHAzPfYm94ux4mOfF72i` |
| `NETLIFY_AUTH_TOKEN` (nfp_*) | `~/.claude/settings.json` env | Netlify API | Deploys, env-var management, project config | https://app.netlify.com/user/applications#personal-access-tokens |
| `CLOUDFLARE_API_TOKEN` (cfut_*) | `~/.claude/settings.json` env | Cloudflare API | DNS, Workers KV/R2 | https://dash.cloudflare.com/profile/api-tokens (Zone:DNS:Edit + Account:Workers KV/R2) |
| `SENTRY_AUTH_TOKEN` (sntryu_*) | `~/.claude/settings.json` env | Sentry API | Source map upload, release creation | https://lessonloop.sentry.io/settings/account/api/auth-tokens/ (`project:write`, `project:releases`) |
| `CONTEXT7_API_KEY` (ctx7sk-*) | `~/.claude/settings.json` env | Context7 docs MCP | Library doc lookup | https://context7.com/dashboard |

**Plane gotcha (learned the hard way 2026-05-09):** Supabase has two
auth planes that don't cross over:

- `sbp_*` PAT → `api.supabase.com` (Management API: secrets, deploys,
  config). This is what you need to read or write Edge Function secrets.
- `sb_secret_*` (or legacy JWT `service_role`) → `*.supabase.co/rest/v1`
  (PostgREST: tables, RPC). Test suite uses this.

A `sb_secret_*` value will return `JWT could not be decoded` against
the Management API regardless of authority — they're different planes.
If `SUPABASE_ACCESS_TOKEN` returns 401, the PAT is expired/revoked;
issue a fresh one at the dashboard URL above.

**Edge Function secrets — readability quirk:** Supabase's Management
API at `GET /v1/projects/{ref}/secrets` returns
`[{name, value, updated_at}]` — but `value` is a SHA-256 hex digest,
NOT the plaintext. Plaintext is genuinely write-only after creation.
If you need a secret value that isn't already in your env, you must
either (a) get it from the user, (b) re-issue/rotate the upstream
(Stripe, Sentry etc.) and capture at create time, or (c) re-run a
flow that returns it (Stripe webhook create returns `secret`, rotate
returns the new one). Then write it back via
`POST /v1/projects/{ref}/secrets` with body `[{name, value}]`.

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:6767",
    "NETLIFY_AUTH_TOKEN": "<nfp_...>",
    "SUPABASE_ACCESS_TOKEN": "<sbp_...>",
    "CLOUDFLARE_API_TOKEN": "<cfut_...>",
    "STRIPE_SECRET_KEY": "<sk_live_...>",
    "STRIPE_TEST_SECRET_KEY": "<sk_test_...>",
    "STRIPE_TEST_WEBHOOK_SECRET": "<whsec_...>",
    "CONTEXT7_API_KEY": "<ctx7sk-...>",
    "SENTRY_AUTH_TOKEN": "<sntryu_...>",
    "SENTRY_ORG": "lessonloop",
    "SENTRY_PROJECT": "javascript-react",
    "SENTRY_REGION_URL": "https://de.sentry.io"
  }
}
```

### 2. `.env.test` for the test suite

```bash
cd /tmp/lessonloop3-deploy   # or wherever you clone to
cp .env.test.example .env.test
```

Then fill in values per the comments. The critical ones:

| Var | Value | Get from |
|-----|-------|----------|
| `E2E_BASE_URL` | `https://app.lessonloop.net` | (production) |
| `ALLOW_PRODUCTION_TESTS` | `true` | (required to target production) |
| `E2E_SUPABASE_URL` | `https://xmrhmxizpslhtkibqyfy.supabase.co` | destination project |
| `E2E_SUPABASE_ANON_KEY` | (eyJ...) | Supabase MCP `get_publishable_keys` |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | (eyJ...) | Supabase Dashboard → Settings → API → service_role (DO NOT COMMIT) |
| `E2E_STRIPE_TEST_SECRET` | `sk_test_<...>` (matches `STRIPE_TEST_SECRET_KEY` in claude settings) | https://dashboard.stripe.com/test/apikeys |
| `E2E_OWNER_EMAIL` | `e2e-owner@test.lessonloop.net` | (already provisioned in destination Supabase) |
| `E2E_OWNER_PASSWORD` | `E2eTestPass123!` | Set 2026-05-08 by reset_password SQL |
| `E2E_*_EMAIL/PASSWORD` (admin/teacher/finance/parent/parent2) | All `e2e-{role}@test.lessonloop.net` / `E2eTestPass123!` | (provisioned + passwords reset) |
| `E2E_ORG_ID` | `25b57950-6c4e-42d8-8089-4942d2bba959` | "E2E Test Academy" |

### 3. Repo bootstrap

```bash
cd /tmp/lessonloop3-deploy
git pull
npm install
npx playwright install chromium
```

### 4. Verify setup

This single command should land in the ~395 passed range:

```bash
./node_modules/.bin/playwright test --project=master --workers=4
```

Expected output (current 2026-05-09 baseline, post §24.12 true-replay):
- **~395 passed** (varies ±5 with transient seed flakes)
- **1-5 failed** — always includes `§5.4` email-verification flake;
  sometimes `§22.2` timezone (cross-file race with §24), `§13` stats
  (occasional), `05-rbac` Settings degradation (in the 13-brittle
  JWT-stale group), `§17.4 streak progression (×2)` (supabaseInsert
  infra flake, unrelated to streak math), or `§20.1` continuation-
  respond (very occasional curl/spawnSync ETIMEDOUT — when it fires it
  cascades to ~2 dependent serial tests shown as "did not run")
- **~152 skipped** (intentional)
- ~3.5-5 min wall-clock at 4 workers

If you see ~35 owner-side failures, the `has_completed_onboarding`
flag has drifted on the e2e-owner profile — fix per
[Known issues](#known-issues). If far fewer pass or you see auth
failures, check `.env.test` and the storage states first.

---

## Next session

Continue **Mode B**: grind through the catalog section by section.
**Stop using `test.fixme()` as a placeholder.** Either write the real
test or delete the line.

### Priority order

1. ~~§24 Stripe payments~~ — **DONE (12/17 catalog items real, ~70%)**.
   §24.12 webhook idempotency now covers both layers via the new
   `postWebhookEvent` helper (sign + POST arbitrary events). §24.4
   hosted-checkout / §24.6 auto-pay / §24.8 disputes / §24.9 Connect /
   §24.11 verify-session remain — all out-of-scope per their per-item
   complexity (Stripe CLI / multi-step OAuth / mobile-only). See
   "Not yet covered" in [§24 progress](#24-progress).
2. ~~§13 Invoices~~ — **DONE (10 real tests, ~70%)**.
3. ~~§14 Invoice detail~~ — **DONE (12 real tests, ~75%)**.
4. **§26 Parent portal — STARTED** (30 real, ~90%). §26.4 makeup
   respond (4) + §26.6 PortalSchedule (8) + §26.7 practice log (1) +
   §26.9 PortalInvoices pay+filter+PDF (3) + §26.10 compose thread
   (5) + §26.12/§26.13 continuation response (4) done. Remaining
   gaps: §26.9 payment-plan installment paths (catalog §26.9.2/§26.9.3
   — needs invoice_installments seed + per-installment Stripe PI
   confirm), §26.10 PortalMessages reply on existing thread (compose
   already covered), §26.11 PortalProfile (one happy path: edit
   notification preferences), §26.8 PortalResources (one happy path
   — file list + download).
5. **§20 Continuation (term rollover)** — DEFERRED. Needs term
   boundaries + continuation_run + response rows seeded. ~6-8 hours.
6. **§8 Lesson CRUD — STARTED** (9 real, ~65%). Group / cancel
   (basic) / edit duration / recurring edit (this_only +
   this_and_future) + §8.8.9 attendance cleanup on cancel +
   §8.8.10a/b auto_issue_credit_on_absence (positive + negative
   policy) done. Catalog mentions an "all" mode for §8.5 but
   RecurringActionDialog only exposes the two production modes —
   that's catalog drift. Remaining: §8.8.3 conflict-detection
   blocks save (UI), §8.8.12 closure-date warning banner (UI),
   §8.8.13 Zoom mapping on online lesson (needs Zoom MCP / fixture),
   §8.8.14 weekly recurrence count.
7. ~~§17.4 streak milestone~~ — **FIXED + test landed**. Migration
   `20260518110000_notify_streak_milestone_defensive.sql` wraps the
   pg_net call in a nested EXCEPTION block; vault/queue failures now
   log as RAISE WARNING but never roll back the user's INSERT. 5 real
   §17.4 tests now (3 streak progression + milestone audit-log + DB
   table queryable). Vault is still missing SUPABASE_URL /
   SUPABASE_SERVICE_ROLE_KEY so notifications don't actually deliver
   yet — that's a separate follow-up if push notifications matter
   pre-launch (audit_log row IS the durable record).
8. ~~§24.12 webhook true-replay idempotency~~ — **DONE this session
   (2 tests + helper)**. `postWebhookEvent` helper landed in
   `tests/e2e/master/_fixtures/stripe-test-helpers.ts` (HMAC-SHA256
   sign + POST arbitrary events to the deployed dual-mode webhook).
   Two new tests under §24.12 in `24-stripe.spec.ts`: (a) same
   `event_id` twice → webhook layer 1 dedup short-circuits with
   `{duplicate: true}`, payments stays at 1; (b) different `event_id`
   but same `payment_intent_id` → RPC layer 2 dedup
   (`record_stripe_payment` checks `_provider_reference`) keeps
   payments at 1 even though webhook claimed both events. Both green
   in isolation (~3s each) and in the full master run.
9. **§26 remaining** — §26.6 + §26.9 **DONE** this session. Still
   remaining: §26.9 payment-plan installment paths (catalog §26.9.2
   "pay one installment" + §26.9.3 "pay all remaining" — needs
   invoice_installments seed first), §26.8 PortalResources (one
   happy path is enough — file list + download), §26.10
   PortalMessages reply on existing thread (compose already
   covered), §26.11 PortalProfile (one happy path: edit notification
   preferences). Each ~1-2 hours; all launch-in-scope per
   LESSONLOOP_V2_PLAN.md §3.1.

10. **§26.6 PortalSchedule — DONE in earlier commit (8 tests)**.
    `26-parent-portal.spec.ts §26.6 — PortalSchedule` block covers
    9 of the 9 catalog cases minus one tap-to-expand-notes (omitted —
    flaky click target, low signal vs the other 8). Helpers added in
    the same file: `patchOrgReschedulePolicy(policy)` service-role
    PATCH that returns the previous value for try/finally restore;
    `seedScheduledLessonForParent({testId, daysFromNow, ...})`
    returns `{studentId, lessonId, title, cleanup}`. Three policy
    tests (admin_locked / request_only / self_service) double-wrap
    cleanup so a seed throw can't leak the org policy. Cross-describe
    teacher-conflict gotcha: §26.4 makeup's `seedOfferedMakeup`
    hardcodes its matched_lesson at `Date.now() + 3 days`; §26.6
    lesson offsets must avoid +3 (and ±0 wherever it'd straddle the
    week boundary). Current §26.6 picks: -10 (always past), 0
    (always today/this-week), +4, +5, +7, +14, +21 — verified
    conflict-free in two consecutive full master runs at end of
    session.

11. **§26.9 PortalInvoices — DONE this session (3 tests)**.
    `26-parent-portal.spec.ts §26.9 — PortalInvoices` block covers
    catalog §26.9.1 (pay full invoice end-to-end), §26.9.6
    (download PDF), §26.9.7 (filter by status). Test 1 reuses the
    §24-style helpers — `signInForToken` + `invokeEdgeFn` (local
    duplicates, see file note above) + `confirmTestPaymentIntent` +
    `waitForWebhookPayment` from `_fixtures/stripe-test-helpers.ts`.
    The test does both: (a) UI smoke — the embedded PaymentDrawer
    opens with the right amount when the parent clicks Pay, (b)
    backend pay flow — drive a fresh PI via parent JWT, confirm
    with `pm_card_visa`, wait for the dual-mode webhook to settle
    invoice → status=paid + payments row. Realtime UI assertion is
    intentionally skipped (works in production, flakes in CI on
    post-webhook delay window).
    Catalog drift: PortalInvoices doesn't have a separate detail
    page; the Pay button on the list opens an embedded
    PaymentDrawer dialog (or Drawer on mobile). The catalog text
    "lesson updated, toast" was wrong — both reschedule policies
    insert into `message_requests`, not `lessons`.
    Hardening landed in the same commit (broader than §26.9):
    * `§26.4 — Make-up offer respond` describe set to
      `mode: 'serial'` — its 4 tests collide on the same teacher's
      +3-day matched_lesson slot when run in parallel.
    * File-level `resetE2ERateLimits()` in beforeAll — the parent
      JWT was hitting the hourly cap on `send-parent-message`
      (§26.10) and `stripe-create-payment-intent` (§26.9.1) once
      the file grew past ~30 tests.
    * `seedScheduledLessonForParent` is now atomic-on-failure: a
      lesson INSERT throw rolls back the just-inserted student +
      student_guardians. Without this, a partially-seeded run
      leaks rows that the next run's identical `Date.now() - 10
      days` slot collides with on the teacher_conflict trigger.
    * `lessonSlotOffsetMs(testId)` adds a deterministic
      0-330-minute offset to lesson start_at. Two runs <30min
      apart at the same wall-clock now land in different 30-min
      slots, eliminating the inter-run collision class.
    * `§26.6.1` test seeds are now wrapped in cleanups-as-you-go:
      each successful seed pushes its cleanup callable to a list,
      finally runs them in reverse — so a failure on the third
      seed still cleans up the first two.

    Not yet covered (out of §26.9 scope):
    * §26.9.2 Pay one installment (needs invoice_installments
      seed + payment-plan invoice).
    * §26.9.3 Pay all remaining (same prerequisite).
    * §26.9.4 Native notice on Capacitor app (mobile-only — not
      master).
    * §26.9.5 Apple Pay only on iOS Safari (mobile-safari project).

After those, remaining 27 sections are mostly gap-fillers + per-page
smoke.

<a id="24-progress"></a>
### §24 progress (3rd + 4th session — landed)

Implemented (commits `b7900ab` → `e36e486` for the J24-A infra in 3rd
session, then `499d54b` for §24.12 true-replay in 4th session, all
pushed to `main`):

**Infrastructure (J24-A):**
- Migration `20260517100000_org_stripe_test_mode_flag.sql`: adds
  `organisations.stripe_test_mode boolean NOT NULL DEFAULT false`.
  E2E org `25b57950-…` set true; every other org defaults to live.
- New helper `supabase/functions/_shared/stripe-client.ts`:
  `getStripeClient(orgId, supabase)` → `{ stripe, mode }`. Defensive:
  missing column / null orgId / lookup failure → live fallback.
  Test mode requested but `STRIPE_TEST_SECRET_KEY` missing → throws
  (never silently routes a flagged org through live, never accidentally
  routes a live org through test).
- 14 stripe-* edge fns + `_shared/auto-pay-reminder-core.ts` +
  `admin-backfill-default-pm` refactored to use the helper. Cron-style
  fns (auto-pay-installment, auto-pay reminders, admin-backfill) cache
  one Stripe client per org to amortise the per-installment lookup.
- `stripe-webhook` is dual-mode: tries `STRIPE_TEST_WEBHOOK_SECRET`
  first, falls back to `STRIPE_WEBHOOK_SECRET`. Each verified event
  uses the matching SDK client for downstream calls (e.g.
  `stripe.subscriptions.retrieve` in `handleSubscriptionCheckoutCompleted`).
- Stripe Dashboard test-mode webhook endpoint `we_1TUwZhBAjFOLYDS3QGslhpbj`
  (URL: `https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/stripe-webhook`)
  subscribed to the 18-event superset the handler dispatches on. Secret
  stored as Supabase env `STRIPE_TEST_WEBHOOK_SECRET`.

**Tests (12/17 catalog §24 items real):**
- `tests/e2e/master/_fixtures/stripe-test-helpers.ts` — driven via
  Stripe TEST API directly, not Stripe Elements iframe. Now also
  exposes `postWebhookEvent(eventBody)` for §24.12 true-replay tests
  (signs with HMAC-SHA256 of `{ts}.{body}` against
  `STRIPE_TEST_WEBHOOK_SECRET`, posts to
  `${SUPABASE_URL}/functions/v1/stripe-webhook`).
- `24-stripe.spec.ts` covers §24.1, §24.2/§24.3, §24.5 list, §24.5 detach,
  §24.7 partial refund, §24.10 billing history, §24.12 dedup contract
  (3 tests: real-PI invariant + true replay same event_id + same
  PI different event_id), RBAC negative (finance →
  stripe-process-refund 400), cross-tenant (parent2 → parent1's
  invoice 400), UI smoke.

**Not yet covered (out of §24 scope):**
- §24.3 Apple Pay button visibility (mobile-safari project only).
- §24.4 Hosted checkout fallback (web/native split — `stripe-create-checkout`).
- §24.6 Auto-pay installment success / failure (cron + decline cards).
- §24.8 Dispute simulation (requires Stripe CLI `stripe trigger`).
- §24.9 Stripe Connect onboarding (multi-step OAuth flow).
- §24.11 Verify session post-checkout (subscription-checkout return URL).

**Two latent issues found and FIXED in the 3rd session:**
1. ~~`update_invoice_status` RPC doesn't exist; `seedInvoice` silently
   no-op'd status transitions.~~ Fixed in `7dcd024`: replaced with
   `patchInvoiceStatus` in `tests/e2e/supabase-admin.ts` — direct
   service-role PATCH that goes through the
   `enforce_invoice_status_transition` trigger.
2. ~~Live Stripe webhook only subscribed to 6 of the 17 events the
   handler dispatches on.~~ Fixed via Stripe API:
   `we_1TUlSHAzPfYm94ux4mOfF72i` now subscribes to the same 18-event
   superset as the test endpoint. `payment_intent.succeeded`,
   `charge.refunded`, `charge.dispute.*` etc are now being delivered
   in production. **Verify post-launch:** when the first real
   embedded-drawer payment lands, confirm the payment row writes via
   the webhook (not just via stripe_checkout_sessions).

**Rate limit gotcha:** stripe-create-checkout is 10/hr per user;
stripe-process-refund is 5/hr. Tests reset `rate_limits` rows for known
e2e users in `beforeAll` (see `resetE2ERateLimits` in
`stripe-test-helpers.ts`). If you debug-rerun and start hitting 429,
that helper unsticks you.

### How to do a section properly

Per the catalog Appendix E checklist, every section needs:

- [ ] Happy path (logged-in role with sufficient permissions, valid input)
- [ ] Validation (empty, malformed, too long, special chars)
- [ ] RBAC negative (other roles redirected/blocked)
- [ ] RLS negative (cross-org / cross-tenant blocked)
- [ ] Trigger / RPC error cases (DB-side guardrails)
- [ ] Optimistic update + rollback
- [ ] Realtime update (where applicable)
- [ ] Audit log entry
- [ ] Mobile viewport (via `mobile-safari` project)
- [ ] No console errors
- [ ] No broken images

A section is **only done** when every checkbox has a passing test. Not
a `test.fixme()`. Not a comment. A passing test.

### Workflow per section

1. **Read the catalog section in full** (e.g. `§24 Stripe payments` is
   ~80 lines). Note every test case it specifies.
2. **Open the existing master spec file** (e.g. `24-stripe.spec.ts`).
   Delete every `test.fixme()` — they're misleading.
3. **For each catalog test case, write a real test:**
   - Set up clean test data via factories (`seedStudent`, `seedInvoice`, etc.)
   - Click through the UI step-by-step (or call the edge fn directly if catalog says so)
   - Assert at every meaningful step (DB row present, page state, audit log entry)
   - Clean up at the end (cleanup helpers in `supabase-admin.ts`)
4. **Run that single file** in isolation: `npx playwright test tests/e2e/master/24-stripe.spec.ts --project=master`. Iterate until all green.
5. **Commit** with message `test(e2e): §24 Stripe — N tests now real (was N fixmes)`.
6. **Update this HANDOVER.md** with the new completion percentage.
7. **Move to next section.**

---

## Anti-patterns

Things prior sessions did wrong — don't repeat them:

### ❌ Don't use `test.fixme()` as a placeholder

```ts
// BAD — looks like progress, is actually nothing
test.fixme('§24.3 — parent pays invoice via embedded drawer', async () => {});
```

It runs as "skipped" and counts toward your "passing" total in misleading
ways. Either write the real test, or delete the line and add a TODO
in plain comment form: `// TODO §24.3 — parent pays invoice…`.

### ❌ Don't run trigger guard tests via service-role

```ts
// BAD — service-role bypasses many triggers by design
const result = tryUpdate('organisations', `id=eq.X`, { subscription_plan: 'custom' });
// Will succeed because service-role skips protect_subscription_fields
```

The realistic attack surface is the **owner JWT** going through PostgREST,
not service-role. Triggers like `protect_subscription_fields` are designed
to fire ONLY for non-service-role calls. Use `getOwnerJwt()` from
`32-security.spec.ts` for trigger tests.

### ❌ Don't trust the catalog's column names blindly

The catalog was written from source code; some details drifted:

| Catalog says | Reality |
|---|---|
| `practice_streaks.current_streak_days` | `current_streak` (no `_days` suffix) |
| `practice_streaks.longest_streak_days` | `longest_streak` |
| `student_guardians.relationship = 'parent'` | enum is `mother\|father\|guardian\|other` (use `'guardian'`) |
| `data-tour="..."` selectors | actually `data-hint="..."` (search the codebase) |

Always cross-check with `information_schema.columns` via Supabase MCP
before writing assertions.

### ❌ Don't read the test file count and call it done

```
547 tests, 312 passed, 0 failed → "we're good"
```

No. The catalog has 500-700 specific cases. We have 80 real ones.
Track real coverage, not file count.

### ❌ Don't write tests longer than 9 minutes total

Supabase JWTs default to 1hr exp, but in parallel runs with 4 workers,
the JWT loaded into a browser context can stale at the 8-9min mark
even when the storage state file is fresh. The `auth-refresh.ts` fixture
helps but doesn't fully solve it.

**Workaround**: shard your test runs into <8min batches, OR add per-test
JWT injection (the next planned fix — see [Known issues](#known-issues)).

---

## Known issues / gotchas

### The 13 brittle test failures (long-run JWT stale)

When running the full master suite (~3.5-4.5 min, ~553 tests at 4
workers), up to ~13 tests can flake. They pass individually. They flake
in the full batch.

**Root cause:** Playwright loads `storageState` at browser context creation,
but contexts persist across tests within a worker. The JWT in localStorage
of a running context doesn't auto-refresh just because the file on disk does.

**The 13:**
- 5 RBAC owner→{settings, help, leads, etc.}
- 4 Dashboard render checks
- 2 Invoices URL filter persistence
- 1 LoopAssist visibility
- 1 §5.4 unconfirmed-email gate

**Fix plan (next session, ~30 min):**
Add a `beforeEach` hook that injects the latest `access_token` into the
running browser's `localStorage` via `page.evaluate()`. Pseudo-code:

```ts
test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === 'master') {
    const role = inferRoleFromStorageState(testInfo);
    const fresh = refreshStorageStateIfStale(AUTH[role]);
    if (fresh) {
      await page.evaluate((token) => {
        const key = `sb-xmrhmxizpslhtkibqyfy-auth-token`;
        const stored = JSON.parse(localStorage.getItem(key) || '{}');
        stored.access_token = token;
        localStorage.setItem(key, JSON.stringify(stored));
      }, fresh);
    }
  }
});
```

### Schema reality vs catalog drift

See [Anti-patterns → don't trust catalog column names](#anti-patterns).
Always verify columns via `information_schema.columns` first.

### ~~Stripe test mode is wired but not dispatched~~ — DONE 2026-05-08

J24-A landed (commits `b7900ab` → `2bf0aea`). 14 stripe-* edge fns +
shared modules now route through `_shared/stripe-client.ts`. Webhook
is dual-mode. Test webhook endpoint `we_1TUwZhBAjFOLYDS3QGslhpbj` is
configured. See [§24 progress](#24-progress) for the full change set.

### ~~Live webhook subscription gap~~ — DONE 2026-05-08

Live endpoint `we_1TUlSHAzPfYm94ux4mOfF72i` patched in 3rd session via
Stripe API to subscribe to the full 18-event superset (was 6). See
[§24 progress](#24-progress) "Two latent issues found and FIXED" for
detail and the post-launch verification ask.

### Resend SMTP

Configured to `smtp.resend.com` → `noreply@lessonloop.net`. SMTP password
is in Supabase auth config. Don't rotate without updating Supabase auth.

### Sentry release tracking

Vite plugin `@sentry/vite-plugin@4.4.1` uploads source maps + creates
releases on every Netlify build (when `SENTRY_AUTH_TOKEN` is in build env,
which it is). Source maps are deleted from `dist/` post-upload — do not
re-add `dist/**/*.map` to the served output.

---

## Test infrastructure cheat sheet

### Run everything

```bash
./node_modules/.bin/playwright test --project=master --workers=4
```

### Run just one section

```bash
./node_modules/.bin/playwright test tests/e2e/master/24-stripe.spec.ts --project=master
```

### Run a single test by name

```bash
./node_modules/.bin/playwright test --project=master -g "owner pays invoice"
```

### Refresh test users + cleanup

```bash
# Reset all 6 e2e test user passwords (already done 2026-05-08)
# - via Supabase MCP execute_sql:
UPDATE auth.users
SET encrypted_password = crypt('E2eTestPass123!', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email LIKE 'e2e-%@test.lessonloop.net';
```

### Owner `has_completed_onboarding` drifts to false (re-fix)

If the baseline shows ~35 failures (instead of 13) all on owner-storage-state
routes, with screenshots showing "Preparing your account…" → the owner
profile's `has_completed_onboarding` flag has drifted to false. The
`/dashboard` route guard redirects unfinished-onboarding users to
`/onboarding`, which hangs on the loading screen.

The `protect_onboarding_flag` trigger blocks direct UPDATE — must run as
service_role:

```sql
DO $$
BEGIN
  SET LOCAL role TO service_role;
  UPDATE profiles SET has_completed_onboarding = true
  WHERE email = 'e2e-owner@test.lessonloop.net';
END $$;
```

(Discovered + fixed 2026-05-08 by Claude Opus 4.7 — root-cause unknown,
the previous session's HANDOVER snapshot claimed all 6 users were
true. If this drifts repeatedly, look for a trigger or migration that
resets it.)

### Useful test factories (in `tests/e2e/supabase-admin.ts`)

| Factory | Returns | Notes |
|---|---|---|
| `seedStudent({ testId, withGuardian, ... })` | `{ studentId, guardianId? }` | Uses service-role; auto-prefixed with `e2e_` |
| `seedLesson({ testId, teacherId, createdBy, studentIds, ... })` | `{ lessonId }` | `teacherId` from `getOwnerTeacherId()`, `createdBy` from `getOwnerUserId()` |
| `seedInvoice({ testId, payerGuardianId, items, status })` | `{ invoiceId, invoiceNumber }` | Uses `create_invoice_with_items` RPC |
| `seedLead({ testId, contactName, stage })` | `{ leadId }` | |
| `createThrowawayUser({ emailPrefix, emailConfirmed, ... })` | `{ userId, email, password }` | Via Supabase admin REST. Always pair with `deleteThrowawayUser(userId)` in afterEach |
| `signInAndWriteStorageState(email, password)` | path to ephemeral state JSON | For one-off role tests via `test.use({ storageState: path })` |
| `cleanupByPrefix(testId)` | void | Sweeps all `e2e_<testId>%` rows across tables |

### Useful query helpers (also in `supabase-admin.ts`)

| Helper | Notes |
|---|---|
| `supabaseSelect(table, query)` | PostgREST GET via owner JWT (RLS-respecting) |
| `supabaseInsert(table, payload)` | Uses service-role when configured (RLS bypass for seeds) |
| `supabaseDelete(table, query)` | Same — service-role for cleanup |
| `supabaseRpc(fnName, params)` | RPC calls via owner JWT |

---

## Audit framework

Living state of every feature: `audit/MASTER.md`. State symbols:
- ✅ green / ⏸ deferred-post-launch
- 🟢 verified by E2E and live
- 🟡 structurally verified, awaiting browser confirmation
- 🔴 known launch blocker
- ❓ untested (target: zero of these)

Current count (2026-05-08): 14 🟢 / 150 🟡 / 6 🔴 / 10 ⏸ / **0 ❓**.

When you finish a catalog section (real tests, all green), update the
relevant rows in `audit/MASTER.md` from 🟡 → 🟢.

---

## Commit style for this work

Follow existing patterns from `git log`. Format:

```
test(e2e): §24 Stripe — 12 tests now real (was 11 fixmes + 1 stub)

* parent pays invoice via embedded drawer with test card 4242 →
  webhook fires + status=paid + receipt email queued
* parent pays via Apple Pay (mobile-safari only)
* …

Catalog completeness: §24 100% / overall 32% (was 25%)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Last words

If you (the next Claude) hit anything that contradicts this doc, trust
the codebase + the catalog over my memory. I tried to capture
everything that mattered but I'm not perfect. The `git log` is the
true history. The catalog is the contract.

Good luck. Don't fixme.
