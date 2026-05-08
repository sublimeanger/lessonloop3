# LessonLoop — Master Playwright Test Catalog

> Goal: a single, exhaustive map of every user journey, page, and feature in LessonLoop, with the exact selectors, RPCs, and assertions needed to write Playwright tests that cover every path. This is a **planning doc**, not source — translate each section into a `spec.ts` file (or merge into the existing `tests/e2e/workflows/` files).
>
> Source-of-truth used to write this:
> - `src/config/routes.ts` (route table + role gates)
> - `src/contexts/AuthContext.tsx`, `OrgContext.tsx`, `LoopAssistContext.tsx`
> - `src/components/auth/RouteGuard.tsx`
> - `src/components/layout/AppSidebar.tsx` (per-role nav)
> - Every page file in `src/pages/` and `src/pages/portal/`, `src/pages/public/`, `src/pages/reports/`
> - Key components: `students/StudentTabsSection.tsx`, `calendar/LessonModal.tsx`, `invoices/CreateInvoiceModal.tsx`, `invoices/BillingRunWizard.tsx`, `booking/SlotGrid.tsx`, `loopassist/LoopAssistDrawer.tsx`, `settings/*Tab.tsx`
> - Live DB schema (86 tables, ~140 RPCs, 24 enums) verified via Supabase MCP on project `xmrhmxizpslhtkibqyfy`
> - All ~100 edge functions in `supabase/functions/`
> - Existing tests in `tests/e2e/` (helpers, fixtures, workflow patterns reused)

---

## Table of contents

