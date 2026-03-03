# LessonLoop — Claude Code Project Context

## What This Is
LessonLoop is a multi-tenant SaaS platform for music teaching academies (scheduling, billing, parent portal, CRM, AI copilot). Built with Vite + React 18 + TypeScript + Supabase + Tailwind + shadcn/ui.

**Domain:** lessonloop.net
**Live app URL:** https://app.lessonloop.net
**Supabase project ID:** ximxgnkpcswbvfrkkmjq
**Supabase URL:** https://ximxgnkpcswbvfrkkmjq.supabase.co
**UK defaults:** GBP currency, Europe/London timezone, DD/MM/YYYY dates

## Tech Stack
- **Frontend:** React 18.3.1, TypeScript 5.x, Vite 5.x, TanStack Query 5.83, React Router 6.30, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend:** Supabase (PostgreSQL + 81 Deno edge functions), Row-Level Security for multi-tenancy
- **External:** Resend (email), Stripe Connect (payments), Anthropic (AI copilot), Zoom (video)
- **Mobile:** Capacitor 8.x (iOS/Android)
- **Testing:** Playwright E2E (15 specs, ~379 tests) + Vitest unit tests (25 specs, 432 tests)

## Package Manager & Commands
```bash
npm install                    # Install dependencies (uses package-lock.json)
npm run dev                    # Start dev server (Vite, default port 8080)
npm run build                  # Production build
npm run typecheck              # tsc --noEmit
npm run lint                   # eslint
npm run test                   # vitest run (unit tests)
npm run test:e2e               # npx playwright test (E2E suite)
npm run test:e2e:headed        # npx playwright test --headed
npm run test:e2e:debug         # PWDEBUG=1 npx playwright test
npm run test:e2e:ui            # npx playwright test --ui
```

## Quality Gates
Before marking any work done, ALL of these must pass:
```bash
npm run typecheck && npm run test && npm run build
```
No new TODOs, no console.log spam, no untyped `any` unless justified.

## Architecture — Key Paths
```
src/
  components/          # 361 component files (.tsx)
  hooks/               # 107 custom hooks
  contexts/            # AuthContext, OrgContext, LoopAssistContext
  config/routes.ts     # All routes with role-based access
  integrations/supabase/
    client.ts          # Supabase client
    types.ts           # Generated DB types
  pages/               # Route pages
  lib/native/          # Capacitor mobile bridge

supabase/
  functions/           # 81 Deno edge functions (each has index.ts)
  functions/_shared/   # Shared utilities (cors, rate-limit, escape-html, sanitise-ai-input, cron-auth)
  migrations/          # 203+ SQL migrations

tests/
  e2e/                 # Playwright E2E tests (15 specs)
  e2e/auth.setup.ts    # Creates stored auth sessions for 6 roles
  e2e/helpers.ts       # waitForPageReady, expectToast, navigateTo, goTo, etc.
  e2e/.auth/           # Stored session files (owner.json, admin.json, etc.)
  e2e/workflows/       # Full-system smoke tests

src/test/              # Vitest unit tests (25 specs, organised by module)

docs/                  # SYSTEM_OVERVIEW, DATA_MODEL, API_REFERENCE, etc.
```

## User Roles (5)
owner, admin, teacher, finance, parent — enforced via RLS + route guards in src/config/routes.ts

---

## Playwright E2E Test Setup

### ⚠️ CRITICAL: SOLVED PROBLEMS — READ THIS ENTIRE SECTION BEFORE TOUCHING E2E TESTS

The following issues took hours to debug. Every solution below is PROVEN WORKING. Do NOT attempt alternative approaches.

---

