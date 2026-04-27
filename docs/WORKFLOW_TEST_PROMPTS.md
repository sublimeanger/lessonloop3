# LessonLoop — Complete Workflow E2E Test Suite

## Prompts for Claude Code

> **Purpose:** These are sequential prompts to feed Claude Code to build a comprehensive **workflow-level** Playwright test suite. The existing `tests/e2e/*.spec.ts` files test features **in isolation**. This suite tests **complete real-world user journeys** that cross module boundaries, proving system cohesion.
>
> **How to use:** Feed each prompt (one at a time) to Claude Code. Wait for it to complete, verify tests pass, then move to the next. Prompts are ordered by dependency — earlier prompts create helpers that later ones use.
>
> **Pre-requisite:** All existing isolation tests should be passing first (the 9 remaining errors should be fixed).

---

## PROMPT 0 — Workflow Test Infrastructure

```
I need you to create the infrastructure for a new workflow-level E2E test suite in `tests/e2e/workflows/`.

These tests are DIFFERENT from our existing isolation tests. Isolation tests check individual pages work. Workflow tests simulate complete real-world user journeys that cross multiple features, proving the system works as a cohesive whole.

Create the following files:

### 1. `tests/e2e/workflows/workflow-helpers.ts`

Extend our existing helpers.ts with workflow-specific utilities:

- `createStudentViaWizard(page, data: { firstName, lastName, email?, instrument?, guardianName?, guardianEmail?, guardianPhone? })` — Navigates to /students, opens the StudentWizard, completes all steps (info → guardian → teaching defaults → success), and returns the student name. Waits for the success toast and the student to appear in the list.

- `createLessonViaCalendar(page, data: { studentName, teacherName?, date?, time?, duration?, instrument?, locationName?, roomName? })` — Navigates to /calendar, opens the lesson creation modal, fills fields, saves, and waits for the lesson to appear on the calendar. Returns identifying text.

- `createInvoiceForStudent(page, data: { studentName, amount, description? })` — Navigates to /invoices, opens create invoice modal, selects the student/guardian as payer, adds a line item, saves. Waits for the invoice to appear in the list.

- `sendInvoice(page, invoiceIdentifier: string)` — Finds an invoice in the list, opens it, clicks Send, confirms. Waits for status to change to "sent".

- `markAttendance(page, data: { studentName, status: 'present' | 'absent' | 'late' })` — Navigates to /register, finds the student's lesson for today, marks the specified status.

- `navigateToStudentDetail(page, studentName: string)` — Navigates to /students, searches for the student, clicks to open detail page, waits for all tabs to load.

- `switchToRole(page, role: 'owner' | 'admin' | 'teacher' | 'finance' | 'parent')` — Applies the correct storageState for the given role. This is a helper for multi-role test scenarios.

- `assertNoConsoleErrors(page)` — Collects all console errors during a test and fails if any unexpected errors occurred (filter out known benign warnings).

- `assertNoBrokenImages(page)` — Checks all images on the current page loaded successfully.

- `waitForDataLoad(page)` — Waits for all loading spinners to disappear AND for at least one data element to be visible in main content. More robust than just waitForPageReady.

- `getToastMessages(page)` — Returns an array of all toast messages currently visible.

### 2. `tests/e2e/workflows/workflow.fixtures.ts`

Create a shared test fixture that:
- Extends Playwright's base test
- Auto-collects console errors per test
- Takes screenshots on failure with descriptive names
- Logs the test name and duration on completion
- Provides a `softAssert` method that collects failures without stopping the test, then reports all at the end

### 3. Update `playwright.config.ts`

Add the workflow tests directory to the existing config. Workflow tests should:
- Run AFTER isolation tests (add dependency)
- Use `workers: 1` (workflows are sequential and may share state)
- Have longer timeout: 120_000 (workflows are multi-page)
- Only run on desktop-chrome project (not mobile-safari — we'll add mobile workflow tests separately later)

Use our existing helpers from `tests/e2e/helpers.ts` — import and re-export them. Use AUTH storage states from helpers.ts. Follow all existing patterns and conventions.

Quality gates: lint, typecheck, build must pass.
```

---

## PROMPT 1 — Student Lifecycle Workflow

```
Create `tests/e2e/workflows/student-lifecycle.spec.ts`

This tests the COMPLETE student lifecycle from creation through to invoicing, as an academy owner would experience it in real life.

### Test: "Full student lifecycle — create, schedule, attend, invoice"

As OWNER:
1. Navigate to /students and note the current student count
2. Open the Add Student wizard
3. Complete Step 1 (Student Info): first name "E2E-Workflow", last name "TestStudent-{timestamp}", instrument "Piano", grade/level if available
4. Complete Step 2 (Guardian): name "E2E Guardian", email "e2e-wf-{timestamp}@test.lessonloop.net", phone "07700900001"
5. Complete Step 3 (Teaching Defaults): select a teacher and location if available
6. Submit the wizard
7. **Assert:** Success toast appears
8. **Assert:** Student now appears in the student list
9. **Assert:** Student count incremented by 1

10. Click into the new student's detail page
11. **Assert:** All 10 tabs visible (Overview, Instruments, Teachers, Guardians, Lessons, Practice, Invoices, Credits, Notes, Messages)
12. Click Guardians tab — **Assert:** Guardian name visible
13. Click Instruments tab — **Assert:** Piano listed

14. Navigate to /calendar
15. Create a lesson for this student (today, 30 minutes, if teacher/location data exists use it)
16. **Assert:** Lesson appears on calendar
17. **Assert:** No conflict warnings

18. Navigate to /register
19. Find the lesson for our test student
20. Mark attendance as "present"
21. **Assert:** Attendance status updates

22. Navigate to /invoices
23. Create a new invoice for the student's guardian
24. Add a line item: "Piano lesson — {date}" for £30.00
25. **Assert:** Invoice created with "Draft" status
26. **Assert:** Amount shows £30.00

27. Navigate back to the student detail page
28. Click the Invoices tab
29. **Assert:** The invoice we just created appears in the student's invoice list

30. Navigate to the student detail page > Lessons tab
31. **Assert:** The lesson we created appears with attendance marked as "present"

### Test: "Student deactivation blocks scheduling"

As OWNER:
1. Navigate to the test student created above (or create a fresh one)
2. Find and click the deactivate/make inactive toggle
3. Confirm the deactivation
4. **Assert:** Student status changes to "Inactive"
5. Navigate to /calendar
6. Attempt to create a new lesson for this student
7. **Assert:** Student should not appear in the student picker (they're inactive) OR a warning should appear

### Test: "Guardian sees only their children"

As PARENT (using AUTH.parent):
1. Navigate to /portal/home
2. **Assert:** Portal home loads
3. Note which children are visible (should be Emma and/or James based on test data)
4. **Assert:** E2E-Workflow TestStudent is NOT visible (belongs to a different guardian)
5. Navigate to /portal/schedule
6. **Assert:** Only lessons for this parent's children are shown
7. Navigate to /portal/invoices
8. **Assert:** Only invoices for this parent's children are shown

Important: Use unique timestamps in student/guardian names to avoid test pollution. Clean up test data if possible (deactivate the student at the end). Follow existing test patterns from helpers.ts.
```

---

## PROMPT 2 — Invoice & Payment Workflow

