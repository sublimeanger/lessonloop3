# LessonLoop — Playwright Master Test Plan for Claude Code

> **Purpose**: Feed these prompts to Claude Code in sequence. Each phase builds on the last.  
> **Base URL**: `app.lessonloop.net` (via `E2E_BASE_URL` env var)  
> **Test users**: owner, admin, teacher, finance, parent, parent2 (via `auth.setup.ts`)  
> **Rule**: Never delete `auth.setup.ts`, `helpers.ts`, or `smoke-full-system.spec.ts`

---

## CURRENT STATE (What Exists)

### ✅ Solid infrastructure
- `tests/e2e/auth.setup.ts` — authenticates 6 roles via Supabase login
- `tests/e2e/helpers.ts` — `safeGoTo`, `waitForPageReady`, `expectToast`, `openDialog`, etc.
- `playwright.config.ts` — 3 projects (desktop-chrome, mobile-safari, workflow)
- `.github/workflows/playwright.yml` — CI pipeline running on push

### ⚠️ Existing spec files (17 files, ~1830 lines) — SHALLOW
Most tests only check "page loads" and "button exists." Very few actually click, fill, submit, or verify outcomes. These need to be **replaced with deep interaction tests**.

### Files to DELETE before starting (they're stubs):
```
tests/e2e/dashboard.spec.ts
tests/e2e/calendar.spec.ts
tests/e2e/students.spec.ts
tests/e2e/student-detail.spec.ts
tests/e2e/invoices.spec.ts
tests/e2e/teachers-locations.spec.ts
tests/e2e/reports.spec.ts
tests/e2e/messages.spec.ts
tests/e2e/settings.spec.ts
tests/e2e/practice-resources.spec.ts
tests/e2e/leads-crm.spec.ts
tests/e2e/register-attendance.spec.ts
tests/e2e/waitlist-makeups-continuation.spec.ts
tests/e2e/parent-portal.spec.ts
tests/e2e/mobile-errors.spec.ts
tests/e2e/public-pages.spec.ts
```

### Files to KEEP:
```
tests/e2e/auth.setup.ts          — authentication setup (critical)
tests/e2e/helpers.ts              — shared utilities (critical)
tests/e2e/auth.spec.ts            — login/signup tests (decent, keep)
tests/e2e/rbac.spec.ts            — role access tests (excellent, keep)
tests/e2e/url-attacks.spec.ts     — security tests (excellent, keep)
tests/e2e/workflows/smoke-full-system.spec.ts — smoke tests (keep)
```

---

## ARCHITECTURE REFERENCE (for Claude Code context)

### App Routes by Role

**Owner/Admin** (full access):
`/dashboard`, `/calendar`, `/register`, `/batch-attendance`, `/students`, `/students/:id`, `/students/import`, `/teachers`, `/locations`, `/invoices`, `/invoices/:id`, `/reports`, `/reports/payroll`, `/reports/revenue`, `/reports/outstanding`, `/reports/lessons`, `/reports/cancellations`, `/reports/utilisation`, `/reports/teacher-performance`, `/messages`, `/practice`, `/resources`, `/leads`, `/leads/:id`, `/waitlist`, `/make-ups`, `/continuation`, `/settings`, `/help`

**Teacher** (limited):
`/dashboard`, `/calendar`, `/register`, `/batch-attendance`, `/students`, `/students/:id`, `/practice`, `/resources`, `/messages`, `/settings`, `/help`

**Finance** (billing focused):
`/dashboard`, `/invoices`, `/invoices/:id`, `/reports`, `/reports/payroll`, `/reports/revenue`, `/reports/outstanding`, `/messages`, `/settings`, `/help`

**Parent** (portal only):
`/portal/home`, `/portal/schedule`, `/portal/practice`, `/portal/resources`, `/portal/invoices`, `/portal/messages`, `/portal/profile`, `/portal/continuation`

**Public**:
`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/book/:slug`, `/respond/continuation`

### UI Patterns
- **Dialogs**: `page.getByRole('dialog')` — used for create/edit modals
- **Toasts**: `[data-radix-collection-item]` — success/error feedback
- **Tabs**: `page.getByRole('tab', { name: 'TabName' })` — settings, student detail, invoices
- **Sidebar**: `page.getByRole('link', { name: 'PageName', exact: true })` — navigation
- **Data tour attrs**: `[data-tour="element-name"]` — key UI elements
- **Loading spinners**: `.animate-spin` — wait for these to disappear
- **Error boundaries**: "Something went wrong" or "Failed to load" text
- **Empty states**: EmptyState component with descriptive text

