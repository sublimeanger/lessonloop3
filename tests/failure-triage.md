# Playwright Failure Triage

**Run:** Playwright Tests #27 (workflow run `22509216509`)
**Date:** 2026-02-28
**Branch:** main (commit `b95f13b`)
**Result:** 89 failed, 1 flaky, 220 passed (27.6 min)

---

## Summary by Failure Type

| Category | Count | % of Failures |
|---|---|---|
| Auth / RBAC issues (redirected to wrong page) | 38 | 42.7% |
| Wrong selector (element not found) | 27 | 30.3% |
| Timeout (page/element took too long) | 23 | 25.8% |
| Other | 1 | 1.1% |
| **Total** | **89** | **100%** |

---

## 1. Auth / RBAC Issues (38 failures)

All RBAC navigation tests fail because `page.goto('/some-route')` redirects to `/dashboard` (staff roles) or `/portal/home` (parent role) instead of staying on the target route. This indicates the stored auth sessions for Teacher, Finance, Parent, and Admin roles are invalid or expired.

| # | File | Test Name | Error (first line) |
|---|---|---|---|
| 1 | `rbac.spec.ts` | Teacher RBAC > can access /calendar | `expect(page).toHaveURL(expected) failed — Expected: /\/calendar/ Received: ".../dashboard"` |
| 2 | `rbac.spec.ts` | Teacher RBAC > can access /students | `expect(page).toHaveURL(expected) failed — Expected: /\/students/ Received: ".../dashboard"` |
| 3 | `rbac.spec.ts` | Teacher RBAC > can access /register | `expect(page).toHaveURL(expected) failed — Expected: /\/register/ Received: ".../dashboard"` |
| 4 | `rbac.spec.ts` | Teacher RBAC > can access /batch-attendance | `expect(page).toHaveURL(expected) failed — Expected: /\/batch-attendance/ Received: ".../dashboard"` |
| 5 | `rbac.spec.ts` | Teacher RBAC > can access /practice | `expect(page).toHaveURL(expected) failed — Expected: /\/practice/ Received: ".../dashboard"` |
| 6 | `rbac.spec.ts` | Teacher RBAC > can access /resources | `expect(page).toHaveURL(expected) failed — Expected: /\/resources/ Received: ".../dashboard"` |
| 7 | `rbac.spec.ts` | Teacher RBAC > can access /messages | `expect(page).toHaveURL(expected) failed — Expected: /\/messages/ Received: ".../dashboard"` |
| 8 | `rbac.spec.ts` | Teacher RBAC > can access /settings | `expect(page).toHaveURL(expected) failed — Expected: /\/settings/ Received: ".../dashboard"` |
| 9 | `rbac.spec.ts` | Teacher RBAC > can access /help | `expect(page).toHaveURL(expected) failed — Expected: /\/help/ Received: ".../dashboard"` |
| 10 | `rbac.spec.ts` | Finance RBAC > can access /invoices | `expect(page).toHaveURL(expected) failed — Expected: /\/invoices/ Received: ".../dashboard"` |
| 11 | `rbac.spec.ts` | Finance RBAC > can access /reports | `expect(page).toHaveURL(expected) failed — Expected: /\/reports/ Received: ".../dashboard"` |
| 12 | `rbac.spec.ts` | Finance RBAC > can access /messages | `expect(page).toHaveURL(expected) failed — Expected: /\/messages/ Received: ".../dashboard"` |
| 13 | `rbac.spec.ts` | Finance RBAC > can access /settings | `expect(page).toHaveURL(expected) failed — Expected: /\/settings/ Received: ".../dashboard"` |
| 14 | `rbac.spec.ts` | Parent RBAC > can access /portal/schedule | `expect(page).toHaveURL(expected) failed — Expected: /\/portal\/schedule/ Received: ".../portal/home"` |
| 15 | `rbac.spec.ts` | Parent RBAC > can access /portal/practice | `expect(page).toHaveURL(expected) failed — Expected: /\/portal\/practice/ Received: ".../portal/home"` |
| 16 | `rbac.spec.ts` | Parent RBAC > can access /portal/resources | `expect(page).toHaveURL(expected) failed — Expected: /\/portal\/resources/ Received: ".../portal/home"` |
| 17 | `rbac.spec.ts` | Parent RBAC > can access /portal/invoices | `expect(page).toHaveURL(expected) failed — Expected: /\/portal\/invoices/ Received: ".../portal/home"` |
| 18 | `rbac.spec.ts` | Parent RBAC > can access /portal/messages | `expect(page).toHaveURL(expected) failed — Expected: /\/portal\/messages/ Received: ".../portal/home"` |
| 19 | `rbac.spec.ts` | Parent RBAC > can access /portal/profile | `expect(page).toHaveURL(expected) failed — Expected: /\/portal\/profile/ Received: ".../portal/home"` |
| 20 | `rbac.spec.ts` | Parent RBAC > can access /portal/continuation | `expect(page).toHaveURL(expected) failed — Expected: /\/portal\/continuation/ Received: ".../portal/home"` |
| 21 | `rbac.spec.ts` | Admin RBAC > can access /calendar | `expect(page).toHaveURL(expected) failed — Expected: /\/calendar/ Received: ".../dashboard"` |
| 22 | `rbac.spec.ts` | Admin RBAC > can access /students | `expect(page).toHaveURL(expected) failed — Expected: /\/students/ Received: ".../dashboard"` |
| 23 | `rbac.spec.ts` | Admin RBAC > can access /teachers | `expect(page).toHaveURL(expected) failed — Expected: /\/teachers/ Received: ".../dashboard"` |
| 24 | `rbac.spec.ts` | Admin RBAC > can access /locations | `expect(page).toHaveURL(expected) failed — Expected: /\/locations/ Received: ".../dashboard"` |
| 25 | `rbac.spec.ts` | Admin RBAC > can access /invoices | `expect(page).toHaveURL(expected) failed — Expected: /\/invoices/ Received: ".../dashboard"` |
| 26 | `rbac.spec.ts` | Admin RBAC > can access /reports | `expect(page).toHaveURL(expected) failed — Expected: /\/reports/ Received: ".../dashboard"` |
| 27 | `rbac.spec.ts` | Admin RBAC > can access /messages | `expect(page).toHaveURL(expected) failed — Expected: /\/messages/ Received: ".../dashboard"` |
| 28 | `rbac.spec.ts` | Admin RBAC > can access /settings | `expect(page).toHaveURL(expected) failed — Expected: /\/settings/ Received: ".../dashboard"` |
| 29 | `rbac.spec.ts` | Admin RBAC > can access /register | `expect(page).toHaveURL(expected) failed — Expected: /\/register/ Received: ".../dashboard"` |
| 30 | `rbac.spec.ts` | Admin RBAC > can access /batch-attendance | `expect(page).toHaveURL(expected) failed — Expected: /\/batch-attendance/ Received: ".../dashboard"` |
| 31 | `rbac.spec.ts` | Admin RBAC > can access /practice | `expect(page).toHaveURL(expected) failed — Expected: /\/practice/ Received: ".../dashboard"` |
| 32 | `rbac.spec.ts` | Admin RBAC > can access /resources | `expect(page).toHaveURL(expected) failed — Expected: /\/resources/ Received: ".../dashboard"` |
| 33 | `rbac.spec.ts` | Admin RBAC > can access /leads | `expect(page).toHaveURL(expected) failed — Expected: /\/leads/ Received: ".../dashboard"` |
| 34 | `rbac.spec.ts` | Admin RBAC > can access /waitlist | `expect(page).toHaveURL(expected) failed — Expected: /\/waitlist/ Received: ".../dashboard"` |
| 35 | `rbac.spec.ts` | Admin RBAC > can access /make-ups | `expect(page).toHaveURL(expected) failed — Expected: /\/make-ups/ Received: ".../dashboard"` |
| 36 | `rbac.spec.ts` | Admin RBAC > can access /continuation | `expect(page).toHaveURL(expected) failed — Expected: /\/continuation/ Received: ".../dashboard"` |
| 37 | `rbac.spec.ts` | Admin RBAC > can access /help | `expect(page).toHaveURL(expected) failed — Expected: /\/help/ Received: ".../dashboard"` |
| 38 | `mobile-errors.spec.ts` | Error & Empty States > no console errors on dashboard | `Console errors: Failed to load resource: 401, 404 (multiple)` |

