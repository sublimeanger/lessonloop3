

# Comprehensive E2E Test Plan — LessonLoop Full System

## Current State

You already have ~16 E2E spec files covering page loading, RBAC, and a smoke walkthrough. What's missing is **lifecycle testing** — tests that create data, mutate it, verify side effects, and clean up. This plan covers every module end-to-end, staged so we implement one file per prompt.

---

## Staged Implementation Order

Each stage = one Playwright spec file. Tests use the seeded demo/E2E accounts and the existing `helpers.ts` utilities. All tests are idempotent (create unique data with `generateTestId()`, clean up or ignore collisions).

---

### Stage 1: `tests/e2e/workflows/student-lifecycle.spec.ts`
**Role: Owner** — Full student CRUD lifecycle

- Create student via wizard (first name, last name, instrument, DOB)
- Verify student appears in list with search
- Navigate to student detail → verify Overview tab data
- Edit student (change instrument, add notes)
- Add a guardian via the Guardians tab (new guardian flow)
- Verify guardian link appears
- Switch to Lessons tab → verify empty state
- Switch to Invoices tab → verify empty state
- Archive student → verify status changes
- Verify archived student hidden from default list, visible with filter

---

### Stage 2: `tests/e2e/workflows/guardian-linking.spec.ts`
**Role: Owner** — Guardian management and primary payer logic

- Create two students
- Create a guardian and link to both students
- Set guardian as primary payer for student A
- Verify primary payer badge on student A's guardian tab
- Attempt to set a second primary payer → verify it replaces the first
- Remove guardian link from student B → verify soft-delete if orphaned
- Verify guardian still linked to student A

---

### Stage 3: `tests/e2e/workflows/lesson-scheduling.spec.ts`
**Role: Owner** — Lesson creation, editing, conflicts, recurrence

- Create a single lesson (select teacher, student, time, location, room)
- Verify lesson appears on calendar (week view)
- Edit lesson (change time by 30 min)
- Create a second lesson that conflicts with teacher → verify conflict error
- Create a recurring weekly lesson (4 weeks)
- Edit "this and future" on occurrence 2 (change time) → verify occurrence 3+ also moved
- Cancel a single occurrence → verify status = cancelled, others unaffected
- Verify lesson detail dialog shows correct participants

---

### Stage 4: `tests/e2e/workflows/attendance-register.spec.ts`
**Role: Owner + Teacher** — Attendance marking and batch operations

- Owner: navigate to Register, verify today's lessons listed
- Mark student as "present" on a lesson
- Mark student as "absent" with reason "sick"
- Verify attendance status persists after page reload
- Teacher: navigate to Register → verify only their lessons visible
- Teacher: mark attendance on own lesson → verify success
- Owner: navigate to Batch Attendance → verify multi-lesson view
- Owner: bulk mark a set of lessons as completed

---

### Stage 5: `tests/e2e/workflows/invoice-lifecycle.spec.ts`
**Role: Owner/Finance** — Invoice creation through payment

- Navigate to Invoices → click "Create Invoice"
- Select payer (guardian), add 2 line items (lesson-linked and ad-hoc)
- Verify subtotal, VAT (20%), and total calculations
- Save as draft → verify appears in draft tab
- Change status to "sent" → verify status badge updates
- Record a partial payment → verify "paid_minor" updates, status stays "sent"
- Record remaining payment → verify status transitions to "paid"
- Create another invoice → void it → verify credits restored if applicable
- Finance role: verify can access invoices but cannot access Students page

---

### Stage 6: `tests/e2e/workflows/payment-plans.spec.ts`
**Role: Owner** — Installment plan lifecycle

- Create invoice with total £120
- Enable payment plan → select 3 monthly installments
- Verify 3 installments generated with correct amounts (£40 each)
- Record payment of £40 → verify first installment marked paid
- Record £40 more → verify second installment marked paid
- Record final £40 → verify invoice status = "paid", all installments paid
- Test custom schedule: create invoice, set 2 custom installments with specific dates and amounts
- Verify installment amounts sum to invoice total

---

### Stage 7: `tests/e2e/workflows/lead-pipeline.spec.ts`
**Role: Owner** — Lead CRM lifecycle

- Navigate to Leads → create new lead manually (name, email, phone, instrument interest)
- Verify lead appears in pipeline (stage: "new")
- Open lead detail → add a note
- Log a call with summary
- Schedule a follow-up reminder
- Move lead to "contacted" stage
- Move lead to "trial_booked" → book a trial lesson from lead detail
- Complete follow-up → verify it's marked done
- Move lead to "enrolled" → verify conversion prompt/flow
- Export leads to CSV → verify download triggers

---

### Stage 8: `tests/e2e/workflows/makeup-credits.spec.ts`
**Role: Owner** — Make-up credit issuance, redemption, and expiry

- Navigate to a student detail → Make-Up Credits panel
- Issue a credit manually (set value £25, expiry 8 weeks)
- Verify credit appears as "available" with correct value
- Issue a second credit (£15)
- Verify total available balance = £40
- Redeem first credit against a lesson → verify status changes to "redeemed"
- Verify total available balance drops to £15
- Delete the second credit → verify it's removed
- Navigate to Make-Ups dashboard → verify summary stats

---

### Stage 9: `tests/e2e/workflows/waitlist-makeup.spec.ts`
**Role: Owner** — Make-up waitlist lifecycle

- Navigate to Make-Ups dashboard
- Add student to waitlist (select student, missed lesson, absence reason)
- Verify entry appears with status "waiting"
- Trigger match finding (if UI available) or verify auto-matching after marking absence
- Offer a slot to the waitlist entry → verify status changes to "offered"
- Dismiss match → verify entry returns to "waiting"
- Re-offer a different slot → verify "offered" again
- Navigate to Make-Up Policies settings → verify policy list loads
- Update a policy (e.g., change "sick" from "waitlist" to "automatic") → verify save