```
Create `tests/e2e/workflows/invoice-payment-lifecycle.spec.ts`

This tests the complete billing workflow: create → send → record payment → verify reports update.

### Test: "Invoice lifecycle — draft → sent → paid"

As OWNER:
1. Navigate to /invoices
2. Note the current counts in the stats widget (draft, sent, paid, overdue counts)
3. Click "Create Invoice"
4. Fill in the modal:
   - Select a payer (search for a known guardian from test data — "Emma"'s guardian)
   - Add a line item: description "Term 1 Piano Lessons", quantity 4, unit price £30.00 (or £3000 in pence if the UI expects minor units)
   - **Assert:** Total shows £120.00
5. Save as draft
6. **Assert:** Toast "Invoice created" (or similar past-tense success)
7. **Assert:** Invoice appears in the list with "Draft" status
8. **Assert:** Draft count incremented by 1

9. Find the new invoice in the list and open it (click into the detail page /invoices/:id)
10. **Assert:** Detail page shows all line items, correct total, "Draft" badge
11. Click "Send Invoice"
12. Confirm the send dialog
13. **Assert:** Status changes to "Sent"
14. **Assert:** Toast confirms sending

15. Navigate back to /invoices
16. **Assert:** Invoice now shows "Sent" status in the list
17. **Assert:** Draft count decremented, Sent count incremented

18. Open the invoice detail again
19. Click "Record Payment" (or "Mark as Paid")
20. Enter payment amount = full total (£120.00)
21. Confirm
22. **Assert:** Status changes to "Paid"
23. **Assert:** Toast confirms payment recorded

24. Navigate to /reports
25. Click into the Revenue report
26. **Assert:** Report loads without errors
27. **Assert:** Revenue data includes the payment we just recorded (or at minimum, the report page doesn't error)

### Test: "Partial payment creates correct remaining balance"

As OWNER:
1. Create a new invoice for £100.00
2. Send it
3. Record a partial payment of £60.00
4. **Assert:** Invoice shows "Partially Paid" or still "Sent" with balance of £40.00
5. Record remaining £40.00
6. **Assert:** Invoice status changes to "Paid"

### Test: "Invoice amounts use minor units correctly"

As OWNER:
1. Create an invoice with amount £99.99
2. **Assert:** Display shows £99.99 (not £99.98 or £100.00 — no floating point errors)
3. If VAT is enabled for the org:
   - **Assert:** VAT calculated at 20% = £20.00 on a £100.00 amount
   - **Assert:** Total = £120.00

### Test: "Finance role can manage invoices but not students"

As FINANCE:
1. Navigate to /invoices
2. **Assert:** Page loads, can see invoice list
3. Navigate to /reports
4. **Assert:** Reports page loads
5. Navigate to /students (should be blocked)
6. **Assert:** Redirected away OR shows "no permission" message
7. Navigate to /teachers (should be blocked)
8. **Assert:** Redirected away OR shows "no permission" message

Follow existing patterns. Use the invoice stats widget to verify counts change. All currency assertions should check for GBP formatting (£ symbol).
```

---

## PROMPT 3 — Calendar & Scheduling Cohesion

```
Create `tests/e2e/workflows/calendar-scheduling.spec.ts`

This tests calendar operations and their cascading effects on other modules (attendance, student records, invoicing).

### Test: "Lesson creation cascades to register and student detail"

As OWNER:
1. Navigate to /calendar
2. Create a new lesson:
   - Student: pick a known student from test data (e.g., "Emma")
   - Teacher: pick a known teacher
   - Date: today
   - Time: 14:00
   - Duration: 30 minutes
   - Location/Room: pick if available
3. **Assert:** Lesson appears on the calendar at the correct time
4. Navigate to /register
5. **Assert:** The lesson appears in today's register view
6. Navigate to /students, find Emma, click into detail
7. Click the Lessons tab
8. **Assert:** The new lesson appears in the student's lesson list

### Test: "Lesson edit updates everywhere"

As OWNER:
1. Find an existing lesson on the calendar (or create one)
2. Click to edit it
3. Change the time from 14:00 to 15:00
4. Save (select "This event only" if recurring dialog appears)
5. **Assert:** Calendar shows lesson at new time
6. Navigate to /register
7. **Assert:** Register shows the updated time
8. Navigate to student detail > Lessons tab
9. **Assert:** Lesson time is updated there too

### Test: "Lesson deletion removes from all views"

As OWNER:
1. Create a new lesson on the calendar (use unique details to identify it)
2. **Assert:** Lesson visible on calendar
3. Navigate to /register — **Assert:** Lesson visible
4. Go back to /calendar
5. Delete the lesson (confirm deletion dialog)
6. **Assert:** Lesson no longer on calendar
7. Navigate to /register — **Assert:** Lesson no longer in register
8. Navigate to student detail > Lessons tab — **Assert:** Lesson gone

### Test: "Calendar filters are consistent with data"

As OWNER:
1. Navigate to /calendar
2. Note total number of visible lessons
3. Apply teacher filter (select one specific teacher)
4. **Assert:** Only that teacher's lessons are visible
5. Clear teacher filter
6. Apply location filter (select one location)
7. **Assert:** Only lessons at that location are visible
8. Clear all filters
9. **Assert:** Back to original count

### Test: "Teacher can only see their assigned lessons"

As TEACHER:
1. Navigate to /calendar
2. **Assert:** Calendar loads
3. Note the lessons visible
4. **Assert:** All visible lessons include the test teacher's name (no other teachers' lessons leak through)
5. Navigate to /register
6. **Assert:** Only this teacher's lessons appear in the register
7. Navigate to /students
8. **Assert:** Only students assigned to this teacher are visible

### Test: "Calendar navigation maintains data integrity"

As OWNER:
1. Navigate to /calendar
2. Note lessons visible this week
3. Click Next week
4. **Assert:** Different set of lessons (or empty)
5. Click Previous week twice (back to last week)
6. **Assert:** Lessons for last week load
7. Click Today
8. **Assert:** Returns to this week's view with original lessons

Use goTo and waitForPageReady from helpers. Test on desktop viewport only.
```

---

## PROMPT 4 — Parent Portal Complete Journey

```
Create `tests/e2e/workflows/parent-portal-journey.spec.ts`

This tests the complete parent experience — the portal is the product's customer-facing side and must be flawless.

### Test: "Parent complete portal walkthrough"

As PARENT (AUTH.parent):
1. Navigate to /portal/home
2. **Assert:** Portal home loads with child data
3. **Assert:** At least one child name visible (Emma or James)
4. **Assert:** Next lesson card visible (or "No upcoming lessons" if none scheduled)
5. **Assert:** Quick action links visible (Schedule, Invoices, Practice)
6. **Assert:** No horizontal overflow (check scrollWidth <= clientWidth)

7. Navigate to /portal/schedule
8. **Assert:** Schedule page loads
9. **Assert:** Shows upcoming lessons or appropriate empty state
10. Note any lesson times shown

11. Navigate to /portal/invoices
12. **Assert:** Invoices page loads
13. **Assert:** Shows invoice list or empty state
14. If invoices exist:
    - **Assert:** Each invoice shows amount with £ symbol
    - **Assert:** Each invoice shows a status badge
    - **Assert:** Invoice cards/rows are tappable

15. Navigate to /portal/practice
16. **Assert:** Practice page loads
17. **Assert:** Shows practice data or empty state for the selected child
18. If practice assignments exist:
    - **Assert:** Assignment cards are visible

19. Navigate to /portal/resources
20. **Assert:** Resources page loads
21. **Assert:** Shows resources or empty state

22. Navigate to /portal/messages
23. **Assert:** Messages page loads
24. **Assert:** "New Message" or compose button is visible
25. Click the compose button
26. **Assert:** Compose dialog/modal opens
27. Close the compose dialog

28. Navigate to /portal/profile
29. **Assert:** Profile page loads
30. **Assert:** Form fields visible (name, email, etc.)
31. **Assert:** Save button exists

### Test: "Parent portal data isolation — multi-child"

As PARENT (AUTH.parent — has Emma + James):
1. Navigate to /portal/home
2. If ChildSwitcher exists (parent has multiple children):
   - Note which child is selected
   - Switch to the other child
   - **Assert:** Content changes (different lessons, practice data, etc.)
   - Switch back
   - **Assert:** Returns to original child's data

As PARENT2 (AUTH.parent2):
3. Navigate to /portal/home
4. **Assert:** Does NOT see Emma or James (those belong to parent1)
5. **Assert:** Only sees their own children's data

### Test: "Parent blocked from all admin routes"

As PARENT (AUTH.parent):
Run through every admin route and verify redirect:
- /dashboard → redirects to /portal/home
- /students → redirects to /portal/home
- /teachers → redirects to /portal/home
- /calendar → redirects to /portal/home
- /invoices → redirects to /portal/home
- /reports → redirects to /portal/home
- /settings → redirects to /portal/home
- /leads → redirects to /portal/home
- /locations → redirects to /portal/home
- /register → redirects to /portal/home
- /messages → redirects to /portal/home (admin messages, not portal)

For each: goto the route, wait up to 10 seconds, assert URL contains /portal/home.

### Test: "Parent portal mobile responsive"

As PARENT (AUTH.parent), viewport 390x844:
1. Navigate to /portal/home
2. **Assert:** No horizontal scroll
3. **Assert:** Bottom nav visible and all items tappable
4. Navigate to each portal page via bottom nav:
   - Schedule: **Assert:** No horizontal scroll, content readable
   - Practice: **Assert:** No horizontal scroll
   - Messages: **Assert:** No horizontal scroll
   - Profile: **Assert:** Form is single-column, save button visible
5. Navigate to /portal/invoices
6. **Assert:** Invoice cards are full-width and readable
7. **Assert:** Amount and status are prominent and visible

IMPORTANT: The parent URL attacks test already exists in url-attacks.spec.ts. These workflow tests focus on the COHESION of the experience, not just access control. We're testing that data flows correctly between portal pages and that the parent sees a coherent, complete experience.
```

---

## PROMPT 5 — Cross-Role Data Consistency

