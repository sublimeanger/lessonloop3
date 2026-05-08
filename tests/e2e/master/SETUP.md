# Test suite setup

Quick reference for setting up the master E2E suite on a new machine
or new Claude account. **For full context, read `/HANDOVER.md` at repo root first.**

## Prerequisites

- Node 20+
- `npm install` already run in repo root
- `npx playwright install chromium` already run

## 1. Create `.env.test`

```bash
cp .env.test.example .env.test
```

Fill in every value. The critical ones:

```bash
# Frontend target
E2E_BASE_URL=https://app.lessonloop.net
ALLOW_PRODUCTION_TESTS=true

# Destination Supabase
E2E_SUPABASE_URL=https://xmrhmxizpslhtkibqyfy.supabase.co
E2E_SUPABASE_ANON_KEY=<eyJ...>     # from `supabase get_publishable_keys`
E2E_SUPABASE_SERVICE_ROLE_KEY=<eyJ...>  # from Dashboard → Settings → API

# Test users (already provisioned — passwords reset 2026-05-08)
E2E_OWNER_EMAIL=e2e-owner@test.lessonloop.net
E2E_OWNER_PASSWORD=E2eTestPass123!
E2E_ADMIN_EMAIL=e2e-admin@test.lessonloop.net
E2E_ADMIN_PASSWORD=E2eTestPass123!
E2E_TEACHER_EMAIL=e2e-teacher@test.lessonloop.net
E2E_TEACHER_PASSWORD=E2eTestPass123!
E2E_FINANCE_EMAIL=e2e-finance@test.lessonloop.net
E2E_FINANCE_PASSWORD=E2eTestPass123!
E2E_PARENT_EMAIL=e2e-parent@test.lessonloop.net
E2E_PARENT_PASSWORD=E2eTestPass123!
E2E_PARENT2_EMAIL=e2e-parent2@test.lessonloop.net
E2E_PARENT2_PASSWORD=E2eTestPass123!

E2E_ORG_ID=25b57950-6c4e-42d8-8089-4942d2bba959

# Stripe test mode
E2E_STRIPE_TEST_SECRET=sk_test_<...>   # fetch from dashboard.stripe.com/test/apikeys
```

## 2. Verify

```bash
./node_modules/.bin/playwright test --project=master --workers=4
```

Expected: **312 passed / 13 failed / 212 skipped** in ~9 min.

If you're not landing there, check:
- `.env.test` values are correct (especially `E2E_SUPABASE_ANON_KEY`
  — must be the destination project's, not source)
- Network: production frontend `app.lessonloop.net` reachable
- Storage states regenerated: delete `tests/e2e/.auth/*.json` and let
  the `auth-setup` project recreate them

## Run subsets

```bash
# One spec file
./node_modules/.bin/playwright test tests/e2e/master/24-stripe.spec.ts --project=master

# By test name
./node_modules/.bin/playwright test --project=master -g "owner pays invoice"

# Without auth.setup re-run (uses cached storage states)
./node_modules/.bin/playwright test --project=master --no-deps
```

## Layout

```
tests/e2e/
├── master/                   ← Master suite (32 spec files mapped to catalog)
│   ├── 01-foundations.spec.ts
│   ├── 02-marketing-redirects.spec.ts
│   ├── …
│   ├── 32-security.spec.ts
│   ├── _fixtures/
│   │   └── auth-refresh.ts   ← JWT refresh, prevents stale-token failures
│   ├── PLAYWRIGHT_MASTER_CATALOG.md  ← Source of truth — 2,233 lines
│   └── SETUP.md              ← This file
├── workflows/                ← Older tests, partially overlap with master
├── helpers.ts                ← Shared utilities (waitForPageReady, expectToast, …)
├── supabase-admin.ts         ← Test factories + DB helpers
├── auth.setup.ts             ← Logs in 6 test users + writes .auth/*.json
└── .auth/                    ← Storage state files (gitignored)
    ├── owner.json
    ├── admin.json
    └── …
```