**PROBLEM 1: DNS resolution is broken for Node.js AND Playwright browsers.**
- `fetch()` from Node.js CANNOT resolve `ximxgnkpcswbvfrkkmjq.supabase.co` — throws `EAI_AGAIN`.
- `page.evaluate(() => fetch(...))` inside Playwright browser context ALSO fails — same DNS issue.
- `curl` from bash WORKS — it uses the system DNS resolver + respects the proxy env vars.
- **ROOT CAUSE:** The container environment routes traffic through an HTTP proxy. Node.js and Chromium don't automatically use it. curl does (via `https_proxy` env var).
- **SOLUTION for Supabase API calls:** Use `child_process.execSync('curl ...')` in auth.setup.ts. Never use Node.js `fetch()` or browser `fetch()` for Supabase API endpoints.

---

**PROBLEM 2: Playwright browser cannot connect to external sites (app.lessonloop.net).**
- Direct HTTPS connections from Chromium time out — the container requires all traffic to go through the HTTP proxy.
- The proxy address is available in the `https_proxy` env var (check with `echo $https_proxy`).
- The proxy may have embedded credentials in the URL (e.g. `http://user:pass@host:port`).
- The proxy's TLS certificate is NOT trusted by Chromium by default.
- **SOLUTION:** Configure the proxy in `playwright.config.ts` under `use`:
```typescript
use: {
  baseURL: process.env.E2E_BASE_URL || 'https://app.lessonloop.net',
  proxy: {
    server: 'http://<proxy_host>:<proxy_port>',  // Parse from https_proxy env var
    username: '<proxy_user>',                      // If proxy has auth
    password: '<proxy_pass>',                      // If proxy has auth
  },
  ignoreHTTPSErrors: true,  // REQUIRED — proxy TLS cert is not trusted by Chromium
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'on-first-retry',
}
```
- **Parse the proxy from env:** Read `process.env.https_proxy`, extract host, port, username, password. If no env var exists, the proxy config may not be needed (local dev machine vs container).
- **ignoreHTTPSErrors: true is MANDATORY** when using the proxy. Without it, every page.goto() fails with a TLS error even though the site is perfectly valid.

---

**PROBLEM 3: `waitUntil: 'networkidle'` hangs forever.**
- The SPA keeps WebSocket connections alive (Supabase realtime subscriptions).
- `networkidle` waits for zero network activity for 500ms — this NEVER happens.
- page.goto() hangs for the full timeout (30-60s) before any assertions run.
- **SOLUTION:** Always use `waitUntil: 'domcontentloaded'` or `waitUntil: 'load'`. NEVER use `networkidle` anywhere in test files or helpers.

---

**PROBLEM 4: Auth setup must bypass the login UI entirely.**
- Filling the login form is fragile: selectors change, networkidle hangs, error toasts vanish before screenshots, and it takes 90+ seconds for 6 roles.
- **SOLUTION:** Authenticate via Supabase REST API using curl, then inject session tokens into a Playwright storage state JSON file. Completes in ~4 seconds for all 6 roles.
```typescript
import { execSync } from 'child_process';

const SUPABASE_URL = 'https://ximxgnkpcswbvfrkkmjq.supabase.co';
const SUPABASE_ANON_KEY = '<key from src/integrations/supabase/client.ts>';

function supabaseAuth(email: string, password: string) {
  const result = execSync(
    `curl -s -X POST '${SUPABASE_URL}/auth/v1/token?grant_type=password' ` +
    `-H 'apikey: ${SUPABASE_ANON_KEY}' ` +
    `-H 'Content-Type: application/json' ` +
    `-d '{"email":"${email}","password":"${password}"}'`,
    { timeout: 15000 }
  );
  return JSON.parse(result.toString());
}
```
Then build a storage state JSON with the tokens injected into localStorage origins for both `app.lessonloop.net` and the Supabase URL, and write it to `tests/e2e/.auth/{role}.json`.

---

**PROBLEM 5: Tests run against the LIVE site, not localhost.**
- `E2E_BASE_URL=https://app.lessonloop.net` in `.env.test`
- The `webServer` config in `playwright.config.ts` must be **disabled/commented out**.
- Do NOT attempt to run `npm run dev` for E2E tests or start a local dev server.

---