### Key Component Patterns
- Student wizard: multi-step dialog (info → guardian → teaching defaults → success)
- Billing run wizard: multi-step dialog (select period → preview → generate)
- Continuation wizard: select students → configure → send
- Lead conversion: lead → trial → student conversion wizard
- Calendar lesson form: popover or modal with time/student/teacher/location fields

---

## PHASE 1: FOUNDATION — Delete stubs, upgrade helpers

### Prompt 1.1 — Clean slate + enhanced helpers

```
Delete these existing test stub files — they are shallow page-load checks being replaced with deep interaction tests:

tests/e2e/dashboard.spec.ts
tests/e2e/calendar.spec.ts
tests/e2e/students.spec.ts
tests/e2e/student-detail.spec.ts
tests/e2e/invoices.spec.ts
tests/e2e/teachers-locations.spec.ts
tests/e2e/reports.spec.ts
tests/e2e/messages.spec.ts
tests/e2e/settings.spec.ts
tests/e2e/practice-resources.spec.ts
tests/e2e/leads-crm.spec.ts
tests/e2e/register-attendance.spec.ts
tests/e2e/waitlist-makeups-continuation.spec.ts
tests/e2e/parent-portal.spec.ts
tests/e2e/mobile-errors.spec.ts
tests/e2e/public-pages.spec.ts

DO NOT delete: auth.setup.ts, helpers.ts, auth.spec.ts, rbac.spec.ts, url-attacks.spec.ts, or anything in workflows/

Then enhance tests/e2e/helpers.ts by ADDING these new helper functions (keep all existing ones):

1. `fillField(page, label: string, value: string)` — finds input by label or placeholder and fills it, with fallback to id selector
2. `selectOption(page, label: string, optionText: string)` — clicks a select/combobox, then clicks the option
3. `clickButton(page, name: string | RegExp)` — clicks button by role and waits for network to settle  
4. `expectToastSuccess(page, text?: string | RegExp)` — waits for success toast (checks for "success", "created", "saved", "updated", "sent", "deleted" if no text given)
5. `expectToastError(page, text?: string | RegExp)` — waits for destructive toast
6. `closeDialog(page)` — clicks the X or Cancel button on the current dialog
7. `waitForTableData(page, minRows?: number)` — waits for table/list to have at least N rows of data
8. `getMainContent(page)` — returns page.locator('main').first() for scoping assertions
9. `countElements(page, selector: string)` — returns count of matching elements
10. `expectNoConsoleErrors(page)` — collects console errors during test, asserts none at end
11. `generateTestId()` — returns a unique string like "e2e_" + timestamp for creating test data without collisions

All helpers must handle slow CI: use generous timeouts (10-15s), catch-and-retry patterns matching the existing safeGoTo pattern. Import { Page, expect } from '@playwright/test'.

Commit with message: "test: clean slate + enhanced helpers for deep interaction tests"
```

---

## PHASE 2: CORE MODULE TESTS (Owner role — the deepest)

### Prompt 2.1 — Dashboard deep tests

```
Create tests/e2e/dashboard.spec.ts with comprehensive dashboard tests.

Use imports: import { test, expect } from '@playwright/test'; import { AUTH, safeGoTo, waitForPageReady } from './helpers';

Test describe blocks:

1. "Owner Dashboard" (storageState: AUTH.owner)
   - loads with time-based greeting (Good morning/afternoon/evening)
   - shows stat cards: "Today's Lessons", "Active Students", at least one number > 0
   - stat card links navigate to correct pages (click "Active Students" → /students)
   - sidebar contains all owner nav links: Dashboard, Calendar, Students, Teachers, Register, Invoices, Messages, Reports, Settings, Help
   - LoopAssist button visible (data-tour="loopassist-button" or text "LoopAssist")
   - today's timeline section shows upcoming lessons or "no lessons" message
   - quick actions grid shows action buttons
   - sign out button: click → redirected to /login, storage cleared
   - refresh: page reloads without errors, data repopulates

2. "Teacher Dashboard" (storageState: AUTH.teacher)
   - loads with teacher-specific stats: "Today", "This Month", "My Students", "Hours (Week)"
   - does NOT show admin widgets (no "Active Students" in owner sense, no revenue cards)
   - sidebar hides admin links (Teachers, Locations, Invoices, Leads)

3. "Finance Dashboard" (storageState: AUTH.finance)  
   - loads successfully
   - shows finance-relevant data

Every test must use safeGoTo and assertNoErrorBoundary from helpers.
Every test must have meaningful assertions — not just "page loaded."
Use test.setTimeout(120_000) for any test that navigates multiple pages.
Commit: "test: deep dashboard interaction tests for owner/teacher/finance"
```

