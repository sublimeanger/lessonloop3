# LessonLoop pre-launch handover (Claude session continuity)

**Last updated:** 2026-05-08 by Claude Opus 4.7 (1M context)
**Working repo:** `sublimeanger/lessonloop3` (branch: `main`)
**Working dir on author's machine:** `/tmp/lessonloop3-deploy`
**Owner:** Jamie McKaye (`jamie@searchflare.co.uk`)

---

## ⚡ If you're a new Claude reading this

Read this whole file before doing anything. Your context starts cold;
this is the only mind-share between sessions. Specifically:

- Don't trust the "312 tests passing" number alone — that's misleading.
  Real catalog completeness is ~25-30% (see [Reality check](#reality-check)).
- Don't use `test.fixme()` as a placeholder — that's why we're behind.
  Either write the real test or leave it out (see [Anti-patterns](#anti-patterns)).
- The catalog at `tests/e2e/master/PLAYWRIGHT_MASTER_CATALOG.md` is the
  source of truth for "what should be tested". Treat each section as a
  contract.
- Section §24 (Stripe payments) is the next priority. See [Next session](#next-session).

---

## Reality check (don't be misled by counters)

**Catalog completeness: ~25-30%.**

| Category | Real count | What it means |
|---|---|---|
| Genuinely behavioural tests (full journeys) | ~80 | These exercise multi-step flows |
| RBAC matrix (5 roles × 33 routes) | 165 | Just route access; useful but narrow |
| Page-load smoke tests | ~30 | "Does this URL render?" — no feature behaviour |
| DB query / trigger guard tests | ~30 | Real, but narrow — single SQL operations |
| **`test.fixme()` empty placeholders** | **212** | **Empty function bodies. They run as "skipped". They prove NOTHING.** |
| **Total spec functions** | **~537** | |

The catalog spells out roughly **500-700 specific test cases**. We've
implemented ~80 of those properly. The rest is scaffolding +
placeholders + adjacent tests.

**Don't pretend otherwise. Track real catalog coverage, not test count.**

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

We're switching to **Mode B**: grind through the catalog section by
section, finishing one fully before moving to the next. **Stop using
`test.fixme()` as a placeholder.** Either write the real test or
delete the line.

### Priority order (from earlier discussion with Jamie)

1. **§24 Stripe payments** — most expensive failure mode in any SaaS,
   real money flows. ~6-8 hours focused.
2. **§13/§14 Invoices + invoice detail** — revenue path (related to §24).
   ~6-9 hours.
3. **§26 Parent portal** — primary customer interface. ~6-10 hours.
4. **§20 Continuation (term rollover)** — term-end critical, complex.
   ~6-8 hours.
5. **§8 Lesson CRUD** — recurring patterns are subtle. ~4-6 hours.

After those 5 sections, the remaining 27 are gap-fillers and per-page smoke.

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

### Stripe test mode is wired but not dispatched

`STRIPE_TEST_SECRET_KEY` is set as a Supabase secret + `.env.test` +
`~/.claude/settings.json`. Verified working (`livemode: false`, GBP).

But the Stripe edge functions (`stripe-create-payment-intent`,
`stripe-webhook`, etc.) all hardcode `Deno.env.get("STRIPE_SECRET_KEY")`
which is the live key. Test mode dispatch is the next infra task before
§24 tests can run end-to-end.

**Recommended approach:**
1. Add column `organisations.stripe_test_mode boolean DEFAULT false`
2. Set `true` on the e2e test org (id `25b57950-6c4e-42d8-8089-4942d2bba959`)
3. Create `_shared/stripe-client.ts` with `getStripeClient(orgId, supabase)`
   that returns a Stripe instance configured with the test key when the
   org has `stripe_test_mode=true`, else live key
4. Update ~10 stripe edge fns to use the helper instead of direct env
5. Configure a separate Stripe webhook endpoint in test mode pointing
   at `functions/v1/stripe-webhook` and store the test webhook secret
   as `STRIPE_TEST_WEBHOOK_SECRET`
6. The `stripe-webhook` fn needs to detect test vs live signature and
   verify against the right secret

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