---

## 2. Wrong Selector — Element Not Found (27 failures)

These tests use locators (role queries, text matchers) that don't match any visible element on the page. Either the UI copy/structure has changed or the selectors need updating.

| # | File | Test Name | Error (first line) |
|---|---|---|---|
| 1 | `auth.spec.ts` | Login Page > wrong password shows error | `expect(locator).toBeVisible() failed — Locator: getByText(/sign in failed/i)` |
| 2 | `auth.spec.ts` | Signup Page > renders signup form | `expect(locator).toBeVisible() failed — Locator: getByText(/create/i)` |
| 3 | `dashboard.spec.ts` | Owner Dashboard > loads with greeting and org name | `expect(locator).toBeVisible() failed — Locator: getByText(/good (morning\|afternoon\|evening)/i)` |
| 4 | `dashboard.spec.ts` | Owner Dashboard > shows stat cards | `expect(locator).toBeVisible() failed — Locator: locator('[class*="CardContent"]')` |
| 5 | `invoices.spec.ts` | Invoices — Owner > billing run button exists | `expect(locator).toBeVisible() failed — Locator: getByRole('button', { name: /billing run\|generate/i })` |
| 6 | `leads-crm.spec.ts` | Leads — Owner > view toggle (kanban/list) exists | `expect(received).toBeTruthy()` |
| 7 | `messages.spec.ts` | Messages — Owner > compose button exists | `expect(locator).toBeVisible() failed — Locator: getByRole('button', { name: /compose\|new message\|write/i })` |
| 8 | `mobile-errors.spec.ts` | Mobile Responsiveness > login page usable on mobile | `expect(locator).toBeVisible() failed — Locator: getByLabel('Email')` |
| 9 | `mobile-errors.spec.ts` | Mobile Responsiveness > settings page shows mobile nav list | `expect(locator).toBeVisible() failed — Locator: getByText(/account\|profile/i)` |
| 10 | `mobile-errors.spec.ts` | Mobile Portal > portal bottom nav visible | `expect(locator).toBeVisible() failed — Locator: locator('nav').last()` |
| 11 | `parent-portal.spec.ts` | Portal — Parent 1 > portal home loads with children | `expect(locator).toBeVisible() failed — Locator: getByText(/emma/i)` |
| 12 | `parent-portal.spec.ts` | Portal — Parent 1 > profile page loads with user info | `expect(locator).toBeVisible() failed — Locator: getByLabel(/name\|email/i)` |
| 13 | `parent-portal.spec.ts` | Portal Data Isolation — Parent 2 > sees their own child (Sophie) | `expect(locator).toBeVisible() failed — Locator: getByText(/sophie/i)` |
| 14 | `practice-resources.spec.ts` | Resources — Owner > upload button exists | `expect(locator).toBeVisible() failed — Locator: getByRole('button', { name: /upload\|add\|new/i })` |
| 15 | `practice-resources.spec.ts` | Resources — Owner > view toggle (grid/list) exists | `expect(received).toBeTruthy()` |
| 16 | `reports.spec.ts` | Reports Hub — Owner > all 7 report types shown | `expect(locator).toBeVisible() failed — Locator: getByText('Outstanding Payments')` |
| 17 | `settings.spec.ts` | Settings — Owner > profile tab is default | `expect(locator).toBeVisible() failed — Locator: getByText(/profile/i)` |
| 18 | `settings.spec.ts` | Settings — Owner > notifications tab renders | `expect(locator).toBeVisible() failed — Locator: getByText(/notification/i)` |
| 19 | `settings.spec.ts` | Settings — Owner > organisation tab shows org name | `expect(locator).toBeVisible() failed — Locator: getByText(/E2E Test Academy/i)` |
| 20 | `settings.spec.ts` | Settings — Owner > availability tab renders | `expect(locator).toBeVisible() failed — Locator: getByText(/availability/i)` |
| 21 | `settings.spec.ts` | Settings — Owner > zoom tab renders | `expect(locator).toBeVisible() failed — Locator: getByText(/zoom/i)` |
| 22 | `settings.spec.ts` | Settings — Owner > messaging settings tab renders | `expect(locator).toBeVisible() failed — Locator: getByText(/messaging\|template/i)` |
| 23 | `settings.spec.ts` | Settings — Owner > booking page tab renders | `expect(locator).toBeVisible() failed — Locator: getByText(/booking\|public\|page/i)` |
| 24 | `students.spec.ts` | Students — Owner > page loads with student list | `expect(locator).toBeVisible() failed — Locator: getByText(/emma\|james\|sophie/i)` |
| 25 | `students.spec.ts` | Students — Owner > status filter pills (All/Active/Inactive) | `expect(locator).toBeVisible() failed — Locator: locator('[role="tablist"]')` |
| 26 | `students.spec.ts` | Students — Owner > export button visible | `expect(locator).toBeVisible() failed — Locator: getByRole('button', { name: /export\|download/i })` |
| 27 | `teachers-locations.spec.ts` | Teachers — Owner > add teacher / invite button exists | `expect(locator).toBeVisible() failed — Locator: getByRole('button', { name: /add\|invite\|new/i })` |