```
Create `tests/e2e/workflows/cross-role-consistency.spec.ts`

This is a critical cohesion test. The SAME data should appear consistently regardless of which role views it. This catches RLS bugs, query scoping errors, and data isolation failures.

### Test: "Student data consistent across owner, admin, and teacher views"

1. As OWNER: Navigate to /students, find "Emma"
   - Note Emma's status (active/inactive)
   - Click into detail, note: instruments listed, guardian names, lesson count (from Lessons tab)
   - Store these values

2. As ADMIN: Navigate to /students, find "Emma"
   - **Assert:** Same status as owner saw
   - Click into detail
   - **Assert:** Same instruments listed
   - **Assert:** Same guardian names
   - **Assert:** Same lesson count (or close — timing tolerance of ±1)

3. As TEACHER: Navigate to /students, find "Emma" (if this teacher is assigned to Emma)
   - **Assert:** Emma is visible in the teacher's student list
   - Click into detail
   - **Assert:** Can see Emma's instruments
   - **Assert:** Can see lessons (at minimum, lessons this teacher teaches)

### Test: "Invoice data consistent between invoices page and student detail"

As OWNER:
1. Navigate to /invoices
2. Note the total number of invoices and pick one specific invoice — record its amount and status
3. Navigate to that invoice's student detail page > Invoices tab
4. **Assert:** The same invoice appears with the same amount and status
5. Navigate to /reports > Outstanding (if the invoice is unpaid)
6. **Assert:** The outstanding report includes this invoice (or at minimum, the report loads without errors)

### Test: "Calendar data consistent with register"

As OWNER:
1. Navigate to /calendar for today
2. Count total lessons visible today
3. Note 3 specific lesson details (student name, time, teacher)
4. Navigate to /register for today
5. **Assert:** Same total number of lessons (±1 for timing)
6. **Assert:** All 3 noted lessons appear in the register with matching student name, time, teacher

### Test: "Settings changes cascade to correct places"

As OWNER:
1. Navigate to /settings
2. Go to the organisation settings tab
3. Note the current org name
4. Navigate to /dashboard
5. **Assert:** Dashboard greeting or sidebar shows the org name
6. Navigate to /settings
7. If there's a VAT toggle, note its current state
8. Navigate to /invoices, create a new invoice
9. **Assert:** VAT line item present/absent matches the setting

### Test: "Message from owner appears in parent portal"

As OWNER:
1. Navigate to /messages
2. Click "New Message"
3. Select a parent recipient (search for the test parent's name or the guardian of a known student)
4. Type a unique message body: "E2E-Workflow-Test-Message-{timestamp}"
5. Send the message
6. **Assert:** Toast confirms message sent

As PARENT (AUTH.parent):
7. Navigate to /portal/messages
8. **Assert:** The message "E2E-Workflow-Test-Message-{timestamp}" appears in the inbox
9. **Assert:** It shows as from the correct sender

This test is CRITICAL because it proves the messaging pipeline works across the staff/parent boundary.

Use descriptive test names that explain the cross-role scenario being tested.
```

---

## PROMPT 6 — Edge Cases & Defensive Scenarios

```
Create `tests/e2e/workflows/edge-cases.spec.ts`

These tests hunt for the bugs that emerge under unusual but realistic conditions.

### Test: "Rapid navigation doesn't break state"

As OWNER:
1. Navigate to /dashboard
2. Immediately click Students in sidebar (don't wait for dashboard to fully load)
3. Immediately click Calendar
4. Immediately click Invoices
5. Immediately click Dashboard
6. Wait for the page to settle
7. **Assert:** Dashboard is displayed correctly (no error boundary, no blank screen)
8. **Assert:** No console errors about cancelled queries or unmounted components
9. **Assert:** Sidebar highlights "Dashboard" correctly

### Test: "Back button doesn't trap or break"

As OWNER:
1. Navigate to /dashboard
2. Click to /students
3. Click on a student to go to /students/:id
4. Click the Lessons tab
5. Press browser back
6. **Assert:** Returns to /students list (NOT to dashboard, not stuck)
7. Press browser back again
8. **Assert:** Returns to /dashboard

### Test: "Deep link to student detail loads correctly"

As OWNER:
1. Navigate to /students, find a student, note their URL (/students/:id)
2. Open a NEW page context (simulate opening the link directly)
3. Navigate directly to /students/:id
4. **Assert:** Student detail page loads with student name visible
5. **Assert:** All 10 tabs are present
6. **Assert:** No loading errors

### Test: "Deep link to invoice detail loads correctly"

As OWNER:
1. Navigate to /invoices, find an invoice, note its URL (/invoices/:id)
2. Navigate directly to that URL in a fresh page
3. **Assert:** Invoice detail loads with correct amount and status

### Test: "Empty state rendering when no data exists"

As OWNER:
1. Navigate to /leads (may have no leads in test data)
2. If leads list is empty:
   - **Assert:** EmptyState component visible (warm, helpful message — NOT "No data found")
   - **Assert:** CTA button to create first lead is visible and clickable
3. Navigate to /waitlist (may be empty)
4. If waitlist is empty:
   - **Assert:** EmptyState component visible with helpful guidance
5. Navigate to /make-ups (may be empty)
6. If empty: **Assert:** EmptyState, not a broken/blank page

### Test: "Very long content doesn't break layouts"

As OWNER:
1. Navigate to /students
2. If possible, search for a student with a very long name (or note that names are properly truncated)
3. Navigate to /messages
4. If messages exist with long content:
   - **Assert:** Message text doesn't overflow its container
   - **Assert:** No horizontal scrollbar on the messages page
5. Check the sidebar:
   - **Assert:** No sidebar items overflow their container
   - **Assert:** All nav items are readable

### Test: "Session/auth edge cases"

UNAUTHENTICATED (clear storage state):
1. Navigate to /dashboard
2. **Assert:** Redirected to /login
3. Navigate to /students/some-fake-uuid
4. **Assert:** Redirected to /login
5. Navigate to /portal/home
6. **Assert:** Redirected to /login
7. Navigate to /invoices
8. **Assert:** Redirected to /login

### Test: "Page doesn't crash with invalid route params"

As OWNER:
1. Navigate to /students/not-a-real-uuid
2. **Assert:** Either 404 page or helpful "Student not found" message — NOT a crash/error boundary
3. Navigate to /invoices/not-a-real-uuid
4. **Assert:** Either 404 or "Invoice not found" — NOT a crash
5. Navigate to /leads/not-a-real-uuid
6. **Assert:** Graceful handling, no crash
7. Navigate to /reports/not-a-real-route
8. **Assert:** 404 or redirect, not crash

### Test: "Concurrent tab usage doesn't cause issues"

As OWNER:
1. Open page 1: /students
2. Open page 2 (new browser context with same auth): /calendar
3. In page 1: search for a student
4. In page 2: navigate forward a week
5. Go back to page 1
6. **Assert:** Student search results still visible (no stale state)
7. Go back to page 2
8. **Assert:** Calendar still shows the forward week

Use Playwright's multiple page contexts for the concurrent tab test.
```

---

## PROMPT 7 — Reports & Analytics Cohesion

```
Create `tests/e2e/workflows/reports-analytics.spec.ts`

Reports must reflect the actual data in the system. This tests that report numbers are grounded in reality.

### Test: "All 7 report types load without errors"

As OWNER:
1. Navigate to /reports
2. **Assert:** Reports hub loads with report cards visible
3. **Assert:** These report types are all visible:
   - Revenue
   - Outstanding Payments
   - Lessons Delivered
   - Cancellation Rate
   - Payroll
   - Room Utilisation
   - Teacher Performance

4. Click into Revenue report (/reports/revenue)
5. **Assert:** Page loads, date range filter visible, data or empty state shown
6. Navigate back to /reports

7. Click into Outstanding report (/reports/outstanding)
8. **Assert:** Page loads without errors
9. Navigate back

10. Click into Lessons Delivered report (/reports/lessons)
11. **Assert:** Page loads without errors
12. Navigate back

13. Click into Cancellation report (/reports/cancellations)
14. **Assert:** Page loads without errors
15. Navigate back

16. Click into Payroll report (/reports/payroll)
17. **Assert:** Page loads without errors
18. Navigate back

19. Click into Utilisation report (/reports/utilisation)
20. **Assert:** Page loads without errors
21. Navigate back

22. Click into Teacher Performance (/reports/teacher-performance)
23. **Assert:** Page loads without errors

For each report: **Assert** no console errors, no error boundaries, and date range filters are functional.

### Test: "Report date filters actually change results"

As OWNER:
1. Navigate to /reports/revenue
2. Note the data shown for the default date range
3. Change the date range to "Last Month" (or adjust start/end date pickers)
4. **Assert:** Data changes or shows empty state for the new range
5. Change to "Last Year" or a broader range
6. **Assert:** Data shows (likely more data for a broader range)
7. Reset to default
8. **Assert:** Returns to original data

### Test: "Teacher can access their allowed reports"

As TEACHER:
1. Navigate to /reports
2. **Assert:** Reports page loads
3. **Assert:** Can see at minimum: Lessons Delivered, Payroll (teacher should see their own payroll)
4. Click into Payroll report
5. **Assert:** Report loads, shows data relevant to this teacher
6. Navigate to /reports/revenue
7. **Assert:** Either blocked (redirect/permission denied) or shows limited data appropriate for a teacher role

### Test: "Finance role report access"

As FINANCE:
1. Navigate to /reports
2. **Assert:** Reports page loads
3. **Assert:** Can see Revenue, Outstanding Payments
4. Click Revenue report
5. **Assert:** Loads with financial data
6. Click Outstanding report
7. **Assert:** Loads with outstanding invoice data

Use goTo helper for navigation. All assertions should use expect with reasonable timeouts.
```

