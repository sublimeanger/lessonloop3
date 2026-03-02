

# LessonLoop Enterprise Audit Plan

A systematic, phased audit covering every module, edge function, hook, and UI flow in the application. Each phase is self-contained and produces a findings report before moving to the next.

---

## Phase 1: Security & Access Control

**Scope:** RLS policies, route guards, role boundaries, data isolation

| ID | Test | Method |
|---|---|---|
| SEC-01 | Audit every RLS policy for `USING(true)` permissiveness | DB linter + manual SQL review |
| SEC-02 | Verify org-scoping on all 70+ edge functions (no cross-tenant leaks) | Code review of every `index.ts` |
| SEC-03 | Route guard matrix: confirm all 5 roles blocked from unauthorized paths | Unit test + browser E2E for owner/admin/teacher/finance/parent |
| SEC-04 | URL attack tests: direct navigation to forbidden routes for each role | Extend `url-attacks.spec.ts` |
| SEC-05 | Subscription field protection (`protect_subscription_fields` trigger) | Attempt client-side mutation of plan fields |
| SEC-06 | Onboarding flag protection (`protect_onboarding_flag` trigger) | Attempt client-side toggle |
| SEC-07 | Rate limiting on public endpoints (booking, contact, enquiry) | Load test edge functions |
| SEC-08 | GDPR export/delete authorization checks | Test with non-admin roles |
| SEC-09 | Calendar token security (OAuth tokens stored in DB) | Review encryption at rest |
| SEC-10 | Input sanitisation (DOMPurify, CSV injection protection) | Inject XSS/formula payloads |

---

## Phase 2: Authentication & Onboarding

**Scope:** Login, signup, email verification, password reset, onboarding wizard, invite acceptance

| ID | Test | Method |
|---|---|---|
| AUTH-01 | Login with valid/invalid credentials | Browser E2E |
| AUTH-02 | Signup flow with email verification gate | Browser E2E |
| AUTH-03 | Forgot password + reset password token flow | Browser E2E |
| AUTH-04 | Onboarding wizard: profile step, org creation, plan selection, CSV import | Browser E2E |
| AUTH-05 | CSV import during onboarding (the fixed `orgId` bug) | Upload MMS CSV during onboarding |
| AUTH-06 | Invite acceptance flow (new user + existing user) | Browser E2E with invite token |
| AUTH-07 | Session expiry handling and auto-refresh | Let token expire, verify re-auth |
| AUTH-08 | Multi-tab session consistency | Open 2 tabs, logout in one |

---

## Phase 3: Calendar & Scheduling

**Scope:** Day/week/agenda views, lesson CRUD, recurring series, conflicts, closures, availability

| ID | Test | Method |
|---|---|---|
| CAL-01 | Create single lesson (all fields) | Browser E2E |
| CAL-02 | Create recurring series (weekly, fortnightly, term-bound) | Browser E2E |
| CAL-03 | Edit single instance vs this-and-future | Browser E2E + unit test |
| CAL-04 | Delete single / series / this-and-future | Browser E2E |
| CAL-05 | Drag-and-drop reschedule (day view, week view) | Browser E2E |
| CAL-06 | Conflict detection: student double-booking (red error) | Unit test + browser |
| CAL-07 | Conflict detection: teacher double-booking | Unit test + browser |
| CAL-08 | Conflict detection: room double-booking | Unit test + browser |
| CAL-09 | Closure date blocking | Create lesson on closure date |
| CAL-10 | Teacher availability check during creation | Unit test |
| CAL-11 | Travel buffer between locations | Unit test |
| CAL-12 | Calendar filters (teacher, location, student) | Browser E2E |
| CAL-13 | Google Calendar bidirectional sync | Edge function test |
| CAL-14 | Apple iCal feed generation and token rotation | Edge function test |
| CAL-15 | Zoom meeting sync for lessons | Edge function test |
| CAL-16 | 500+ lesson performance (week view rendering) | Performance test |

---

## Phase 4: Students & CRM

**Scope:** Student CRUD, guardians, instruments, grades, import, archive, deletion validation

| ID | Test | Method |
|---|---|---|
| CRM-01 | Create student with guardian link | Browser E2E |
| CRM-02 | Edit student details (all fields) | Browser E2E |
| CRM-03 | Student search and filtering | Browser E2E |
| CRM-04 | Guardian CRUD and multi-org guardian lookup | Browser E2E + unit test |
| CRM-05 | Instrument/grade assignment and history | Browser E2E |
| CRM-06 | CSV import (upload, mapping, preview, execute) | Browser E2E with MMS file |
| CRM-07 | Deletion validation (block if lessons/invoices exist) | Unit test |
| CRM-08 | Soft delete / archive flow | Browser E2E |
| CRM-09 | GDPR anonymisation | Edge function test |
| CRM-10 | Student detail page: lessons tab, invoices tab, notes tab | Browser E2E |
| CRM-11 | Teacher-student assignment | Browser E2E |
| CRM-12 | Leads pipeline (create, activities, convert to student) | Browser E2E |
| CRM-13 | Enrolment waitlist management | Browser E2E |

