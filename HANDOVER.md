# LessonLoop pre-launch handover (Claude session continuity)

**Last updated:** 2026-05-08 (late evening) by Claude Opus 4.7 (1M context, 2nd session)
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
- `<§13/§14 commit>` — 22 real tests across §13 + §14
- Live Stripe webhook subscription patched (we_1TUlSHAzPfYm94ux4mOfF72i),
  18 events configured (was 6) — closes the P0 production gap previously
  flagged in the §24 progress notes. No commit (Stripe Dashboard config).

---

## ⚡ If you're a new Claude reading this

Read this whole file before doing anything. Your context starts cold;
this is the only mind-share between sessions. Specifically:

- Don't trust raw test counters. Track **real catalog coverage**, not
  spec count. §24 went from 0 real tests (11 fixmes) → 10 real (60% of
  catalog §24 items) this session. Catalog overall ~30% (was 25%).
- Don't use `test.fixme()` as a placeholder — see [Anti-patterns](#anti-patterns).
- The catalog at `tests/e2e/master/PLAYWRIGHT_MASTER_CATALOG.md` is the
  source of truth for "what should be tested". Treat each section as a
  contract.
- §24 Stripe payments — **DONE**. Next priority: §13/§14 Invoices.
  See [Next session](#next-session).
- **J24-A infra is live in production.** 14 stripe-* edge fns + the
  webhook now route through `_shared/stripe-client.ts` with org-scoped
  test/live key dispatch. The e2e org has `stripe_test_mode=true`. Do
  NOT toggle that flag for any other org without testing — it would
  break that org's live payments instantly.

---

## Reality check (don't be misled by counters)

**Catalog completeness: ~30% (was 25-30%, +10 real §24 tests this session).**

Current baseline (end of session):
- **372 passed** (was 312 at session start; +60 net)
- **1-3 failed**: always includes the documented §5.4 email-verification
  flake. Sometimes also: Owner Dashboard LoopAssist visibility (JWT-stale)
  and the §22/§24 mutations race (see flake notes below).
- **165 skipped** (was 212; this session converted 47 fixmes to real
  tests across §24, §13, §14, §26, §8).
- ~3.3-4.4 min wall-clock at 4 workers.

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
| Genuinely behavioural tests (full journeys) | ~90 | +10 §24 Stripe end-to-end |
| RBAC matrix (5 roles × 33 routes) | 165 | Just route access; useful but narrow |
| Page-load smoke tests | ~30 | "Does this URL render?" — no feature behaviour |
| DB query / trigger guard tests | ~30 | Real, but narrow — single SQL operations |
| **`test.fixme()` empty placeholders** | **211** | Empty function bodies. They run as "skipped". They prove NOTHING. |
| **Total spec functions** | **~547** | |

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

The currency bug specifically is now permanently regression-tested in
`tests/e2e/master/26-parent-portal.spec.ts` ("invoices page renders
without currency-error boundary").

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

### 1. Required env vars in `~/.claude/settings.json`

The `env` block must include these keys. **Values are not in this file
(GitHub push protection blocks them).** Copy values from the existing
account's `~/.claude/settings.json` directly, or fetch fresh from each
service dashboard.

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:6767",
    "NETLIFY_AUTH_TOKEN": "<nfp_...>",
    "SUPABASE_ACCESS_TOKEN": "<sbp_...>",
    "CLOUDFLARE_API_TOKEN": "<cfut_...>",
    "STRIPE_SECRET_KEY": "<sk_live_...>",
    "STRIPE_TEST_SECRET_KEY": "<sk_test_...>",
    "CONTEXT7_API_KEY": "<ctx7sk-...>",
    "SENTRY_AUTH_TOKEN": "<sntryu_...>",
    "SENTRY_ORG": "lessonloop",
    "SENTRY_PROJECT": "javascript-react",
    "SENTRY_REGION_URL": "https://de.sentry.io"
  }
}
```

Where to fetch each value:

| Var | Source |
|---|---|
| `NETLIFY_AUTH_TOKEN` | https://app.netlify.com/user/applications#personal-access-tokens |
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens |
| `CLOUDFLARE_API_TOKEN` | https://dash.cloudflare.com/profile/api-tokens (needs Zone:DNS:Edit + Account:Workers KV/R2) |
| `STRIPE_SECRET_KEY` | https://dashboard.stripe.com/apikeys (live) |
| `STRIPE_TEST_SECRET_KEY` | https://dashboard.stripe.com/test/apikeys |
| `CONTEXT7_API_KEY` | https://context7.com/dashboard |
| `SENTRY_AUTH_TOKEN` | https://lessonloop.sentry.io/settings/account/api/auth-tokens/ (scopes: `project:write`, `project:releases`) |

Verify the Stripe keys belong to the LessonLoop account (the user can
confirm by checking the dashboard).

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

This single command must land on `~312 passed`:

```bash
./node_modules/.bin/playwright test --project=master --workers=4
```

Expected output (current 2026-05-08 baseline):
- **312 passed**
- **13 failed** (same JWT-stale flakes — see [Known issues](#known-issues))
- **212 skipped** (intentional fixmes — placeholders to be filled)
- ~9 min wall-clock

If you get fewer passing or different failures, something's wrong with
your setup. Check `.env.test` first.

---

## Next session

Continue **Mode B**: grind through the catalog section by section.
**Stop using `test.fixme()` as a placeholder.** Either write the real
test or delete the line.

### Priority order

1. ~~§24 Stripe payments~~ — **DONE (10/17 catalog items real, ~60%)**.
2. ~~§13 Invoices~~ — **DONE (10 real tests, ~70%)**.
3. ~~§14 Invoice detail~~ — **DONE (12 real tests, ~75%)**.
4. **§26 Parent portal — STARTED** (10 real, ~40%). §26.7 practice
   log + §26.4 makeup respond (accept / decline / cross-tenant
   reject / re-respond reject) done; remaining gaps in TODO
   comment block: §26.10 compose thread + notify-internal-message,
   §26.12/§26.13 continuation response (authed + public token).
   Most need small seed-data prep (active continuation run, message
   threads).
5. **§20 Continuation (term rollover)** — DEFERRED. Needs term
   boundaries + continuation_run + response rows seeded. ~6-8 hours.
6. **§8 Lesson CRUD — STARTED** (4 real, ~30%). Group / cancel /
   edit duration done; recurring edit dialog (§8.5: "all" /
   "this+following" / "this only") + student-side cancellation
   credit issuance left as TODO (need recurrence_rules +
   lesson_recurrence_overrides setup).

After those 5 sections, the remaining 27 are gap-fillers and per-page smoke.

### §24 progress (this session)

Implemented (commits `b7900ab` → `e36e486` on `main`, all pushed):

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

**Tests (10/17 catalog §24 items real):**
- `tests/e2e/master/_fixtures/stripe-test-helpers.ts` — driven via
  Stripe TEST API directly, not Stripe Elements iframe.
- `24-stripe.spec.ts` covers §24.1, §24.2/§24.3, §24.5 list, §24.5 detach,
  §24.7 partial refund, §24.10 billing history, §24.12 dedup contract,
  RBAC negative (finance → stripe-process-refund 400), cross-tenant
  (parent2 → parent1's invoice 400), UI smoke.

**Not yet covered (out of §24 scope):**
- §24.3 Apple Pay button visibility (mobile-safari project only).
- §24.4 Hosted checkout fallback (web/native split — `stripe-create-checkout`).
- §24.6 Auto-pay installment success / failure (cron + decline cards).
- §24.8 Dispute simulation (requires Stripe CLI `stripe trigger`).
- §24.9 Stripe Connect onboarding (multi-step OAuth flow).
- §24.11 Verify session post-checkout (subscription-checkout return URL).

**Two latent issues found and FIXED this session:**
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

Things I did wrong this session — don't repeat them:

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

When running the full master suite (~9 min, 537 tests, 4 workers),
the same 13 tests flake. They pass individually. They fail in the full
batch.

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

**Live webhook subscription gap (P0)** — see §24 progress. The live
endpoint is missing 12 events the handler expects. Fix before launch.

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