---

## PROMPT 8 — Settings & Configuration Cascade

```
Create `tests/e2e/workflows/settings-cascade.spec.ts`

Settings changes must propagate to every part of the app that uses them. These tests verify that.

### Test: "Settings page — all tabs load"

As OWNER:
1. Navigate to /settings
2. **Assert:** Settings page loads
3. Iterate through every settings tab that should be visible to an owner:
   - Profile (default)
   - Notifications
   - Organisation
   - Calendar
   - Invoicing
   - Rate Cards
   - Terms
   - Integrations
   - Members
   - Subscription
   - Privacy
   - LoopAssist
   - Audit Log
   
   For each tab:
   - Click the tab
   - **Assert:** Content loads (not empty, not error)
   - **Assert:** No console errors
   
4. **Assert:** Each tab has some meaningful content (form fields, tables, or informational content)

### Test: "Profile settings save and persist"

As OWNER:
1. Navigate to /settings?tab=profile
2. Note the current name value
3. Change the name to include " - E2E Test" suffix
4. Click Save
5. **Assert:** Success toast appears
6. Refresh the page (or navigate away and back)
7. **Assert:** The name still has the " - E2E Test" suffix (change persisted)
8. Restore the original name
9. Save again
10. **Assert:** Success toast, name restored

### Test: "Teacher sees limited settings tabs"

As TEACHER:
1. Navigate to /settings
2. **Assert:** Settings page loads
3. **Assert:** Profile tab visible
4. **Assert:** Notifications tab visible
5. **Assert:** Organisation tab NOT visible (or read-only)
6. **Assert:** Members tab NOT visible
7. **Assert:** Subscription tab NOT visible
8. **Assert:** Audit Log tab NOT visible

### Test: "Notification preferences save per user"

As OWNER:
1. Navigate to /settings?tab=notifications
2. If there are toggles:
   - Note the current state of the first toggle
   - Click it to change
   - Click Save
   - **Assert:** Success toast
   - Navigate away to /dashboard
   - Navigate back to /settings?tab=notifications
   - **Assert:** Toggle is still in the changed state
   - Restore original state and save

### Test: "Members tab shows correct team"

As OWNER:
1. Navigate to /settings?tab=members (or the equivalent tab that shows team members)
2. **Assert:** Page loads with at least one member listed
3. **Assert:** Current user (owner) is visible with "Owner" role badge
4. **Assert:** If other members exist, their roles are displayed correctly
5. **Assert:** Invite button exists and is clickable

Follow existing patterns. Use descriptive assertions that explain what's being checked.
```

---

## PROMPT 9 — Lead Pipeline: Enquiry to Enrolled Student

```
Create `tests/e2e/workflows/lead-pipeline.spec.ts`

This tests the COMPLETE lead-to-student conversion pipeline. LessonLoop's lead stages are:
enquiry → contacted → trial_booked → trial_completed → enrolled | lost

The "enrolled" stage triggers actual student creation — this is the business-critical conversion.

### Test: "Lead full pipeline — create, progress, add activities, convert to student"

As OWNER:
1. Navigate to /leads
2. Note the current lead count (if visible)
3. Click "Add Lead"
4. **Assert:** Modal/dialog opens
5. Fill in lead details:
   - Contact name: "E2E-Pipeline-{timestamp}"
   - Email: "e2e-pipeline-{timestamp}@test.lessonloop.net"
   - Phone: "07700900002"
   - Source: "Website" (if source picker exists)
   - Add a student/child: first name "PipelineChild", instrument "Guitar"
6. Save
7. **Assert:** Toast "Lead created" (or similar past-tense success)
8. **Assert:** Lead appears in the list/kanban in "Enquiry" stage

9. Click on the lead to open /leads/:id detail page
10. **Assert:** Contact name, email, phone all visible
11. **Assert:** Student "PipelineChild" listed with "Guitar" instrument
12. **Assert:** Activity/timeline section visible
13. **Assert:** Current stage shows "Enquiry"

14. PROGRESS THE PIPELINE — Change stage to "Contacted"
    - Find the stage selector/dropdown or pipeline buttons
    - Change to "Contacted"
    - **Assert:** Stage updates, activity log records the change

15. Add a note/activity:
    - Click add note/activity button
    - Enter "Called and discussed lesson options - interested in Thursday 4pm slot"
    - Save
    - **Assert:** Note appears in the activity timeline with timestamp

16. Progress to "Trial Booked"
    - Change stage to "Trial Booked"
    - **Assert:** Stage badge updates to amber/yellow (trial_booked colour)

17. Progress to "Trial Completed"
    - Change stage to "Trial Completed"
    - **Assert:** Stage updates

18. CONVERT TO STUDENT — Progress to "Enrolled"
    - Change stage to "Enrolled"
    - **Assert:** Conversion dialog or confirmation appears
    - If a conversion wizard appears:
      - Confirm student details (PipelineChild, Guitar)
      - Confirm guardian details (E2E-Pipeline contact)
      - Submit
    - **Assert:** Toast "Lead converted" or "Students enrolled"
    - **Assert:** Lead stage shows "Enrolled" with green badge

19. VERIFY THE CONVERSION CASCADED:
    - Navigate to /students
    - Search for "PipelineChild"
    - **Assert:** Student exists in the student list (the lead conversion actually created a real student)
    - Click into the student detail
    - **Assert:** Guitar listed in instruments
    - Click Guardians tab
    - **Assert:** Guardian with the lead's contact email exists

20. Navigate back to /leads
    - Find the original lead
    - **Assert:** Shows "Enrolled" status
    - **Assert:** converted_at timestamp visible (or similar "converted" indicator)

### Test: "Lead marked as lost"

As OWNER:
1. Create a new lead: "E2E-Lost-{timestamp}"
2. Open the lead detail page
3. Change stage to "Lost"
4. If a reason picker appears, select a reason (e.g., "Not interested" or "Price")
5. **Assert:** Lead shows "Lost" status with red badge
6. **Assert:** Lead does NOT appear in active pipeline views (unless "show lost" filter is on)

### Test: "Lead detail — activity timeline integrity"

As OWNER:
1. Navigate to an existing lead detail page
2. **Assert:** Activity timeline shows entries in reverse chronological order (newest first)
3. If stage changes were recorded:
   - **Assert:** Each stage change shows the old and new stage
   - **Assert:** Timestamps are in chronological order
4. **Assert:** Notes added by the user show correct content and attribution

### Test: "Kanban vs List view toggle"

As OWNER:
1. Navigate to /leads
2. If kanban view toggle exists:
   - Click kanban view
   - **Assert:** Leads are arranged in stage columns (Enquiry, Contacted, Trial Booked, Trial Completed)
   - **Assert:** Lead cards show contact name and instrument
   - Switch to list view
   - **Assert:** Same leads now in a table/list format
   - **Assert:** Stage shown as a badge on each row
3. If only one view exists, verify it shows leads with stage indicators

### Test: "Lead source tracking"

As OWNER:
1. Create a lead with source "Referral"
2. Create another lead with source "Phone"
3. Navigate to /leads
4. If source filter exists:
   - Filter by "Referral"
   - **Assert:** Only the referral lead shows
   - Clear filter
   - **Assert:** Both leads visible

CRITICAL: The lead-to-student conversion (step 18-19) is the most important test here. If a lead converts to "Enrolled" but no student appears in /students, the pipeline is broken. This test MUST verify the actual data cascade.

Use timestamps in all created lead names to avoid collisions. Handle the case where conversion might not be supported via UI (some orgs might not have it enabled) — use conditional assertions.
```

---