---

## Phase 5: Billing & Invoicing

**Scope:** Invoice CRUD, billing runs, payment recording, Stripe, refunds, payment plans, VAT

| ID | Test | Method |
|---|---|---|
| BIL-01 | Create manual invoice with line items | Browser E2E |
| BIL-02 | VAT calculation (20% standard rate) | Unit test |
| BIL-03 | Billing run wizard (term selection, student filtering, deduplication) | Browser E2E |
| BIL-04 | Invoice status transitions (draft → sent → paid/overdue/void) | Unit test + browser |
| BIL-05 | Invalid status transitions blocked (paid → draft) | Unit test |
| BIL-06 | Record manual payment | Browser E2E |
| BIL-07 | Payment plan generation (equal split, custom schedule) | Browser E2E + unit test |
| BIL-08 | Installment auto-pay via Stripe | Edge function test |
| BIL-09 | Installment overdue check cron | Edge function test |
| BIL-10 | Invoice voiding with credit restoration | Browser E2E |
| BIL-11 | Stripe Connect onboarding | Edge function test |
| BIL-12 | Stripe payment intent creation | Edge function test |
| BIL-13 | Stripe webhook handling (payment succeeded/failed) | Edge function test |
| BIL-14 | Refund processing | Edge function test + browser |
| BIL-15 | PDF generation | Browser E2E |
| BIL-16 | Invoice email sending | Edge function test |
| BIL-17 | Payment receipt email | Edge function test |
| BIL-18 | Overdue reminder emails | Edge function test |
| BIL-19 | Make-up credit offset on invoice | Unit test |
| BIL-20 | Rate card application to billing run | Unit test |
| BIL-21 | Term adjustment with credit note generation | Edge function + browser |
| BIL-22 | Recurring invoice templates | Browser E2E |

---

## Phase 6: Attendance & Register

**Scope:** Daily register, batch attendance, attendance records, lesson completion

| ID | Test | Method |
|---|---|---|
| ATT-01 | Daily register loads correct lessons for date | Browser E2E |
| ATT-02 | Mark attendance (present, absent, late, cancelled_by_student/teacher) | Browser E2E |
| ATT-03 | Attendance validation (student must be participant) | Unit test (trigger) |
| ATT-04 | Batch attendance for multiple lessons | Browser E2E |
| ATT-05 | Attendance audit trail | Check audit_log entries |
| ATT-06 | Absence reason triggers slot release / make-up policy | Unit test |
| ATT-07 | Teacher-scoped register (only own lessons) | Browser E2E as teacher role |
| ATT-08 | Lesson completion status update on full attendance | Browser E2E |

---

## Phase 7: Make-Up Credits & Waitlist

**Scope:** Credit issuance, redemption, expiry, waitlist matching, policies

| ID | Test | Method |
|---|---|---|
| MKP-01 | Automatic credit issuance on teacher cancellation | Integration test |
| MKP-02 | Credit redemption (single use, no double-redemption) | Unit test |
| MKP-03 | Credit expiry (8-week default) | Unit test |
| MKP-04 | Waitlist matching algorithm (`find_waitlist_matches`) | Unit test |
| MKP-05 | Waitlist notification on match | Edge function test |
| MKP-06 | Make-up policy configuration per absence reason | Browser E2E |
| MKP-07 | Cancellation notice eligibility check | Unit test |
| MKP-08 | Waitlist expiry cron | Edge function test |
| MKP-09 | Credit applied as invoice discount | Unit test (in billing) |
| MKP-10 | Make-up dashboard UI (all tabs) | Browser E2E |

---

## Phase 8: Parent Portal

**Scope:** All 8 portal pages, payment, practice logging, messages, resources, continuation