**ABSOLUTE DO-NOT-ATTEMPT LIST:**
- ❌ `fetch()` from Node.js for Supabase API calls → use curl
- ❌ `page.evaluate(() => fetch())` for Supabase API calls → use curl
- ❌ Filling the login form in auth.setup.ts → use API + curl
- ❌ `waitUntil: 'networkidle'` anywhere → use `domcontentloaded`
- ❌ Starting a local dev server for E2E → test against live site
- ❌ Direct HTTPS from Playwright without proxy config → configure proxy in playwright.config.ts
- ❌ Trusting proxy TLS certificates → use `ignoreHTTPSErrors: true`
- ❌ Adding /etc/hosts entries to fix DNS → doesn't help because traffic must go through proxy anyway

**PROVEN WORKING APPROACH:**
- ✅ curl via `child_process.execSync()` for all Supabase API calls in test setup
- ✅ Proxy configured in `playwright.config.ts` use block (parsed from `https_proxy` env var)
- ✅ `ignoreHTTPSErrors: true` in Playwright config
- ✅ `waitUntil: 'domcontentloaded'` for all navigation
- ✅ E2E_BASE_URL pointing to `https://app.lessonloop.net`
- ✅ webServer config disabled in playwright.config.ts

---

### Prerequisites
```bash
npm install                              # Install all deps including @playwright/test
npx playwright install --with-deps       # Install browser binaries (Chromium + WebKit)
```

### Environment
Tests require `.env.test` in repo root (loaded by playwright.config.ts via dotenv):
```
E2E_BASE_URL=https://app.lessonloop.net
E2E_OWNER_EMAIL=<owner account email>
E2E_OWNER_PASSWORD=<owner account password>
E2E_ADMIN_EMAIL=<admin account email>
E2E_ADMIN_PASSWORD=<admin account password>
E2E_TEACHER_EMAIL=<teacher account email>
E2E_TEACHER_PASSWORD=<teacher account password>
E2E_FINANCE_EMAIL=<finance account email>
E2E_FINANCE_PASSWORD=<finance account password>
E2E_PARENT_EMAIL=<parent account email>
E2E_PARENT_PASSWORD=<parent account password>
E2E_PARENT2_EMAIL=<parent2 account email>
E2E_PARENT2_PASSWORD=<parent2 account password>
```
These accounts must exist in the Supabase project with the correct roles assigned.