## PROMPT 9A — Waitlist: Waiting to Enrolled

```
Create `tests/e2e/workflows/waitlist-pipeline.spec.ts`

This tests the complete enrolment waitlist pipeline. The waitlist stages are:
waiting → offered → accepted → enrolled (converts to student) | declined/expired/withdrawn

The waitlist is how music academies manage demand — students wait for slots, get offered a place, and convert to enrolled students.

### Test: "Waitlist full pipeline — add entry, offer slot, track status"

As OWNER:
1. Navigate to /waitlist
2. Note the stats at the top: waiting count, offered count, accepted count, enrolled count
3. Click "Add to Waiting List" (or equivalent button)
4. **Assert:** Modal/dialog opens
5. Fill in the entry:
   - Contact name: "E2E-Waitlist-{timestamp}"
   - Email: "e2e-waitlist-{timestamp}@test.lessonloop.net"
   - Phone: "07700900003"
   - Child first name: "WaitlistChild"
   - Instrument: "Piano"
   - Preferred day: "Thursday" (if day picker exists)
   - Experience level: "Beginner" (if available)
   - Duration: 30 minutes
6. Save
7. **Assert:** Toast "Added to waiting list" (or similar)
8. **Assert:** Entry appears in the list with "Waiting" status badge
9. **Assert:** Waiting count in stats incremented by 1

10. Find the new waitlist entry and open its detail/actions
11. If "Offer Slot" button exists:
    - Click "Offer Slot"
    - **Assert:** Offer dialog opens
    - Fill in offered details:
      - Day: Thursday
      - Time: 16:00
      - Teacher: select a teacher (if picker available)
      - Location: select a location
      - Rate: £30.00 (or £3000 minor units)
    - Submit the offer
    - **Assert:** Entry status changes to "Offered"
    - **Assert:** Offered count in stats incremented

12. Check the entry shows offered details:
    - **Assert:** Offered day, time, teacher, location visible
    - **Assert:** Offer expiry date shown (if applicable)

### Test: "Waitlist status filter works"

As OWNER:
1. Navigate to /waitlist
2. If status filter exists:
   - Select "Waiting" filter
   - **Assert:** Only entries with "Waiting" status shown
   - Select "Offered" filter
   - **Assert:** Only offered entries shown
   - Select "All" or clear filter
   - **Assert:** All entries visible
3. If search exists:
   - Search for the test entry name
   - **Assert:** Filtered correctly

### Test: "Waitlist stats match actual entries"

As OWNER:
1. Navigate to /waitlist
2. Note the stats widget values (waiting, offered, accepted, enrolled_this_term)
3. Switch filter to "Waiting" — count visible entries
4. **Assert:** Visible count matches the "waiting" stat number
5. Switch to "Offered" — count visible entries
6. **Assert:** Visible count matches "offered" stat

### Test: "Waitlist entry shows correct priority"

As OWNER:
1. Create a waitlist entry with priority "High" (if priority field exists)
2. **Assert:** Entry shows a priority indicator (badge, icon, or sorting position)
3. Create another with "Normal" priority
4. **Assert:** High priority entry appears above or has a distinct indicator vs normal

### Test: "Waitlist instrument grouping"

As OWNER:
1. Navigate to /waitlist
2. If instrument-based grouping or filtering exists:
   - Filter/group by "Piano"
   - **Assert:** Only piano waitlist entries visible
   - Clear the filter

NOTE: The full waitlist-to-student conversion (accepted → enrolled → student created) is a complex flow that may require Supabase edge function calls behind the scenes. Test as far as the UI allows — if the conversion button exists, click it and verify. If not, verify the status progression up to "offered" and that the data is correctly displayed.

Use timestamps in contact names. Handle empty waitlists gracefully.
```

---

## PROMPT 9B — Make-Up Credits: Cancellation to Credit to Invoice Offset

```
Create `tests/e2e/workflows/makeup-credits.spec.ts`

This tests the make-up credit lifecycle. The chain is:
lesson cancelled → credit issued to student → credit appears on student detail (Credits tab) → credit can be redeemed against a make-up lesson → credit can offset a future invoice

Make-up credits are a core music academy concept — when a student cancels with enough notice, they get a credit they can use later. This must work flawlessly or academies lose money.

### Test: "Issue credit and verify it appears on student detail"

As OWNER:
1. Navigate to /students, find "Emma" (or a known test student)
2. Click into the student detail page
3. Click the "Credits" tab
4. Note the current credit balance (might be £0.00 or have existing credits)
5. Note the number of credits listed

6. Find the "Issue Credit" button (should be in the Credits tab or as a page action)
7. Click "Issue Credit"
8. **Assert:** IssueCreditModal opens
9. Fill in:
   - Amount: £30.00 (or 3000 in minor units if raw input)
   - Notes: "E2E test credit — cancelled lesson {timestamp}"
   - If a lesson picker exists, optionally link to a lesson
10. Submit
11. **Assert:** Toast "Make-up credit issued"
12. **Assert:** New credit appears in the credits list with "Available" status
13. **Assert:** Credit balance increased by £30.00
14. **Assert:** Credit shows the notes we entered

### Test: "Credit balance badge on student card/list"

As OWNER:
1. Navigate to /students
2. Find the student we issued a credit to
3. **Assert:** If CreditBalanceBadge exists on the student card/row, it shows the correct balance (e.g., "£30.00 credit")
4. Click into student detail
5. **Assert:** Credits tab shows matching balance

### Test: "Available vs redeemed vs expired credits display correctly"

As OWNER:
1. Navigate to a student's Credits tab
2. If credits exist:
   - **Assert:** Available credits show green/active badge
   - **Assert:** Redeemed credits (if any) show "Redeemed" badge with the lesson they were used for
   - **Assert:** Expired credits (if any) show "Expired" badge
   - **Assert:** Only available (unredeemed, non-expired) credits count toward the balance total
3. **Assert:** The total available balance at the top matches the sum of available credit values

### Test: "Make-up dashboard shows correct data"

As OWNER:
1. Navigate to /make-ups
2. **Assert:** Page loads without errors
3. If make-up data exists:
   - **Assert:** Entries show student name, original lesson date, credit status
   - **Assert:** Available make-up slots shown (if the org has configured them)
   - **Assert:** Credits that have been redeemed show which make-up lesson they were used for
4. If empty:
   - **Assert:** Helpful empty state (not "No data found" but guidance on how make-ups work)

### Test: "Credit lifecycle visible across multiple views"

As OWNER:
1. Issue a credit to a student (or use one created in a previous test)
2. Navigate to /students → student detail → Credits tab
   - **Assert:** Credit visible with "Available" status and £30.00 value
3. Navigate to /make-ups
   - **Assert:** If the make-ups dashboard aggregates credits, the student and credit appear
4. Navigate back to student detail → Invoices tab
   - If the invoice creation flow has a "Apply credits" option:
     - **Assert:** Available credit amount is shown when creating an invoice for this student

### Test: "Credits cannot be double-redeemed"

As OWNER:
1. Navigate to a student's Credits tab
2. Find an available credit
3. If a "Redeem" action exists:
   - Redeem the credit (apply to a lesson or mark as used)
   - **Assert:** Credit status changes to "Redeemed"
   - **Assert:** The same credit no longer appears in "available" credits
   - **Assert:** Credit balance decreased by the redeemed amount
4. If redeem is not available via UI, verify:
   - **Assert:** Redeemed credits in the list show the redemption date and linked lesson
   - **Assert:** They are NOT counted in the available balance

NOTE: The connection between "lesson cancelled → credit auto-issued" requires a lesson cancellation flow. If the calendar cancellation doesn't auto-issue credits, test the manual issuance path (Issue Credit button). The unit tests already cover the calculation logic — these E2E tests prove the UI correctly reflects the credit state.

All currency values must show with £ symbol. Use formatCurrencyMinor display format (£30.00 not 3000).
```

---

## PROMPT 9C — Term Continuation: End-of-Term Parent Response Flow