### Prompt 2.2 — Calendar deep tests

```
Create tests/e2e/calendar.spec.ts with comprehensive calendar tests.

Imports: import { test, expect } from '@playwright/test'; import { AUTH, safeGoTo, waitForPageReady, openDialog } from './helpers';

Test describe blocks:

1. "Calendar — Owner" (storageState: AUTH.owner)
   - week view loads with day column headers (MON-FRI or full names)
   - lesson cards render if seed data exists (check for colored blocks in the time grid)
   - navigate forward: click Next → URL or view updates, click Previous → returns
   - today button: navigate away then click Today → returns to current week
   - filter bar renders with teacher/location/instrument dropdowns
   - teacher filter: select a teacher → only their lessons shown
   - location filter: select a location → lessons filtered
   - clear filters: reset button returns to unfiltered view
   - view switching: if Day/Week/Stacked/Agenda toggles exist, click each and verify content renders without errors
   - create lesson: click "Add Lesson" button or click on empty time slot → lesson form dialog opens with fields for student, teacher, date, time, duration, location, room, instrument
   - create lesson happy path: fill student (pick first from dropdown), teacher, set time to tomorrow at 10:00, duration 30min → save → toast success → new lesson appears on calendar
   - lesson detail: click an existing lesson card → side panel or detail view opens with lesson info (student name, teacher, time, location)
   - no error boundaries on any view transition

2. "Calendar — Teacher" (storageState: AUTH.teacher)
   - can view calendar with their lessons only
   - cannot see lessons for other teachers (if filter exists, teacher filter locked to self)

All calendar tests should handle the case where seed data may or may not have lessons for today/this week — use conditional logic like the smoke test does.
Test timeout: 120_000 for tests that create data.
Commit: "test: deep calendar interaction tests with lesson creation"
```

### Prompt 2.3 — Students deep tests

```
Create tests/e2e/students.spec.ts with comprehensive student management tests.

Imports: import { test, expect } from '@playwright/test'; import { AUTH, safeGoTo, waitForPageReady, openDialog, generateTestId } from './helpers';

1. "Students List — Owner" (storageState: AUTH.owner)
   - page loads with student list (check for seed student names or "No students" empty state)
   - status filter pills: click Active → shows active only, click Inactive → shows inactive, click All → shows all
   - search: type "Emma" → list filters to show Emma, clear → list resets
   - add student wizard opens: click "Add Student" → dialog with Step 1 (student info)
   - add student validation: click Next without filling required fields → error messages shown under fields
   - add student happy path:
     * Step 1: fill First Name = "E2E", Last Name = generateTestId(), pick instrument from dropdown
     * Step 2 (guardian): skip or fill guardian name + email
     * Step 3 (teaching defaults): skip or set defaults
     * Final: click Finish/Create → success toast → new student appears in list
   - export button: visible and clickable (just verify it triggers download or opens export options)
   - student card/row: shows name, instrument, status badge, and is clickable

2. "Student Detail — Owner" (storageState: AUTH.owner)
   - navigate to a student: go to /students, click first student link → /students/:id loads
   - student info card shows: name, instrument, status, teacher assignment
   - tabs render: Overview, Lessons, Invoices, Guardians (check each tab exists)
   - switch between tabs: click each tab → content updates without errors
   - overview tab: shows student info card with edit capability
   - guardians tab: shows linked guardians or "No guardians" empty state
   - lessons tab: shows lesson history or upcoming lessons
   - invoices tab: shows student's invoices
   - breadcrumbs: click "Students" breadcrumb → navigates back to /students list
   - edit student: click edit button on info card → dialog opens → change last name → save → updated name shown

3. "Students — Teacher" (storageState: AUTH.teacher)
   - page loads showing only their assigned students
   - cannot access student import (/students/import redirects)

Test timeout: 120_000 for wizard tests. Use generous waits for data loading (seed data in Supabase can be slow).
Commit: "test: deep student CRUD and detail page tests"
```