| ID | Test | Method |
|---|---|---|
| PRT-01 | Portal home: children list, next lesson, outstanding balance | Browser E2E |
| PRT-02 | Portal schedule: upcoming lessons for linked children | Browser E2E |
| PRT-03 | Portal invoices: view, filter, Pay Now button | Browser E2E |
| PRT-04 | Stripe embedded payment (parent pays invoice) | Browser E2E + edge function |
| PRT-05 | Saved payment methods management | Browser E2E |
| PRT-06 | Auto-pay preferences toggle | Browser E2E |
| PRT-07 | Portal practice: log entry, streak display | Browser E2E |
| PRT-08 | Portal resources: shared files visible | Browser E2E |
| PRT-09 | Portal messages: send message request, view thread | Browser E2E |
| PRT-10 | Portal profile: edit guardian details | Browser E2E |
| PRT-11 | Portal continuation: respond to term continuation | Browser E2E |
| PRT-12 | Child filter context (multi-child families) | Browser E2E |
| PRT-13 | Data isolation: parent cannot see other families' data | Security test |
| PRT-14 | Realtime payment status update | Integration test |

---

## Phase 9: Messaging & Notifications

**Scope:** Internal messaging, parent messaging, bulk messages, push notifications, email sending

| ID | Test | Method |
|---|---|---|
| MSG-01 | Compose and send internal message (staff-to-staff) | Browser E2E |
| MSG-02 | Parent message request lifecycle | Browser E2E |
| MSG-03 | Bulk message sending | Browser E2E + edge function |
| MSG-04 | Message threading and read status | Browser E2E |
| MSG-05 | Unread message count (badge) | Browser E2E |
| MSG-06 | Teacher messaging permissions (parent_can_message_teacher setting) | Browser E2E |
| MSG-07 | Push notification registration and delivery | Edge function test |
| MSG-08 | Email notifications (invoice, cancellation, notes, reminders) | Edge function test |
| MSG-09 | Message sanitisation (XSS prevention) | Inject HTML payloads |

---

## Phase 10: Reports & Analytics

**Scope:** All 7 report pages, data accuracy, filtering, export

| ID | Test | Method |
|---|---|---|
| RPT-01 | Revenue report: correct paid totals, period comparison | Browser E2E + unit test |
| RPT-02 | Outstanding report: overdue detection, ageing buckets | Browser E2E |
| RPT-03 | Payroll report: teacher earnings calculation | Browser E2E |
| RPT-04 | Lessons delivered report: counts, filtering | Browser E2E |
| RPT-05 | Cancellation report: reason breakdown | Browser E2E |
| RPT-06 | Utilisation report: room/teacher capacity | Browser E2E |
| RPT-07 | Teacher performance report: metrics accuracy | Browser E2E |
| RPT-08 | Report filtering (date range, teacher, location) | Browser E2E |
| RPT-09 | Role-based report access (finance sees billing reports, teacher sees own) | Browser E2E per role |

---

## Phase 11: Settings & Configuration

**Scope:** All settings tabs, org settings, profile, rates, terms, availability, integrations

| ID | Test | Method |
|---|---|---|
| SET-01 | Profile settings: name, email, avatar | Browser E2E |
| SET-02 | Organisation settings: name, timezone, branding, VAT toggle | Browser E2E |
| SET-03 | Calendar settings: schedule hours, closure dates | Browser E2E |
| SET-04 | Rate card CRUD | Browser E2E |
| SET-05 | Term CRUD (create, edit, delete) | Browser E2E |
| SET-06 | Teacher availability management | Browser E2E |
| SET-07 | Invitation management (send, resend, revoke) | Browser E2E |
| SET-08 | Notification preferences | Browser E2E |
| SET-09 | Cancellation notice hours setting | Browser E2E |
| SET-10 | Continuation settings (notice weeks, assumed continuing) | Browser E2E |
| SET-11 | Messaging settings (parent_can_message_teacher toggle) | Browser E2E |
| SET-12 | Stripe Connect settings | Browser E2E |
| SET-13 | Booking page settings | Browser E2E |
| SET-14 | GDPR compliance tab | Browser E2E |

---

## Phase 12: Subscription & Feature Gating

**Scope:** Plan limits, trial enforcement, upgrade paths, Stripe subscription

| ID | Test | Method |
|---|---|---|
| SUB-01 | Trial countdown and expiry enforcement | Unit test + browser |
| SUB-02 | `is_org_active` blocks writes after trial expiry | DB trigger test |
| SUB-03 | Student limit enforcement per plan | Unit test |
| SUB-04 | Teacher limit enforcement per plan | DB trigger test |
| SUB-05 | Feature gate UI (useFeatureGate hook) | Unit test |
| SUB-06 | Subscription checkout flow | Edge function test |
| SUB-07 | Stripe customer portal access | Edge function test |
| SUB-08 | Plan upgrade/downgrade webhook handling | Edge function test |
| SUB-09 | Trial reminder emails (7-day, 3-day, 1-day) | Edge function test |
| SUB-10 | Trial winback email | Edge function test |

---