```
Create `tests/e2e/workflows/term-continuation.spec.ts`

This tests the term continuation workflow — the process academies use at the end of each term to confirm which students are continuing next term. The flow is:

ADMIN SIDE: Create run (draft) → Send to parents → Monitor responses → Send reminders → Deadline passes → Process responses → Complete
PARENT SIDE: Receive continuation → View lesson summary + fees → Respond (continuing/withdrawing) → See confirmation

This is business-critical because it determines next term's revenue and scheduling.

### Test: "Continuation page loads and shows correct structure"

As OWNER:
1. Navigate to /continuation
2. **Assert:** Page loads without errors
3. **Assert:** If an active continuation run exists:
   - Run status is visible (draft/sent/reminding/deadline_passed/completed)
   - Summary stats shown: total students, confirmed, withdrawing, pending, no_response
   - Progress bar reflects the proportions
   - Student response table/list is visible
4. If no active run exists:
   - **Assert:** "Create Run" or "Start Continuation" button exists
   - **Assert:** Empty state explains what continuation is and how to start

### Test: "Continuation run summary stats are consistent"

As OWNER:
1. Navigate to /continuation
2. If an active run exists:
   - Note the summary: confirmed=X, withdrawing=Y, pending=Z, no_response=W, assumed_continuing=A
   - **Assert:** total_students = confirmed + withdrawing + pending + no_response + assumed_continuing
   - **Assert:** The progress bar segments add up to 100%
   - If individual response rows are visible:
     - Count rows by status
     - **Assert:** Counts match the summary stats

### Test: "Continuation response statuses display correctly"

As OWNER:
1. Navigate to /continuation
2. If responses are listed:
   - **Assert:** "Continuing" responses show green/success badge
   - **Assert:** "Withdrawing" responses show red/destructive badge
   - **Assert:** "Pending" responses show muted/secondary badge
   - **Assert:** "No Response" shows distinct indicator
   - **Assert:** "Assumed Continuing" (if policy is enabled) shows appropriate badge
3. If a student has responded:
   - **Assert:** Response date is visible
   - **Assert:** If withdrawing, withdrawal reason is shown (if provided)

### Test: "Continuation actions available based on run status"

As OWNER:
1. Navigate to /continuation
2. If run status is "sent" or "reminding":
   - **Assert:** "Send Reminders" button exists
   - **Assert:** If deadline has passed, "Process" or "Mark Deadline Passed" action exists
3. If run status is "deadline_passed":
   - **Assert:** Bulk process actions exist (process confirmed, process withdrawals, process all)
4. If run status is "completed":
   - **Assert:** Run shows as completed with final stats
   - **Assert:** Option to create new run exists (if another term is defined)

### Test: "Past continuation runs are visible"

As OWNER:
1. Navigate to /continuation
2. If past/completed runs exist:
   - **Assert:** Past runs section is visible
   - **Assert:** Each past run shows the term names, final stats, and completion date
   - **Assert:** Can click into a past run to view its details

### Test: "Parent continuation response page"

As PARENT (AUTH.parent):
1. Navigate to /portal/continuation
2. **Assert:** Page loads
3. If a pending continuation exists for this parent's children:
   - **Assert:** Child name visible
   - **Assert:** Lesson summary visible (day, time, teacher, instrument, duration)
   - **Assert:** Fee for next term visible with £ symbol
   - **Assert:** "Continue" and "Withdraw" buttons visible
   - **Assert:** Page explains the deadline clearly
4. If no pending continuation:
   - **Assert:** Appropriate message (no pending continuation to respond to)

5. If already responded:
   - **Assert:** Shows confirmation of the response already given
   - **Assert:** Response cannot be changed (or can be changed with clear UI)

### Test: "Continuation data visible on student detail"

As OWNER:
1. Navigate to /students, find a student who is part of a continuation run
2. Click into student detail
3. Check if continuation status is visible anywhere (Overview tab or a dedicated section)
4. **Assert:** If the student has responded "Continuing", this is reflected
5. **Assert:** If the student has responded "Withdrawing", this is reflected

NOTE: Creating a full continuation run from scratch requires terms to be configured (current term + next term) and students with recurring lessons. If test data doesn't have this setup, test what's available — at minimum verify the page loads, stats are consistent, and the parent portal page handles the no-continuation case gracefully.

The token-based response flow (/respond/continuation?token=X&action=continuing) is a public route used from email links. If you can construct a test token, test it. Otherwise, test the authenticated portal path.
```

---

## PROMPT 10 — Mobile Workflow Cohesion

```
Create `tests/e2e/workflows/mobile-cohesion.spec.ts`

Tests that the COMPLETE workflow experience works on mobile. Not just "page loads" but actual user journeys.

All tests use viewport: { width: 390, height: 844 } (iPhone 14 equivalent)

### Test: "Mobile owner navigation flow"

As OWNER, viewport 390x844:
1. Navigate to /dashboard
2. **Assert:** Dashboard loads, no horizontal scroll
3. **Assert:** Greeting and stats visible
4. Open the mobile sidebar/menu (hamburger icon or equivalent)
5. **Assert:** Menu opens, all navigation items visible
6. Click "Students" in the menu
7. **Assert:** Students page loads, no horizontal scroll
8. **Assert:** Student cards/list readable
9. Use search — type "Emma"
10. **Assert:** Search results filter correctly
11. Click on Emma
12. **Assert:** Student detail page loads
13. **Assert:** Tabs are scrollable or all visible
14. Click back to students list
15. Open menu again, navigate to Calendar
16. **Assert:** Calendar loads in mobile view
17. **Assert:** Lessons are visible and tappable

### Test: "Mobile parent portal complete journey"

As PARENT, viewport 390x844:
1. Navigate to /portal/home
2. **Assert:** No horizontal scroll on any page
3. **Assert:** Bottom nav visible with correct items
4. Tap Schedule in bottom nav
5. **Assert:** Schedule page loads, no overflow
6. Tap Invoices (bottom nav or navigation)
7. **Assert:** Invoices page loads, amounts visible and formatted
8. Tap Practice
9. **Assert:** Practice page loads
10. Tap Messages
11. **Assert:** Messages page loads
12. Tap compose button
13. **Assert:** Compose opens (should be near-full-screen on mobile)
14. Close compose
15. Navigate to Profile
16. **Assert:** Form is single-column
17. **Assert:** All form fields and save button visible without scrolling horizontally

### Test: "Mobile modals and dialogs are usable"

As OWNER, viewport 390x844:
1. Navigate to /students
2. Click Add Student
3. **Assert:** Wizard opens as near-full-screen or large dialog
4. **Assert:** Form fields are full-width
5. **Assert:** Submit/Next button is reachable (not hidden below keyboard)
6. Close the wizard

7. Navigate to /invoices
8. Click Create Invoice
9. **Assert:** Modal is large/full-screen on mobile
10. **Assert:** Form controls are touch-friendly (large enough)
11. Close

12. Navigate to /messages
13. Click compose
14. **Assert:** Compose is full-screen or near-full-screen
15. Close

### Test: "No horizontal overflow on any page (mobile)"

As OWNER, viewport 390x844:
Run through EVERY key page and check for horizontal overflow:

Pages to check:
/dashboard, /calendar, /students, /teachers, /locations, /invoices, /reports, /messages, /practice, /resources, /register, /batch-attendance, /leads, /waitlist, /make-ups, /continuation, /settings, /help

For each page:
```javascript
const body = await page.evaluate(() => ({
  scrollWidth: document.body.scrollWidth,
  clientWidth: document.body.clientWidth,
}));
expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 5);
```

Also run for portal pages as PARENT:
/portal/home, /portal/schedule, /portal/invoices, /portal/practice, /portal/resources, /portal/messages, /portal/profile

This is a comprehensive sweep — every page must pass.
```

---

## PROMPT 11 — Data Integrity & Deletion Cascades