### Prompt 2.4 — Invoices deep tests

```
Create tests/e2e/invoices.spec.ts with comprehensive invoice management tests.

Imports: import { test, expect } from '@playwright/test'; import { AUTH, safeGoTo, waitForPageReady, openDialog, generateTestId } from './helpers';

1. "Invoices — Owner" (storageState: AUTH.owner)
   - page loads with invoice list or empty state
   - stats widget shows counts (Draft, Sent, Overdue, Paid) — at least the container renders
   - status tabs/filters: click each status tab → list filters accordingly
   - filter bar: date range picker works, clear filters resets
   - create invoice: click "Create Invoice" → modal opens
   - create invoice happy path:
     * Select student from dropdown
     * Add line item (description + amount)
     * Verify total calculates correctly (shown in £ GBP)
     * Click Create → success toast → new invoice appears in list
   - invoice detail: click an invoice → /invoices/:id loads with status badge, line items, total
   - invoice detail actions: verify buttons exist (Send, Record Payment, Download PDF based on status)
   - record payment: on a sent/overdue invoice, click Record Payment → modal → fill amount → save → status updates to Paid
   - billing run wizard: click Billing Run → wizard opens with period selection → preview step shows which students will be billed
   - send invoice: on a draft invoice detail, click Send → confirm → status changes to Sent, toast confirms email sent
   - export: export button visible on invoice list
   - bulk actions: if checkboxes exist, select multiple → bulk action bar appears

2. "Invoices — Finance" (storageState: AUTH.finance)
   - can access /invoices and see the list
   - can view invoice detail
   - has same CRUD capabilities as owner for invoices

All monetary values should be in GBP (£). Test timeout: 120_000 for creation flows.
Commit: "test: deep invoice CRUD, billing run, and payment recording tests"
```

### Prompt 2.5 — Teachers & Locations deep tests

```
Create tests/e2e/teachers-locations.spec.ts with comprehensive tests.

1. "Teachers — Owner" (storageState: AUTH.owner)
   - page loads with teacher list (cards or table)
   - search: type teacher name → list filters
   - invite/add teacher button: click → dialog opens with email + role fields
   - teacher card: shows name, email, student count, instruments
   - teacher quick view: click a teacher → side panel or expanded view opens with details
   - export button visible

2. "Locations — Owner" (storageState: AUTH.owner)
   - page loads with location list
   - add location: click "Add Location" → dialog with name, address, type fields
   - add location happy path: fill name = "E2E Test Location " + generateTestId(), select type → save → appears in list
   - location card: shows name, type, room count
   - rooms management: click a location → see rooms list → can add a room
   - add room to location: click "Add Room" within a location → fill name → save → room appears
   - closure dates: if closure dates section exists, verify it renders
   - location type filter: if filter exists, toggle between types
   - delete location: if no rooms/lessons linked, delete button works with confirmation dialog

Test timeout: 120_000. Commit: "test: deep teachers and locations management tests"
```

### Prompt 2.6 — Messages deep tests

```
Create tests/e2e/messages.spec.ts with comprehensive messaging tests.

1. "Messages — Owner" (storageState: AUTH.owner)
   - page loads with message list or empty state
   - compose button exists and opens compose modal/drawer
   - compose message: select recipient → type subject → type body → click send → success toast
   - message templates tab: if exists, shows saved templates
   - internal messages: if tab exists, click it → shows staff-to-staff messages
   - message requests tab: shows parent message requests (if any)
   - bulk compose: if button exists, opens bulk compose with recipient selection
   - notification bell: visible in header, shows unread count if messages exist

2. "Messages — Teacher" (storageState: AUTH.teacher)
   - can access messages page
   - can compose messages to parents of their students

Commit: "test: deep messaging interaction tests"
```

### Prompt 2.7 — Reports deep tests