---

## 3. Timeout — Page/Element Took Too Long (23 failures)

These tests exceed the 60 s timeout while trying to interact with a locator (usually `locator.click`). The target element likely never appears on the page due to data not loading or a preceding navigation/auth failure.

| # | File | Test Name | Error (first line) |
|---|---|---|---|
| 1 | `calendar.spec.ts` | Calendar — Owner > navigate forward and back | `locator.click: Test timeout of 60000ms exceeded` |
| 2 | `calendar.spec.ts` | Calendar — Owner > today button returns to current week | `locator.click: Test timeout of 60000ms exceeded` |
| 3 | `leads-crm.spec.ts` | Leads — Owner > create lead button opens modal | `locator.click: Test timeout of 60000ms exceeded` |
| 4 | `messages.spec.ts` | Messages — Owner > compose modal opens | `locator.click: Test timeout of 60000ms exceeded` |
| 5 | `parent-portal.spec.ts` | Portal — Parent 1 > portal sidebar navigation works | `locator.click: Test timeout of 60000ms exceeded` |
| 6 | `parent-portal.spec.ts` | Portal — Parent 1 > sign out from portal works | `locator.click: Test timeout of 60000ms exceeded` |
| 7 | `reports.spec.ts` | Reports Hub — Owner > can navigate to outstanding report | `locator.click: Test timeout of 60000ms exceeded` |
| 8 | `reports.spec.ts` | Reports Hub — Owner > can navigate to lessons delivered report | `locator.click: Test timeout of 60000ms exceeded` |
| 9 | `reports.spec.ts` | Reports Hub — Owner > can navigate to payroll report | `locator.click: Test timeout of 60000ms exceeded` |
| 10 | `student-detail.spec.ts` | Student Detail — Owner > detail page loads with student name | `locator.click: Test timeout of 60000ms exceeded` |
| 11 | `student-detail.spec.ts` | Student Detail — Owner > all 10 tabs render | `locator.click: Test timeout of 60000ms exceeded` |
| 12 | `student-detail.spec.ts` | Student Detail — Owner > can switch between tabs | `locator.click: Test timeout of 60000ms exceeded` |
| 13 | `student-detail.spec.ts` | Student Detail — Owner > overview tab shows student info card | `locator.click: Test timeout of 60000ms exceeded` |
| 14 | `student-detail.spec.ts` | Student Detail — Owner > guardians tab shows linked parents | `locator.click: Test timeout of 60000ms exceeded` |
| 15 | `student-detail.spec.ts` | Student Detail — Owner > breadcrumbs navigate back to students list | `locator.click: Test timeout of 60000ms exceeded` |
| 16 | `students.spec.ts` | Students — Owner > search filters students | `locator.fill: Test timeout of 60000ms exceeded` |
| 17 | `students.spec.ts` | Students — Owner > add student wizard opens | `locator.click: Test timeout of 60000ms exceeded` |
| 18 | `students.spec.ts` | Students — Owner > wizard validates required fields | `locator.click: Test timeout of 60000ms exceeded` |
| 19 | `students.spec.ts` | Students — Owner > navigate to student detail | `locator.click: Test timeout of 60000ms exceeded` |
| 20 | `students.spec.ts` | Students — Owner > create student happy path | `locator.click: Test timeout of 60000ms exceeded` |
| 21 | `teachers-locations.spec.ts` | Locations — Owner > add location button exists | `expect(locator).toBeVisible() failed — Locator: getByRole('button', { name: /add.*location\|new.*location/i })` |
| 22 | `teachers-locations.spec.ts` | Locations — Owner > add location dialog opens | `locator.click: Test timeout of 60000ms exceeded` |
| 23 | `waitlist-makeups-continuation.spec.ts` | Enrolment Waitlist — Owner > add to waitlist button exists | `expect(locator).toBeVisible() failed — Locator: getByRole('button', { name: /add\|new/i })` |