```
Create `tests/e2e/workflows/data-integrity.spec.ts`

Tests that data operations maintain referential integrity and that the DeleteValidationDialog properly prevents destructive cascades.

### Test: "Cannot delete teacher with assigned future lessons"

As OWNER:
1. Navigate to /teachers
2. Find a teacher who has future lessons (the E2E test teacher likely has some)
3. Click the delete button/option for that teacher
4. **Assert:** DeleteValidationDialog appears
5. **Assert:** Dialog shows that deletion is BLOCKED
6. **Assert:** Reason mentions "future lessons" or "assigned students" (dependencies)
7. Close the dialog
8. **Assert:** Teacher is still in the list (not deleted)

### Test: "Cannot delete location with active rooms/lessons"

As OWNER:
1. Navigate to /locations
2. Find a location that has rooms or scheduled lessons
3. Attempt to delete it
4. **Assert:** DeleteValidationDialog shows blocking dependencies
5. Close
6. **Assert:** Location still exists

### Test: "Student deactivation vs deletion"

As OWNER:
1. Navigate to /students
2. Find a student who has lessons/invoices
3. Attempt to delete (if delete button exists)
4. **Assert:** Either deletion is blocked (dependencies exist) or the student is soft-deleted (set to inactive, not removed)
5. **Assert:** No orphaned records — invoices and lessons still reference the student

### Test: "Invoice deletion checks"

As OWNER:
1. Navigate to /invoices
2. Find a "Paid" invoice
3. Attempt to delete it
4. **Assert:** Either deletion is blocked (paid invoices shouldn't be deleted for audit trail) or requires explicit confirmation with warning about audit implications
5. Find a "Draft" invoice
6. If draft can be deleted:
   - Delete it
   - **Assert:** Removed from list
   - Navigate to the student's detail > Invoices tab
   - **Assert:** Invoice no longer appears there either

### Test: "Recurring lesson series edit — 'this only' vs 'all future'"

As OWNER:
1. Navigate to /calendar
2. Find a recurring lesson (if test data has one) — OR create a recurring lesson if the UI supports it
3. Click on one occurrence to edit
4. **Assert:** Recurring action dialog appears: "This event only" / "This and all future events"
5. Select "This event only"
6. Make a change (e.g., change time)
7. Save
8. **Assert:** Only that one occurrence changed
9. Check adjacent weeks — **Assert:** Other occurrences unchanged

10. Click on another occurrence of the same series
11. Select "This and all future events"
12. Make a change (e.g., change time)
13. Save
14. **Assert:** This and all future occurrences changed
15. Check previous weeks — **Assert:** Past occurrences unchanged

NOTE: If test data doesn't have recurring lessons, this test can be marked as skipped with a clear message about why. Don't create complex recurring series just for this test.

### Test: "Bulk operations maintain integrity"

As OWNER:
1. Navigate to /students
2. If bulk select is available:
   - Select multiple students
   - If bulk actions include "Export" or "Message":
     - Execute the bulk action
     - **Assert:** Action applies to all selected students
   - If bulk delete is available:
     - **Assert:** Confirmation shows count of affected items
     - Cancel (don't actually delete)

Use try/catch and conditional logic — some of these features may not have UI yet or may require specific test data. Tests should be resilient and skip gracefully when preconditions aren't met.
```

---

## PROMPT 12 — Performance & Load Resilience

```
Create `tests/e2e/workflows/performance-resilience.spec.ts`

Tests that the app handles real-world scale and doesn't degrade.

### Test: "Dashboard loads within 5 seconds"

As OWNER:
1. const start = Date.now()
2. Navigate to /dashboard
3. Wait for stat cards to be visible
4. const loadTime = Date.now() - start
5. **Assert:** loadTime < 5000 (5 seconds)
6. Log the actual load time for tracking

### Test: "Student list loads and is interactive within 3 seconds"

As OWNER:
1. Measure time from navigation to first student visible
2. Navigate to /students
3. Wait for at least one student name to appear
4. **Assert:** Time < 3000ms
5. Type in search box — **Assert:** Response within 500ms
6. Clear search — **Assert:** Full list returns within 500ms

### Test: "Calendar renders week view within 5 seconds"

As OWNER:
1. Measure time from navigation to first lesson visible
2. Navigate to /calendar
3. Wait for day headers and at least one lesson
4. **Assert:** Time < 5000ms
5. Navigate to next week — **Assert:** Loads within 3000ms
6. Navigate back — **Assert:** Loads within 2000ms (should be cached)

### Test: "Reports page doesn't timeout"

As OWNER:
1. Navigate to each report page with a 15-second timeout
2. For each (/reports/revenue, /reports/outstanding, /reports/lessons, /reports/cancellations, /reports/payroll, /reports/utilisation, /reports/teacher-performance):
   - Navigate to the page
   - **Assert:** Page loads within 15 seconds
   - **Assert:** No error boundary or crash

### Test: "Navigation between pages is instant when cached"

As OWNER:
1. Navigate to /dashboard (first load — cold)
2. Navigate to /students (first load — cold)
3. Navigate to /calendar (first load — cold)
4. Navigate back to /dashboard
5. Measure time until dashboard stat cards visible
6. **Assert:** < 2000ms (cached by React Query)
7. Navigate back to /students
8. **Assert:** < 2000ms (cached)

### Test: "Offline banner appears when connection lost"

As OWNER:
1. Navigate to /dashboard, wait for full load
2. Simulate offline: await page.context().setOffline(true)
3. Wait 2 seconds
4. **Assert:** OfflineBanner appears (or some offline indicator)
5. Restore: await page.context().setOffline(false)
6. Wait 2 seconds
7. **Assert:** OfflineBanner disappears
8. **Assert:** Data refreshes (or at minimum, no stale error state)

### Test: "Memory doesn't leak on repeated navigation"

As OWNER:
1. Navigate through 20 page transitions: dashboard → students → calendar → invoices → reports → dashboard → students → calendar → (repeat)
2. After 20 transitions:
   - **Assert:** No error boundary triggered
   - **Assert:** Final page loads correctly
   - **Assert:** No console errors about memory

These performance tests establish baselines. Log all timings so you can track regressions.
```

---

## PROMPT 13 — Security Boundary Tests

```
Create `tests/e2e/workflows/security-boundaries.spec.ts`

Tests that security boundaries hold under realistic conditions.

### Test: "Multi-tenant isolation — parent can't access other org data"

As PARENT:
1. Navigate to /portal/home
2. Note which children are visible
3. Open browser dev tools equivalent:
   - Try navigating to /portal/home with a query param like ?org_id=fake-uuid
   - **Assert:** Still shows only own children (query param doesn't bypass RLS)
4. Navigate to /portal/invoices
5. **Assert:** Only own invoices visible

### Test: "URL parameter tampering doesn't expose other students"

As TEACHER:
1. Navigate to /students
2. Note which students are visible (only assigned students)
3. Navigate directly to /students/fake-uuid-that-doesnt-exist
4. **Assert:** 404 or "not found" — NOT a data leak
5. If you know the UUID of a student NOT assigned to this teacher:
   - Navigate to /students/{that-uuid}
   - **Assert:** Either 404/not found OR the data shown is properly filtered

As PARENT:
6. Navigate to /portal/home
7. Try accessing /students/any-uuid
8. **Assert:** Redirected to /portal/home (parent can't access admin routes)

### Test: "Role escalation not possible"

As TEACHER:
1. Navigate to /settings
2. **Assert:** Settings page loads but only shows limited tabs
3. **Assert:** No way to change own role (role management UI not visible)
4. Navigate to /settings?tab=members
5. **Assert:** Either tab doesn't exist, is hidden, or shows read-only view

### Test: "Expired/invalid session handling"

1. Start with valid OWNER auth
2. Navigate to /dashboard — **Assert:** works
3. Clear all cookies and local storage (simulate session expiry):
   ```javascript
   await page.evaluate(() => {
     localStorage.clear();
     sessionStorage.clear();
   });
   await page.context().clearCookies();
   ```
4. Navigate to /students
5. **Assert:** Redirected to /login (not a crash, not partial data exposure)
6. **Assert:** No sensitive data visible after redirect

### Test: "XSS-style input doesn't render as HTML"

As OWNER:
1. Navigate to /students
2. Open add student wizard
3. Enter first name: `<script>alert('xss')</script>`
4. Enter last name: `<img src=x onerror=alert('xss')>`
5. Proceed through the wizard (the input should be sanitised)
6. **Assert:** Either:
   a. Validation blocks the malicious input, OR
   b. The input is stored but rendered as plain text (not executed)
7. If the student was created, navigate to student detail
8. **Assert:** Name displays as literal text, no script execution

### Test: "API error responses don't leak sensitive info"

As OWNER:
1. Navigate to /students
2. Monitor network responses:
   ```javascript
   const errors = [];
   page.on('response', async (response) => {
     if (response.status() >= 400) {
       const body = await response.text().catch(() => '');
       errors.push({ url: response.url(), status: response.status(), body });
     }
   });
   ```
3. Navigate through several pages to trigger any API calls
4. For any 4xx/5xx responses captured:
   - **Assert:** Response body does NOT contain raw SQL
   - **Assert:** Response body does NOT contain internal file paths
   - **Assert:** Response body does NOT contain other users' data

Use descriptive test names. These tests are about proving the BOUNDARIES hold, not about feature functionality.
```

---

## PROMPT 14 — Accessibility Baseline

