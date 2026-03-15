# LessonLoop — Claude Code Project Context

## What This Is
LessonLoop is a multi-tenant SaaS platform for music teaching academies (scheduling, billing, parent portal, CRM, AI copilot). Built with Vite + React 18 + TypeScript + Supabase + Tailwind + shadcn/ui.

- **Domain:** lessonloop.net (NOT .com — the .com is a different site)
- **Live app URL:** https://app.lessonloop.net
- **Marketing site:** https://lessonloop.net (prerendered static HTML on Cloudflare Pages, GitHub repo sublimeanger/lessonloop3)
- **Supabase project ID:** ximxgnkpcswbvfrkkmjq
- **Supabase URL:** https://ximxgnkpcswbvfrkkmjq.supabase.co
- **iOS App Store URL:** https://apps.apple.com/app/id6759724798 (App ID net.lessonloop.app)
- **UK defaults:** GBP currency, Europe/London timezone, DD/MM/YYYY dates

## Tech Stack
- **Frontend:** React 18.3.1, TypeScript 5.x, Vite 5.x, TanStack Query 5.83, React Router 6.30, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend:** Supabase (PostgreSQL + 81 Deno edge functions), Row-Level Security for multi-tenancy
- **External:** Resend (email), Stripe Connect (payments), Anthropic Claude Haiku (LoopAssist AI copilot), Zoom (video)
- **Mobile:** Capacitor 8.x (iOS/Android)
- **Testing:** Playwright E2E (74 spec files, ~779 tests) + Vitest unit tests (24 specs)

## Division of Labour
- **Lovable:** UI/frontend work — components, pages, hooks, routing, styling, mobile layouts
- **Claude Code:** Edge functions, SQL migrations, RLS policies, test infrastructure, schema, backend logic
- **Never cross these boundaries unless explicitly instructed**

## Subscription Plans (3)

| Plan | Price | Max Teachers | Key Features |
|------|-------|-------------|--------------|
| Teacher | £12/mo | 1 | Solo teacher — no Teachers page, simplified nav |
| Studio | £29/mo | 5 | Multi-teacher, multi-location, custom branding |
| Agency | £79/mo | Unlimited | Everything + API access |
| Trial | Free/30 days | 1 | All features unlocked |

Plan config: `src/hooks/useSubscription.ts` (PLAN_LIMITS), `src/components/settings/BillingTab.tsx`
Org type stored as: `solo_teacher`, `academy`, `agency` on `organisations` table

## User Roles (5)

| Role | Dashboard | Key Access |
|------|-----------|------------|
| owner | Full / SoloTeacher (if solo) | Everything |
| admin | Full | Everything except billing |
| teacher | TeacherDashboard | Own lessons, students, notes, register only |
| finance | FinanceDashboard | Invoices, financial reports, messages only |
| parent | Portal Home | Portal only — schedule, invoices, practice, messages |

Enforced via RLS + route guards in `src/config/routes.ts`

## Role-Specific Navigation
- **Solo teacher owner:** Simplified sidebar (soloOwnerGroups in AppSidebar.tsx) — no Teachers, Locations, Batch Attendance, Leads, Waitlist, Make-Ups, Continuation. Determined by `org_type === 'solo_teacher'`.
- **Academy owner:** Full sidebar with collapsible Pipeline section (Leads, Waitlist, Make-Ups, Continuation)
- **Teacher:** Teaching-focused sidebar. Mobile bottom nav has 4 tabs + More menu with 6 items (Register, Attendance, Practice, Resources, Notes, Settings)
- **Finance:** Business-focused sidebar (Dashboard, Invoices, Reports, Messages). LoopAssist and notification bell hidden.
- **Parent:** Completely separate Portal UI with bottom nav (Home, Schedule, Practice, Resources, Invoices, Messages)

## Settings Tab Visibility
- **Owner/Admin:** All tabs
- **Teacher/Finance:** Profile, Notifications, Help & Tours, Availability, Calendar Sync, Zoom only
- **Organisation and Branding tabs are `adminOnly: true`**

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

No new TODOs, no `console.log` spam, no untyped `any` unless justified.

## Architecture — Key Paths