---

## 4. Other (1 failure)

| # | File | Test Name | Error (first line) |
|---|---|---|---|
| 1 | `waitlist-makeups-continuation.spec.ts` | Continuation — Owner > create continuation run button exists | `expect(locator).toBeVisible() failed — Locator: getByRole('button', { name: /create\|new\|start/i })` |

---

## Flaky (not counted in failures)

| File | Test Name |
|---|---|
| `teachers-locations.spec.ts` | Locations — Owner > filter by location type |

---

## Root Cause Analysis

### Auth/RBAC (38 tests) — Highest Impact
The `auth.setup.ts` stores auth state per role. All Teacher, Finance, Parent, and Admin sessions appear to fail silently, causing `page.goto` to redirect to the default authenticated landing page (`/dashboard` or `/portal/home`) instead of the target route. **Fix:** Verify the E2E role credentials in GitHub secrets are still valid and that `auth.setup.ts` correctly persists sessions for each role.

### Wrong Selectors (27 tests)
Locators like `getByText(/sign in failed/i)`, `getByRole('button', { name: /billing run|generate/i })`, and `locator('[class*="CardContent"]')` don't match the current DOM. This indicates the UI has been updated (text changes, component restructuring) without updating the corresponding tests. **Fix:** Audit each selector against the current UI and update test locators to match.

### Timeouts (23 tests)
Most timeouts are `locator.click` waiting for an element that never appears. These cluster around students, student-detail, reports, and calendar — pages that likely require data to load. **Fix:** These may resolve if the selector issues are fixed first; otherwise investigate whether the pages load data correctly in CI.