### Playwright Config (playwright.config.ts)
- **4 projects:** auth-setup → desktop-chrome, mobile-safari, workflow
- **Auth setup runs first:** auth.setup.ts authenticates all 6 roles via Supabase REST API (curl) and saves sessions to tests/e2e/.auth/*.json. All other projects depend on this.
- **webServer: DISABLED** — tests run against the live site at app.lessonloop.net
- **Proxy: CONFIGURED** — parsed from `https_proxy` env var, with `ignoreHTTPSErrors: true`
- **Workers:** 4 parallel
- **Timeout:** 60s per test (120s for workflow project)
- **Expect timeout:** 10s
- **Traces/screenshots/video:** on-first-retry / only-on-failure / on-first-retry

### Running Tests
```bash
# Full suite (auth setup runs automatically first)
npx playwright test

# Auth setup only (should complete in ~4 seconds)
npx playwright test --project=auth-setup

# Single spec file
npx playwright test tests/e2e/calendar.spec.ts

# Single test by name
npx playwright test -g "should load calendar"

# Desktop Chrome only (skip mobile)
npx playwright test --project=desktop-chrome

# View HTML report after run
npx playwright show-report
```

### Auth Session Architecture
- auth.setup.ts authenticates 6 roles via Supabase REST API (curl, NOT fetch)
- Sessions stored at tests/e2e/.auth/{role}.json
- Tests use `test.use({ storageState: AUTH.owner })` to load a role's session
- helpers.ts exports `AUTH` object with paths to each session file
- If auth setup fails, ALL downstream tests fail (they depend on stored sessions)
- `goTo()` helper handles the Supabase auth race condition with a retry

### Test Helpers (tests/e2e/helpers.ts)
- `waitForPageReady(page)` — waits for domcontentloaded + spinners gone + main visible. Must NOT use networkidle internally.
- `expectToast(page, text)` — asserts a radix toast appears
- `navigateTo(page, linkText)` — clicks sidebar/nav link and waits
- `goTo(page, path)` — navigates directly with auth race condition retry
- `safeGoTo(page, path)` — goTo with extra safety for flaky navigation
- `openDialog(page, buttonText)` — clicks button and waits for dialog
- `fillField(page, label, value)` — fills input by label
- `selectOption(page, label, value)` — selects from dropdown
- `clickButton(page, name)` — clicks button by role
- `trackConsoleErrors(page)` — collects console errors for assertions

### Test Spec Summary (15 files, ~379 tests)
| Spec | Tests | Roles Tested |
|------|-------|-------------|
| auth.spec.ts | 11 | unauth, owner, parent |
| calendar.spec.ts | 20 | owner, teacher, finance, parent |
| dashboard.spec.ts | 25 | owner, teacher, finance, admin |
| invoices.spec.ts | 18 | owner, finance, teacher, parent |
| messages.spec.ts | 20 | owner, teacher, finance, parent |
| mobile-public-errors.spec.ts | 21 | owner, parent, unauth |
| parent-portal.spec.ts | 22 | parent, owner |
| rbac.spec.ts | 79 | teacher, finance, parent, admin |
| reports.spec.ts | 18 | owner, finance, teacher, parent |
| secondary-modules.spec.ts | 37 | owner, teacher |
| settings.spec.ts | 18 | owner, teacher, finance, parent |
| students.spec.ts | 21 | owner, teacher, finance |
| teachers-locations.spec.ts | 21 | owner, teacher, finance |
| url-attacks.spec.ts | 45 | parent, teacher, finance |
| workflows/smoke-full-system.spec.ts | 3 | owner, parent, teacher |

---

## Fixing Tests — Rules
- **NEVER change app source code to make tests pass.** Only change test files.
- If auth setup fails, fix that FIRST — it cascades into most other failures.
- When selectors are stale, read the actual component source to find the correct current selector.
- Use `goTo()` not `page.goto()` for navigation (handles auth race condition).
- Use `waitForPageReady()` after any navigation.
- **NEVER use `waitUntil: 'networkidle'`** — the SPA keeps WebSocket connections alive. Use `domcontentloaded` or `load`.

## Commit Convention
```
fix(area): short description
feat(area): short description
chore(area): short description
test(e2e): short description
```
One logical change per commit. Small, reviewable diffs.

## Gotchas
- **LessonLoop domain is lessonloop.net** (not .co.uk)
- **Live app URL is https://app.lessonloop.net** — E2E tests run against this, not localhost
- **Prerender:** always verify no localhost references in output HTML after builds. Past incident: localhost:5173 leaked into production static site.
- **ACCL schema:** Do not use SpeakableSpecification. Do not include aggregateRating or review arrays.
- **Supabase edge functions:** verify_jwt is DISABLED at platform level. All functions do manual auth validation via Authorization header.
- **Multi-tenant:** Every table is scoped by org_id with RLS policies. Every hook mutation should include .eq('org_id', currentOrg.id).
- **Shared AI sanitisation:** supabase/functions/_shared/sanitise-ai-input.ts — used by staff chat, parent chat, and marketing chat.
- **DNS in CI/containers:** Node.js `fetch()` and Playwright browser `fetch()` CANNOT resolve Supabase domains. Only `curl` via `child_process.execSync()` works. This is a known proxy/network issue, not a code bug. Do not attempt to debug DNS — just use curl.
- **Proxy:** Container environments route traffic through an HTTP proxy (check `$https_proxy`). Playwright must have proxy configured in its config. `ignoreHTTPSErrors: true` is required.
- **networkidle:** NEVER use this in any Playwright test or helper. The SPA's realtime WebSocket connections prevent networkidle from ever resolving. This has been debugged extensively — there is no workaround other than not using it.