```
Create tests/e2e/reports.spec.ts with comprehensive report tests.

1. "Reports Hub — Owner" (storageState: AUTH.owner)
   - hub page loads with report cards: Revenue, Outstanding, Lessons Delivered, Cancellations, Payroll, Utilisation, Teacher Performance
   - each card links to its detail report

2. "Individual Reports — Owner" (for each report sub-page)
   - Revenue report (/reports/revenue): loads with chart or table, date range filter works
   - Outstanding report (/reports/outstanding): shows overdue invoices count/amount
   - Lessons Delivered (/reports/lessons): shows lesson count by period
   - Payroll (/reports/payroll): shows teacher hours and rates
   - Cancellations (/reports/cancellations): shows cancellation rate
   - Utilisation (/reports/utilisation): shows room utilisation percentages
   - Teacher Performance (/reports/teacher-performance): shows teacher metrics
   
   For EACH report page test:
   - page loads without error boundary
   - date range picker exists and changes data when adjusted
   - data table or chart renders with content
   - export/download button exists

3. "Reports — Finance" (storageState: AUTH.finance)
   - can access revenue and payroll reports
   - blocked from teacher-only reports

Commit: "test: comprehensive report page tests for all 7 report types"
```

### Prompt 2.8 — Settings deep tests

```
Create tests/e2e/settings.spec.ts with comprehensive settings tests.

1. "Settings — Owner" (storageState: AUTH.owner)
   For each settings tab, navigate and test:
   
   - Profile tab (default): loads with name/email fields, can edit display name → save → success toast
   - Notifications tab: loads with toggle switches, can toggle a notification → save
   - Organisation tab: shows org name, can see business details
   - Branding tab: loads with colour/logo options
   - Members tab: shows team member list, invite button exists
   - Data Import tab: shows import options (CSV upload area)
   - Scheduling tab: shows scheduling preferences (lesson duration defaults, etc.)
   - Availability tab: shows teacher availability management
   - Calendar Sync tab: shows sync options (Google/iCal)
   - Zoom tab: shows Zoom integration settings
   - Music tab: shows instrument/grade configuration
   - Billing tab: shows invoice/payment settings
   - Rate Cards tab: shows rate card list, can create a new rate card
   - Messaging Settings tab: shows email configuration
   - Booking Page tab: shows public booking page settings
   - Privacy tab: shows GDPR options (data export, deletion)
   
   Each tab test: navigate via query param (/settings?tab=tabname) or click tab → verify main content renders, no error boundary.

2. "Settings — Teacher" (storageState: AUTH.teacher)
   - can see Profile and Notifications tabs
   - cannot see admin-only tabs: Members, Billing, Audit Log, Organisation

Navigate between tabs using both URL params and clicking.
Commit: "test: comprehensive settings tests for all 17+ tabs"
```

---

## PHASE 3: CRM & SPECIALIST MODULES

### Prompt 3.1 — Leads & CRM

```
Create tests/e2e/leads-crm.spec.ts

1. "Leads — Owner" (storageState: AUTH.owner)
   - page loads with lead list (kanban or list view)
   - view toggle: switch between kanban and list views
   - create lead: click "Add Lead" → dialog with name, email, phone, instrument, source fields
   - create lead happy path: fill name = "E2E Lead " + generateTestId(), email, instrument → save → appears in list/board
   - lead funnel chart: renders with pipeline stages
   - search: type lead name → filters
   - lead detail: click a lead → /leads/:id loads with timeline and info
   - lead status: can move lead between stages (New → Contacted → Trial Booked etc.)
   - book trial: if Book Trial button exists, click → modal opens
   - convert lead: if Convert button exists on qualified lead, click → conversion wizard opens
   - export button exists

Commit: "test: deep leads CRM interaction tests"
```

### Prompt 3.2 — Waitlist, Make-Ups, Continuation

```
Create tests/e2e/waitlist-makeups-continuation.spec.ts

1. "Enrolment Waitlist — Owner" (storageState: AUTH.owner)
   - page loads with waitlist entries or empty state
   - add to waitlist button opens dialog with student/instrument/preference fields
   - status filter (waiting/offered/enrolled) works
   - waitlist entry: shows student name, instrument, date added

2. "Make-Up Dashboard — Owner"
   - page loads with make-up stats cards (credits issued, pending, redeemed)
   - needs action section shows students needing make-ups
   - add to waitlist dialog accessible

3. "Continuation — Owner"
   - page loads
   - create continuation run button opens wizard
   - wizard: select term/period → select students → preview → create

Commit: "test: waitlist, make-ups, and continuation module tests"
```