```
src/
  components/          # 373 component files (.tsx)
  hooks/               # 111 custom hooks
  contexts/            # AuthContext, OrgContext, LoopAssistContext
  config/routes.ts     # All routes with role-based access (allowedRoles)
  integrations/supabase/
    client.ts          # Supabase client
    types.ts           # Generated DB types
  pages/               # 86 route pages
  lib/
    utils.ts           # formatCurrencyMinor(), currencySymbol() — USE THESE for all currency
    native/            # Capacitor mobile bridge
    platform.ts        # iOS/Android/web detection

supabase/
  functions/           # 81 Deno edge functions (each has index.ts)
  functions/_shared/   # Shared utilities (cors, rate-limit, escape-html, sanitise-ai-input, cron-auth)
  migrations/          # 216 SQL migrations

tests/
  e2e/                 # 74 Playwright E2E spec files (~779 tests)
  e2e/auth.setup.ts    # Creates stored auth sessions for 6 roles via curl
  e2e/helpers.ts       # waitForPageReady, expectToast, navigateTo, goTo, etc.
  e2e/.auth/           # Stored session files (owner.json, admin.json, etc.)
  e2e/workflows/       # 49 workflow spec files

src/test/              # Vitest unit tests (24 specs)

marketing-html/        # Prerendered static marketing site (deployed to Cloudflare Pages)
docs/                  # SYSTEM_OVERVIEW, DATA_MODEL, API_REFERENCE, etc.
```

## Currency Formatting — CRITICAL

ALWAYS use the central utilities for currency display:

```typescript
import { formatCurrencyMinor, currencySymbol } from '@/lib/utils';

// For amounts in pence/cents (minor units):
formatCurrencyMinor(2500, 'GBP')  // "£25.00"

// For the symbol only:
currencySymbol('GBP')  // "£"
```

**NEVER:**
- Hardcode `£` in components
- Use `(amount / 100).toFixed(2)` manually
- Use ad-hoc ternaries like `currency === 'GBP' ? '£' : '$'`
- Create duplicate formatting functions in components

## Timezone Handling — CRITICAL

Org timezone is `Europe/London`. Use timezone-aware utilities for all date logic:

```typescript
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

// Get "now" in org timezone:
const nowInOrg = toZonedTime(new Date(), orgTimezone);

// Get UTC equivalent for Supabase queries:
const utcNow = fromZonedTime(new Date(), orgTimezone).toISOString();

// For Supabase date filters:
.gte('start_at', fromZonedTime(new Date(), orgTimezone).toISOString())
```

**NEVER** use `new Date().toISOString()` or `new Date().getHours()` for business logic — these use the browser/server timezone, not the org timezone.

## Security Audit Status

**Completed (74/75 findings fixed)**

Full enterprise security audit covered: RLS policies, edge function auth, GDPR compliance, Stripe payment integrity, FK cascades, input sanitisation, prompt injection prevention.

### Key Security Facts
- `verify_jwt` is DISABLED at Supabase platform level. All edge functions do manual auth validation via Authorization header.
- All `dangerouslySetInnerHTML` uses `DOMPurify.sanitize()` with restrictive whitelists (`src/lib/sanitize.ts`)
- All RPC calls use parameterized queries — no SQL injection risk
- AI input sanitisation: `supabase/functions/_shared/sanitise-ai-input.ts`
- Stripe webhook signature verification with deduplication via `stripe_webhook_events` table
- Zoom OAuth has domain allowlist validation on `redirect_uri`
- `teachers_with_pay` view replaced with role-checked RPC (`get_teachers_with_pay`)
- LoopAssist system prompt is role-aware (teacher/finance/parent restrictions)

### Still Pending
- [ ] Enable leaked password protection in Supabase dashboard (SEC-H1 — 30 seconds)

## Codebase Bug Audit — Completed

### Wave 1 (Surface): 46 findings — ALL fixed

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 2 | Fixed |
| HIGH | 12 | Fixed |
| MEDIUM | 14 | Fixed |
| LOW | 18 | Fixed |

Key fixes: lesson deletion error check, teachers_with_pay RPC, Zoom redirect allowlist, Students.tsx crash fix, 5 timezone bugs, 7 currency bugs, 16+ unguarded queries, invoice double-click protection, CalendarPage null safety, 23 unused files deleted, hardcoded .com→.net, Stripe search interpolation.

### Wave 2 (Deep): IN PROGRESS
Stripe payment integrity, invoice lifecycle, recurring lessons, bulk slots, bulk edit, lesson notes, auth edge cases, cascade/orphan checks, RLS completeness, edge function deep dive.

### Wave 3 (Continuation & Make-Ups): IN PROGRESS
Term continuation and make-up credits — data model, lifecycle, parent response, credit balance, waitlist matching, policy enforcement.