---

### Stage 10: `tests/e2e/workflows/enrolment-waitlist.spec.ts`
**Role: Owner** — Enrolment waitlist (separate from make-up waitlist)

- Navigate to /waitlist
- Add a new entry (student name, instrument, preferred day/time)
- Verify entry appears in the list
- Send enrolment offer → verify status changes
- Verify offer details (if visible in UI)

---

### Stage 11: `tests/e2e/workflows/messaging.spec.ts`
**Role: Owner + Parent** — Internal messaging lifecycle

- Owner: navigate to Messages → compose new message (select template or free text)
- Send to a guardian → verify message appears in sent/thread view
- Parent: navigate to Portal Messages → verify message received
- Parent: reply to message → verify reply appears
- Owner: verify reply visible in thread
- Owner: send bulk message → verify status

---

### Stage 12: `tests/e2e/workflows/parent-portal-full.spec.ts`
**Role: Parent** — Complete parent portal lifecycle

- Login as parent → verify redirect to /portal/home
- Verify child cards show on Home with correct data
- Select child A via ChildSwitcher → verify Home filters to child A
- Navigate to Schedule via sidebar → verify child A filter persists
- Verify lessons shown match child A only
- Switch to "All children" → verify all lessons shown
- Navigate to Invoices → verify outstanding balance and invoice list
- Click an invoice → verify detail view (line items, status, payment history)
- Navigate to Practice → verify practice log and streak display
- Navigate to Resources → verify shared resources visible
- Navigate to Profile → verify guardian info displayed
- Test child filter on mobile bottom nav (viewport resize)
- Legacy URL test: navigate to `/portal/schedule?student=<id>` → verify auto-converts to `?child=`

---

### Stage 13: `tests/e2e/workflows/continuation-lifecycle.spec.ts`
**Role: Owner + Parent** — Term continuation run

- Owner: navigate to /continuation
- Create a new continuation run (select term, set deadline)
- Verify run appears with status and student counts
- Parent: navigate to /portal/continuation → verify pending response
- Parent: respond "continuing" for child A → verify confirmation
- Owner: verify summary updates (1 continuing)
- Owner: check response details in run view

---

### Stage 14: `tests/e2e/workflows/reports-deep.spec.ts`
**Role: Owner + Finance** — Report data validation

- Navigate to Reports hub → verify all report cards visible
- Open Revenue report → verify date range selector works, chart renders
- Open Outstanding report → verify overdue invoices listed
- Open Lessons Delivered report → verify counts
- Open Cancellation report → verify data
- Open Payroll report → verify teacher hours
- Open Room Utilisation report → verify data
- Open Teacher Performance report → verify metrics
- Finance role: verify can access Revenue and Outstanding but not Cancellation

---

### Stage 15: `tests/e2e/workflows/settings-full.spec.ts`
**Role: Owner** — Settings across all tabs

- Profile tab: update display name → verify toast and persistence
- Notifications tab: toggle a notification preference → verify save
- Organisation tab: update org name → verify change
- Organisation tab: update VAT rate → verify save
- Organisation tab: update cancellation notice hours → verify save
- Members tab: verify member list shows seeded accounts with correct roles
- Invoice Settings: update overdue reminder days → verify save
- Billing tab: verify subscription plan display
- Audit Log tab: verify log entries visible with filtering

---

### Stage 16: `tests/e2e/workflows/practice-resources.spec.ts`
**Role: Owner + Parent** — Practice tracking and resource library

- Owner: navigate to Practice → verify student list
- Owner: log a practice session for a student
- Owner: navigate to Resources → upload a resource file
- Share resource with a student
- Parent: navigate to Portal Practice → verify practice log visible
- Parent: navigate to Portal Resources → verify shared resource visible

---

### Stage 17: `tests/e2e/workflows/booking-page.spec.ts`
**Role: Public + Owner** — Public booking page flow

- Owner: verify booking page exists in settings/leads
- Public (unauthenticated): navigate to `/book/<slug>`
- Fill booking form (parent name, email, child name, instrument)
- Submit → verify success message
- Owner: navigate to Leads → verify new lead created from booking

---

### Stage 18: `tests/e2e/workflows/security-edge-cases.spec.ts`
**Role: All** — Security and edge case validation

- Parent cannot access /students, /invoices, /calendar (redirects to portal)
- Teacher cannot access /teachers, /locations, /leads
- Finance cannot access /students, /calendar, /register
- Direct URL manipulation: /students/<random-uuid> → verify 404 or empty
- Verify no console errors on rapid page switching (navigate 10 pages in sequence)
- Verify mobile viewport has no horizontal overflow on all portal pages
- Verify error boundary does not appear on any page load

---

## Technical Notes

- All tests use `AUTH.owner`, `AUTH.teacher`, `AUTH.finance`, `AUTH.parent` storage states from `auth.setup.ts`
- Each file is self-contained and can run independently
- Tests that create data use `generateTestId()` for unique names to avoid collisions
- Timeouts: 120s per test (workflow project config), 300s for multi-step journeys
- Files go in `tests/e2e/workflows/` and run under the `workflow` Playwright project (sequential, not parallel)
- Existing `helpers.ts` utilities (`safeGoTo`, `fillField`, `selectOption`, `clickButton`, `expectToastSuccess`, etc.) are reused throughout

## Execution Order

We build one stage per prompt. I recommend starting with **Stage 1 (student lifecycle)** since students are the foundation entity that all other modules depend on.