### Prompt 3.3 — Register & Attendance

```
Create tests/e2e/register-attendance.spec.ts

1. "Daily Register — Owner" (storageState: AUTH.owner)
   - page loads showing today's lessons
   - date navigation: click forward/back → date changes, lessons update
   - lesson list: shows time, student name, teacher, status
   - mark attendance: if lesson exists, click attendance button → status dropdown (Present/Absent/Cancelled/Late)
   - mark day complete button visible

2. "Batch Attendance — Owner"
   - page loads
   - date picker selects different dates
   - shows lessons for selected date
   - save button exists
   - can toggle multiple attendance statuses and save

3. "Register — Teacher" (storageState: AUTH.teacher)
   - sees only their own lessons
   - can mark attendance on their lessons

Commit: "test: register and attendance tracking tests"
```

### Prompt 3.4 — Practice & Resources

```
Create tests/e2e/practice-resources.spec.ts

1. "Practice — Owner" (storageState: AUTH.owner)
   - page loads with practice overview (student practice logs or empty state)
   - can create practice assignment: button opens dialog → fill details → save

2. "Resources — Owner" (storageState: AUTH.owner)
   - page loads with resource library
   - upload button exists
   - view toggle (grid/list) works if present
   - category management accessible (create/edit categories)
   - resource cards show file type, name, category

Commit: "test: practice and resources module tests"
```

---

## PHASE 4: PARENT PORTAL (Mobile-first perspective)

### Prompt 4.1 — Portal comprehensive tests

```
Create tests/e2e/parent-portal.spec.ts

1. "Portal — Parent 1" (storageState: AUTH.parent)
   - Portal Home: loads with child's info, upcoming lessons, quick action links
   - Schedule: loads with lesson cards (upcoming lessons or empty state), request button exists
   - Invoices: loads with invoice list, Pay button visible on unpaid invoices
   - Practice: loads with practice timer or log, streak info visible
   - Resources: loads with shared resources from teacher
   - Messages: loads with message list, compose button opens new message request
   - compose message: open compose → type message → send → success toast
   - Profile: loads with parent profile form, can edit phone number → save → success toast
   - Continuation: loads (may have active continuation responses or empty)
   - navigation: click each sidebar/bottom-nav item → correct page loads
   - sign out: click sign out → redirected to /login

2. "Portal Data Isolation — Parent 2" (storageState: AUTH.parent2)
   - sees their own child data, NOT Parent 1's children
   - portal home shows different student(s)

3. "Portal Mobile" (viewport: { width: 390, height: 844 }, storageState: AUTH.parent)
   - bottom nav visible and functional on mobile
   - no horizontal scroll overflow on any portal page
   - invoice cards are full-width and readable
   - compose message works with mobile keyboard

Commit: "test: comprehensive parent portal tests with data isolation and mobile"
```

---

## PHASE 5: CROSS-CUTTING CONCERNS

### Prompt 5.1 — Mobile responsiveness

```
Create tests/e2e/mobile-responsive.spec.ts

Use viewport: { width: 390, height: 844 } for all mobile tests.

1. "Mobile — Login" (storageState: { cookies: [], origins: [] })
   - login page renders without horizontal scroll
   - form fields are full-width
   - keyboard doesn't obscure submit button (just verify button is in viewport)
   - social login buttons have adequate size (min 44px height)

2. "Mobile — Owner Pages" (storageState: AUTH.owner, viewport mobile)
   - dashboard: no horizontal scroll, stat cards stack vertically
   - calendar: mobile layout renders (MobileWeekView or MobileDayView), no overflow
   - students: cards layout (not cramped table), search prominent
   - invoices: card layout, amounts readable
   - settings: tabs scroll horizontally or show as list on mobile
   - sidebar/nav: hamburger menu or mobile nav accessible

3. "Mobile — Error States" (storageState: AUTH.owner)
   - 404 page renders on mobile without overflow
   - no console errors on dashboard load
   - no 5xx network responses across key pages (intercept responses, check status codes)

Commit: "test: mobile responsiveness and error state tests"
```

### Prompt 5.2 — Public pages & booking