1. [Foundations & shared fixtures](#1-foundations--shared-fixtures)
2. [Public/marketing redirects](#2-publicmarketing-redirects)
3. [Auth flows](#3-auth-flows)
4. [Onboarding](#4-onboarding)
5. [RBAC matrix — every role × every route](#5-rbac-matrix)
6. [Dashboard (per role)](#6-dashboard-per-role)
7. [Calendar — views, navigation, filters, bulk](#7-calendar)
8. [Lesson CRUD — single, recurring, group, cancel, conflicts](#8-lesson-crud)
9. [Daily register & batch attendance](#9-daily-register--batch-attendance)
10. [Students — list, wizard, import, detail tabs](#10-students)
11. [Teachers — CRUD, link, archive, pay](#11-teachers)
12. [Locations & rooms](#12-locations--rooms)
13. [Invoices — list, billing run, recurring](#13-invoices)
14. [Invoice detail — send, pay, refund, plan, dispute](#14-invoice-detail)
15. [Reports — every report page](#15-reports)
16. [Messages — threads, requests, bulk, internal](#16-messages)
17. [Practice — assignments, logs, streaks](#17-practice)
18. [Resources — upload, share, categories](#18-resources)
19. [Make-ups & waitlist & leads & enrolment waitlist](#19-make-ups-waitlist-leads-enrolment)
20. [Continuation (term continuation)](#20-continuation)
21. [LoopAssist (AI assistant)](#21-loopassist)
22. [Settings — all 24 tabs](#22-settings)
23. [Subscription & plan limits](#23-subscription--plan-limits)
24. [Stripe payments end-to-end](#24-stripe-payments)
25. [Public booking page](#25-public-booking-page)
26. [Parent portal — every page](#26-parent-portal)
27. [Email & notifications](#27-email--notifications)
28. [GDPR & privacy](#28-gdpr--privacy)
29. [Cross-feature integrity (RLS, audit, realtime)](#29-cross-feature-integrity)
30. [Error & edge-case workflows](#30-error--edge-case-workflows)
31. [Mobile & native (Capacitor)](#31-mobile--native)
32. [Negative & security tests](#32-negative--security-tests)

---

## 1. Foundations & shared fixtures

### 1.1 Roles
The app has exactly five roles (`AppRole` enum, `app_role` PG enum):
- `owner` — created automatically when an org is created via `onboarding-setup` or `handle_new_organisation` trigger; protected by `protect_owner_role` and `block_owner_insert` triggers.
- `admin` — invited by owner; same access as owner except cannot delete the org or change subscription.
- `teacher` — sees only their own students/lessons unless RLS allows otherwise; pay info visible only when org settings allow.
- `finance` — invoices/reports only; no student or teaching write access.
- `parent` — guardian; routes confined to `/portal/*`. Sidebar fully different.

For solo orgs (`org_type = 'solo_teacher'`), the owner sees a slimmer sidebar (`soloOwnerGroups` in `AppSidebar.tsx`).

### 1.2 Authentication setup (existing pattern, keep as-is)
Existing `auth.setup.ts` logs in once per role via direct curl to Supabase REST and writes a storage state JSON to `tests/e2e/.auth/{role}.json`. Each test loads the relevant state via `test.use({ storageState: AUTH.{role} })` from `tests/e2e/helpers.ts`.

Required env in `.env.test`:
```
E2E_BASE_URL=https://staging.lessonloop.net  # MUST NOT be app.lessonloop.net unless ALLOW_PRODUCTION_TESTS=true
E2E_SUPABASE_URL=https://xmrhmxizpslhtkibqyfy.supabase.co
E2E_SUPABASE_ANON_KEY=<anon>
E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD
E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
E2E_TEACHER_EMAIL / E2E_TEACHER_PASSWORD
E2E_FINANCE_EMAIL / E2E_FINANCE_PASSWORD
E2E_PARENT_EMAIL / E2E_PARENT_PASSWORD
E2E_PARENT2_EMAIL / E2E_PARENT2_PASSWORD  # second parent for cross-tenant isolation tests
SUPABASE_SERVICE_ROLE_KEY  # for tests/e2e/supabase-admin.ts (DB seed/teardown, RLS verification)
```

The `playwright.config.ts` already enforces a production-target safety guard. Keep it.

### 1.3 Helper inventory (already in `tests/e2e/helpers.ts` — extend, don't duplicate)
- `waitForPageReady(page)` — gates on spinner gone + `<main>` visible
- `expectToast`, `expectToastSuccess`, `expectToastError` — Radix `[data-radix-collection-item]`
- `goTo`, `safeGoTo` — handles auth race; retries once
- `expectRedirect(page, path, redirectPattern)` — used heavily in section 5 (RBAC)
- `assertNoErrorBoundary` — checks for both full-page and section error boundaries
- `fillField`, `selectOption`, `clickButton`, `closeDialog`
- `waitForTableData`, `getMainContent`
- `trackConsoleErrors` — filters known benign errors; **extend** with any new noise observed
- `assertNoHorizontalOverflow` — for mobile viewport tests
- `generateTestId` — `e2e_${Date.now()}_${rand}`

Workflow helpers already exist in `tests/e2e/workflows/workflow-helpers.ts`:
- `createStudentViaWizard`, `createLessonViaCalendar`, `createInvoiceForStudent`, `sendInvoice`, `markAttendance`, `navigateToStudentDetail`, `switchToRole`, `assertNoConsoleErrors`, `assertNoBrokenImages`, `waitForDataLoad`, `getToastMessages`, `expectAuditEntry`, `switchToCalendarView`, `navigateToInvoiceDetail`, `TestCleanup` class.

### 1.4 Selector strategy — what's actually in the codebase
The app uses three selector layers (in priority order):

1. **`data-tour="..."` attributes** — added for product tours, ideal for tests because they're stable. Confirmed in source: `add-student-button`, `create-lesson-button`, `create-invoice-button`, `calendar-view-toggle`, plus more I didn't enumerate. Run `grep -rn 'data-tour=' src/components` to get the full list before writing each spec.
2. **`data-hint="..."` attributes** — for ContextualHint dot indicators (`sidebar`, `loopassist-button`).
3. **Role/label/text** — `getByRole('button', { name: /create lesson/i })`, `getByLabel(/email/i)`, etc.

Avoid CSS selectors except for radix-internal markers (`[role="dialog"]`, `[cmdk-item]`, `[data-radix-collection-item]`).

### 1.5 Test data seeding strategy
`tests/e2e/supabase-admin.ts` exists — it uses the service role key to seed deterministic data. Extend it with these factories per spec needs:
- `seedOrg({ orgType, currency, timezone, plan })` → returns `{ orgId, ownerId }`
- `seedStudent({ orgId, withGuardian, instrument, status })` → `{ studentId, guardianId }`
- `seedLesson({ orgId, teacherId, studentIds, startAt, durationMins, recurring })` → `{ lessonId, recurrenceRuleId? }`
- `seedInvoice({ orgId, payerGuardianId, status, totalMinor, items, installments? })` → `{ invoiceId, items: [...] }`
- `seedRateCard`, `seedTerm`, `seedBookingPage`, `seedLead`, `seedWaitlistEntry`, `seedEnrolmentWaitlistEntry`, `seedContinuationRun`, `seedRecurringTemplate`
- `cleanupByPrefix(orgId, namePrefix='e2e_')` — sweeps test-tagged rows

Edge functions `seed-demo-agency`, `seed-demo-solo`, `seed-e2e-data` already exist — **prefer calling these** in `beforeAll` rather than building data piecewise, unless the test specifically needs an empty org.

### 1.6 Per-test prelude template
Every spec should:
```ts
test.use({ storageState: AUTH.owner });   // or whichever role
test.beforeEach(async ({ page }) => {
  const checkErrors = await trackConsoleErrors(page);
  test.info().annotations.push({ type: 'check-errors', description: 'will assert at end' });
  // make checkErrors visible to test via page-attached symbol or test fixture
});
test.afterEach(async ({ page }) => {
  await assertNoBrokenImages(page);
  // checkErrors() — see note in helpers.ts
});
```

---

## 2. Public/marketing redirects

`/` and all `/features/*`, `/compare/*`, `/for/*`, `/about`, `/blog`, `/contact`, `/pricing`, `/privacy`, `/terms`, `/gdpr`, `/cookies`, `/kickstarter`, `/report`, `/zoom-integration`, `/uk` use `ExternalRedirect` to `https://lessonloop.net/{path}`. In SSG mode (`window.__SSG_MODE__`) they're served as static HTML — but the app under test won't be in SSG mode.

### Tests
For each path in `productionMarketingRoutes` (defined in `src/config/routes.ts`):

| Path | Expected behaviour |
|---|---|
| `/` (unauthed) | Renders `AuthRedirect` → external redirect to `lessonloop.net/` (or to login if logged in — see `AuthRedirect` component) |
| `/` (authed staff) | Redirects to `/dashboard` |
| `/` (authed parent) | Redirects to `/portal/home` |
| `/features` | 302/JS-redirect to `https://lessonloop.net/features` |
| `/features/scheduling` … `/features/resources` (12 paths) | Redirect to `lessonloop.net/features/{slug}` |
| `/compare/lessonloop-vs-{my-music-staff,teachworks,opus1,jackrabbit-music,fons}` | Redirect |
| `/for/{music-academies,solo-teachers,piano-schools,guitar-schools,performing-arts}` | Redirect |
| `/about`, `/blog`, `/blog/:slug`, `/contact`, `/pricing` | Redirect |
| `/privacy`, `/terms`, `/gdpr`, `/cookies` | Redirect |
| `/demo` | Redirects to `/contact?subject=demo` |
| `/kickstarter`, `/report`, `/zoom-integration`, `/uk` | Redirect |

Test pattern:
```ts
test('marketing redirect: /features → lessonloop.net/features', async ({ page }) => {
  const responses: string[] = [];
  page.on('response', r => responses.push(r.url()));
  await page.goto('/features');
  await page.waitForURL(/lessonloop\.net\/features/, { timeout: 10_000 });
  expect(page.url()).toMatch(/lessonloop\.net\/features$/);
});
```

Tag this whole section `@marketing` so it can be skipped when `lessonloop.net` is unreachable in sandboxed CI.

---

## 3. Auth flows

### 3.1 Login (`/login`, `/auth`)
**Component:** `src/pages/Login.tsx`. Eager-loaded.

Test cases:
1. **Happy path** — fill email/password, submit, redirect to `/dashboard` (staff) or `/portal/home` (parent).
2. **Email format validation** — submit `not-an-email` → toast `Invalid email`, no navigation, focus stays.
3. **Missing fields** — empty submit → toast `Missing fields`.
4. **Wrong password** — toast `Incorrect email or password. Please try again.` (specifically check we collapse Supabase's `Invalid login credentials` and `User not found` into the same message — the SEC-AUTH-03 enumeration guard in `signIn`).
5. **Email not confirmed** — toast `Please verify your email address before signing in. Check your inbox for the verification link.`
6. **Password show/hide toggle** — input type flips between `password` and `text`.
7. **`Forgot password?` link** — navigates to `/forgot-password`.
8. **`Get started` link** — navigates to `/signup`.
9. **OAuth callback handling** — visit `/login#access_token=fake` → shows `Signing you in…` skeleton; after 10s timeout, toast `Sign in timed out`. URL gets cleaned to `/login`.
10. **`PublicRoute` redirect when already logged in** — visit `/login` while authed → redirects to `/dashboard` (staff) or `/portal/home` (parent), and honours `inviteReturn` from sessionStorage if set and starts with `/accept-invite`. (Open-redirect guard: only relative paths beginning `/`, not `//`.)
11. **Google/Apple OAuth buttons** — only render when `SOCIAL_AUTH_GOOGLE_ENABLED` / `SOCIAL_AUTH_APPLE_ENABLED` env flags. Mock `lovable.auth.signInWithOAuth` and assert it's called with `{ redirect_uri: '<origin>/login' }`. Popup-blocked path: toast `Please allow popups for this site and try again`.
12. **Form disabled while signing in** — assert `aria-disabled` on Sign-in button during request.
13. **`loginFailed` aria-invalid** — after failed login, both inputs get `aria-invalid="true"` until user types again.

### 3.2 Signup (`/signup`)
**Component:** `src/pages/Signup.tsx`.

1. **Happy path** — fill name + email + password (twice) → success screen `Check your email`.
2. **Password strength gate** — `PASSWORD_MIN_LENGTH` enforced; `getPasswordScore < 2` → toast `Password too weak`.
3. **Mismatched passwords** — `aria-invalid` on confirm field, toast `Passwords don't match`.
4. **Existing email** — `signUp` returns `{ error: Error('An account with this email may already exist…') }` (the `data?.user?.identities?.length === 0` Supabase obfuscation detection). Toast `Sign up failed` with that text.
5. **Resend verification** — on success screen, click `Resend verification email`. Cooldown 60s — button text becomes `Resend in Xs` and disabled until 0.
6. **Show/hide password toggle** — applies to both fields together (shared state).
7. **Terms/privacy links** — render and navigate.

### 3.3 Forgot password (`/forgot-password`)
**Component:** `src/pages/ForgotPassword.tsx`.

1. Submit email → success state, no error even if email doesn't exist (no enumeration).
2. Invalid email format → validation error before submit.
3. `supabase.auth.resetPasswordForEmail` is called with `redirectTo: <origin>/reset-password`.

### 3.4 Reset password (`/reset-password`)
**Component:** `src/pages/ResetPassword.tsx`. Public route — only valid if visited from email link with type=`recovery`.

1. Visit without recovery token → error state.
2. Visit with recovery → form for new password + confirm; submit → toast success → redirect to `/login`.
3. New password must pass strength check.
4. Mismatched passwords → blocked.

### 3.5 Verify email (`/verify-email`)
**Component:** `src/pages/VerifyEmail.tsx`. Auth-only (must be logged in).

1. Already-verified user → redirect to `/onboarding` (or `/dashboard` if onboarded).
2. Unverified user → polls `user.email_confirmed_at`; renders resend CTA. RouteGuard special-cases `/verify-email` to require auth only.
3. Click `Resend` — calls `supabase.auth.resend({ type: 'signup' })`; cooldown.
4. Click email link in real test (or mock) — token consumed, user gets `email_confirmed_at`, page transitions.

### 3.6 Accept invite (`/accept-invite?token=...`)
**Component:** `src/pages/AcceptInvite.tsx`. Public.

Edge functions called: `invite-get` (lookup), `invite-accept`.

Pre-test: seed an invite via service role:
```sql
INSERT INTO invites (org_id, email, role, token, expires_at, status) VALUES
  (<orgId>, 'newuser@e2e.test', 'teacher', 'TOK_e2e', now()+interval '7 days', 'pending');
```

1. **No token** → error state.
2. **Invalid token** → `invite-get` 404 → error.
3. **Expired token** → `expiredOrgName` shows; CTA to request new invite.
4. **Existing user (already authed, email matches)** — render `Accept invitation` button → calls `invite-accept` → membership inserted → redirect to `/dashboard` (or `/portal/home` if role is parent).
5. **Existing user (different email)** — show error `Sign in with the invited email` (the `emailLikelyMatches` redaction-aware comparison; server does the authoritative match).
6. **New user signup path** — render full signup form (name + email + password); on submit calls `supabase.auth.signUp`, then polls profile (`waitForProfile`, 10×500ms), then `invite-accept`. Redirect by role.
7. **Signed-out existing user** — show `Sign in to accept` flow → preserves token in `sessionStorage('lessonloop_invite_return')` → after login, `PublicRoute` reads it and redirects back.
8. **Open-redirect guard on inviteReturn** — assert that `sessionStorage.lessonloop_invite_return = '//evil.com'` is rejected (must start with single `/accept-invite`).

### 3.7 Zoom OAuth callback (`/auth/zoom/callback`)
**Component:** `src/pages/ZoomOAuthCallback.tsx`.

Calls edge function `calendar-oauth-callback` with `provider=zoom`. Assertions:
1. With `?code=XXX&state=YYY` → success → toast → redirect to `/settings?tab=zoom`.
2. With `?error=access_denied` → error toast.
3. State mismatch → error.

---

## 4. Onboarding (`/onboarding`)

**Component:** `src/pages/Onboarding.tsx`. Multi-step wizard. State managed via `useOnboardingState` (localStorage-persisted).

Steps (in `useOnboardingState` flow): `welcome` → `teaching` → `migration` → `plan` → `loading` → `success` | `error`.

Edge functions: `profile-ensure`, `onboarding-setup`, `csv-import-execute`.

### 4.1 Pre-conditions checked on mount
1. **Already completed onboarding (no `?new=true`)** → redirect to `/dashboard`.
2. **Has active org membership** → skip onboarding entirely; route by role.
3. **Profile missing** → call `profile-ensure` self-heal, refetch.
4. **`?new=true`** → force the wizard to render even if `has_completed_onboarding` is true.

### 4.2 Welcome step
Field: `fullName` (prefilled from `profile.full_name` or `user_metadata.full_name`).
Field: `orgType` (single-select: `solo_teacher`, `studio`, `academy`, `agency`).
- Empty name → toast `Please enter your name`, blocked.
- Click `Continue` → goes to `teaching`.

### 4.3 Teaching profile step
Fields:
- `orgName` — required if `orgType !== 'solo_teacher'`. Max 100 chars.
- `studentCount` — number selector (1-5, 6-15, 16-30, 31-60, 60+) — used in plan recommendation.
- `teamSize` — number selector (1, 2-3, 4-7, 8-15, 16+).
- `locationCount` — number selector (1, 2-3, 4-7, 8+).
- `instruments` — multi-select.
- `alsoTeaches` — boolean (only if `orgType !== 'solo_teacher'`); marks the owner as also a teacher.

Validation:
- Empty `orgName` for non-solo → toast.
- `orgName.length > 100` → toast.

### 4.4 Migration step
Choice: `not_yet`, `starting_fresh`, `switching`.

If `switching`:
- Show CSV upload + mapping UI (powered by `csv-import-mapping` edge fn).
- Mappings: column headers ↔ target fields (`first_name`, `last_name`, `email`, `phone`, `guardian_name`, etc.).
- Special transforms: `split_name`, `combine_guardian_name`, `combine_guardian2_name`.
- Source software detection: auto, `my_music_staff`, `teachworks`, `jackrabbit`, etc.
- Option: `importLessons` toggle.

### 4.5 Plan step
Engine: `getSmartRecommendation` in `src/lib/plan-recommendation.ts`. Inputs: orgType, teamSize, locationCount, studentCount, isSwitching. Output: `{ plan: SubscriptionPlan, reason: string }`.

Selectable plans: `trial`, `solo_teacher`, `academy`, `agency`, `custom`. (Trial is auto-applied for first 14 days regardless.)

Recommendations to assert:
- `solo_teacher` org → recommends `solo_teacher` plan.
- `academy` org with teamSize ≥ 4 → recommends `academy` plan.
- `agency` org → recommends `agency` plan.
- `studentCount: '60+'` → bumps recommendation up a tier.
- `isSwitching` → adds an annotation but doesn't change tier.

Click `Continue` (or finish-equivalent) → triggers `handleSubmit`.

### 4.6 Loading / success / error
- `handleSubmit` runs `Promise.all([wait(1500), createOrgFlow])`. Even if create finishes faster, the loading screen shows for 1.5s.
- **Idempotency** — re-checks `org_memberships` for existing owner; if found, skips creation, refreshes profile, navigates by role.
- Calls `POST /functions/v1/onboarding-setup` with `{ org_name, org_type, full_name, subscription_plan, timezone, also_teaches }`. Bearer = current session token. Aborts after 30s.
- Then if `importData`, calls `POST /functions/v1/csv-import-execute` with transformed rows + mappings.
- Stages animate: 0 → 1 (600ms) → 2 (1500ms or 2000ms with import) → 3 (3500ms with import).
- Progress bar: 0 → 90 over `maxDuration` (5000ms / 8000ms with import) → snaps to 100 on success/error.
- On success → `clearOnboardingState()`, refresh profile, transitions to `success` step.
- On error → toast + transitions to `error` step. CTAs: `Retry` (re-runs handleSubmit), `Edit` (back to plan), `Logout`.

### 4.7 Tests
1. Solo teacher happy path, no migration, no import. Final state: org row created with `org_type='solo_teacher'`, `subscription_plan='solo_teacher'`, `subscription_status='trialing'`, `trial_ends_at = now()+14d`.
2. Studio with team size 5, importing CSV from My Music Staff — validate `studentsCreated`, `guardiansCreated`, `linksCreated`, `lessonsCreated` numbers in success view. Failed-import case (malformed CSV) → success view shows errors array.
3. Profile missing on mount → `profile-ensure` called, profile created, wizard renders.
4. Existing membership detected → wizard skipped, redirect to `/dashboard`.
5. `?new=true` flag forces render even with completed flag.
6. Network timeout (mock 30s+ delay) → error state with `Network timeout. Please check your connection and try again.`
7. `Failed to fetch` (mocked offline) → `Unable to connect. Please check your internet connection.`
8. Backend returns 500 → error state with `Server error (500). Please try again.`
9. Idempotency: simulate two parallel submits (rapid double-click) — second one detects existing membership and short-circuits.
10. State persists in localStorage — abandon the wizard at step 3, reload — should restore to step 3 with all entered data.

---

## 5. RBAC matrix

This is the single most valuable test category for catching regressions. Generate it programmatically from `src/config/routes.ts`.

### 5.1 Allowed-roles map (verified from source)
```
/dashboard                                    owner, admin, teacher, finance
/register                                     owner, admin, teacher
/calendar                                     owner, admin, teacher
/batch-attendance                             owner, admin, teacher
/students                                     owner, admin, teacher
/students/import                              owner, admin
/students/:id                                 owner, admin, teacher
/teachers                                     owner, admin
/locations                                    owner, admin
/invoices                                     owner, admin, finance
/invoices/:id                                 owner, admin, finance
/reports                                      owner, admin, finance, teacher
/reports/payroll                              owner, admin, teacher, finance
/reports/revenue                              owner, admin, finance
/reports/outstanding                          owner, admin, finance
/reports/lessons                              owner, admin, teacher
/reports/cancellations                        owner, admin
/reports/attendance                           owner, admin, teacher
/reports/utilisation                          owner, admin
/reports/teacher-performance                  owner, admin
/messages                                     owner, admin, teacher, finance
/practice                                     owner, admin, teacher
/resources                                    owner, admin, teacher
/make-ups                                     owner, admin
/leads                                        owner, admin
/leads/:id                                    owner, admin
/waitlist                                     owner, admin
/continuation                                 owner, admin
/notes                                        owner, admin, teacher
/settings                                     owner, admin, finance, teacher
/settings/recurring-billing/:templateId       owner, admin, finance
/settings/recurring-billing/runs/:runId       owner, admin, finance
/help                                         (no role gate — any authed)
/portal/*                                     parent
```

### 5.2 Test generator
```ts
const ROUTES = [ ...staffRoutes, ...portalRoutes ];
const ROLES = ['owner','admin','teacher','finance','parent'] as const;

for (const role of ROLES) {
  test.describe(`RBAC — ${role}`, () => {
    test.use({ storageState: AUTH[role] });
    for (const route of ROUTES) {
      const allowed = route.allowedRoles?.includes(role) ?? true;
      test(`${role} → ${route.path} = ${allowed ? '200' : 'redirect'}`, async ({ page }) => {
        await page.goto(route.path);
        if (allowed) {
          await expect(page).toHaveURL(new RegExp(route.path.replace(/:\w+/g, '[^/]+')));
          await assertNoErrorBoundary(page);
        } else {
          // Parent rejected → /portal/home; staff rejected → /dashboard
          const expected = role === 'parent' ? /\/portal\/home/ : /\/dashboard/;
          await page.waitForURL(expected, { timeout: 10_000 });
        }
      });
    }
  });
}
```

### 5.3 Specific cross-checks
- Staff visiting any `/portal/*` route → redirects via `RouteGuard.allowedRoles` not matching → `/dashboard`.
- Parent visiting `/dashboard` → `Dashboard.tsx` itself does `useEffect(navigate('/portal/home'))` if `currentRole === 'parent'` (belt-and-braces beyond RouteGuard).
- Parent visiting `/calendar` → redirects (parent role not in allowed list) — even though `CalendarPage.tsx` renders a parent-aware view, that's only used inside the portal.
- `/settings` is allowed for `teacher` and `finance` but the page itself only shows `Profile` tab for non-admins (the `adminTabs` array in `Settings.tsx`). Test: visit `/settings?tab=organisation` as teacher → page silently degrades to `profile` tab (resolvedTab logic).

### 5.4 Email-not-confirmed gate
For an authed user where `user.email_confirmed_at` is null:
- Visiting any protected route → redirect to `/verify-email` (RouteGuard line 150).
- Exception: `/onboarding` and `/verify-email` themselves don't bounce.

### 5.5 Onboarding-not-complete gate
- Visiting any protected route while `profile.has_completed_onboarding === false` → redirect to `/onboarding`.
- After onboarding `requireOnboarding: false` routes (`/onboarding`, `/verify-email`, `/accept-invite`) bypass this.

### 5.6 Profile-grace and role-grace periods
Simulate: log in fresh, immediately visit `/dashboard`. The 3s profile-grace and 5s role-grace must show the loading skeleton, not redirect prematurely. Mock the profile RPC to delay 4s, then resolve — the page should land successfully.

---

## 6. Dashboard (per role)

**Component:** `src/pages/Dashboard.tsx`. Realtime invoices subscription via `useRealtimeInvoices`.

### 6.1 Owner / admin dashboard
Widgets visible (all wrapped in `SectionErrorBoundary`):
- `DashboardHero` — greeting `Good {morning|afternoon|evening}, {firstName}`.
- `OnboardingChecklist` — sourced from `useOnboardingProgress`. Items: add students, add teachers, schedule first lesson, send first invoice, configure rate cards, etc. Auto-dismisses when all complete.
- `UrgentActionsBar` — `useUrgentActions`. Items: unmarked register entries, overdue invoices, expiring make-up credits, pending message requests.
- `StatsGrid` with 4-6 `StatCard`s — revenue this month, lessons today, active students, outstanding amount, etc. Tap → navigates with appropriate filter.
- `TodayTimeline` — today's lessons; tap → opens lesson detail.
- `UpcomingWeekWidget` — next 7 days.
- `QuickActionsGrid` — buttons for common actions.
- `LoopAssistWidget` + `LoopAssistAlerts` — proactive AI alerts.
- `CalendarSyncBanner` — if Google/Apple/Zoom integration has errors.
- `ContinuationWidget` — if a continuation run is open.
- `PaymentAnalyticsCard` — auto-pay success rate, etc.
- `WaitlistDashboardWidget`.
- `TeacherAvailabilityCard`.
- `ActiveDisputesCard` (only if disputes exist).
- `RecurringRunsCard`.
- `FinanceDashboard` (only if `org_type` is academy/agency).

### 6.2 Teacher dashboard
Uses `useTeacherDashboardStats`. Different cards: my upcoming lessons, my unmarked register, my students count, hours this week, my pay this week (only if `org.teacher_payment_analytics_enabled`).

### 6.3 Finance dashboard
Different again — focuses on outstanding invoices, overdue alerts, dispute count, payment plan health. No teaching-related stats.

### 6.4 Parent (handled by `useEffect` redirect to `/portal/home` — already covered in section 5).

### 6.5 Tests
For each role:
1. Page loads without error boundary.
2. Each widget renders or shows its empty state.
3. Stat cards reflect actual DB values (use `supabase-admin` to seed known counts and assert).
4. Click each stat card → URL changes correctly (e.g. `/invoices?status=overdue`, `/students?status=active`).
5. Realtime: insert an invoice via service role; dashboard outstanding count updates without reload (within 5s).
6. `OnboardingChecklist` — mark items complete via DB, assert items disappear; when all done, the whole widget unmounts.

---

## 7. Calendar

**Component:** `src/pages/CalendarPage.tsx`. Layout splits desktop vs mobile via `useIsDesktop`.

### 7.1 URL params
- `?view=day|week|stacked|agenda` — sets initial view.
- `?date=YYYY-MM-DD` — sets initial date.
- Both round-trip when user changes view/date (`setSearchParams`).

### 7.2 Views
- **Day** — single column, today by default. Filters bar visible. Time slots in 15-min granularity, 07:00-20:45.
- **Week** — 7 columns, Mon-Sun (locale = en-GB).
- **Stacked** — week view but with each teacher as a horizontal lane.
- **Agenda** — flat list, paginated.
- Mobile: only `Day`, `Week`, `Agenda` views. `Stacked` is hidden on mobile.

### 7.3 Toggle selectors (verified)
`[data-tour="calendar-view-toggle"]` wraps the toggle group. Each button has `aria-label`:
- `Day view`
- `Time grid view` (week)
- `Stacked view`
- `Agenda view`

### 7.4 Filters bar (`CalendarFiltersBar.tsx`)
- Teacher multi-select (auto-selects current teacher when role=`teacher`).
- Location multi-select.
- Status filter (scheduled/completed/cancelled).
- Show external busy blocks toggle (`useShowExternalEvents`).
- Lesson type (private/group).
- Filters serialise to URL (so deep-links share state).

### 7.5 Navigation
- Prev/Next buttons (`<` `>`).
- `Today` button.
- Calendar popover for jump-to-date.
- Keyboard shortcuts (see `useKeyboardShortcuts.ts`): `t` = today, `d` = day, `w` = week, `a` = agenda, `←/→` prev/next.

### 7.6 Bulk select
- Toggle bulk mode → checkboxes appear on lessons.
- Select multiple → `BulkSelectBar` appears at bottom with: Reschedule, Cancel, Delete, Mark complete, Send reminder.
- Calls `bulk_cancel_lessons` / `bulk_update_lessons` RPC.

### 7.7 Drag/resize
- Drag a lesson onto a different time slot → calls `useDragLesson` → updates `start_at`/`end_at`. Conflict-detection runs first (`check_lesson_conflicts` trigger and `useConflictDetection` hook); if conflict, dialog asks confirm.
- Resize bottom edge → `useResizeLesson` → adjusts `end_at`. Min 15 min.

### 7.8 External calendar overlays
- If `calendar_connections` row exists with `provider='google'|'apple'|'zoom'` and `sync_status='active'`, `external_busy_blocks` are shown as ghost/striped overlays via `BusyBlockOverlay.tsx`.
- Tap overlay → tooltip with title/source.

### 7.9 Slot generator wizard (`SlotGeneratorWizard.tsx`)
Triggered from a quick-action button.
1. Step 1: select teacher.
2. Step 2: select location.
3. Step 3: pick date range (start, end weeks).
4. Step 4: pick days of week + time-of-day blocks (e.g. Mon 16:00-19:00).
5. Step 5: lesson length (default 30, 45, 60).
6. Step 6: preview generated slots in a timeline. Toggles for "skip closures", "skip teacher time-off".
7. Confirm → bulk-creates lessons (status=scheduled, no participants). Used to publish "open slots" for parents to claim from booking page.
8. Output rows: `lessons` with `is_open_slot=true`, no `lesson_participants`.

### 7.10 iCal feed
Settings → Calendar tab generates a per-org iCal token via `generate_ical_token()`. Test: call `/functions/v1/calendar-ical-feed?token=XXX` → returns `text/calendar`. Validate ICS contains expected lessons.

### 7.11 Tests
1. View URL persistence — navigate to `/calendar?view=week&date=2026-06-01` → week view shows June 1 2026.
2. View toggle — switch to each of 4 views, asserting via `[aria-label="Time grid view"]` etc.
3. Filter persistence — set teacher filter, navigate away & back, filter persists in URL.
4. Today button.
5. Prev/Next navigation moves the visible date by 1 day / 1 week appropriately.
6. Drag lesson → conflict → confirmation dialog.
7. Resize lesson; assert end_at changed in DB.
8. Bulk select 3 lessons → cancel → confirm dialog → all 3 status=cancelled.
9. External event overlay shows when calendar_connections seeded.
10. Slot generator wizard creates N open slots; verify `lessons.is_open_slot=true` count matches.
11. Mobile: agenda view shows pull-to-refresh.

---

## 8. Lesson CRUD

**Modal:** `LessonModal.tsx`, body `lesson-form/LessonFormBody.tsx`. Hook: `useLessonForm`.

### 8.1 Create — fields
- `lessonType`: `private | group`.
- `teacherId` (required; filters student list to those assigned to this teacher).
- `selectedStudents` (StudentSelector with cmdk search; 1 for private, 1+ for group).
- `locationId` (optional).
- `roomId` (optional, filtered by location).
- `selectedDate` (Calendar popover).
- `startTime` (Radix Select; 07:00-20:45 in 15-min steps — see `DURATION_OPTIONS`/`TIME_OPTIONS`).
- `durationMins` (15, 30, 45, 60, 90, 120 default 30).
- `notesPrivate`, `notesShared`, `recapUrl`.
- `status` (default `scheduled`).
- `isOnlineLesson` toggle (only enabled if Zoom connection active).
- `isRecurring` toggle → reveals:
  - `recurrenceDays` (multi-select Mon-Sun).
  - `recurrenceEndDate`.

### 8.2 Conflict detection
- On any field change that affects time/teacher/location, `useConflictDetection` runs (debounced).
- States: `idle | checking | clear | conflict`.
- `ConflictAlerts` component renders the conflict list (other lessons that overlap, teacher time-off, closure dates).
- Save button disabled while `checking`, and disabled if `conflict` (unless override allowed for org).

### 8.3 Closure-date check
- `useClosurePatternCheck` warns if scheduling a recurring series that would land on closure dates. Banner: "X dates will be skipped due to closures."

### 8.4 Save flow
- `handleSaveClick` → if `isRecurring`, opens `RecurringEditDialog` first (only on edit, not on create).
- Calls Supabase `lessons` insert + `lesson_participants` insert + `recurrence_rules` insert if recurring.
- Triggers DB-side: `check_lesson_conflicts`, `validate_attendance_participant`, `prevent_past_open_slot`, `clear_open_slot_on_participant`.
- On success: closes modal, calendar refetches, toast `Lesson created`.
- Calls `calendar-sync-lesson` edge function async (Zoom/Google/Apple sync).

### 8.5 Edit flow
- Open existing lesson → modal pre-fills.
- If recurring (has `recurrence_rule_id`), save click → `RecurringEditDialog` asks: `This lesson only` / `This and following lessons` / `All lessons in series`.
- Each option has different behaviour:
  - This only → detach from series (set recurrence_rule_id=null), update single row.
  - This and following → split: end original series at this date, create new series from this date.
  - All → bulk update via `bulk_update_lessons` RPC (or `shift_recurring_lesson_times` for time changes).

### 8.6 Cancel flow
- Different from delete. `status='cancelled'` row stays for history.
- `cleanup_attendance_on_cancel` trigger removes any attendance records.
- `auto_issue_credit_on_absence` trigger may issue make-up credit if cancellation reason is `student`.
- For recurring: same dialog asking scope.

### 8.7 Delete flow
- Hard delete only allowed via `prevent_invoiced_lesson_delete` trigger — fails if any `invoice_items` reference this lesson.
- Toast: `Cannot delete: lesson is on an invoice. Void the invoice first.`

### 8.8 Tests
1. Create private lesson, no recurrence → row + participant inserted.
2. Create group lesson with 3 students → 3 participants.
3. Conflict: pre-seed a lesson at 14:00 with same teacher; try to create another at 14:00 → save disabled, conflict alert shown.
4. The "fallback time loop" pattern from existing `workflow-helpers.ts` already retries time slots — incorporate.
5. Edit single lesson — change duration, save.
6. Edit recurring — pick "all" → all instances updated.
7. Edit recurring — pick "this and following" — original series ends, new series starts.
8. Edit recurring — pick "this only" — detached lesson updated, rest of series unchanged.
9. Cancel single lesson → status=cancelled, attendance records gone.
10. Cancel student-side → make-up credit issued (check `make_up_credits` table).
11. Try to delete invoiced lesson → toast error, lesson row still present.
12. Create with closure date — banner shows N skipped dates.
13. Create with `isOnlineLesson=true` and Zoom connected → `zoom_meeting_mappings` row created.
14. Recurring weekly Mon+Wed+Fri until end date — verify count of `lessons` rows = expected (compute weekdays in range).

---

## 9. Daily register & batch attendance

### 9.1 Daily register (`/register`)
**Component:** `DailyRegister.tsx`. URL `?view=unmarked` for backlog mode.

Hook: `useRegisterData`.

UI:
- Date picker + prev/next day arrows.
- Teacher filter (defaults from localStorage `register_teacher_filter_${orgId}`; teachers see only their own with no toggle by default).
- For each lesson row (`RegisterRow.tsx`): student name, time, status buttons.
- Status buttons (per student): `Present`, `Absent`, `Late`, `Cxl (T)` (cancelled by teacher), `Cxl (S)` (cancelled by student).
- Absence reason picker if status=Absent: `sick`, `school_commitment`, `family_emergency`, `holiday`, `teacher_cancelled`, `weather_closure`, `no_show`, `other`.
- Notes popover per student (`StudentNotesPopover`).
- `Mark Day Complete` button — inserts a marker; disables further changes for finalised days.

### 9.2 Backlog view
- Lists every lesson > 1 day old without attendance.
- Same status buttons inline.

### 9.3 Tests
1. Mark `Present` on a row → DB `attendance_records` row inserted with status=`present`.
2. Mark `Absent` → reason picker required → submit → record + reason saved.
3. `Cxl (S)` → triggers `auto_issue_credit_on_absence` if org policy allows → `make_up_credits` row created.
4. Try to mark a future-date lesson → blocked by `check_attendance_not_future` trigger; toast.
5. Mark Day Complete → row inserted; further status buttons disabled.
6. Teacher-role: teacher filter is themselves only; can't see other teachers' rows.
7. Backlog view shows old unmarked lessons; marking from backlog updates and removes from list.
8. Pull-to-refresh on mobile.

### 9.4 Batch attendance (`/batch-attendance`)
**Component:** `BatchAttendance.tsx`. Hook: `useBatchAttendanceLessons` + `useSaveBatchAttendance`.

UI:
- Date picker.
- Lesson cards with all participants in a grid; per-student toggle group (Present/Absent/Late/CxlT/CxlS).
- Local `attendance` Map state; save button per lesson card.
- Optimistic save with `savedLessons` Set; ✓ flash, then fade.

### 9.5 Tests
1. Future date → save disabled (`isFutureDate` guard).
2. Mark all 5 students present → save → 5 attendance_records rows.
3. Save error path — service role mock to fail → `saveError=true`, toast.
4. Resume after partial save: half-saved students keep their status when re-loaded.

---

## 10. Students

### 10.1 List page (`/students`)
**Component:** `Students.tsx`. Hook: `useStudents`.

UI:
- Status filter pills (`StatusPills`): `All (N)`, `Active (N)`, `Inactive (N)` — based on `student_status` enum.
- Search input (filters by name/email/phone).
- Table columns: Name, Instrument · Grade, Email, Phone, Status, Guardians (count), [Admin actions].
- Table row click → `/students/:id`.
- `Add Student` button (data-tour="add-student-button").
- `Import` button → `/students/import`.
- `Export` button → CSV download (`useDataExport`).
- Bulk select → toggle status, archive.
- Plan limit gate (`useUsageCounts.studentsAtCap`) — disables Add Student when at cap.

### 10.2 Add Student wizard
3 steps:
1. **Student details**: `firstName` (`#wizard-firstName`), `lastName` (`#wizard-lastName`), DOB, email, phone, status, instrument selector (with grade).
2. **Guardian**: `add-guardian` toggle. `New | Link existing` radio. Fields: firstName, lastName, email, phone, relationship (mother/father/guardian/other), `isPrimaryPayer`. Multiple guardians supported (loop with "Add another" button).
3. **Teaching**: default location, default teacher, default rate card (only if rate cards exist). Lesson length default.

Submit → `students` insert + `guardians` insert + `student_guardians` join + maybe `student_instruments`.

Duplicate detection: if same name + DOB exists → `Possible duplicate?` dialog (existing helper handles `Continue anyway`).

`check_student_limit` trigger blocks insert if org over plan cap.

### 10.3 Detail page (`/students/:id`)
**Component:** `StudentDetail.tsx`. Hook: `useStudentDetailPage` (giant hook centralising state for all 10 tabs).

10 tabs, each `<TabsTrigger>`:
1. `overview` — `StudentInfoCard`. Inline edit (firstName, lastName, email, phone, dob, notes). Save → `students` update.
2. `instruments` — `InstrumentGradeSelector`. Add instrument → `student_instruments` row. Each entry: instrument, grade level, exam board, status (current/passed/preparing). Grade-change history shown.
3. `teachers` — `TeacherAssignmentsPanel`. Add/remove teacher assignment → `student_teacher_assignments` rows. Sets primary teacher.
4. `guardians` — `GuardiansCard`. Add new guardian or link existing. Per-guardian: invite to portal (`send-invite-email`), copy invite link, edit, remove (with cascade check).
5. `lessons` — past + upcoming lesson list, infinite scroll with "Load more". `Term Adjustment` button → `TermAdjustmentWizard`.
6. `practice` — `StudentPracticePanel`. Active assignments, log entries, weekly progress.
7. `invoices` — student-scoped invoices. `Payment plan preference` selector (default/always/never) — affects billing-run auto-split.
8. `credits` — `MakeUpCreditsPanel`. Available credits, redeemed, expired. Issue credit (admin only).
9. `notes` — `StudentLessonNotes`. Quick-note (`useStudentQuickNotes`). View previous lesson notes (private to teacher, shared with parent).
10. `messages` — `MessageList` scoped to this student/guardian thread. `ComposeMessageModal` button.

### 10.4 Term adjustment wizard (`TermAdjustmentWizard.tsx`)
For prorating mid-term changes (start/end/lesson-length change). Calls `process-term-adjustment` edge function. Generates adjustment row in `term_adjustments`.

### 10.5 Delete student
- `Trash2` icon in PageHeader (admin only).
- `DeleteValidationDialog` calls `useDeleteValidation` → checks for blockers (active lessons, unpaid invoices, active practice assignments).
- If blockers: shows list, prevents delete.
- If clear: confirm → `students` deleted (cascades to `student_guardians`, `student_instruments`, `student_teacher_assignments`, `lesson_participants`).
- `void_credits_on_student_delete` trigger voids any open credits.

### 10.6 Tests
1. List filter pills update counts.
2. Search filter narrows table.
3. Bulk archive 3 students → status=inactive on all, audit log entries created.
4. Add student via wizard, single guardian; verify rows in students, guardians, student_guardians, optional student_instruments.
5. Multiple guardians (primary + secondary).
6. Duplicate name+DOB → dialog, continue anyway → still inserted.
7. Plan cap reached → Add Student button disabled with tooltip.
8. Invite guardian to portal — `send-invite-email` invoked, `invites` row created with role=`parent`, copy-link reveals invite URL.
9. Remove guardian — cascade check: if last guardian, dialog warns about portal access loss.
10. Each tab loads without error boundary.
11. Term adjustment wizard creates adjustment row, generates new lessons.
12. Delete student with active lessons → blocked with reason list.
13. Delete student clean → cascade verified.

### 10.7 Import (`/students/import`)
**Component:** `StudentsImport.tsx`. CSV upload, mapping UI, dry-run preview, execute, undo.

- Upload CSV → backend `csv-import-mapping` returns suggested mappings.
- User can adjust (assign each header to a target field or skip).
- Special transforms: `split_name`, `combine_guardian_name`, `combine_guardian2_name`.
- Preview → run dry-run, show counts, errors per row.
- Execute → calls `csv-import-execute`, returns `studentsCreated`, `guardiansCreated`, `linksCreated`, `lessonsCreated`, `errors`, `importBatchId`.
- Undo button → calls `undo_student_import(_import_batch_id)` RPC; reverses all rows from that batch.

Tests:
1. Upload valid CSV with 5 rows → 5 students inserted.
2. Upload with 1 malformed row → preview shows error per row, valid rows still importable.
3. Skip duplicates option → existing emails skipped.
4. Undo last import → all rows from batch removed.
5. Mapping validation: missing required field (firstName) → cannot proceed.

---

## 11. Teachers

### 11.1 List page (`/teachers`)
**Component:** `Teachers.tsx`. Filter tabs: `all | linked | unlinked | inactive`.

`linked` = has `user_id` (account claimed via invite).
`unlinked` = no user_id (still placeholder).
`inactive` = status=inactive.

Per row: avatar with colour (deterministic from sorted index), display_name, email/phone, badges (Linked/Unlinked, Pay rate type), actions menu.

Actions:
- `Edit` → opens dialog with `teacherSchema` (zod).
- `Invite` → opens `InviteMemberDialog` for unlinked teachers (sends invite via `send-invite-email`).
- `Unlink` → removes user_id, demotes membership.
- `Archive` → `RemovalDialog` flow:
  - If teacher has upcoming lessons: choose `Reassign to other teacher` or `Cancel all upcoming lessons`.
  - Calls `bulk_update_lessons` (reassign) or `bulk_cancel_lessons` (cancel).
- `Restore` for inactive.

Stats: progress bar towards plan cap (`teachers/maxTeachers`).

### 11.2 Pending invites list (`PendingInvitesList.tsx`)
Shows unaccepted invites. Per row: email, role, expires, copy link, resend, revoke.

### 11.3 Form fields (`teacherSchema`)
- `display_name` (required)
- `email` (optional but recommended)
- `phone`
- `status` (active/inactive)
- `employment_type` (employee/contractor)
- `pay_rate_type` (per_lesson/hourly/percentage)
- `pay_rate_minor` (in pence/cents)
- `bio`, `qualifications` (text)
- Default location, default rate card

### 11.4 Tests
1. Add unlinked teacher → row in `teachers` only, no membership.
2. Invite teacher → invites row created.
3. Accept invite → `org_memberships` insert + teacher.user_id set + status changes to linked.
4. Remove (archive) with upcoming lessons → choice dialog → reassign → all lessons reassigned.
5. Same scenario, cancel option → all lessons status=cancelled.
6. Plan cap reached → Add Teacher disabled.
7. Filter tabs counts match DB.
8. Pay rate types render correctly per teacher.
9. `protect_teacher_user_link` trigger: try to manually update teacher.user_id → blocked.
10. Inactive teacher does not appear in calendar teacher dropdown.

---

## 12. Locations & rooms

### 12.1 Page (`/locations`)
**Component:** `Locations.tsx`. Filter tabs `all | school | studio | home | online`.

Per location: name, address, type, rooms count, primary star, archive icon.

Add location dialog: name, type, address (+ optional postcode), notes, primary toggle.

`set_primary_location()` RPC ensures only one primary at a time.

Each location has rooms (capacity, max_capacity, description). Add/edit/delete rooms inline.

Archive location: blocks if there are upcoming lessons referencing it.

### 12.2 Tests
1. Add school location.
2. Mark as primary — previous primary auto-unchecked (RPC).
3. Add 2 rooms.
4. Edit room capacity.
5. Delete room with upcoming lesson scheduled in it → blocked.
6. Archive location with no lessons → succeeds.
7. Archive location with lessons → dialog with cascade options.
8. Online type — special rendering (no address).

---

## 13. Invoices

### 13.1 Page (`/invoices`)
**Component:** `Invoices.tsx`. Hook: `useInvoices`, `useInvoiceStats`. Realtime: `useRealtimeInvoices`.

Tabs (URL `?tab=`):
- `invoices` (default)
- `payment-plans`
- `recurring`
- `history` (billing run history)

URL state: `?status=draft|sent|paid|overdue|void`, `?due=past`, `?tab=...`.

### 13.2 Filters bar
`InvoiceFiltersBar.tsx`: status, date range (issue date, due date), payer, amount range, sort.

### 13.3 Invoice list (`InvoiceList.tsx`)
Columns: select, invoice #, payer name, total, due, status badge, actions menu.

Bulk actions bar (`BulkActionsBar.tsx`): Send (drafts only — `handleBulkSend` chunks of 5, calls `send-invoice-email` per invoice; failed-id retention), Void (`void_invoice` RPC), Download PDFs (zip).

### 13.4 Stats widget
`InvoiceStatsWidget.tsx`: total, draft, sent, paid, overdue, void counts; total outstanding amount.

### 13.5 Create invoice modal (`CreateInvoiceModal.tsx`)
Tabs:
1. **Manual Entry** — payer (guardian or student), line items (description, qty, unit price), discount, VAT toggle, due date, notes.
2. **From Lessons** — select unbilled lessons (`useUnbilledLessons`) → auto-generates line items based on rate cards (`findRateForDuration`).
3. **Group Lessons** — auto-splits group lesson cost across participants.

Payment plan toggle → if enabled, opens installment editor (`generate_installments` RPC). User picks frequency (weekly/biweekly/monthly), number of installments. Preview shows schedule.

Available credits banner — `useAvailableCreditsForPayer` shows applicable credits to pre-apply.

Submit → `create_invoice_with_items` RPC. On success, modal closes, list refetches.

### 13.6 Billing run wizard (`BillingRunWizard.tsx`)
4 steps:
1. **Type** — `monthly | term | custom`.
2. **Date range** — start/end dates. Term mode picks from `terms` table.
3. **Payers** — multi-select; `Use student payment_plan_preference` toggle to honour per-student override.
4. **Preview** — list of invoices to create, totals per payer, with "skip" toggles.
5. **Confirm** — calls `create-billing-run` edge fn → creates `billing_runs` row + N `invoices` (status=draft).

Retry failed: `useRetryBillingRunPayers` + `retry_failed_recipients` RPC for partial runs.

### 13.7 Tests
1. List loads, statusCounts equals DB.
2. Filter by `status=overdue` updates URL and list.
3. Tab switch persists in URL.
4. Bulk send 3 drafts → `send-invoice-email` called 3 times → all 3 status=sent → toast `3 invoices sent`.
5. Bulk void with `void_invoice` RPC → status=void; if any partially_paid → installments also voided (per code comment in J3-F14b).
6. Create invoice (manual): line items inserted, total calculated, VAT applied if org.vat_enabled.
7. Create invoice (from lessons) — pre-selected lessons get line items.
8. Create invoice with payment plan — installments rows created via `generate_installments`.
9. Apply credit during create — credit row marked `applied`, line item discount added.
10. Billing run (monthly): for 5 students → 5 invoices created in draft.
11. Billing run for student with `payment_plan_preference='always'` → invoice has installments.
12. Retry failed billing run — only previously failed payers retried.

---

## 14. Invoice detail (`/invoices/:id`)

**Component:** `InvoiceDetail.tsx`. Hook: `useInvoice`. Modals: Edit, Send, RecordPayment, Refund, PaymentPlan, ReminderModal, Void confirm.

### 14.1 Header
Status badge (with `Overdue` if past due_date and status=sent), invoice number, payer, dates.

### 14.2 Top actions (state-dependent)
Visible based on status and role:
- `Edit` (draft only, admin)
- `Send` (draft only)
- `Send Reminder` (sent or overdue)
- `Record Payment` (not paid, not void)
- `Refund` (paid with manual or stripe payment, admin)
- `Void` (not paid, not void)
- `Setup Payment Plan` (sent, no installments)
- `Pay Now` (parent role, status=sent or overdue) — opens `PaymentDrawer` with embedded Stripe.
- `Download PDF` — `useInvoicePdf` calls `generate-invoice-pdf`. Cached PDF re-used unless `pdf_rev` bumped.

### 14.3 Body
- Items table with description, qty, unit price, line total.
- Subtotal, discount, VAT, total.
- Payment list — each `payments` row with method/provider, amount, date, reference. Refunded payments show refund link.
- Installment timeline (`InstallmentTimeline.tsx`) if `invoice_installments` exist — visual schedule with paid/due/overdue status per installment.
- Recalc-failure banner (`RecalcFailureBanner`) — if `_spotcheck_log` has recent failed `recalculate_invoice_paid` for this invoice.
- Dispute banner (`DisputeBanner`) — if active dispute (`payment_disputes`).

### 14.4 Send invoice modal (`SendInvoiceModal.tsx`)
2 steps:
1. Compose: recipient (multi if multiple guardians), CC, subject (templated), body (templated), include PDF toggle.
2. Preview: rendered email with PDF attachment.

Submit → `send-invoice-email`. On success, status flips to `sent` (if was draft).

### 14.5 Record payment modal
Fields: amount (default = remaining due), method (card/bank_transfer/cash/other), provider (manual/stripe), date, reference, notes. Allocate to installment optional.

Submit → `record_manual_payment` RPC + `recalculate_invoice_paid` RPC. Status → paid if total covered.

### 14.6 Refund dialog (`RefundDialog.tsx`)
Per payment: amount (≤ payment amount minus already refunded), reason. If Stripe payment → calls `stripe-process-refund`; if manual → `record_manual_refund`. Inserts `refunds` row.

`validate_refund_amount` trigger ensures non-negative, ≤ original.

### 14.7 Payment plan setup (`PaymentPlanSetup.tsx`)
Picks frequency, installment count. Calls `generate_installments`. Auto-switches to "split" mode.

### 14.8 Cancel/edit payment plan
- `cancel_payment_plan` RPC (admin only) — voids unpaid installments, reverts to standard invoice.
- `update_payment_plan` RPC for editing existing schedule.

### 14.9 Dispute lifecycle
Stripe webhook → `payment_disputes` row inserted with status `needs_response`. Banner appears with deadline. Admin can:
- Submit evidence (manual via Stripe dashboard).
- Mark as `won` (no action) or `lost` (`apply_lost_dispute_cascade` → marks payment refunded, updates invoice status, may issue credit).

### 14.10 Tests
1. Status badge shows `Overdue` correctly.
2. Send modal: 2 guardians both selected by default; preview renders.
3. After send → status=sent, log row in `message_log`.
4. Send reminder → second log row, no status change.
5. Record manual payment full amount → status=paid.
6. Record partial payment → status stays sent, payments aggregate.
7. Refund manual payment partial → original payment shows partial refund.
8. Refund Stripe payment full → calls `stripe-process-refund`, payment marked refunded.
9. Setup plan post-send → `invoice_installments` rows created.
10. Pay an installment via parent portal → `record_installment_payment` → that installment marked paid; `recalculate_installment_status` recalcs.
11. Void from detail → status=void, `enforce_invoice_status_transition` permits draft→void / sent→void.
12. Try void from paid → blocked.
13. Try edit from sent → blocked (admin tools restricted).
14. PDF download — first call generates, second uses cache, modify line item → `bump_invoice_pdf_rev_*` trigger increments rev → next download regenerates.
15. Dispute banner displays after seeded dispute row.
16. `apply_lost_dispute_cascade` cascades correctly.

---

## 15. Reports

### 15.1 `/reports` overview
**Component:** `Reports.tsx`. Hub page linking to each report. Each card shows title, description, role gate.

### 15.2 Per-report

| Path | Component | Allowed roles | Key data |
|---|---|---|---|
| `/reports/payroll` | `Payroll.tsx` | owner, admin, teacher, finance | `usePayroll` — per-teacher hours + pay this period |
| `/reports/revenue` | `Revenue.tsx` | owner, admin, finance | `useReports.useRevenueReport` (calls `get_revenue_report` RPC) — monthly buckets, by location, by teacher |
| `/reports/outstanding` | `Outstanding.tsx` | owner, admin, finance | aged debtor list, 0-30/31-60/61-90/90+ buckets |
| `/reports/lessons` | `LessonsDelivered.tsx` | owner, admin, teacher | lessons delivered count by teacher/date range, status breakdown |
| `/reports/cancellations` | `Cancellations.tsx` | owner, admin | cancellation reasons distribution |
| `/reports/attendance` | `AttendanceReport.tsx` | owner, admin, teacher | attendance % per student, late count |
| `/reports/utilisation` | `Utilisation.tsx` | owner, admin | room utilisation % per location |
| `/reports/teacher-performance` | `TeacherPerformance.tsx` | owner, admin | per-teacher KPIs (lessons taught, attendance %, avg engagement rating, retention) |

### 15.3 Common controls
- Date range picker.
- Filters (teacher, location, student where relevant).
- View toggles (table/chart).
- CSV export button (`useDataExport`).
- Print/PDF for some.

### 15.4 Tests (per report)
1. Renders without error.
2. Date range change updates data.
3. Filter changes update data.
4. CSV export downloads file matching data on screen.
5. Empty state when no data in range.
6. Role gate honoured.
7. Data correctness: seed known set, verify totals.

---

## 16. Messages

### 16.1 Page (`/messages`)
**Component:** `Messages.tsx`. View toggle: `List` vs `Threads` (`ToggleGroup`). Tabs: `Sent`, `Internal` (org members), `Requests` (parent-staff requests pending approval).

### 16.2 Filters (`MessageFiltersBar.tsx`)
- Date range, recipient, type (sms/email/internal), status, search.

### 16.3 Compose modals
- `ComposeMessageModal` — single recipient, with template loader. Submit → `send-message` or `send-bulk-message`.
- `BulkComposeModal` — multi-recipient (filter by student status, instrument, location, etc.). Insert merge tokens (`{first_name}`, `{guardian_name}`, etc). Preview before send. Calls `send-bulk-message` → batches recipients.
- `InternalComposeModal` — pick org members → `internal_messages` row.

### 16.4 Threads view (`ThreadedMessageList.tsx`)
Groups messages by guardian/student conversation; replies accumulate in threads. Reply inline.

### 16.5 Internal (`InternalMessageList.tsx`)
Org member-to-member messaging. Read state tracked per-user.

### 16.6 Message requests (`MessageRequestsList.tsx`)
When parent sends a non-direct enquiry (e.g. about a different student or after-hours), it lands as a `message_requests` row needing admin approval. Approve → routed to teacher; Decline → notifies parent.

### 16.7 Tests
1. Compose → sends email; `message_log` row inserted; toast.
2. Bulk compose to all parents of active students with instrument=piano → matches expected count.
3. Merge tokens render per recipient.
4. Internal compose to teacher → `internal_messages` row, recipient sees badge + can read.
5. Reply on thread → reply persisted, thread re-sorts by latest.
6. Parent submits request → admin sees in Requests tab, approve → message routed.
7. Templates load from `message_templates` per org.
8. Pending requests count = `usePendingRequestsCount`; sidebar badge updates.
9. Unread internal count = `useUnreadInternalCount`; sidebar badge.
10. Read-tracking: opening a thread triggers `mark-messages-read` edge function for that thread.

---

## 17. Practice

### 17.1 Page (`/practice`)
**Component:** `Practice.tsx`.

UI:
- Stats: active assignments, unreviewed logs, students with progress this week.
- `Teacher Practice Review` (left/main section) — list of assignments grouped by student, with quick-review buttons.
- `New Assignment` button → `CreateAssignmentModal`.
- Click assignment → `AssignmentDetailDialog` → list of `practice_logs` for it; teacher can leave feedback.

### 17.2 Create assignment
Fields: student(s), title, description, due date, target minutes per week, instrument, attached resources.

Insert → `practice_assignments` row.

### 17.3 Practice log (parent-side)
Parent on `/portal/practice` enters duration + notes per day → `practice_logs` row. `update_practice_streak` trigger updates `practice_streaks`.

### 17.4 Streaks
`practice_streaks` per (student, instrument). `_notify_streak_milestone` notifies on 3-day, 7-day, 30-day milestones via `streak-notification` edge fn. `reset_stale_streaks` cron.

### 17.5 Tests
1. Create assignment → row inserted, parent sees on portal.
2. Parent logs 30 min → log row + streak updated.
3. Teacher reviews log → `reviewed_at` set, parent sees green check.
4. Streak milestone (3 days) → push notification + record.
5. Stale streak (no log >2 days) reset by cron.
6. Complete-on-due-date: `complete_expired_assignments` cron sets status=completed.
7. Weekly progress widget shows correct percent vs target minutes.

---

## 18. Resources

### 18.1 Page (`/resources`)
**Component:** `Resources.tsx`.

UI:
- `Upload` button → `UploadResourceModal` (file or link).
- `Manage Categories` button → `ManageCategoriesModal`.
- Search, file-type filter, shared-only toggle, sort newest/oldest.
- Grid or list view (toggle persisted in localStorage).
- Per resource card: name, type badge, shared-with summary, share button, delete.

### 18.2 Upload
Fields: file (multipart) or URL, name, description, category. File goes to Supabase Storage `resources/{org_id}/{uuid}/{filename}`.

`resources` row inserted. `resource_category_assignments` if category.

### 18.3 Share
`ShareResourceModal` — pick students, guardians, or teachers. Inserts `resource_shares` rows.

`cleanup_resource_shares_on_student_archive` trigger removes shares when student archived. `cleanup_orphaned_resources` cron.

### 18.4 Parent view
`/portal/resources` lists shared-with-me resources. Download or view.

### 18.5 Tests
1. Upload PDF (mock file) → row + storage object.
2. Share with 2 students → 2 shares.
3. Parent of one student sees the resource on portal.
4. Parent of unrelated student does not (RLS).
5. Archive student → shares removed.
6. Delete resource → blocked if pinned to active assignment.
7. Category create + assign + filter.

---

## 19. Make-ups, waitlist, leads, enrolment

### 19.1 Make-up dashboard (`/make-ups`)
**Component:** `MakeUpDashboard.tsx`. Hook: `useWaitlist`, `useWaitlistStats`.

Sections:
- `MakeUpStatsCards` — counts by status.
- `NeedsActionSection` — entries with status `matched` or `accepted` (waiting for admin to confirm).
- `WaitlistTable` — full list. Filters: status (waiting/matched/offered/accepted/declined/booked/expired), teacher.

### 19.2 Add to waitlist
`AddToWaitlistDialog` — pick student, instrument, preferred days/times, notes. Optionally link to a `make_up_credits` row (must own credit).

`validate_waitlist_credit_ownership` trigger.

### 19.3 Match flow
Open slot created → `auto_add_to_waitlist` trigger queries waitlist for matches → inserts records. Admin sees in NeedsAction.

Admin offers slot → `offer_makeup_slot` RPC → status=offered → `notify-makeup-offer` edge fn emails parent.

Parent accepts via email link `/portal/home?makeup_action=accept&id=X` → `respond_to_makeup_offer` RPC → status=accepted.

Admin confirms booking → `confirm_makeup_booking` RPC → creates lesson, status=booked. `make_up_credits.used_at` set.

### 19.4 Cancel booked make-up
`cancel_booked_makeup` RPC — releases the slot back, voids the lesson, returns credit to "available" status if not expired.

### 19.5 Credit expiry
`credit_expiry` cron (daily) — voids credits past `expires_at`. `credit-expiry-warning` cron — emails parents 7 days before expiry.

### 19.6 Tests
1. Add waitlist entry. Verify `enrolment_waitlist_activity` (audit) and `make_up_waitlist` row.
2. Auto-match: create open slot for matching teacher/instrument → entry status=matched.
3. Offer → email sent → record offer_at/expires_at.
4. Parent accept via URL param → status=accepted, dashboard updates.
5. Admin confirm → lesson created, credit consumed.
6. Parent decline → status=declined, slot remains open.
7. Cancel booked make-up → lesson void, slot reopens, credit may return.
8. Expired credit → `credit_expiry` removes; warning sent at -7d.

### 19.7 Leads (`/leads`)
**Component:** `Leads.tsx`. Hook: `useLeads`, `useLeadStageCounts`. View toggle: kanban / list.

Stages: `enquiry → contacted → trial_booked → trial_completed → enrolled → lost`.
Sources: `manual, booking_page, widget, referral, website, phone, walk_in, other`.

Kanban: columns per stage. Drag a card → update stage.

CreateLeadModal: name, email, phone, source, instrument(s), notes, multiple children supported (`lead_students`).

LeadDetail (`/leads/:id`): activity timeline (`lead_activities`), follow-up scheduling (`lead_follow_ups`), convert button (calls `convert_lead` RPC → creates Student + Guardian + sets status=enrolled).

LeadFunnelChart: conversion %.

### 19.8 Tests
1. Create lead → kanban card in `enquiry`.
2. Drag to `contacted` → DB stage updated, activity logged.
3. Add follow-up reminder → due notification sent.
4. Convert lead to student → `students` and `guardians` and `student_guardians` rows; lead.stage=enrolled.
5. Mark lost with reason → row preserved for analytics.
6. Funnel chart percentages match expected.
7. Filter by source.
8. CSV export (`exportLeadsToCSV`).
9. FeatureGate: leads is gated to certain plans — verify locked-screen for trial/lower plans.

### 19.9 Enrolment waitlist (`/waitlist`)
**Component:** `EnrolmentWaitlistPage.tsx`. Distinct from make-up waitlist; for prospective students who can't enrol immediately.

Statuses: `waiting | offered | accepted | declined | enrolled | withdrawn | expired`.

UI: stats cards, table with filters, AddToWaitlistDialog, OfferSlotDialog, WaitlistEntryDetail panel.

Flow:
1. Add → `add_to_enrolment_waitlist` RPC.
2. Offer → `OfferSlotDialog` picks teacher/instrument/slot → `send-enrolment-offer` edge fn → status=offered.
3. Parent responds via email link → `respond_to_enrolment_offer` RPC.
4. Convert → `convert_waitlist_to_student` RPC.
5. Withdraw → `withdraw_from_enrolment_waitlist` RPC.
6. Expiry: `enrolment-offer-expiry` cron + `waitlist-expiry` cron.

### 19.10 Tests
1. Add entry. Send offer. Parent accepts. Admin converts → student row.
2. Parent declines. Status=declined, expiry tracked.
3. Auto-expire after `make_up_waitlist_expiry_weeks` from org settings.

---

## 20. Continuation

**Component:** `Continuation.tsx`. Hook: `useTermContinuation`.

Workflow:
1. Owner creates a continuation run (`ContinuationRunWizard`): pick term, picks students, set deadline, customise message.
2. `create-continuation-run` edge fn creates `term_continuation_runs` + N `term_continuation_responses` rows + emails parents.
3. Parent receives email → click → goes to `/respond/continuation?token=X` (public) or `/portal/continuation` (authed).
4. Parent picks: continue / pause / withdraw / change details. Calls `continuation-respond` edge fn (public token-based) or `continuation_run_org_id` RPC (authed).
5. Admin can: send reminder (`useSendContinuationReminders`), process deadline (auto-mark non-respondents per default policy), bulk process (`bulk-process-continuation` edge fn), preview, delete run (`useDeleteContinuationRun`).
6. After processing, admin clicks `Materialise Lessons` → `materialise_continuation_lessons` RPC creates real lessons in calendar for the continuing students.

### 20.1 Tests
1. Create run with 10 students → 10 response rows.
2. Reminder cron / button sends reminder emails.
3. Parent responds via authed portal → response row updated.
4. Parent responds via unauthed token URL → response row updated, parent message sent.
5. Process deadline → non-respondents marked per default.
6. Bulk preview → list of changes and totals.
7. Materialise → `lessons` rows created for continuing students.
8. Delete run with no responses yet → succeeds.
9. Delete run with responses → blocks or warns.

---

## 21. LoopAssist

**Drawer:** `LoopAssistDrawer.tsx`. Context: `LoopAssistContext.tsx`. Hooks: `useLoopAssist`, `useProactiveAlerts`, `useLoopAssistFirstRun`, `useLoopAssistIntro`.

### 21.1 Open
- Click bell sparkle button in `Header.tsx` (only for owner/admin/teacher).
- Keyboard `Space` (when no input focused) or `Cmd+J`.

### 21.2 Views
- `landing` — proactive welcome + alerts + history shortcut + new conversation CTA.
- `chat` — current conversation thread; streaming responses; tool status; action proposals.
- `history` — list of past conversations from `ai_conversations`; click to load.

### 21.3 Page-context auto-detect (from `LoopAssistContext.tsx`)
- `/calendar*` → `{ type: 'calendar' }`
- `/students/:id` → `{ type: 'student', id }`
- `/students` → `{ type: 'student' }`
- `/invoices/:id` → `{ type: 'invoice', id }`
- `/invoices` → `{ type: 'invoice' }`
- else → `{ type: 'general' }`

This `pageContext` is sent to `looopassist-chat` edge fn so the model has scoped data.

### 21.4 Send message
- `useLoopAssist.sendMessage(content, pageContext)` → POST to `looopassist-chat`.
- Server applies rate limit (`checkRateLimit` and `checkLoopAssistDailyCap`).
- Stream response. UI shows token-by-token.
- Tool calls show `toolStatus` (`Searching invoices...`, `Found 3 students...`).
- Cancel via `Square` button → aborts stream.

### 21.5 Action proposals
When the model proposes an action (e.g. "create invoice for John for £45"), an `ai_action_proposals` row is created with payload. UI shows `ActionCard` with Accept/Reject. Accept → calls `looopassist-execute` edge fn which performs the action atomically.

### 21.6 Entity chips
Markdown response can contain `<span data-entity-type="student" data-entity-id="...">Name</span>` — rendered as clickable chip via `EntityChip.tsx`. Click → navigates to entity.

### 21.7 Result cards
For some queries the response includes a structured `[result:...]` block which `parseResultFromResponse` extracts into a `ResultCard` (e.g. tabular data preview).

### 21.8 First-run / intro
- `LoopAssistIntroModal` — shown on first ever open per user (tracked in `hint_completions` or localStorage).
- `useLoopAssistFirstRun.proactiveMessage` — for fresh accounts, surfaces a starter prompt.

### 21.9 Tests
1. Open via keyboard `Space` + `Cmd+J`.
2. Send message → streaming response renders incrementally.
3. Cancel mid-stream → request aborted, partial text retained.
4. Page context: visit `/students/<id>`, open LoopAssist → context shown as a chip "On student: John Smith".
5. Action proposal flow — model proposes, user accepts → action executed, list refetches in main app.
6. Reject proposal → row marked rejected, no change.
7. Conversation history persists; load old conversation, messages rehydrate.
8. Delete conversation → confirm dialog, removed from list.
9. Rate limit hit (mock daily cap) → toast + lock send button.
10. Parent variant — test with parent role hitting `parent-loopassist-chat` (different guardrails).
11. Entity chip click navigates correctly.
12. Result card renders tabular preview.

---

## 22. Settings — all 24 tabs

Tab map (URL `/settings?tab=...`):

| Tab | Component | Roles | Notes |
|---|---|---|---|
| `profile` | `ProfileTab` | all | name, email change, avatar upload, password change, MFA setup |
| `organisation` | `OrganisationTab` | admin | name, type, country, currency, timezone, VAT settings, schedule hours, parent reschedule policy, default lesson length, cancellation notice hours |
| `branding` | `BrandingTab` | admin | logo, colours |
| `members` | `OrgMembersTab` | admin | invite, role change, disable, owner-protect (via `protect_owner_role` trigger) |
| `scheduling` | `SchedulingSettingsTab` | admin | closure dates, buffer minutes, schedule_start_hour/end_hour |
| `audit` | `AuditLogTab` | admin | filter by entity_type, action, date, actor; pagination |
| `privacy` | `PrivacyTab` | admin | GDPR export, delete account |
| `rate-cards` | `RateCardsTab` | admin | per-instrument/duration pricing |
| `music` | `MusicSettingsTab` | admin | default exam board, instruments enabled |
| `messaging` | `MessagingSettingsTab` | admin | from name, signature, templates |
| `availability` | `TeacherAvailabilityTab` | admin/teacher | weekly availability template + ad-hoc blocks + time-off |
| `calendar` | `CalendarIntegrationsTab` | admin/teacher | Google/Apple OAuth (start/callback/disconnect/refresh), iCal feed |
| `zoom` | `ZoomIntegrationTab` | admin | OAuth, revoke, default settings |
| `billing` | `BillingTab` + `InvoiceSettingsTab` | owner/admin/finance | plan upgrade (`stripe-subscription-checkout`), customer portal (`stripe-customer-portal`), saved payment methods, invoice number format, footer notes |
| `booking-page` | `BookingPageTab` | admin | slug, instruments, teachers, advance days, embed code |
| `data-import` | `DataImportTab` | admin | CSV import, Stripe Connect, accounting integrations |
| `loopassist` | `LoopAssistPreferencesTab` | admin | tone, allowed tools, daily caps |
| `notifications` | `NotificationsTab` | all | email/push toggles, per-event |
| `help-tours` | `HelpToursTab` | admin | reset tour state |
| `continuation` | `ContinuationSettingsTab` | admin | default response policy, deadline lead-time |
| `accounting` | `AccountingTab` | admin | Xero connect/disconnect, sync invoice, entity mappings |
| (recurring billing) | nested route `/settings/recurring-billing/...` | admin/finance | template detail page, run detail page |

### 22.1 Profile tab tests
1. Update full name → `profiles.full_name` updated, header avatar refreshes.
2. Change email → triggers email re-verification flow (Supabase auth update; new email needs confirmation).
3. Upload avatar (file input) → stored, displays in sidebar avatar.
4. Change password → re-auth with old password, then update; signs other devices out (because `signOut({ scope: 'global' })`).
5. Phone update.
6. Optional: notification preferences inline.

### 22.2 Organisation tab tests
- Editable: name, country (`country_code`), currency (`currency_code`), timezone, default lesson length, cancellation notice hours, schedule_start_hour, schedule_end_hour, parent_reschedule_policy (`self_service | request_only | admin_locked`), buffer_minutes_between_locations, block_scheduling_on_closures, vat_enabled, vat_rate, vat_registration_number, overdue_reminder_days (array), auto_pause_lessons_after_days, max_credits_per_term, credit_expiry_days, teacher_payment_notifications_enabled, teacher_payment_analytics_enabled.
- `validate_org_timezone_currency` trigger blocks invalid combos.
- `validate_schedule_hours` trigger ensures end > start.
- `trg_auto_transition_solo_to_studio` trigger: changing `org_type` from `solo_teacher` to `studio` adjusts settings accordingly.
- `prevent_org_id_change` trigger guards immutability.
- `protect_subscription_fields` trigger: subscription_plan/status not editable except via Stripe webhook.

Tests:
1. Update timezone → live in DB, calendar pages start using new TZ on next render.
2. VAT toggle on → invoices show VAT lines; off → don't.
3. Bad timezone string → trigger error toast.
4. Change org_type from solo to studio → solo-only sidebar items disappear, studio sidebar appears.
5. Try to manually update `subscription_plan` via UI → blocked.
6. parent_reschedule_policy=`admin_locked` → parent portal hides reschedule button.

### 22.3 Branding tab
1. Upload logo → `organisations.logo_url` set; appears on invoice PDFs and parent portal.
2. Set brand colour → applied to invoice PDF.

### 22.4 Members tab tests
1. Invite by email + role → `invites` row + `send-invite-email` called.
2. Pending invites list shows; resend, revoke.
3. Accepted invite shows in members table.
4. Change member role → `org_memberships.role` updated, audit logged.
5. Disable member → status=disabled; member can't access org.
6. Try to remove the owner → blocked (`protect_owner_role`).
7. Owner can transfer ownership (if implemented; `block_owner_insert` trigger means they have to be careful).

### 22.5 Scheduling settings
- Closure dates list (CRUD) — `closure_dates` table.
- Buffer minutes between locations — affects conflict detection across locations.
- Schedule hours.

Tests:
1. Add closure date → calendar grid shows greyed-out, lessons during closure flagged.
2. Set buffer 30min → creating lesson at location A then trying lesson at location B 15 min later → conflict.

### 22.6 Audit log tab
**Component:** `AuditLogTab.tsx`. Hook: `useAuditLog`.
- Filters: entity_type (student, lesson, invoice, etc.), action (Created, Updated, Deleted), actor, date range.
- Each row shows actor, action, entity, entity name, before/after diff (where applicable).
- Pagination.

Existing helper `expectAuditEntry(page, { action, entity })` used in workflow tests — reuse it.

Tests:
1. Create a student → audit row appears with action=Created.
2. Update a student → action=Updated with field-level diff.
3. Delete a student → action=Deleted.
4. Filter by entity_type=student → only student rows.
5. Pagination across >50 rows.

### 22.7 Privacy tab
- GDPR export button → `gdpr-export` edge fn → emails the org owner a ZIP of all their data.
- GDPR delete (org-level) → `gdpr-delete` edge fn — destructive, two-step confirm.
- Per-user account-delete via `account-delete` edge fn.

Tests:
1. Click Export → toast `Export queued`. Job row in `_spotcheck_log` (or similar). Email received.
2. Account delete confirm → user signed out, profile + memberships removed, `anonymise_*` triggers run on linked entities.

### 22.8 Rate cards tab
- Add rate card: name, instrument, durations array (each with price). Currency = org currency.
- Edit, archive.
- Used by lessons + invoices to determine line-item prices.

### 22.9 Music settings tab
- Default exam board (FK to `exam_boards`).
- Enable/disable instruments per org from `instruments` master list.

### 22.10 Messaging settings tab
- From name (defaults to org name).
- Signature (markdown).
- Templates: per category (invoice send/reminder, lesson reminder, makeup offer, etc.). CRUD on `message_templates`.

### 22.11 Availability tab (`TeacherAvailabilityTab`)
For each teacher (admin can switch via dropdown — see `AvailabilityTabWithSelector` wrapper):
- Weekly template editor (day-of-week × time blocks). Inserts `availability_templates` rows.
- Specific date blocks (`availability_blocks`) — exceptions.
- Time-off (`time_off_blocks`) — full-day blocks.

`check_availability_overlap` trigger blocks overlapping blocks.

Tests:
1. Set Mon 9-12 + 14-17. Save. Block calendar slots accordingly.
2. Add ad-hoc block 2 weeks from now 8-9.
3. Add time-off range. Calendar greyed out for those dates.
4. Overlapping block → trigger error.
5. Admin views another teacher's availability via dropdown.

### 22.12 Calendar integrations tab
- Per-provider (Google, Apple, Zoom): connect button → `calendar-oauth-start` → redirects to provider → returns to `calendar-oauth-callback`.
- Connection status: active/error/disconnected. Last sync time.
- Refresh button → `calendar-refresh-busy` (re-pulls busy blocks).
- Disconnect → `calendar-disconnect` edge fn.
- iCal feed: copy URL with token. Test the URL returns valid ICS via `calendar-ical-feed`.
- iCal expiry warning — `ical-expiry-reminder` cron emails when token expiry near.

Tests:
1. Connect Google (mock OAuth) → row in `calendar_connections` with sync_status=active.
2. After connection, busy blocks appear on calendar.
3. Refresh → recent fetch logged.
4. Disconnect → row removed, busy blocks gone.
5. iCal copy → fetch URL → valid ICS payload with VEVENTS for upcoming lessons.

### 22.13 Zoom integration tab
- OAuth flow same shape; `auth/zoom/callback` page completes.
- After connection, lesson modal `Online lesson` toggle becomes interactive; on save, creates Zoom meeting via API and stores in `zoom_meeting_mappings`.
- Revoke → unhooks org, future online lessons become unavailable until reconnected.

### 22.14 Billing tab
- Current plan card with usage (students/teachers vs caps).
- Upgrade button → `stripe-subscription-checkout` → redirects to Stripe checkout.
- Manage subscription → `stripe-customer-portal` → redirects to Stripe portal.
- Saved payment methods (`useSavedPaymentMethods`): list, set default, detach (`stripe-detach-payment-method`).
- Auto-pay preferences (org-level): toggle `Default to auto-pay for new payment plans`.
- `InvoiceSettingsTab` (rendered after `BillingTab`): invoice number prefix/sequence, late-fee policy, default due-date offset, footer notes.

Tests:
1. Click Upgrade — mock Stripe checkout → returns → webhook fires → plan upgraded.
2. Manage portal — redirect with valid session URL.
3. Add payment method via Stripe → reflected in list.
4. Detach payment method.
5. Invoice number format change → next invoice uses new format. Confirm via `invoice_number_sequences` row + `set_invoice_number` trigger.

### 22.15 Booking page tab
- Toggle `enabled`.
- Slug (must be unique within org).
- Heading, description, accent colour, logo override.
- Pick teachers (multi).
- Pick instruments (multi).
- Slot config: min advance hours, max advance days, lesson lengths offered.
- Confirmation message.
- Embed code snippet.
- Preview link → `/book/<slug>`.

Tests:
1. Configure → save → `booking_pages` row + `booking_page_teachers`/`booking_page_instruments` rows.
2. Public visit `/book/<slug>` shows it.
3. Slug collision → error.
4. Disable → public page returns 404.
5. Embed iframe URL `?embed=true` strips chrome.

### 22.16 Data import tab
- CSV import wizard (re-run-able; same as onboarding migration).
- Stripe Connect onboard (`stripe-connect-onboard`) — for studios to take payments to their own account. Status via `stripe-connect-status`.
- Xero/QuickBooks connect (only Xero in current code: `xero-oauth-start`, `xero-oauth-callback`, `xero-disconnect`, `xero-sync-invoice`, `xero_entity_mappings`).
- Backfill default payment method for guardians: `admin-backfill-default-pm` edge fn.

### 22.17 LoopAssist preferences tab
- Daily message cap.
- Tone (concise/detailed).
- Allowed tools (per category toggle).
- Reset onboarding intro.

### 22.18 Notifications tab
- Per-event toggles (email, push). Persisted in `notification_preferences`.
- Preview each notification.

### 22.19 Help tours tab
- List of tours with completion state.
- "Reset all tours" → clears `hint_completions` for current user.
- Per-tour start button.

### 22.20 Continuation settings tab
- Default response policy (continue/pause/manual).
- Deadline lead time (e.g. 14 days before term end).
- Default email template.

### 22.21 Accounting tab
- Xero connect button → `xero-oauth-start`.
- Sync invoice button per invoice → `xero-sync-invoice`.
- Entity mappings: org members ↔ Xero contacts (`xero_entity_mappings`).
- Disconnect.

### 22.22 Recurring billing pages
- `/settings/recurring-billing/:templateId` — `RecurringTemplateDetail.tsx`. Edit template (frequency, term-mode delivered/upfront/hybrid, items, recipients). Run-now button → `useRunRecurringTemplate` → fires `recurring-billing-scheduler` edge fn for that template.
- `/settings/recurring-billing/runs/:runId` — `RecurringRunDetail.tsx`. Per-run outcome: completed/partial/failed/cancelled/running. List of generated invoices with status. Retry failed recipients button. Cancel run button (`cancel_template_run` RPC).

Tests:
1. Create template (in `RecurringBillingTab` → embedded in Invoices recurring tab too).
2. Recipients add — students or guardians.
3. Items add — fixed amount or per-lesson rate.
4. Term mode delivered → invoices generated based on actual lessons in period.
5. Term mode upfront → invoices generated for the period total at start.
6. Hybrid — combo.
7. Toggle active/paused.
8. Run-now → run detail shows generated invoices.
9. Partial failure (mock 1 recipient with bad email) → run.outcome=partial; retry button works.
10. Delete run.

---

## 23. Subscription & plan limits

Plans (from `subscription_plan` enum): `trial, solo_teacher, academy, agency, custom`.
Statuses (from `subscription_status` enum): `trialing, active, past_due, cancelled, paused`.

`PLAN_LIMITS` config (in `supabase/functions/_shared/plan-config.ts`) defines:
- max_students per plan
- max_teachers per plan
- features (leads, recurring billing, accounting, etc.) gated per plan

DB triggers:
- `check_student_limit` → on `students` insert, blocks if at cap
- `check_teacher_limit` → on `teachers` insert
- `check_subscription_active` → on most write operations, blocks if status=cancelled

Cron jobs:
- `trial-reminder-7day`, `trial-reminder-3day`, `trial-reminder-1day` — emails as trial nears end
- `trial-expired` — flips status to past_due/paused
- `trial-winback` — winback email after trial ended

Tests:
1. Trialing org → can use all features within plan caps.
2. Trial expiring 1 day → reminder email sent.
3. Trial expired → status flipped, write actions blocked.
4. Reactivate via Stripe checkout → status=active.
5. Plan downgrade across cap → error or grace period (verify expected behaviour).
6. `past_due` status → banner shown app-wide; some actions disabled.
7. Webhook idempotency: re-deliver same Stripe event ID twice → no duplicate row in `stripe_webhook_events` (table comment says it stores event IDs for dedup).
8. Feature gates (`useFeatureGate`) — leads/recurring billing/booking page hidden on trial; visible on academy.

---

## 24. Stripe payments end-to-end

### 24.1 Customer creation
On first invoice send to a guardian, `stripe_customer_id` is populated on `guardians` if Stripe is connected.

### 24.2 Payment intent (one-off)
`stripe-create-payment-intent` edge fn. Inputs: invoiceId, savedPaymentMethodId optional. Output: client_secret.

### 24.3 Embedded payment (parent portal)
`PaymentDrawer.tsx` uses `@stripe/react-stripe-js` + `useStripeElements` + `useEmbeddedPayment`. Renders Stripe Elements card form, supports Apple Pay / Google Pay if available. On confirm → `record_stripe_payment` RPC. Webhook `stripe-webhook` later confirms via `payment_intent.succeeded`.

### 24.4 Hosted checkout (web fallback / native)
`stripe-create-checkout` → returns Stripe Checkout URL. Used on native (iOS/Android) where embedded SDK is restricted (see `NativePaymentNotice.tsx`).

### 24.5 Saved payment methods
`stripe-list-payment-methods` (parent + admin views). `stripe-detach-payment-method`.

### 24.6 Auto-pay
- Toggle on payment plan or per-installment.
- `stripe-auto-pay-installment` runs N days before due (cron `installment-upcoming-reminder` then `installment-overdue-check`), attempts charge against saved card.
- Failure path: `auto_pay_attempts` row, retry up to N, then `send-auto-pay-failure-notification` + `send-auto-pay-alert`.
- `auto-pay-upcoming-reminder` cron — pre-charge notice.
- `auto-pay-final-reminder` cron — last warning.

### 24.7 Refund flow
- Manual refund: `record_manual_refund` RPC inserts `refunds` row.
- Stripe refund: `stripe-process-refund` calls Stripe API → on success records `refunds` row + updates payment.

### 24.8 Disputes
- Stripe webhook `charge.dispute.created` → `payment_disputes` row (status=needs_response).
- `send-dispute-notification` emails admin.
- Resolution: `payment_disputes` updated by admin; if lost → `apply_lost_dispute_cascade`.

### 24.9 Stripe Connect (multi-tenant)
For studio orgs to receive payments directly. `stripe-connect-onboard` → onboarding link. `stripe-connect-status` → returns charges_enabled etc.

### 24.10 Billing history
`stripe-billing-history` for owner — list of platform subscription invoices.

### 24.11 Verify session (post-checkout)
`stripe-verify-session?session_id=cs_X` confirms a checkout completed. Used for plan upgrade return URL.

### 24.12 Tests (smoke; the full suite needs Stripe test mode)
1. Parent pays invoice via embedded drawer (Stripe test card 4242…) → payment row, status=paid, webhook idempotent.
2. Apple Pay button visibility on iOS Safari only.
3. Saved card list and default selection.
4. Detach card.
5. Auto-pay installment success path.
6. Auto-pay failure → retry → final failure → email + invoice flagged.
7. Refund partial via Stripe → `refunds` row, original payment refunded amount accumulates.
8. Dispute simulated via Stripe CLI → banner appears.
9. Plan upgrade → Stripe checkout completed → webhook flips org plan and limits.
10. Customer portal redirect carries return URL back to `/settings?tab=billing`.

---

## 25. Public booking page (`/book/:slug`)

**Component:** `src/pages/public/BookingPage.tsx`. Hooks: `usePublicBookingPage`, `fetchBookingSlots`. Edge fns: `booking-get-slots`, `booking-submit`, `send-parent-enquiry`.

### 25.1 Steps (dynamic)
Steps built by `buildSteps(config)`:
- `welcome`
- `instrument` (only if multiple instruments)
- `teacher` (only if multiple teachers)
- `datetime`
- `details`
- `confirmation`

### 25.2 Welcome
Heading from `config.heading`. `Get Started` button. Org name in title.

### 25.3 Instrument
Cards from `booking_page_instruments`. Click selects one.

### 25.4 Teacher
Cards from `booking_page_teachers` (filtered by selected instrument if applicable).

### 25.5 Date & time
- Calendar widget — date range constrained by `getTomorrow()` and `getMaxDate(advance_days)`.
- After date pick, `fetchBookingSlots` called → returns array of `TimeSlot { time, teacher_id?, teacher_ref? }`.
- `SlotGrid` groups by morning/afternoon/evening.
- Click slot → selected. Continue.

### 25.6 Details
Form:
- Multiple children (`ChildEntry[]`): firstName, age, instrument_id (if multi-instrument flow).
- Contact: name, email, phone.
- Notes textarea.
- Consent checkbox.
- "Just enquiring" mode — bypass slot, only email captured (calls `send-parent-enquiry` instead of `booking-submit`).

### 25.7 Confirmation
- Booking ref + chosen slot.
- "What happens next?" text.
- If `?embed=true`, no chrome.

### 25.8 Backend behaviour
`booking-submit` →
- Inserts `leads` (source=booking_page) + `lead_students` per child.
- If slot present, marks slot as held; admin must confirm.
- Sends notification email to org admin + receipt email to parent.
- Rate-limited per IP and per email.

### 25.9 Tests
1. Visit invalid slug → 404 / NotFound page.
2. Visit valid slug → welcome step.
3. Single instrument config → instrument step skipped.
4. Single teacher → teacher step skipped.
5. Pick date → slots fetched (mock 5 slots).
6. Pick slot → continue → details.
7. Submit with valid contact + 1 child → confirmation; `leads` and `lead_students` rows created; admin email sent (mock).
8. Submit "Just enquiring" → no slot, lead created with stage=enquiry.
9. Multi-children form (2 kids).
10. Embed mode `?embed=true` removes header.
11. Rate-limited submit (101 in an hour from same IP) → toast `Too many requests`.
12. Disabled booking page (toggle off in settings) → public route 404.

---

## 26. Parent portal

### 26.1 Layout
**Component:** `PortalLayout.tsx` + `PortalSidebar.tsx` + `PortalBottomNav.tsx` (mobile).

Sidebar items:
- Home → `/portal/home`
- Schedule → `/portal/schedule`
- Practice → `/portal/practice`
- Resources → `/portal/resources`
- Invoices & Payments → `/portal/invoices`
- Messages → `/portal/messages`
- (Profile via avatar dropdown)

### 26.2 Child filter (`ChildFilterContext`)
If parent has multiple children, a selector at top filters all pages by child. `selectedChildId` is the context state; consumed by every portal page.

### 26.3 PortalHome
Hooks: `useParentSummary`, `useChildrenWithDetails`, `useGuardianInfo`, `useParentWaitlistEntries`, `useParentEnrolmentWaitlist`, `useParentContinuationPending`, `useUnreadMessagesCount`, `useParentCredits`, `usePortalFeatures`.

URL params:
- `?makeup_action=accept|decline&id=X` → handled on mount. Calls `respond_to_makeup_offer` RPC, shows toast, refetches.
- (Similar logic for enrolment offer is built into the hooks.)

Sections:
- Hero with parent name.
- Children cards with next lesson, recent practice, instruments + grades.
- Make-up matches needing action (`MakeUpStepper`).
- Enrolment offers needing response.
- Continuation pending banner (if active run).
- Available credits.
- Recent invoices.
- Messages summary.
- Resources count.
- Welcome dialog (`PortalWelcomeDialog`) — first-visit only.
- `ParentOnboardingChecklist` — initial setup steps (profile, preferences, etc.).
- `RequestModal` — for general requests (lesson change, info).

### 26.4 Tests
1. Login as parent → redirect to `/portal/home`.
2. Welcome dialog on first visit (`hint_completions` flag).
3. Child filter switches data context.
4. Tap a make-up match → confirm flow.
5. Email-link `/portal/home?makeup_action=accept&id=X` triggers RPC, toast, refresh.
6. Continuation pending banner click → `/portal/continuation`.
7. Enrolment offer card → response flow.
8. Credit balance card shows correct count.
9. Realtime: insert a make-up match via service role → home page shows it within 5s (`useParentPortal` realtime subscription).
10. Multiple children: switch between them; each shows their own next-lesson.

### 26.5 PortalSchedule
**Component:** `PortalSchedule.tsx`. Hook: `useParentLessons`.

Sections:
- Upcoming lessons grouped by week.
- Past lessons collapsible (`pastOpen` state).
- Per lesson: time, teacher, location, status, expandable details (lesson notes via `useParentLessonNotes`).

Actions per lesson (depend on `org.parent_reschedule_policy`):
- `self_service` — `Reschedule` button opens `RescheduleSlotPicker` → list of available slots → submit → lesson rescheduled directly.
- `request_only` — `Request change` button opens `LessonChangeSheet` → submits a `message_request` for admin approval.
- `admin_locked` — only `Cancel request` allowed; reschedule hidden.

Other per-lesson actions:
- View notes (parent-visible only).
- Add to calendar — Google calendar URL via `generateGoogleCalendarUrl`, ICS download via `downloadICSFile`.
- Join Zoom — if online and link available.

iCal sync:
- "Sync calendar" button generates per-parent iCal token. Copy URL.

### 26.6 Tests
1. Lessons grouped correctly (this week / next week / etc.).
2. Past lessons hidden by default, click to expand.
3. Tap lesson → expand row, show notes if present.
4. Reschedule self-service: pick slot → submit → lesson updated, toast.
5. Reschedule request-only: opens sheet, submit → `message_requests` row created, admin notified.
6. Reschedule admin-locked: button hidden.
7. Add to Google Calendar — opens correctly formatted URL.
8. Download ICS — file content correct.
9. iCal sync URL works (fetch the URL, parse VEVENTs).

### 26.7 PortalPractice
- Practice assignments per child.
- Log practice form (date, duration, notes).
- Streak indicator.
- Recent feedback from teacher.

Tests:
1. Log 30 min today → `practice_logs` row, streak updated.
2. Past assignment shown completed.
3. Teacher feedback visible.

### 26.8 PortalResources
- List of resources shared with this parent's children.
- File-type filter.
- View / download.

### 26.9 PortalInvoices
**Component:** `PortalInvoices.tsx`. Hook: `useParentInvoices`. Realtime: `useRealtimePortalPayments`.

UI:
- Status filter (all/sent/paid/overdue).
- Per invoice: number, amount, due date, status badge, payment plan installments expandable.
- Pay button → opens `PaymentDrawer` (embedded Stripe).
- For payment-plan invoices, `PaymentPlanInvoiceCard` shows installment-level pay buttons.
- Native app: shows `NativePaymentNotice` → opens hosted checkout instead of embedded drawer.
- Download PDF.
- Saved methods (`useSavedPaymentMethods`).

Tests:
1. Pay full invoice → success → status=paid, realtime updates list.
2. Pay one installment → only that installment paid, invoice partially_paid.
3. "Pay all remaining" path.
4. Native notice on Capacitor app.
5. Apple Pay only on iOS Safari.
6. Download PDF.
7. Filter by status.

### 26.10 PortalMessages
- Threads with admin (per child or general).
- Compose new thread.
- Reply on existing.
- Unread count badge.
- Calls `notify-internal-message` for staff push.

### 26.11 PortalProfile
- Edit name, phone, contact preferences.
- Notification preferences.
- Linked children with permissions.
- Sign out.

### 26.12 PortalContinuation (`/portal/continuation`)
**Authed parent variant.** List of pending continuation responses. Pick option per child:
- Continue (same teacher/instrument)
- Change teacher
- Change instrument
- Pause (skip term)
- Withdraw

Submit → response saved.

### 26.13 Public continuation response (`/respond/continuation?token=X`)
Same UX, no login required (token in URL). Server validates token → fetches response row → submit handles unauthenticated flow.

Tests:
1. Authed parent submits continuation → `term_continuation_responses.response_type` set, parent message recorded.
2. Token URL works for unauthenticated parent (e.g. clicking from email).
3. Expired token → error message.
4. Already-submitted token → shows current response, allow change before deadline.

---

## 27. Email & notifications

Notification preferences (`notification_preferences` per user) gate each:
- Email: lesson reminder, invoice due, invoice overdue, payment receipt, message received, makeup match, makeup offer, enrolment offer, continuation reminder, dispute, refund, streak milestone, trial reminder.
- Push: same set, plus realtime nudges.

Edge functions:
- `send-lesson-reminders` (cron) — N hours before each lesson per org settings.
- `overdue-reminders` (cron) — `overdue_reminder_days` array drives schedule.
- `send-invoice-email` / `send-invoice-email-internal` — invoice send / reminder.
- `send-payment-receipt` — on payment success.
- `send-cancellation-notification`.
- `send-refund-notification`.
- `send-dispute-notification`.
- `send-bulk-message`, `send-message`, `send-parent-message`, `send-parent-enquiry`, `send-contact-message`.
- `send-enrolment-offer`, `send-recurring-billing-alert`, `send-auto-pay-alert`, `send-auto-pay-failure-notification`.
- `streak-notification`.
- `notify-makeup-match`, `notify-makeup-offer`.
- `notify-internal-message`.
- `send-push` — Capacitor push token target.

Push tokens stored in `push_tokens` (per user × per device). Lifecycle: register on app start (`initPushNotifications`), teardown on logout.

### 27.1 Tests (mock email transport via Resend test mode or capture from `message_log`)
1. Each event triggers expected email/push:
   - Schedule a lesson → `send-lesson-reminders` cron picks it up.
   - Send an invoice → email sent, log row.
   - Mark invoice overdue (date passes) → `overdue-reminders` cron sends N reminders per `overdue_reminder_days`.
   - Auto-pay attempt fails → `send-auto-pay-failure-notification`.
2. Notification preferences off for a category → no email sent.
3. Push token lifecycle: log in → token registered; log out → token removed.
4. Deep-link from push: tapping notification opens correct page (handled by `initPushNotifications` and Capacitor app deep-link handler in `App.tsx`).
5. `cron-health-watchdog` — verifies all crons ran in last day; if not, alerts.

---

## 28. GDPR & privacy

### 28.1 Export
`gdpr-export` edge fn — bundles all data for an org or a guardian/user into a ZIP, emails secure download URL with expiry.

### 28.2 Delete
`gdpr-delete` edge fn — destructive; requires confirmation.

### 28.3 Anonymise
RPCs `anonymise_student(_id)` and `anonymise_guardian(_id)` — replaces PII with `Redacted`, keeps row for referential integrity.

### 28.4 Tests
1. Owner clicks Export → email received → ZIP contents include profiles, students, guardians, lessons, invoices CSVs.
2. Account delete (user-level) confirms two-step → user signs out, profile removed, owned org left intact (transferred or marked).
3. Org delete (admin) → entire org wiped; cascade rollups.
4. Anonymise student RPC → name becomes `Redacted Redacted`, email/phone null; FK rows still queryable but anonymised.

---

## 29. Cross-feature integrity

### 29.1 RLS verification
For each table, write a test (use `tests/e2e/supabase-admin.ts` to create rows in two orgs A and B):
1. User in org A queries via REST → only sees org A rows.
2. User in org A mutates an org B row (by ID guess) → 403/no-op.
3. Specific tables to verify: `students`, `lessons`, `lesson_participants`, `attendance_records`, `invoices`, `invoice_items`, `payments`, `messages`, `internal_messages`, `make_up_credits`, `practice_assignments`, `practice_logs`, `practice_streaks`, `resources`, `resource_shares`, `lesson_notes`, `audit_log`, `leads`, `enrolment_waitlist`, `term_continuation_*`, `recurring_*`.
4. Parent-specific RLS:
   - Parent can `SELECT` from `teachers` but **must not** see email/phone (table-level comment confirms; use `get_teachers_for_parent()` RPC). Query directly with parent JWT and assert columns are null.
   - Parent sees only their `student_guardians`-linked students.
   - Parent sees only invoices where they are the payer (`is_invoice_payer`).
   - Parent sees only lesson_notes where parent_visible is true (`get_parent_lesson_notes` RPC).

### 29.2 Audit-log assertion after each mutation
Existing helper `expectAuditEntry` — wrap every CRUD test with a final audit-log check.

### 29.3 Realtime
- Open invoice list as owner; insert invoice via service role → list re-renders (`useRealtimeInvoices`).
- Open parent portal invoices; record payment via service role → status updates in <5s (`useRealtimePortalPayments`).
- Calendar — insert lesson via service role → calendar refetches.
- Make-up waitlist — insert match → portal home shows it.

### 29.4 Optimistic-update rollback
- Many mutations use TanStack Query optimistic updates. Mock the mutation to fail after 1s; UI should revert. Tests:
  - Update student name (optimistic) → mutation fails → name reverts, toast `Failed`.
  - Mark attendance (optimistic) → fails → status reverts.

### 29.5 Query invalidation
After each mutation, the relevant query keys must be invalidated:
- `useCreateInvoice` invalidates `['invoices']`, `['invoice-stats']`, `['unbilled-lessons']`.
- `useCreateLesson` invalidates `['calendar', orgId, dateRange]`.
- Test by spying on `queryClient.invalidateQueries` (via Playwright route mocking + assertion of refetch network call).

### 29.6 Stripe webhook idempotency
- POST same event twice → second is dropped (uses `stripe_webhook_events` dedup table).
- Test by replaying a fake signed event payload to `/functions/v1/stripe-webhook` twice; expect 200/200 and only one DB effect.

---

## 30. Error & edge-case workflows

The repo already has separate spec files (in `tests/e2e/workflows/`) for these — keep them but ensure each is exercised:

### 30.1 Error currency (`error-currency.spec.ts`)
- Org currency = USD: invoice amounts render `$`, line items in cents.
- Switch to GBP: future invoices in £, existing invoices retain original currency.
- Multi-currency org (if supported): assert no mixing.

### 30.2 Error duplicates (`error-duplicates.spec.ts`)
- Student name+DOB duplicate → wizard prompt.
- Guardian email duplicate → "use existing" suggestion.
- Lesson at exact same teacher+time → conflict alert.
- Invite same email twice → second one updates the existing pending invite.
- Booking page slug uniqueness within org.

### 30.3 Empty states (`error-empty-states.spec.ts`)
For every list page, confirm empty-state copy + CTA renders when DB has 0 rows for that org:
- Students, Teachers, Locations, Invoices, Reports, Messages, Practice, Resources, Make-ups, Leads, Waitlist, Continuation, Notes, Calendar (no lessons), Parent portal (no children).

### 30.4 Empty submissions (`error-empty-submissions.spec.ts`)
- Submit forms with all fields blank → validation errors per field.
- Whitespace-only fields → trimmed and treated as empty.

### 30.5 Long text (`error-long-text.spec.ts`)
- Names > 100 chars → truncated/blocked.
- Lesson notes 10k chars → saved, rendered (markdown if applicable).
- Description fields with paragraph breaks.

### 30.6 Special chars (`error-special-chars.spec.ts`)
- Names with apostrophes ("O'Brien").
- Emoji in names + messages.
- HTML/script injection attempts → DOMPurify sanitises before render.
- CSV export sanitisation (`sanitiseCSVCell` prevents `=cmd|...!A1` formula injection).

### 30.7 Error boundary resilience (`error-boundary-resilience.spec.ts`)
- Mock a sub-component to throw → `SectionErrorBoundary` shows; rest of page works.
- Mock the entire page → top-level `ErrorBoundary` shows; sidebar still works; logout still works.

### 30.8 URL attacks (`url-attacks.spec.ts`)
- `/accept-invite?token=` redirect after login → `inviteReturn` storage value `//evil.com` → `PublicRoute` ignores it (must start `/accept-invite`).
- Post-login `from` state with `//evil.com` → ignored (must start `/`, not `//`).
- Open-redirect via `redirect_uri` on OAuth → must match origin.

### 30.9 Feature requests (`feature-request.spec.ts`)
- The in-app feedback button (Help page or sidebar) → opens form → submits via `send-contact-message` → confirmation.

---

## 31. Mobile & native (Capacitor)

Tests in mobile-safari project (`devices['iPhone 14']`). Existing `mobile-errors.spec.ts` and `mobile-public-errors.spec.ts` cover the public side.

### 31.1 Layouts
- `StaffBottomNav.tsx` for mobile staff.
- `PortalBottomNav.tsx` for mobile parent.
- `MarketingLayout` redirects on mobile work too.
- `useIsMobile` toggles between `CalendarMobileLayout` and `CalendarDesktopLayout`.

### 31.2 Drawers vs dialogs
On mobile, Lesson modal renders as a `Drawer` (vaul); on desktop as a `Dialog`. Test selector strategies must handle both.

### 31.3 iOS keyboard handling
`useIOSKeyboardHeight` measures keyboard, applies bottom padding to drawers (e.g. LoopAssist input). Test by focussing input in iPhone 14 viewport; bottom of drawer should not be obscured.

### 31.4 Pull-to-refresh
`PullToRefresh` component on Daily Register and parent schedule. Mobile-only.

### 31.5 Capacitor app state
`App.tsx` adds listener `appStateChange` — when foregrounded, refreshes auth session and invalidates all queries. Test by simulating background/foreground.

### 31.6 Android back button
`useAndroidBackButton` wires hardware back to navigation history (and exit on root). Test in mobile project using `Page.goBack`.

### 31.7 Push notifications (mock)
- `initPushNotifications` registers token → row in `push_tokens`.
- Tap notification with `data: { path: '/students/<id>' }` → navigates to that path.
- `teardownPushNotifications` on logout removes token.

### 31.8 No horizontal overflow
Use existing `assertNoHorizontalOverflow` on every page in mobile project.

### 31.9 Tests
1. Bottom nav per role renders correctly.
2. Calendar view defaults to day on mobile, no stacked option.
3. Lesson drawer opens, scrolls; footer buttons sticky.
4. iOS keyboard doesn't cover input.
5. Foreground: simulate `appStateChange { isActive: true }` → query invalidation occurs.
6. Android back from `/students/X` → goes to `/students`.
7. No horizontal overflow on every public, staff, portal page.

---

## 32. Negative & security tests

### 32.1 Authentication enumeration
- Login wrong password vs unknown user → identical generic message (SEC-AUTH-03 collapse).
- Forgot password reveals nothing about existence.
- Signup with existing email → ambiguous "may already exist" (SEC obfuscation via `identities: []`).

### 32.2 Session hardening
- `signOut({ scope: 'global' })` invalidates refresh tokens (SEC-AUTH-07).
- Token tampering: corrupt JWT in localStorage → next request 401, redirect to login with toast `Session expired`.
- Rate limiting: `rate_limits` table + `check_rate_limit` RPC. Test: 100 invoice sends in 1 min → after threshold, 429.

### 32.3 RLS / horizontal access
- Parent A tries to query parent B's invoice via direct REST (using parent A's JWT) → 0 rows.
- Teacher A tries to update teacher B's availability → blocked.
- Finance role tries to insert a student → blocked (RLS policy).

### 32.4 CSRF on edge functions
All state-changing edge functions require Bearer JWT. Test: POST to `/functions/v1/create-billing-run` without token → 401. With invalid token → 401. With token from different org member → 403.

### 32.5 Server-side input validation
- `booking-submit` with malformed payload → 400.
- `looopassist-chat` with prompt injection in user message → `sanitiseMessage` strips `[Student:...]` markers, control chars, and impersonation prefixes. Verify by inspecting sent payload.
- File upload: oversized file > 25MB → rejected.
- File upload: executable mime type → rejected.

### 32.6 Privilege escalation
- Member tries to update their own role → `protect_owner_role` and RLS prevent.
- Parent tries to set themselves as primary payer of a student they don't guardian → blocked.

### 32.7 Trigger guards (catch via DB-error toasts)
- `prevent_org_id_change`: try to update `students.org_id` → fails.
- `prevent_invoiced_lesson_delete`: try to delete invoiced lesson → fails.
- `protect_subscription_fields`: update `organisations.subscription_plan` directly via REST → fails.
- `protect_onboarding_flag`: set `profiles.has_completed_onboarding=false` after true → fails.
- `block_owner_insert`: insert second owner row → fails.
- `check_attendance_not_future`: insert attendance for tomorrow → fails.
- `check_invoice_item_amounts`: negative line item → fails.
- `validate_refund_amount`: refund > original → fails.
- `enforce_invoice_status_transition`: try paid→draft → fails.

---

## Appendix A — Selector inventory

Verified `data-tour` selectors (grep these in `src/components` to find the rest):
- `add-student-button` (Students page, top-right)
- `create-lesson-button` (Calendar page)
- `create-invoice-button` (Invoices page)
- `calendar-view-toggle` (Calendar view toggle group)
- `loopassist-button` (header LoopAssist trigger — actually `data-hint`)
- `sidebar` (`data-hint`)

CMD palette dropdown items use `[cmdk-item]` (Radix Command).

Toast container: `[data-radix-collection-item]` filtered by text.

Dialogs: `getByRole('dialog')`. Drawers (mobile): `getByRole('dialog')` works for vaul too.

Form fields by ID seen in code:
- `#wizard-firstName`, `#wizard-lastName` (Student wizard step 1)
- `#add-guardian` (toggle in wizard)
- `#email`, `#password`, `#fullName`, `#confirmPassword` (auth pages)
- `#plan-pref` (Student detail invoice tab)

Calendar specific:
- Time triggers identifiable by combobox role + text matching `^\d{2}:\d{2}$`
- Duration trigger by combobox role + text containing `min`
- Date display button by text matching `\d{2}\s+(jan|feb|...)\s+\d{4}` (en-GB format)
- Day cells: `getByRole('gridcell', { name: '15' })`

---

## Appendix B — RPC inventory (every callable from UI)

Already enumerated 140+ RPCs in section "What I've fully mapped". When mocking or asserting, use `Supabase:execute_sql` MCP to confirm:

```sql
SELECT routine_name, parameters
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

Critical UI-callable RPCs to assert against in tests:
- `get_user_roles`, `get_user_org_ids`, `get_org_role`
- `get_invoice_stats`, `get_revenue_report`, `get_unmarked_lesson_count`, `get_unbilled_lesson_ids`
- `void_invoice`, `record_payment_and_update_status`, `record_manual_payment`, `record_manual_refund`, `record_stripe_payment`, `record_installment_payment`
- `cancel_payment_plan`, `update_payment_plan`, `generate_installments`, `recalculate_invoice_paid`, `recalculate_installment_status`
- `confirm_makeup_booking`, `respond_to_makeup_offer`, `cancel_booked_makeup`, `dismiss_makeup_match`, `offer_makeup_slot`, `redeem_make_up_credit`, `issue_make_up_credit`
- `add_to_enrolment_waitlist`, `withdraw_from_enrolment_waitlist`, `respond_to_enrolment_offer`, `convert_waitlist_to_student`
- `convert_lead`
- `bulk_cancel_lessons`, `bulk_update_lessons`, `shift_recurring_lesson_times`
- `materialise_continuation_lessons`, `recalc_continuation_summary`, `user_has_continuation_response_in_run`
- `cancel_template_run`, `retry_failed_recipients`, `generate_invoices_from_template`, `delete_billing_run`
- `apply_lost_dispute_cascade`, `get_active_disputes_for_org`, `get_disputes_for_invoice`
- `complete_onboarding`, `set_primary_location`, `seed_make_up_policies`
- `get_parent_dashboard_data`, `get_parent_lesson_notes`, `get_lesson_notes_for_staff`
- `get_students_for_org`, `get_teachers_with_pay`, `get_lessons_on_date`
- `anonymise_student`, `anonymise_guardian`
- `cleanup_withdrawal_credits`, `cleanup_expired_invites`, `cleanup_rate_limits`, `cleanup_webhook_retention`
- `find_waitlist_matches`
- `count_lessons_on_dates`, `can_edit_lesson`
- `is_org_admin`, `is_org_owner`, `is_org_finance_team`, `is_org_parent`, `is_org_member`, `is_org_staff`, `is_org_scheduler`, `is_org_active`, `is_org_write_allowed`, `has_org_role`, `has_role`, `is_assigned_teacher`, `is_lesson_teacher`, `is_invoice_payer`, `is_parent_of_student`, `teacher_has_thread_access`

---

## Appendix C — Edge function inventory

100+ functions in `supabase/functions/`. Group by purpose:

**Auth & onboarding:** `profile-ensure`, `onboarding-setup`, `invite-get`, `invite-accept`, `send-invite-email`, `batch-invite-guardians`, `account-delete`.

**Calendar & sync:** `calendar-oauth-start`, `calendar-oauth-callback`, `calendar-disconnect`, `calendar-fetch-busy`, `calendar-refresh-busy`, `calendar-sync-lesson`, `calendar-ical-feed`, `ical-expiry-reminder`.

**Zoom:** OAuth callback handled in `calendar-oauth-callback` with `provider=zoom`; meeting creation via `calendar-sync-lesson` when online flag true; revoke via `calendar-disconnect`.

**Stripe:** `stripe-webhook`, `stripe-create-checkout`, `stripe-subscription-checkout`, `stripe-create-payment-intent`, `stripe-customer-portal`, `stripe-list-payment-methods`, `stripe-detach-payment-method`, `stripe-update-payment-preferences`, `stripe-process-refund`, `stripe-billing-history`, `stripe-auto-pay-installment`, `stripe-verify-session`, `stripe-connect-onboard`, `stripe-connect-status`.

**Xero / accounting:** `xero-oauth-start`, `xero-oauth-callback`, `xero-disconnect`, `xero-sync-invoice`.

**Invoices & payments:** `generate-invoice-pdf`, `cleanup-invoice-pdf-orphans`, `send-invoice-email`, `send-invoice-email-internal`, `send-payment-receipt`, `send-refund-notification`, `send-dispute-notification`, `send-auto-pay-alert`, `send-auto-pay-failure-notification`, `auto-pay-upcoming-reminder`, `auto-pay-final-reminder`, `installment-upcoming-reminder`, `installment-overdue-check`, `invoice-overdue-check`, `overdue-reminders`, `admin-backfill-default-pm`, `create-billing-run`, `recurring-billing-scheduler`, `send-recurring-billing-alert`.

**Continuation:** `create-continuation-run`, `bulk-process-continuation`, `continuation-respond`, `process-term-adjustment`.

**Booking & leads:** `booking-get-slots`, `booking-submit`, `send-parent-enquiry`.

**Make-ups & waitlist:** `notify-makeup-match`, `notify-makeup-offer`, `send-enrolment-offer`, `enrolment-offer-expiry`, `waitlist-respond`, `waitlist-expiry`, `credit-expiry`, `credit-expiry-warning`.

**Messaging:** `send-message`, `send-bulk-message`, `send-parent-message`, `mark-messages-read`, `notify-internal-message`, `send-cancellation-notification`, `send-notes-notification`, `send-contact-message`, `marketing-chat`.

**Practice:** `streak-notification`.

**LoopAssist:** `looopassist-chat`, `looopassist-execute`, `parent-loopassist-chat`.

**Push:** `send-push`.

**Resources:** `cleanup-orphaned-resources`.

**Trial / subscription:** `trial-reminder-7day`, `trial-reminder-3day`, `trial-reminder-1day`, `trial-expired`, `trial-winback`.

**Cron health:** `cron-health-watchdog`, `cleanup-webhook-retention`.

**CSV import:** `csv-import-mapping`, `csv-import-execute`.

**GDPR:** `gdpr-export`, `gdpr-delete`.

**Lesson reminders:** `send-lesson-reminders`.

**Demo seed (use only in test envs):** `seed-demo-agency`, `seed-demo-solo`, `seed-demo-data`, `seed-e2e-data`.

**Migration tools:** `migration-dump`.

For each test that triggers an edge function, use Playwright `page.route('**/functions/v1/<name>', ...)` to either mock or just spy. For service-role-side effects, query DB via the supabase-admin helper to assert.

---

## Appendix D — Suggested file structure for the new test suite

```
tests/e2e/
├── helpers.ts                                    (existing — extend)
├── supabase-admin.ts                             (existing — extend with factories)
├── auth.setup.ts                                 (existing)
├── master/                                        ← NEW master suite
│   ├── 01-foundations.spec.ts                    (sanity check, env, fixtures)
│   ├── 02-marketing-redirects.spec.ts
│   ├── 03-auth.spec.ts                           (login, signup, forgot, reset, verify, accept-invite, zoom-callback)
│   ├── 04-onboarding.spec.ts                     (full wizard incl. CSV)
│   ├── 05-rbac.spec.ts                           (programmatic role × route matrix)
│   ├── 06-dashboard.spec.ts                      (per-role)
│   ├── 07-calendar.spec.ts                       (views, filters, drag, slot generator)
│   ├── 08-lesson-crud.spec.ts                    (single, recurring, group)
│   ├── 09-attendance.spec.ts                     (register + batch)
│   ├── 10-students.spec.ts                       (list, wizard, import, all 10 detail tabs, term adjustment, delete)
│   ├── 11-teachers.spec.ts
│   ├── 12-locations-rooms.spec.ts
│   ├── 13-invoices.spec.ts                       (list, billing run, recurring, plans)
│   ├── 14-invoice-detail.spec.ts                 (send, pay, refund, plan, dispute, PDF)
│   ├── 15-reports.spec.ts                        (8 reports)
│   ├── 16-messages.spec.ts                       (single, bulk, internal, requests, threads)
│   ├── 17-practice.spec.ts
│   ├── 18-resources.spec.ts
│   ├── 19-makeups-waitlist-leads.spec.ts
│   ├── 20-continuation.spec.ts
│   ├── 21-loopassist.spec.ts
│   ├── 22-settings.spec.ts                       (24 tabs — split into sub-files if too big)
│   ├── 23-subscription.spec.ts
│   ├── 24-stripe.spec.ts                         (test-mode required)
│   ├── 25-public-booking.spec.ts
│   ├── 26-parent-portal.spec.ts                  (every page)
│   ├── 27-notifications.spec.ts
│   ├── 28-gdpr.spec.ts
│   ├── 29-integrity.spec.ts                      (RLS, audit, realtime, optimistic rollback)
│   ├── 30-edge-cases.spec.ts                     (consolidates existing error-* specs)
│   ├── 31-mobile-native.spec.ts
│   └── 32-security.spec.ts                       (negative tests)
└── workflows/                                     (existing — keep, gradually fold into master)
```

Every spec file should:
1. Open with `test.use({ storageState: AUTH.<role> })` or rotate roles inside.
2. Seed minimum data via `supabase-admin` factories in `test.beforeAll`.
3. Clean up in `test.afterAll` (sweep `e2e_*` rows by prefix).
4. Use the workflow helpers, not handcrafted selectors, when an action is in `workflow-helpers.ts`.
5. Always end actions with the corresponding audit-log assertion via `expectAuditEntry`.
6. Always run `assertNoErrorBoundary` and `assertNoBrokenImages` after navigation.
7. Track console errors via `trackConsoleErrors` and assert clean at end.

---

## Appendix E — Coverage checklist (use as PR review gate)

For each section above, tick when a spec exists that covers:
- [ ] Happy path (logged-in role with sufficient permissions, valid input)
- [ ] Validation (empty, malformed, too long, special chars)
- [ ] RBAC negative (other roles redirected/blocked)
- [ ] RLS negative (cross-org / cross-tenant blocked)
- [ ] Trigger / RPC error cases (the DB-side guardrails)
- [ ] Optimistic update + rollback
- [ ] Realtime update (where applicable)
- [ ] Audit log entry
- [ ] Mobile viewport (via `mobile-safari` project)
- [ ] No console errors
- [ ] No broken images

If any box is empty for a section, the suite is incomplete for that journey.

---

*End of catalog. Generated from a deep recon of `lessonloop3-main` against live Supabase project `xmrhmxizpslhtkibqyfy` on 2026-05-08.*