```
Create `tests/e2e/workflows/accessibility-baseline.spec.ts`

Basic accessibility checks that ensure the app is usable with assistive technology.

### Test: "All pages have proper page titles"

As OWNER:
Navigate to each key page and check document.title:

/dashboard → should contain "Dashboard"
/students → should contain "Students"
/calendar → should contain "Calendar"
/teachers → should contain "Teachers"
/locations → should contain "Locations"
/invoices → should contain "Invoices"
/reports → should contain "Reports"
/messages → should contain "Messages"
/settings → should contain "Settings"
/register → should contain "Register"
/practice → should contain "Practice"
/resources → should contain "Resources"

Each should also contain "LessonLoop" somewhere in the title.

As PARENT:
/portal/home → should contain "Home" and "Portal" or "LessonLoop"
/portal/schedule → should contain "Schedule"
/portal/invoices → should contain "Invoices"

### Test: "All interactive elements are keyboard accessible"

As OWNER:
1. Navigate to /students
2. Press Tab repeatedly
3. **Assert:** Focus moves through interactive elements in logical order
4. **Assert:** Focus indicators are visible (outline or ring)
5. Find the Add Student button via Tab
6. Press Enter
7. **Assert:** Wizard opens (keyboard-activated)
8. Press Escape
9. **Assert:** Wizard closes

### Test: "Forms have proper labels"

As OWNER:
1. Navigate to /settings?tab=profile
2. Check all form inputs:
   ```javascript
   const inputs = await page.locator('input, select, textarea').all();
   for (const input of inputs) {
     const id = await input.getAttribute('id');
     const ariaLabel = await input.getAttribute('aria-label');
     const ariaLabelledBy = await input.getAttribute('aria-labelledby');
     // Each input should have either an associated <label>, aria-label, or aria-labelledby
     const hasLabel = id ? await page.locator(`label[for="${id}"]`).count() > 0 : false;
     expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
   }
   ```

### Test: "Images have alt text"

As OWNER:
1. Navigate to /dashboard
2. Check all images:
   ```javascript
   const images = await page.locator('img').all();
   for (const img of images) {
     const alt = await img.getAttribute('alt');
     const role = await img.getAttribute('role');
     // Each image should have alt text OR role="presentation" for decorative images
     expect(alt !== null || role === 'presentation').toBeTruthy();
   }
   ```

3. Navigate to /students and repeat the check
4. Navigate to /portal/home as PARENT and repeat

### Test: "Colour contrast meets WCAG AA"

As OWNER:
1. Navigate to /dashboard
2. Check that status badges use sufficient contrast:
   - **Assert:** "Active" badges are visible (green on appropriate background)
   - **Assert:** "Overdue" badges are visible (red/destructive variant)
   - **Assert:** Text is readable against its background

This is a visual spot-check, not automated contrast analysis. Focus on the most common elements.

### Test: "Screen reader landmarks present"

As OWNER:
1. Navigate to /dashboard
2. **Assert:** `<main>` element exists
3. **Assert:** `<nav>` element exists (sidebar)
4. **Assert:** `role="banner"` or `<header>` exists
5. Navigate to /portal/home as PARENT
6. **Assert:** Same landmark structure

These are baseline accessibility tests. They won't catch everything but they establish a floor.
```

---

## PROMPT 15 — Final Integration Smoke Test

```
Create `tests/e2e/workflows/smoke-full-system.spec.ts`

This is the ULTIMATE cohesion test. It simulates a realistic day for an academy owner, touching every major system in sequence. If this test passes, the system works as a whole.

### Test: "Academy owner full day simulation"

As OWNER:
1. LOGIN & DASHBOARD
   - Navigate to /dashboard
   - Assert: greeting visible, stat cards loaded
   - Note active student count, today's lesson count

2. CHECK CALENDAR
   - Navigate to /calendar
   - Assert: week view loads with day headers
   - Note today's lessons
   - Navigate forward a week, then back
   - Assert: returns to correct week

3. REVIEW REGISTER
   - Navigate to /register
   - Assert: today's lessons listed
   - If lessons exist: note first student name and lesson time

4. CHECK STUDENTS
   - Navigate to /students
   - Assert: student list loads
   - Search for "Emma"
   - Assert: search results filter
   - Click into Emma's detail
   - Assert: all tabs visible
   - Check Lessons tab — assert lessons listed
   - Check Invoices tab — note if invoices exist
   - Navigate back to /students

5. REVIEW TEACHERS
   - Navigate to /teachers
   - Assert: teacher list loads
   - Note teacher count

6. CHECK INVOICES
   - Navigate to /invoices
   - Assert: invoice list loads with stats widget
   - Note draft/sent/paid/overdue counts

7. REVIEW REPORTS
   - Navigate to /reports
   - Assert: all 7 report types visible
   - Click into Revenue report
   - Assert: loads without errors
   - Navigate back

8. CHECK MESSAGES
   - Navigate to /messages
   - Assert: messages page loads
   - Assert: compose button exists

9. REVIEW SETTINGS
   - Navigate to /settings
   - Assert: settings page loads
   - Click through 3 tabs (profile, notifications, organisation)
   - Assert: each loads content

10. CHECK PRACTICE & RESOURCES
    - Navigate to /practice
    - Assert: page loads
    - Navigate to /resources
    - Assert: page loads

11. CHECK CRM PAGES
    - Navigate to /leads — assert loads
    - Navigate to /waitlist — assert loads
    - Navigate to /make-ups — assert loads
    - Navigate to /continuation — assert loads

12. FINAL DASHBOARD CHECK
    - Navigate back to /dashboard
    - Assert: still loads correctly
    - Assert: stat cards still show data (cached or refreshed)
    - Assert: no error boundaries anywhere

13. META-ASSERTIONS
    - Assert: zero console errors throughout the entire journey
    - Assert: no unhandled promise rejections
    - Assert: sidebar highlighting correct on every navigation
    - Log total test duration

### Test: "Parent portal full day simulation"

As PARENT:
1. Navigate to /portal/home — assert loads with children
2. Navigate to /portal/schedule — assert loads
3. Navigate to /portal/invoices — assert loads
4. Navigate to /portal/practice — assert loads
5. Navigate to /portal/resources — assert loads
6. Navigate to /portal/messages — assert loads
7. Navigate to /portal/profile — assert loads
8. Navigate back to /portal/home — assert still loads
9. Assert: zero console errors throughout
10. Assert: no horizontal overflow on any page (check each)

### Test: "Teacher workday simulation"

As TEACHER:
1. Navigate to /dashboard — assert loads
2. Navigate to /calendar — assert shows only this teacher's lessons
3. Navigate to /register — assert loads
4. Navigate to /students — assert shows assigned students only
5. Navigate to /practice — assert loads
6. Navigate to /resources — assert loads
7. Navigate to /messages — assert loads
8. Navigate to /settings — assert loads with limited tabs
9. Navigate back to /dashboard
10. Assert: zero console errors
11. Assert: no access to /teachers, /locations, /invoices (verify redirect)

This test is the gate. If the smoke test passes, the system is cohesive.
```

---

## Execution Order Summary

| # | File | What it proves | Est. tests |
|---|------|---------------|------------|
| 0 | Infrastructure | Test helpers and fixtures work | 0 (setup) |
| 1 | student-lifecycle | Student CRUD cascades correctly | 3 |
| 2 | invoice-payment-lifecycle | Billing pipeline works end-to-end | 4 |
| 3 | calendar-scheduling | Calendar ops cascade to register/students | 6 |
| 4 | parent-portal-journey | Parent experience is complete and isolated | 4 |
| 5 | cross-role-consistency | Same data, different roles, same results | 5 |
| 6 | edge-cases | Defensive scenarios don't crash | 8 |
| 7 | reports-analytics | Reports reflect real data | 4 |
| 8 | settings-cascade | Settings propagate everywhere | 5 |
| 9 | lead-pipeline | Lead → enquiry → trial → **enrolled student conversion** | 5 |
| 9A | waitlist-pipeline | Waitlist → offered → accepted → **student enrolment** | 5 |
| 9B | makeup-credits | Credit issuance → student detail → balance → redemption | 6 |
| 9C | term-continuation | Run → parent response → summary stats → **next term planning** | 6 |
| 10 | mobile-cohesion | Mobile experience is complete | 4 |
| 11 | data-integrity | Delete validation and cascades | 5 |
| 12 | performance-resilience | Speed and stability | 6 |
| 13 | security-boundaries | Auth boundaries hold | 5 |
| 14 | accessibility-baseline | Basic a11y compliance | 5 |
| 15 | smoke-full-system | **THE GATE** — full system cohesion | 3 |
| | | **TOTAL** | **~89 tests** |

---

## Important Notes for Claude Code

1. **Use existing patterns** — Import from `tests/e2e/helpers.ts` (goTo, waitForPageReady, expectToast, AUTH, etc.)
2. **Don't break isolation tests** — These workflow tests are ADDITIVE. Don't modify existing spec files.
3. **Handle missing test data gracefully** — Use conditional assertions (`if (await element.isVisible())`) where data may not exist.
4. **Use unique identifiers** — Any data you create should include a timestamp to avoid collisions.
5. **Clean up when possible** — Deactivate (don't delete) students you create. Don't leave test invoices in "sent" state.
6. **Quality gates** — After each prompt: `npm run lint`, `npm run typecheck`, `npm run build` must all pass.
7. **Run workflow tests separately** — `npx playwright test tests/e2e/workflows/ --project=desktop-chrome`