```
Create tests/e2e/public-pages.spec.ts

1. "Public Pages" (storageState: { cookies: [], origins: [] })
   - booking page: /book/e2e-test-academy loads (or shows appropriate error for invalid slug)
   - booking page 404: /book/nonexistent-slug-12345 shows not found or error state
   - reset password: /reset-password renders form with email field
   - marketing root (/): redirects appropriately (to login or external site)
   - login page: accessible without auth, renders form
   - signup page: accessible without auth, renders form
   - forgot password: accessible, renders form

Commit: "test: public pages and booking flow tests"
```

---

## PHASE 6: RUN, VERIFY, FIX

### Prompt 6.1 — Run all tests and fix failures

```
Run the full Playwright test suite with:
npx playwright test --project=desktop-chrome --reporter=list 2>&1

Review the output carefully. For each failing test:
1. Check if the failure is a genuine app bug (screenshot/trace will show) or a test selector issue
2. For selector issues: use the Playwright MCP browser tool to visit the page, inspect the actual DOM, and fix the selectors
3. For timing issues: increase timeouts or add waitForPageReady calls
4. For seed data issues: make tests resilient — use conditional logic (if data exists, test it; if empty, verify empty state)

Key patterns to watch for:
- Auth race condition: session not warm on first navigation → helpers.ts goTo already handles this with retry
- Supabase latency: queries taking 5-10s in CI → use 15_000ms timeouts
- Dynamic content: greeting changes with time of day → use regex like /good (morning|afternoon|evening)/i
- Seed data names: look for "Emma", "James", "Sophie" in student lists (from seed data)

After fixing, run again until the suite passes. Then run mobile tests:
npx playwright test --project=mobile-safari --reporter=list 2>&1

Commit all fixes: "test: fix test failures from initial run"
```

### Prompt 6.2 — Workflow smoke test verification

```
Run just the workflow smoke test to verify it still passes:
npx playwright test --project=workflow --reporter=list 2>&1

This should pass — it was the one test file we kept. If it fails, investigate and fix without changing the test structure (it's proven stable).

Commit any fixes: "test: ensure smoke workflow test passes alongside new test suite"
```

---

## APPENDIX: TEST PATTERNS CHEAT SHEET

### Creating data in tests
```typescript
// Use generateTestId() to avoid collisions
const uniqueName = `E2E Test ${generateTestId()}`;

// Always clean up if possible, or use unique names that won't conflict
```

### Handling optional UI elements
```typescript
// DON'T fail if an element might not exist (seed data dependent)
const hasStudents = await page.getByText(/emma/i).first().isVisible({ timeout: 15_000 }).catch(() => false);
if (hasStudents) {
  // test interactions with student data
} else {
  // verify empty state renders correctly
}
```

### Testing dialogs
```typescript
await page.getByRole('button', { name: /add student/i }).first().click();
await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
// interact with dialog...
// close and verify
```

### Testing navigation
```typescript
await safeGoTo(page, '/students', 'Students');
// click something that navigates
await page.getByText(/emma/i).first().click();
await page.waitForURL(/\/students\//, { timeout: 10_000 });
await waitForPageReady(page);
```

### Testing toasts
```typescript
// After an action that should show success
const success = await page.getByText(/success|created|saved/i).first().isVisible({ timeout: 10_000 }).catch(() => false);
expect(success).toBe(true);
```

---

## EXECUTION ORDER

Feed prompts to Claude Code in this exact sequence:
1. **1.1** — Clean slate + helpers (5 min)
2. **2.1** — Dashboard (10 min)
3. **2.2** — Calendar (15 min)
4. **2.3** — Students (15 min)
5. **2.4** — Invoices (15 min)
6. **2.5** — Teachers & Locations (10 min)
7. **2.6** — Messages (10 min)
8. **2.7** — Reports (10 min)
9. **2.8** — Settings (10 min)
10. **3.1** — Leads CRM (10 min)
11. **3.2** — Waitlist/Make-Ups/Continuation (10 min)
12. **3.3** — Register & Attendance (10 min)
13. **3.4** — Practice & Resources (5 min)
14. **4.1** — Parent Portal (15 min)
15. **5.1** — Mobile (10 min)
16. **5.2** — Public Pages (5 min)
17. **6.1** — Run + fix (30 min)
18. **6.2** — Smoke verification (5 min)

**Total estimated time**: ~3-4 hours of Claude Code execution

**Expected final test count**: ~180-220 tests across 16 files + 3 kept files = 19 spec files total