## E2E Test Suite — Final State
- 74 spec files, ~779 tests. E2E testing phase complete — no more test writing until after beta.
- 5 competitive features shipped & tested: Feature Request Board, Student Notes on Attendance, Notes Explorer, Bulk Slot Generator, Bulk Edit Lessons

## Manual Testing — 34 Bugs Found & Fixed
8 Launch Blockers, 10 High, 13 Medium — all fixed.

## Role-Based Access Audit — 12 Issues Fixed
Solo teacher nav, teacher mobile nav (LAUNCH BLOCKER), FinanceDashboard, Pipeline collapsible, settings adminOnly, invite race condition, LoopAssist role-aware, settings typo.

## Performance — Auth init 1700ms → 500ms
Skip profile-ensure, prefetch dashboard data, STALE_STABLE invoice stats, scoped realtime.

## Pending Work

### Critical
- [ ] Enable leaked password protection in Supabase (SEC-H1)
- [ ] Marketing site prerender rebuild (broken icons)
- [ ] Money Path test (Jamie manual)
- [ ] Patrick's test results (waiting)

### In Progress
- [ ] Deep audit wave 2 & 3

### Deferred to Post-Beta
- [ ] UX polish prompts 1-6
- [ ] Accessibility audit
- [ ] Visual regression baselines
- [ ] Sentry source maps, Stripe test clocks, backup drill, pgTAP, Cloudflare WAF+CSP
- [ ] 21 `.toLocaleDateString()` instances
- [ ] Unbounded realtime listeners (PERF-M5)

## Playwright E2E Test Setup

### ⚠️ CRITICAL: SOLVED PROBLEMS — READ BEFORE TOUCHING E2E TESTS

**PROBLEM 1:** DNS broken. Node.js `fetch()` and browser `fetch()` cannot resolve Supabase. Use `curl` via `child_process.execSync()`.

**PROBLEM 2:** Proxy required. Configure in `playwright.config.ts` from `$https_proxy`. `ignoreHTTPSErrors: true` mandatory.

**PROBLEM 3:** `networkidle` hangs. Realtime WebSockets prevent idle. ALWAYS use `domcontentloaded`. NEVER `networkidle`.

**PROBLEM 4:** Auth bypass UI. Authenticate via Supabase REST API using curl → inject into storage state JSON. ~4 seconds for 6 roles.

**PROBLEM 5:** Live site only. `E2E_BASE_URL=https://app.lessonloop.net`. `webServer` DISABLED.

### DO-NOT-ATTEMPT:
- ❌ `fetch()` for Supabase → use `curl`
- ❌ Login form in auth.setup → use API + curl
- ❌ `networkidle` → `domcontentloaded`
- ❌ Local dev server → live site
- ❌ Direct HTTPS without proxy → configure proxy + `ignoreHTTPSErrors`

### Environment
`.env.test` in repo root. Patrick's accounts in `.env.patrick`.

### Running

```bash
npx playwright test                              # Full suite
npx playwright test --project=auth-setup         # Auth only (~4s)
npx playwright test tests/e2e/calendar.spec.ts   # Single spec
npx playwright show-report                       # View report
```

### Test Fixing Rules
- NEVER change app source code to make tests pass
- Fix auth setup failures FIRST
- Use `goTo()` not `page.goto()`
- Use `waitForPageReady()` after navigation
- NEVER use `networkidle`

## Commit Convention

```
fix(area): short description
feat(area): short description
chore(area): short description
test(e2e): short description
```

## Gotchas
- Domain is `lessonloop.net` (NOT .com)
- Live app at `https://app.lessonloop.net`
- Prerender: verify no localhost refs in output HTML
- ACCL schema: No `SpeakableSpecification`, no `aggregateRating`/`review` arrays
- Multi-tenant: Every table scoped by `org_id` with RLS
- `verify_jwt` DISABLED — edge functions do manual auth
- DNS in containers: Only `curl` works
- Edge function typo: `supabase/functions/looopassist-chat/` has triple-o. Do NOT rename.
- Stripe: LessonLoop Stripe is live. Webhook deduplication via `stripe_webhook_events`.
- LoopAssist: Claude Haiku via Anthropic API. Role-aware system prompt.
- Invited users: `invite-accept` sets `has_completed_onboarding=true`. `AcceptInvite` retries `refreshProfile()` 3× 500ms.