## Phase 13: Term Management

**Scope:** Term adjustments, continuation runs, withdrawal, day changes

| ID | Test | Method |
|---|---|---|
| TRM-01 | Term adjustment preview (withdrawal) | Edge function test |
| TRM-02 | Term adjustment preview (day change) | Edge function test |
| TRM-03 | Term adjustment confirm: lessons cancelled, new lessons created | Edge function test |
| TRM-04 | Credit note generation on withdrawal | Edge function test |
| TRM-05 | Continuation run creation and email dispatch | Edge function test |
| TRM-06 | Parent continuation response (confirm/decline) | Browser E2E |
| TRM-07 | Term-based billing integration | Integration test |

---

## Phase 14: Practice & Resources

**Scope:** Practice logging, streaks, assignments, resource sharing

| ID | Test | Method |
|---|---|---|
| PRA-01 | Practice log creation (student, date, duration, notes) | Browser E2E |
| PRA-02 | Streak calculation (consecutive days) | Unit test (trigger) |
| PRA-03 | Streak milestone detection (3, 7, 14, 30, 60, 100) | Unit test |
| PRA-04 | Practice assignment CRUD | Browser E2E |
| PRA-05 | Resource upload and categorisation | Browser E2E |
| PRA-06 | Resource sharing to students | Browser E2E |
| PRA-07 | Resource cleanup on student archive | DB trigger test |
| PRA-08 | Streak notification edge function | Edge function test |

---

## Phase 15: LoopAssist AI

**Scope:** AI chat, query execution, action proposals, audit logging

| ID | Test | Method |
|---|---|---|
| AI-01 | LoopAssist chat: read queries (invoices, schedules, students) | Edge function test |
| AI-02 | LoopAssist action proposals (requires confirmation) | Edge function test |
| AI-03 | LoopAssist execute (confirmed action) | Edge function test |
| AI-04 | Parent LoopAssist (scoped to own data) | Edge function test |
| AI-05 | All AI actions logged to audit_log | DB verification |
| AI-06 | AI chat error handling (rate limits, invalid queries) | Edge function test |

---

## Phase 16: Public Pages & Integrations

**Scope:** Booking page, Zoom, contact form, external integrations

| ID | Test | Method |
|---|---|---|
| PUB-01 | Public booking page: slot display, form submission | Browser E2E |
| PUB-02 | Booking slot availability (respects calendar) | Edge function test |
| PUB-03 | Contact form / parent enquiry submission | Browser E2E |
| PUB-04 | Zoom OAuth flow | Edge function test |
| PUB-05 | Zoom meeting creation for lessons | Edge function test |
| PUB-06 | Account deletion flow | Edge function test |

---

## Phase 17: Performance & Scale

**Scope:** Load testing, query performance, rendering at scale

| ID | Test | Method |
|---|---|---|
| PRF-01 | Calendar with 3,300+ lessons (agency scale) | Browser performance test |
| PRF-02 | Invoice list with 1,000+ invoices (pagination) | Browser E2E |
| PRF-03 | Student list with 300+ students (virtual scroll) | Browser E2E |
| PRF-04 | Billing run with 100+ students (deduplication) | Edge function test |
| PRF-05 | Abort controller on navigation (no stale fetches) | Browser console check |
| PRF-06 | React Query stale time tiers working correctly | Code review |
| PRF-07 | Lazy loading and code splitting verification | Bundle analysis |

---

## Phase 18: Mobile & Responsive

**Scope:** All critical flows on mobile viewports

| ID | Test | Method |
|---|---|---|
| MOB-01 | Bottom navigation renders for staff roles | Browser E2E (390x844) |
| MOB-02 | Calendar day view on mobile | Browser E2E |
| MOB-03 | Student creation form on mobile | Browser E2E |
| MOB-04 | Invoice detail on mobile | Browser E2E |
| MOB-05 | Portal home on mobile (parent) | Browser E2E |
| MOB-06 | Settings tabs on mobile (sheet navigation) | Browser E2E |
| MOB-07 | Offline banner appears when disconnected | Browser E2E |
| MOB-08 | Android back button handling | Code review |

---

## Execution Strategy

**Total test items:** ~200 across 18 phases

Each phase will:
1. Read all relevant source files (hooks, components, edge functions)
2. Run existing unit tests to check current pass/fail status
3. Execute browser E2E tests where applicable
4. Call edge functions directly to verify backend logic
5. Check database state for data integrity
6. Produce a findings list with severity (Critical / High / Medium / Low)

Phases are ordered by risk: security first, then revenue-critical paths (billing), then feature completeness. I will begin with Phase 1 and report findings before proceeding.

