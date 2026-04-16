# LessonLoop Phase 1 Audit Map

**Branch:** `audit/phase-1-map`
**Author:** Claude Code (Opus 4.7)
**Started:** 2026-04-16
**Purpose:** Navigation document for Phase 2 deep audit. Flow inventory + cross-cutting concern map + problem surface. No fixes in Phase 1.

Prior audit files referenced by filename (not duplicated):
- `audit-feature-01-auth-onboarding.md` … `audit-feature-26-payroll.md`
- `core-loop-audit-part{1,2,3}.md`
- `deep-audit-continuation-part{2,3}.md`
- `SECURITY_CORRECTNESS_AUDIT_2026-03-16.md`
- `bug-audit-report.md`
- `COHESION_AUDIT.md`
- `PRODUCTION_READINESS_DEEP_DIVE_2026-03-16.md`

Each section below is appended in its own commit to route around stream-idle timeouts.

---

## Section 1.A — Auth & Onboarding

### A1. Email+password sign-up (new owner)
- **Actor:** public
- **Entry:** `/signup` (→ `src/pages/Signup.tsx`)
- **Touchpoints:** `Signup` → `AuthContext.signUp` → `supabase.auth.signUp` → (email verify link) → `/verify-email` → `/onboarding` → `profile-ensure` edge fn → `onboarding-setup` edge fn (creates org, owner `org_memberships`, default location, terms) → `profiles.has_completed_onboarding=true`
- **Exits:** success → `/dashboard`; failure → error toast, stays on form. Unverified user → `/verify-email` loop.
- **Referenced audits:** `audit-feature-01-auth-onboarding.md`, `core-loop-audit-part1.md`
- **Priority:** CRITICAL (auth boundary + org-creation atomicity)

### A2. Sign-in
- **Actor:** owner | admin | teacher | finance | parent
- **Entry:** `/login` (also `/auth`)
- **Touchpoints:** `Login` → `AuthContext.signIn` → `supabase.auth.signInWithPassword` → `OrgContext` (loads memberships) → `RouteGuard` role resolution → redirect (`parent` → `/portal/home`, else `/dashboard` or `location.state.from`)
- **Exits:** success → role-appropriate landing; failure → error toast. Grace periods: 3s profile, 5s role.
- **Referenced audits:** `audit-feature-01-auth-onboarding.md`
- **Priority:** CRITICAL

### A3. Forgot / reset password
- **Actor:** any authenticated role
- **Entry:** `/forgot-password` → emailed magic link → `/reset-password`
- **Touchpoints:** `ForgotPassword` → `AuthContext.resetPassword` → `supabase.auth.resetPasswordForEmail` → Supabase templated email → `/reset-password` → `supabase.auth.updateUser({password})`
- **Exits:** success → `/login`; failure → error toast.
- **Referenced audits:** `audit-feature-01-auth-onboarding.md`
- **Priority:** HIGH (account takeover adjacency)

### A4. Email verification
- **Actor:** newly signed-up user
- **Entry:** `/verify-email` (after sign-up) OR Supabase confirm link → `auth.users.email_confirmed_at`
- **Touchpoints:** `VerifyEmail` → periodic `supabase.auth.getUser` poll → on confirmed, `RouteGuard` releases
- **Exits:** confirmed → `/onboarding`; unconfirmed → stays blocked from protected routes.
- **Priority:** HIGH

### A5. Staff invite — send
- **Actor:** owner | admin
- **Entry:** `/settings` → Members → "Invite" dialog (`InviteMemberDialog.tsx`)
- **Touchpoints:** `InviteMemberDialog` → `send-invite-email` edge fn → creates `org_invitations` row (token) → Resend email → recipient link `/accept-invite?token=…`
- **Exits:** success → invite pending row; failure → toast. Re-send via `PendingInvitesList`.
- **Referenced audits:** `audit-feature-03-roles-permissions.md`
- **Priority:** CRITICAL (role escalation vector — token issuance + role binding)

### A6. Staff/parent invite — accept
- **Actor:** new user OR existing user
- **Entry:** `/accept-invite?token=…` (deep-link-aware on native via `lib/native/deepLinks.ts`)
- **Touchpoints:** `AcceptInvite.tsx` → `invite-get` edge fn (redacted email preview) → if not signed in: `sessionStorage` stash → `/login` / `/signup` → back to `/accept-invite` → `invite-accept` edge fn (binds `user_id` to `org_memberships`, flips invite to accepted) → role-appropriate redirect
- **Exits:** success → `/dashboard` or `/portal/home`; failure → error message on token mismatch, expired, email mismatch.
- **Referenced audits:** `audit-feature-03-roles-permissions.md`
- **Priority:** CRITICAL (role binding, email-match enforcement)

### A7. Guardian batch invite (from student record / CSV import)
- **Actor:** owner | admin
- **Entry:** `Students.tsx` or `StudentsImport` CompleteStep
- **Touchpoints:** `batch-invite-guardians` edge fn → per-guardian `send-invite-email` → creates invite rows → Resend emails
- **Exits:** per-recipient success/failure report.
- **Referenced audits:** `audit-feature-22-parent-portal.md`
- **Priority:** HIGH

### A8. Sign-out
- **Actor:** any
- **Entry:** user menu / `signOut` button
- **Touchpoints:** `AuthContext.signOut` → `supabase.auth.signOut({scope: 'global'})` fallback to `local` → clear query cache → `/login`
- **Priority:** MEDIUM

### A9. Session resume (native app background → foreground)
- **Actor:** any (native only)
- **Entry:** Capacitor `App.appStateChange` (in `App.tsx` NativeInitializer)
- **Touchpoints:** `supabase.auth.getSession()` refresh → `queryClient.invalidateQueries()`
- **Exits:** success → refreshed data; if token expired → redirect to `/login`.
- **Priority:** HIGH (silent session loss on native)

### A10. Profile self-heal
- **Actor:** any authenticated user where `profiles` row is missing
- **Entry:** `Onboarding.tsx` on mount
- **Touchpoints:** `profile-ensure` edge fn → inserts `profiles` row → `refreshProfile`
- **Priority:** HIGH (RouteGuard 3s grace depends on this)

### A11. Zoom OAuth connect
- **Actor:** owner | admin | teacher (personal Zoom)
- **Entry:** `/settings` → Integrations → "Connect Zoom" → Zoom consent → `/auth/zoom/callback`
- **Touchpoints:** `zoom-oauth-start` edge fn → Zoom authorize → `zoom-oauth-callback` edge fn (token exchange, store in `zoom_connections`) → `ZoomOAuthCallback` page closes/redirects
- **Priority:** MEDIUM

### A12. Google Calendar OAuth connect
- **Actor:** owner | admin | teacher
- **Entry:** `/settings` → Integrations → "Connect Google"
- **Touchpoints:** `calendar-oauth-start` → Google consent → `calendar-oauth-callback` (stores tokens in `calendar_connections`) → subsequent `calendar-refresh-busy` cron uses tokens
- **Priority:** HIGH (third-party token storage + cron dependency)

---

## Section 1.B — Academy Setup (Org, Teachers, Locations, Students)

### B1. Org creation (first-run)
- **Actor:** new owner
- **Entry:** `/onboarding` → SetupStep
- **Touchpoints:** `onboarding-setup` edge fn → inserts `organisations`, default `locations` (primary), default `terms`, owner `org_memberships` → updates `profiles.has_completed_onboarding`
- **Exits:** success → `/dashboard`; failure → rollback path (partial org creation).
- **Priority:** CRITICAL (org-scoping foundation)

### B2. Org settings edit (branding, tz, currency, policies)
- **Actor:** owner | admin
- **Entry:** `/settings` → Organisation tab
- **Touchpoints:** `OrganisationTab.tsx` → direct `update` on `organisations` (RLS-guarded, trigger `protect_subscription_fields` blocks subscription cols). Related tabs: `BrandingTab`, `MusicSettingsTab`, `SchedulingSettingsTab`, `InvoiceSettingsTab`, `ContinuationSettingsTab`, `RecurringBillingTab`, `MessagingSettingsTab`, `PrivacyTab`, `NotificationsTab`
- **Exits:** success → toast; failure → trigger error, validation error.
- **Referenced audits:** `audit-feature-02-org-settings.md`
- **Priority:** HIGH (trigger surface; currency + tz changes have propagation risk)

### B3. Staff member list / role change / remove
- **Actor:** owner (all roles) | admin (non-owner mutations)
- **Entry:** `/settings` → Members (`OrgMembersTab.tsx`)
- **Touchpoints:** Direct `org_memberships` update/delete → `org_id` immutability trigger → role change (owner-protected)
- **Exits:** success → list refresh; failure → RLS denial.
- **Referenced audits:** `audit-feature-03-roles-permissions.md`
- **Priority:** CRITICAL (RBAC mutation)

### B4. Teacher add (with optional invite)
- **Actor:** owner | admin
- **Entry:** `/teachers` (`Teachers.tsx`)
- **Touchpoints:** `useTeachers` → insert `teachers` → optional `send-invite-email` → link `teacher_user_id` on accept
- **Exits:** success → list refresh; failure → validation/duplication error.
- **Referenced audits:** `audit-feature-05-teachers.md`
- **Priority:** HIGH (dual-linking `teacher_user_id` vs `teacher_id` → `teachers.user_id`)

### B5. Teacher edit (pay rate, availability, instruments)
- **Actor:** owner | admin (teacher self-service for availability only)
- **Entry:** `/teachers/:id` or self `TeacherAvailabilityTab` on dashboard
- **Touchpoints:** `useTeachers`, `useTeacherAvailability` → update `teachers`, `teacher_availability`, `teacher_instruments`; percentage pay gating via `pay_rate_type`
- **Priority:** HIGH (affects payroll + scheduling)

### B6. Teacher archive / remove
- **Actor:** owner | admin
- **Entry:** `/teachers`
- **Touchpoints:** archive flag OR hard delete via RPC (if unused). Impacts future lessons, pay runs.
- **Priority:** HIGH

### B7. Location + rooms CRUD
- **Actor:** owner | admin
- **Entry:** `/locations` (`Locations.tsx`)
- **Touchpoints:** insert/update `locations`, `rooms`; `set_primary_location` RPC (auto-promote on archive via `auto_promote_primary_on_archive` trigger)
- **Exits:** success → list refresh; failure → unique-name collision (case-insensitive).
- **Referenced audits:** `audit-feature-06-locations.md`
- **Priority:** MEDIUM

### B8. Student add (single)
- **Actor:** owner | admin | teacher
- **Entry:** `/students` → New Student dialog
- **Touchpoints:** `useStudents` → insert `students` → optional `student_guardians` link
- **Priority:** HIGH

### B9. Student CSV import (with guardian links + rates)
- **Actor:** owner | admin
- **Entry:** `/students/import`
- **Touchpoints:** `StudentsImport` wizard → `csv-import-mapping` edge fn (validate/preview) → `csv-import-execute` edge fn (atomic import, `import_batch_id`) → optional `batch-invite-guardians` → undo via `undo_student_import` RPC
- **Exits:** success → students inserted in batch; failure → per-row error report, rollback path via undo RPC.
- **Referenced audits:** `audit-feature-22-parent-portal.md`, `core-loop-audit-part2.md`
- **Priority:** CRITICAL (bulk write; undo path correctness)

### B10. Student edit / archive / delete
- **Actor:** owner | admin | teacher (edit); admin (delete)
- **Entry:** `/students/:id` (`StudentDetail.tsx`, `useStudentDetail`)
- **Touchpoints:** `useStudentDetailPage` → update `students` (soft-delete `archived=true`); `void_credits_on_student_delete` trigger; guardian linking; instruments
- **Priority:** HIGH (cascading waitlist/credit impact)

### B11. Term CRUD + default term
- **Actor:** owner | admin
- **Entry:** `/settings` → `TermManagementCard`
- **Touchpoints:** insert/update `terms`; impacts continuation runs, credit expiry, billing
- **Priority:** HIGH

### B12. Closure dates (holidays)
- **Actor:** owner | admin
- **Entry:** settings → scheduling
- **Touchpoints:** `useClosureDates`, `useClosurePatternCheck` → `closure_dates` table; calendar overlay
- **Priority:** MEDIUM

### B13. Rate cards
- **Actor:** owner | admin
- **Entry:** `/settings` → `RateCardsTab`
- **Touchpoints:** `rate_cards` table; used when generating lessons to snapshot `lesson_participants.rate_minor`
- **Priority:** HIGH (money path — rate resolution)

### B14. Instrument catalogue
- **Actor:** owner | admin
- **Entry:** `/settings` → `MusicSettingsTab`
- **Touchpoints:** `useInstruments` → `instruments` table (org-scoped)
- **Priority:** LOW

### B15. Demo/seed data
- **Actor:** owner (self-serve) or internal
- **Entry:** settings or admin tool
- **Touchpoints:** `seed-demo-agency`, `seed-demo-solo`, `seed-demo-data`, `seed-e2e-data` edge fns — bulk inserts against new org
- **Priority:** MEDIUM (footgun if ever runnable against live org)

---

## Section 1.C — Scheduling (Lessons, Calendar, Slots, Recurrence)

### C1. Single lesson create
- **Actor:** owner | admin | teacher
- **Entry:** Calendar drag-to-create, `QuickCreatePopover`, or `LessonModal`
- **Touchpoints:** `useLessonForm` → insert `lessons` + `lesson_participants` (rate snapshot via rate-card resolution) → optional `calendar-sync-lesson` + `zoom-sync-lesson` → query invalidation
- **Exits:** success → lesson visible on grid; failure → conflict toast (overlap/closure check).
- **Referenced audits:** `audit-feature-07-lessons-calendar.md`, `core-loop-audit-part1.md`
- **Priority:** HIGH (rate snapshot correctness, overlap)

### C2. Lesson edit (single instance)
- **Actor:** owner | admin | lesson teacher
- **Entry:** `LessonDetailPanel` / `LessonDetailSidePanel`
- **Touchpoints:** update `lessons` (CHECK `end_at > start_at`), `lesson_participants`; `can_edit_lesson()` RPC guard; drag/resize via `useDragLesson` / `useResizeLesson`; `can_edit_lesson` re-check server-side
- **Priority:** HIGH

### C3. Recurring lesson create (rule + materialised occurrences)
- **Actor:** owner | admin | teacher
- **Entry:** `RecurrenceSection` in `LessonFormBody`
- **Touchpoints:** insert `recurrence_rules` (DST-safe via date-fns-tz, 200-lesson cap) → insert `lessons` batch
- **Priority:** HIGH (DST + cap + bulk write)

### C4. Recurring edit — "this & following" / all-future time shift
- **Actor:** owner | admin | lesson teacher
- **Entry:** `RecurringEditDialog`
- **Touchpoints:** `shift_recurring_lesson_times` RPC → updates `recurrence_rules` + affected `lessons`
- **Priority:** HIGH (state-divergence risk across series)

### C5. Recurring delete (single / series)
- **Actor:** owner | admin
- **Entry:** `RecurringActionDialog`
- **Touchpoints:** lesson delete trigger: blocks if invoiced; cascades `lesson_participants`
- **Priority:** HIGH (invoice-guard trigger correctness)

### C6. Bulk edit / bulk cancel
- **Actor:** owner | admin
- **Entry:** `BulkSelectBar` → `BulkEditDialog` on `/calendar`
- **Touchpoints:** `useBulkLessonActions` → `bulk_update_lessons` / `bulk_cancel_lessons` RPCs (atomic, server-side authz)
- **Referenced audits:** `audit-feature-09-bulk-edit.md`
- **Priority:** HIGH

### C7. Slot generator wizard (open-slot grid for future term/month)
- **Actor:** owner | admin
- **Entry:** `SlotGeneratorWizard` on `/calendar`
- **Touchpoints:** `useSlotGenerator` → insert `lessons` with `is_open_slot=true`; `SlotPreviewTimeline` pre-check
- **Referenced audits:** `audit-feature-08-slot-generator.md`
- **Priority:** HIGH (bulk creation)

### C8. Open-slot booking by parent / public booking page
- **Actor:** parent (portal) or public
- **Entry:** `/portal/schedule` (parent) OR `/book/:slug` (public)
- **Touchpoints (public):** `BookingPage.tsx` → `booking-get-slots` → `booking-submit` edge fn → inserts `lesson_participants`, clears `is_open_slot`; enquiry mode → `leads` via `send-parent-enquiry`
- **Touchpoints (parent):** `PortalSchedule` flows into same open-slot consumption
- **Referenced audits:** `audit-feature-22-parent-portal.md`
- **Priority:** CRITICAL (public endpoint, write path, rate-limit surface)

### C9. Parent reschedule / cancel request
- **Actor:** parent
- **Entry:** `/portal/schedule` → `LessonChangeSheet`
- **Touchpoints:** insert `lesson_change_requests` → teacher/admin approves via `/calendar` → on approve update lesson + optionally issue make-up credit
- **Priority:** HIGH

### C10. Lesson conflict detection
- **Actor:** owner | admin | teacher
- **Entry:** all create/edit flows
- **Touchpoints:** `useConflictDetection` → checks teacher/location/student overlap + `external_busy_blocks` overlay
- **Priority:** HIGH (silent conflict risk)

### C11. External busy-block overlay (Google Calendar)
- **Actor:** teacher
- **Entry:** `/calendar` with Google connected
- **Touchpoints:** `useExternalBusyBlocks` → reads `external_busy_blocks` (populated by `calendar-refresh-busy` cron every 15 min)
- **Priority:** MEDIUM

### C12. Two-way calendar sync per lesson
- **Actor:** teacher with Google connected
- **Entry:** on lesson create/edit
- **Touchpoints:** `useCalendarSync` → `calendar-sync-lesson` edge fn → Google API → stores external event id
- **Priority:** HIGH (external-state divergence)

### C13. iCal feed subscribe
- **Actor:** any (Apple / other readers)
- **Entry:** `useCalendarConnections` → `calendar-ical-feed?token=…` (unauthed via token)
- **Touchpoints:** `calendar-ical-feed` edge fn (no JWT, token-based)
- **Priority:** HIGH (bearer-token leakage → PII exposure)

### C14. Zoom lesson sync
- **Actor:** teacher with Zoom connected
- **Entry:** lesson with "Zoom link" enabled
- **Touchpoints:** `useZoomSync` → `zoom-sync-lesson` edge fn → Zoom API → store meeting URL on lesson
- **Priority:** MEDIUM

### C15. Teacher availability (self-service)
- **Actor:** teacher
- **Entry:** dashboard "My Availability" card
- **Touchpoints:** `useTeacherAvailability` → `teacher_availability` rows; feeds slot generator + conflict checks
- **Priority:** MEDIUM

### C16. Closure dates application
- **Actor:** owner | admin
- **Entry:** settings → closures
- **Touchpoints:** `useClosurePatternCheck` prevents creating lessons on closure days; surfaced visually in calendar views
- **Priority:** MEDIUM

---

## Section 1.D — Attendance & Registers

### D1. Daily register (per-teacher view)
- **Actor:** owner | admin | teacher
- **Entry:** `/register` (`DailyRegister.tsx`)
- **Touchpoints:** `useRegisterData` → loads today's `lessons` + `lesson_participants` + existing `attendance_records` → `RegisterRow` per-lesson marking → upsert `attendance_records` (status: present/absent/late/cancelled/…)
- **Exits:** status persisted; triggers: `trg_auto_credit` (issues `make_up_credits` on qualifying absence), `send-absence-notification` (if parents opted in)
- **Referenced audits:** `audit-feature-10-attendance-register.md`
- **Priority:** CRITICAL (credit issuance triggered here)

### D2. Mark lesson day complete (batch "all present")
- **Actor:** owner | admin | teacher
- **Entry:** `MarkDayCompleteButton` on `LessonDetailPanel`
- **Touchpoints:** bulk upsert `attendance_records` with `present`
- **Priority:** HIGH (silently sets attendance for all)

### D3. Batch attendance — multi-day
- **Actor:** owner | admin | teacher
- **Entry:** `/batch-attendance` (`BatchAttendance.tsx`)
- **Touchpoints:** multi-date selector → bulk upsert `attendance_records` for range
- **Priority:** HIGH

### D4. Unmarked backlog view
- **Actor:** owner | admin | teacher
- **Entry:** `UnmarkedBacklogView`; `useUrgentActions` + `get_unmarked_lesson_count` RPC power dashboard badges
- **Touchpoints:** surfaces lessons past `start_at` lacking attendance records
- **Priority:** MEDIUM

### D5. Auto-complete stale lessons
- **Actor:** system (migration trigger `auto_complete_stale_lessons`)
- **Entry:** scheduled/trigger path on stale unmarked lessons
- **Touchpoints:** migration `20260330234227_auto_complete_stale_lessons.sql`; may insert present records automatically after some threshold
- **Priority:** HIGH (silent attendance write → credit/payroll side effects)

### D6. Absence reason capture + parent notification
- **Actor:** owner | admin | teacher
- **Entry:** `AbsenceReasonPicker` on register row after marking absent
- **Touchpoints:** update `attendance_records.absence_reason` → `send-absence-notification` edge fn (parent email via Resend) → may trigger `auto_issue_credit_on_absence` RPC
- **Priority:** CRITICAL (credit path + parent comms)

### D7. Credit reversal when attendance changes
- **Actor:** staff toggling status
- **Entry:** re-mark existing record
- **Touchpoints:** migration `20260403000004_fix_credit_reversal_on_attendance_change.sql` — voids previously issued credit if status changes away from absent
- **Priority:** CRITICAL (state reversal correctness)

### D8. Realtime attendance/practice subscription
- **Actor:** any participant
- **Entry:** register pages
- **Touchpoints:** migration `20260330234228_add_realtime_attendance_practice.sql` enables Supabase Realtime on attendance tables; UI updates on push
- **Priority:** MEDIUM

### D9. Dashboard urgent-action counters
- **Actor:** owner | admin | teacher
- **Entry:** `Dashboard.tsx`
- **Touchpoints:** `useUrgentActions` → `get_unmarked_lesson_count` and similar RPCs
- **Priority:** LOW

---

## Section 1.E — Billing & Invoicing

### E1. Billing run (bulk invoice generation)
- **Actor:** owner | admin | finance
- **Entry:** `/invoices` → Billing Runs → `BillingRunWizard`
- **Touchpoints:** `useBillingRuns` → `create-billing-run` edge fn (rate-limited, dedup) → inserts `billing_runs`, `invoices`, `invoice_items` from `lesson_participants.rate_minor` snapshots → auto-sync to Xero via `xero-sync-invoice` if connected
- **Exits:** success → invoices in `draft`; failure → partial run (dedup should prevent duplicates)
- **Referenced audits:** `audit-feature-11-billing-runs.md`
- **Priority:** CRITICAL (bulk money; idempotency; Xero sync)

### E2. Billing run delete (with paid-invoice guard)
- **Actor:** owner | admin
- **Entry:** `BillingRunHistory`
- **Touchpoints:** `delete_billing_run` RPC (rejects if any child invoice is paid/void)
- **Priority:** CRITICAL (destructive; guard correctness)

### E3. Manual invoice create
- **Actor:** owner | admin | finance
- **Entry:** `/invoices` → `CreateInvoiceModal`
- **Touchpoints:** direct insert `invoices` + `invoice_items` (status draft)
- **Priority:** HIGH

### E4. Invoice edit (draft only)
- **Actor:** owner | admin | finance
- **Entry:** `/invoices/:id` (`InvoiceDetail`)
- **Touchpoints:** update `invoices` / `invoice_items`; DB trigger enforces status transitions
- **Priority:** HIGH

### E5. Invoice send (email)
- **Actor:** owner | admin | finance
- **Entry:** `SendInvoiceModal`
- **Touchpoints:** `send-invoice-email` edge fn → Resend → transitions `invoices.status` draft→sent → records dispatch
- **Priority:** HIGH (email delivery, branded PDF, payment plan schedule)

### E6. Invoice PDF download
- **Actor:** staff or parent (their own)
- **Entry:** `useInvoicePdf`
- **Touchpoints:** client-side PDF render (jsPDF) from invoice data
- **Priority:** MEDIUM (content correctness — total/paid/remaining)

### E7. Payment plan setup
- **Actor:** owner | admin | finance
- **Entry:** `PaymentPlanSetup` / `PaymentPlanToggle` on invoice
- **Touchpoints:** update `invoices.plan_enabled`, `installment_count`, `installment_frequency` → derives `invoice_installments` (migration-created)
- **Priority:** CRITICAL (money schedule)

### E8. Installment auto-pay collection
- **Actor:** system (cron/scheduled)
- **Entry:** scheduled trigger
- **Touchpoints:** `stripe-auto-pay-installment` edge fn → Stripe off-session PI on saved PM → `payments` record → invoice `paid_minor` update; `installment-upcoming-reminder` and `installment-overdue-check` edge fns for dunning
- **Priority:** CRITICAL (autonomous money movement)

### E9. Manual payment record
- **Actor:** owner | admin | finance
- **Entry:** `RecordPaymentModal` on invoice
- **Touchpoints:** insert `payments` → trigger updates `invoices.paid_minor` → status transition on paid-in-full
- **Priority:** HIGH

### E10. Invoice overdue / dunning reminder
- **Actor:** system (cron)
- **Entry:** cron schedule
- **Touchpoints:** `invoice-overdue-check`, `overdue-reminders` edge fns → email via Resend; respects org dunning config on `organisations`
- **Priority:** HIGH

### E11. Term adjustment (pro-rate mid-term invoice fixes)
- **Actor:** owner | admin
- **Entry:** `TermAdjustmentWizard`
- **Touchpoints:** `useTermAdjustment` → `process-term-adjustment` edge fn → adjusts or issues new invoices
- **Priority:** HIGH

### E12. Invoice status lifecycle (draft → sent → paid → voided)
- **Actor:** system + staff
- **Entry:** all invoice transitions
- **Touchpoints:** DB trigger on `invoices` blocks invalid transitions; void path separate from refund (refunds don't auto-void)
- **Referenced audits:** `audit-feature-12-invoices.md`
- **Priority:** CRITICAL (state machine)

### E13. Invoice list filters / sorting / export
- **Actor:** owner | admin | finance
- **Entry:** `/invoices`
- **Touchpoints:** `useInvoices` query + `InvoiceFiltersBar` + CSV export
- **Priority:** MEDIUM

---

## Section 1.F — Payments (Stripe Connect, Plans, Auto-pay, Refunds)

### F1. Stripe Connect onboarding (org → connected account)
- **Actor:** owner | admin
- **Entry:** `/settings` → Billing → "Connect Stripe"
- **Touchpoints:** `useStripeConnect` → `stripe-connect-onboard` edge fn → returns onboarding URL → Stripe hosted flow → `stripe-connect-status` edge fn polls; `stripe-webhook` `account.updated` / `account.application.deauthorized` syncs `organisations.stripe_account_id` and flags
- **Priority:** CRITICAL (money custody)

### F2. Customer one-off invoice payment (parent, embedded)
- **Actor:** parent
- **Entry:** `/portal/invoices` invoice detail → `PaymentDrawer`
- **Touchpoints:** `useEmbeddedPayment` + `useStripePayment` → `stripe-create-payment-intent` edge fn (destination charge, paid out to org) → Stripe Elements → `stripe-verify-session` (optional confirm) → `stripe-webhook` `payment_intent.succeeded` → `record_stripe_payment_paid_guard` RPC → upserts `payments`, updates invoice `paid_minor`
- **Referenced audits:** `audit-feature-13-stripe-payments.md`
- **Priority:** CRITICAL

### F3. Customer payment via Stripe Checkout redirect (admin "pay on behalf")
- **Actor:** owner | admin (for parent)
- **Entry:** `InvoiceDetail` → "Pay with Stripe" redirect
- **Touchpoints:** `stripe-create-checkout` → redirect → `stripe-webhook` `checkout.session.completed` (invoice branch) → `handleInvoiceCheckoutCompleted`
- **Priority:** HIGH

### F4. Saved payment method list / detach
- **Actor:** parent
- **Entry:** `/portal/invoices` → Payment Methods
- **Touchpoints:** `useSavedPaymentMethods` → `stripe-list-payment-methods`, `stripe-detach-payment-method` edge fns
- **Priority:** HIGH

### F5. Auto-pay preferences update
- **Actor:** parent | owner | admin
- **Entry:** `PaymentMethodsCard`
- **Touchpoints:** `stripe-update-payment-preferences` edge fn → updates `organisations` / parent-level preferences
- **Priority:** HIGH

### F6. Installment auto-pay run
- **Actor:** system (cron/scheduler) + on-demand
- **Entry:** scheduled or triggered by `installment-upcoming-reminder`
- **Touchpoints:** `stripe-auto-pay-installment` edge fn → off-session PI → `stripe-webhook` `payment_intent.succeeded` → `payments` + invoice update; failure → `installment-overdue-check` cron + `auto-pay-upcoming-reminder`
- **Priority:** CRITICAL (autonomous money; retry logic)

### F7. Customer portal (Stripe-hosted subscription mgmt)
- **Actor:** owner only (per claude.md)
- **Entry:** `/settings` → Billing → "Manage subscription"
- **Touchpoints:** `stripe-customer-portal` edge fn → Stripe customer portal URL → return → `stripe-webhook` subscription lifecycle events
- **Priority:** HIGH

### F8. Refund (partial or full)
- **Actor:** owner | admin | finance
- **Entry:** `RefundDialog` on `InvoiceDetail`
- **Touchpoints:** `useRefund` → `stripe-process-refund` edge fn (platform account) → Stripe refund → `stripe-webhook` `charge.refunded` → `refunds` row (service_role writes only); OR `record_manual_refund` RPC for off-Stripe refunds → `send-refund-notification`
- **Referenced audits:** `audit-feature-14-refunds.md`
- **Priority:** CRITICAL (destructive money; dual path)

### F9. Payment receipt email
- **Actor:** system
- **Entry:** on successful payment
- **Touchpoints:** `send-payment-receipt` edge fn (triggered by webhook handler or record-payment path) → Resend
- **Priority:** MEDIUM

### F10. Stripe webhook (event processing)
- **Actor:** Stripe
- **Entry:** `https://…/functions/v1/stripe-webhook`
- **Touchpoints:** signature verify → `stripe_webhook_events` dedup insert (23505 = duplicate, returns 200) → switch on event.type: `checkout.session.completed` (subscription vs invoice), `checkout.session.expired`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`, `payment_intent.{succeeded,payment_failed}`, `account.updated`, `account.application.deauthorized`, `charge.refunded`
- **Exits:** 200 on success/duplicate; 400 on bad signature; **500 on DB failure** (per claude.md convention)
- **Priority:** CRITICAL (central money event bus)

### F11. Stripe billing history (for org admin UI)
- **Actor:** owner | admin
- **Entry:** `/settings` → Billing → History
- **Touchpoints:** `stripe-billing-history` edge fn → lists past Stripe invoices/charges
- **Priority:** MEDIUM

---

## Section 1.G — Xero Sync

### G1. Xero OAuth connect
- **Actor:** owner | admin
- **Entry:** `/settings` → Accounting tab (`AccountingTab.tsx`) → "Connect Xero"
- **Touchpoints:** `xero-oauth-start` edge fn → Xero consent → `xero-oauth-callback` (exchanges code, stores refresh+access in `xero_connections` for the org + tenant)
- **Scopes:** `openid profile email offline_access accounting.contacts accounting.invoices` (payments scope pending)
- **Priority:** CRITICAL (third-party auth; token custody)

### G2. Xero disconnect
- **Actor:** owner | admin
- **Entry:** `AccountingTab` → "Disconnect"
- **Touchpoints:** `xero-disconnect` edge fn → deletes `xero_connections` row, optionally `xero_entity_mappings`
- **Priority:** HIGH (cleanup; may leave orphan mappings)

### G3. Invoice sync (manual)
- **Actor:** owner | admin
- **Entry:** `AccountingTab` → bulk sync OR invoice-level action
- **Touchpoints:** `xero-sync-invoice` edge fn → `_shared/xero-auth.ts` `getValidXeroToken` (refresh) → Xero `/Contacts` upsert from `guardians` → Xero `/Invoices` create/update → store `xero_entity_mappings` for dedup; status mapping draft→DRAFT, sent/paid→AUTHORISED, voided→VOIDED
- **Priority:** CRITICAL (dedup on re-sync; external state mirror)

### G4. Invoice sync (auto on billing run)
- **Actor:** system
- **Entry:** `create-billing-run` edge fn completion
- **Touchpoints:** after generating invoices, POSTs to `xero-sync-invoice` per invoice (fire-and-forget `fetch`)
- **Priority:** CRITICAL (silent failure risk — fire-and-forget)

### G5. Payment sync (auto on Stripe webhook) — BLOCKED by scope
- **Actor:** system
- **Entry:** `stripe-webhook` handlers for `payment_intent.succeeded` and `charge.refunded`
- **Touchpoints:** fetch to `xero-sync-payment` edge fn → **currently blocked** until `accounting.payments` scope available
- **Priority:** CRITICAL when unblocked; currently FAILING SILENTLY

### G6. Contact sync (ensure Xero contact exists for guardian)
- **Actor:** system (within `xero-sync-invoice`)
- **Entry:** inline
- **Touchpoints:** uses `xero_entity_mappings` to dedup contact creation
- **Priority:** HIGH

### G7. Sync stats / health display
- **Actor:** owner | admin
- **Entry:** `AccountingTab` sync stats section
- **Touchpoints:** reads `xero_entity_mappings` counts, last-sync timestamps on `xero_connections`
- **Priority:** LOW

---

## Section 1.H — Term Continuation

### H1. Create continuation run (wizard)
- **Actor:** owner | admin
- **Entry:** `/continuation` → `ContinuationRunWizard`
- **Touchpoints:** `useTermContinuation` → `create-continuation-run` edge fn (4 invocation sites — stage flags) → inserts `term_continuation_runs` + per-student `term_continuation_responses` → enqueues emails
- **Exits:** run visible on `/continuation`; failure → rollback
- **Referenced audits:** `audit-feature-16-term-continuation.md`, `deep-audit-continuation-part2.md`, `deep-audit-continuation-part3.md`
- **Priority:** CRITICAL (bulk parent comms + downstream lesson creation)

### H2. Bulk-process continuation (server-side batch update)
- **Actor:** owner | admin
- **Entry:** `/continuation`
- **Touchpoints:** `bulk-process-continuation` edge fn → applies responses server-side → updates `term_continuation_responses.status`, inserts `lessons` for accepted, voids credits/offers as needed
- **Priority:** CRITICAL (bulk write, deadline-enforced)

### H3. Parent response (authenticated portal)
- **Actor:** parent
- **Entry:** `/portal/continuation`
- **Touchpoints:** `continuation-respond` edge fn → updates `term_continuation_responses.status` (continue/change/stop) → may flip waitlist offers
- **Priority:** CRITICAL (parent-initiated state change + downstream scheduling)

### H4. Parent response (public link, unauthenticated)
- **Actor:** parent
- **Entry:** `/respond/continuation` (public route, signed token)
- **Touchpoints:** same `continuation-respond` edge fn — verifies token; server-side deadline enforcement
- **Priority:** CRITICAL (unauth endpoint, token forgery surface)

### H5. Run summary recompute
- **Actor:** staff (any time) + after responses
- **Entry:** `/continuation` run detail view
- **Touchpoints:** `recalc_continuation_summary` RPC → aggregates counts/amounts on `term_continuation_runs`
- **Priority:** HIGH

### H6. Continuation response inspect / override
- **Actor:** owner | admin
- **Entry:** `ContinuationResponseDetail`
- **Touchpoints:** direct row update on `term_continuation_responses` (RLS + trigger enforces transition)
- **Priority:** HIGH

---

## Section 1.I — Make-up Credits & Waitlists

### I1. Auto-issue make-up credit on absence
- **Actor:** system (trigger)
- **Entry:** `attendance_records` insert/update → status = absent (qualifying)
- **Touchpoints:** `trg_auto_credit` trigger + `auto_issue_credit_on_absence` RPC → inserts `make_up_credits` row → `max per term` enforcement; `available_credits` view filters `voided_at IS NULL`
- **Priority:** CRITICAL (currency-like asset)

### I2. Manual credit issue / adjust
- **Actor:** owner | admin
- **Entry:** `/make-ups` or student detail
- **Touchpoints:** direct insert on `make_up_credits` (RLS)
- **Priority:** HIGH

### I3. Credit void
- **Actor:** owner | admin
- **Entry:** `MakeUpDashboard` → row actions
- **Touchpoints:** `void_make_up_credit` RPC → sets `voided_at`, `voided_by`; trigger `void_credits_on_student_delete` cascades on student delete
- **Priority:** CRITICAL (destructive; audit trail)

### I4. Credit consumption (parent books make-up)
- **Actor:** parent
- **Entry:** `/portal/schedule` → makeup open slot
- **Touchpoints:** select open slot → atomic consume via RPC using `FOR UPDATE SKIP LOCKED` to prevent double-spend → inserts `lesson_participants`, marks credit consumed
- **Priority:** CRITICAL (concurrency)

### I5. Credit expiry (cron)
- **Actor:** system
- **Entry:** cron `credit-expiry`
- **Touchpoints:** `credit-expiry` edge fn → expires credits past term end (except those on active waitlist per claude.md); optionally emails via `credit-expiry-warning`
- **Priority:** HIGH

### I6. Make-up waitlist add
- **Actor:** owner | admin | parent
- **Entry:** `/make-ups` or portal
- **Touchpoints:** `useMakeUpWaitlist` → insert `make_up_waitlist` (dedup index); waitlist credit ownership validated (migration `20260331140000_validate_waitlist_credit_ownership`)
- **Priority:** HIGH

### I7. Make-up offer (match + notify)
- **Actor:** owner | admin
- **Entry:** `/make-ups` → match
- **Touchpoints:** `notify-makeup-match` + `notify-makeup-offer` edge fns → emails parents; offer expires via deadline; `offer_notify_and_waitlist_audit` migration instruments audit
- **Priority:** CRITICAL (parent-facing state machine)

### I8. Make-up offer accept/decline
- **Actor:** parent
- **Entry:** email link → portal
- **Touchpoints:** atomic RPC → converts offer to booked lesson + consumes credit OR declines
- **Priority:** CRITICAL

### I9. Enrolment waitlist add
- **Actor:** owner | admin | parent
- **Entry:** `/waitlist` (`EnrolmentWaitlistPage`) or public booking
- **Touchpoints:** `useEnrolmentWaitlist` → insert `enrolment_waitlist` (mutual-exclusion vs `make_up_waitlist`)
- **Priority:** HIGH

### I10. Enrolment offer send
- **Actor:** owner | admin
- **Entry:** `/waitlist` → `OfferSlotDialog`
- **Touchpoints:** `send-enrolment-offer` edge fn → email
- **Priority:** HIGH

### I11. Enrolment offer expiry
- **Actor:** system
- **Entry:** cron `enrolment-offer-expiry`
- **Touchpoints:** expires stale offers; restores waitlist position
- **Priority:** HIGH

### I12. Waitlist respond (accept/decline via link)
- **Actor:** parent
- **Entry:** `waitlist-respond` edge fn (token-based, public)
- **Touchpoints:** atomic conversion → insert `lesson_participants` or decline → audit row
- **Priority:** CRITICAL

### I13. Waitlist general expiry cron
- **Actor:** system
- **Entry:** cron `waitlist-expiry`
- **Touchpoints:** age-out stale entries
- **Priority:** MEDIUM

---

## Section 1.J — Parent Portal

### J1. Portal home
- **Actor:** parent
- **Entry:** `/portal/home` (`PortalHome.tsx`)
- **Touchpoints:** `useParentPortal`, `ChildSwitcher`, `ThisWeekFocus`, `ParentOnboardingChecklist`, `PortalWelcomeDialog` → queries parent guardian chain (auth.uid → guardians.user_id → student_guardians → students) → filters by `?child=` via `useChildFilter`
- **Referenced audits:** `audit-feature-22-parent-portal.md`
- **Priority:** CRITICAL (guardian chain is the RLS boundary for all child data)

### J2. Portal schedule
- **Actor:** parent
- **Entry:** `/portal/schedule`
- **Touchpoints:** list upcoming/past lessons filtered by child → `LessonChangeSheet` for reschedule/cancel requests → reschedule via `RescheduleSlotPicker`
- **Priority:** HIGH

### J3. Portal practice (log practice, streak, goals)
- **Actor:** parent (or student via parent)
- **Entry:** `/portal/practice`
- **Touchpoints:** `PracticeTimer` → insert `practice_logs` → triggers streak/goal calcs; `PracticeHistory`, `WeeklyGoalCard`, `PracticeMilestones`
- **Priority:** MEDIUM

### J4. Portal resources
- **Actor:** parent
- **Entry:** `/portal/resources`
- **Touchpoints:** list `resources` assigned to child (filtered by guardian chain); storage download URLs via signed URL
- **Priority:** MEDIUM

### J5. Portal invoices & payment
- **Actor:** parent
- **Entry:** `/portal/invoices`
- **Touchpoints:** list `invoices` for guardian → `PaymentDrawer` (embedded Stripe) → `useEmbeddedPayment`; `PaymentPlanInvoiceCard` for installments; `PaymentMethodsCard` for saved methods and auto-pay preferences
- **Priority:** CRITICAL (parent-facing money)

### J6. Portal messages
- **Actor:** parent
- **Entry:** `/portal/messages`
- **Touchpoints:** `useParentConversations` → list `internal_messages` threads (guardian-scoped, **not** child-filtered by design) → `send-parent-message` edge fn to send/reply → `mark-messages-read` to clear unread
- **Priority:** HIGH

### J7. Portal profile
- **Actor:** parent
- **Entry:** `/portal/profile`
- **Touchpoints:** update `profiles`, `notification_preferences`; GDPR export/delete buttons (see 1.R)
- **Priority:** MEDIUM

### J8. Portal continuation response
- **Actor:** parent
- **Entry:** `/portal/continuation` (also public `/respond/continuation`)
- **Touchpoints:** `continuation-respond` edge fn (see H3/H4)
- **Priority:** CRITICAL

### J9. Parent LoopAssist (parent-side AI copilot)
- **Actor:** parent
- **Entry:** `PortalHome` LoopAssist widget or dedicated drawer
- **Touchpoints:** `useParentLoopAssist` → `parent-loopassist-chat` edge fn (streaming) → Anthropic Claude
- **Priority:** HIGH (data-scoping — must only expose parent's children)

### J10. Parent enquiry (portal & public booking)
- **Actor:** parent or prospect
- **Entry:** portal or `/book/:slug` enquiry mode
- **Touchpoints:** `useParentEnquiry` → `send-parent-message` edge fn (unified with replies) OR `send-parent-enquiry` for lead generation → `leads` insert
- **Priority:** HIGH

### J11. Guardian invitation acceptance badge (admin-side visibility)
- **Actor:** owner | admin (viewing)
- **Entry:** student detail / guardian list
- **Touchpoints:** reads `org_invitations` state; displays "Portal Active"/"Invite Pending"
- **Priority:** LOW

---

## Section 1.K — Messaging

### K1. Staff → parent thread message
- **Actor:** owner | admin | teacher | finance
- **Entry:** `/messages` → `ComposeMessageModal`
- **Touchpoints:** `useMessages` → `send-message` edge fn → inserts `internal_messages` (thread), dispatches email via Resend (with List-Unsubscribe), `escapeHtml` per claude.md
- **Referenced audits:** `audit-feature-23-messaging.md`
- **Priority:** CRITICAL (email, PII, XSS in rendered HTML)

### K2. Parent → staff reply
- **Actor:** parent
- **Entry:** `/portal/messages`
- **Touchpoints:** `useParentReply` / `useParentEnquiry` → `send-parent-message` edge fn (unified) → inserts `internal_messages`, email notifies staff via `notify-internal-message`
- **Priority:** HIGH

### K3. Internal staff-to-staff message
- **Actor:** owner | admin | teacher | finance
- **Entry:** `/messages` → `InternalComposeModal`
- **Touchpoints:** `useInternalMessages` → insert `internal_messages` (internal thread) → `notify-internal-message` edge fn emails recipients
- **Priority:** MEDIUM

### K4. Bulk message (org-wide or segmented)
- **Actor:** owner | admin
- **Entry:** `/messages` → `BulkComposeModal`
- **Touchpoints:** `useBulkMessage` → `send-bulk-message` edge fn (admin-only, escapeHtml, List-Unsubscribe) → emails all matching guardians/teachers
- **Priority:** CRITICAL (mass email; consent + rate)

### K5. Message thread read state
- **Actor:** any
- **Entry:** open thread
- **Touchpoints:** `useUnreadMessages` → `mark-messages-read` edge fn → updates `internal_messages.read_at` per-recipient
- **Priority:** MEDIUM

### K6. Teacher-conversation reassignment on teacher departure
- **Actor:** owner | admin
- **Entry:** `MessagingSettingsTab`
- **Touchpoints:** `reassign_teacher_conversations_to_owner` RPC → bulk reassign
- **Priority:** MEDIUM

### K7. Admin approves pending message request (portal → staff)
- **Actor:** owner | admin
- **Entry:** `MessageRequestsList` (`useAdminMessageRequests`)
- **Touchpoints:** on approve → calls `send-message` to dispatch conversation; inserts `internal_messages`
- **Priority:** HIGH

### K8. Payment notifications (internal system table)
- **Actor:** system
- **Entry:** Stripe payment handler / invoice reminders
- **Touchpoints:** `payment_notifications` table (service_role INSERT only) — surfaced in portal and admin views
- **Priority:** HIGH (RLS on write)

### K9. Contact form (public)
- **Actor:** public
- **Entry:** marketing `/contact`
- **Touchpoints:** `send-contact-message` edge fn → emails internal team
- **Priority:** MEDIUM (public write endpoint)

### K10. Absence / cancellation / refund / receipt notifications
- **Actor:** system (triggered by attendance/refund/payment)
- **Entry:** internal
- **Touchpoints:** `send-absence-notification`, `send-cancellation-notification`, `send-refund-notification`, `send-payment-receipt`, `send-notes-notification` edge fns → Resend
- **Priority:** HIGH

### K11. Lesson reminders
- **Actor:** system (cron)
- **Entry:** cron job 14 (hourly)
- **Touchpoints:** `send-lesson-reminders` edge fn (290 lines; dedup by lesson+recipient)
- **Priority:** HIGH

### K12. Push notifications (native)
- **Actor:** system
- **Entry:** various (messages, reminders, etc.)
- **Touchpoints:** `send-push` edge fn → APNs/FCM via Capacitor Push registration in `services/pushNotifications.ts`
- **Priority:** HIGH (native delivery + token storage)

### K13. Streak / practice / contextual nudges
- **Actor:** system
- **Entry:** cron or trigger
- **Touchpoints:** `streak-notification`, `notify-makeup-*`, etc.
- **Priority:** MEDIUM

---

## Section 1.L — Practice Tracking & Resources

### L1. Log practice session (portal)
- **Actor:** parent (on behalf of student)
- **Entry:** `/portal/practice` → `PracticeTimer`
- **Touchpoints:** `usePractice` → insert `practice_logs` → triggers streak calc and weekly-goal progress
- **Priority:** MEDIUM (low-stakes writes but high-frequency, RLS critical)

### L2. Streak milestone celebration / notifications
- **Actor:** system
- **Entry:** streak transitions
- **Touchpoints:** `StreakBadge`, `StreakCelebration`; `streak-notification` edge fn → push/email
- **Priority:** LOW

### L3. Assignment create (teacher → student practice goal)
- **Actor:** owner | admin | teacher
- **Entry:** `/practice` → `CreateAssignmentModal`
- **Touchpoints:** insert `practice_assignments` (or similar) → scoped to student/instrument
- **Referenced audits:** `audit-feature-20-practice-tracking.md`
- **Priority:** MEDIUM

### L4. Teacher practice review
- **Actor:** owner | admin | teacher
- **Entry:** `/practice` → `TeacherPracticeReview`
- **Touchpoints:** list aggregated logs + assignments per student
- **Priority:** LOW

### L5. Resource upload
- **Actor:** owner | admin | teacher
- **Entry:** `/resources` → `UploadResourceModal`
- **Touchpoints:** `useResources` → Supabase Storage bucket upload → insert `resources` row; optional `ShareResourceModal` → insert `resource_shares`
- **Referenced audits:** `audit-feature-21-resources.md`
- **Priority:** HIGH (file storage, signed URL expiry, PII in uploads)

### L6. Resource share / unshare
- **Actor:** owner | admin | teacher
- **Entry:** `ShareResourceModal`
- **Touchpoints:** insert/delete `resource_shares` (student- or guardian-scoped)
- **Priority:** HIGH

### L7. Resource delete / update
- **Actor:** owner | admin | teacher
- **Entry:** `/resources` → detail modal
- **Touchpoints:** `useUpdateResource` → update/delete rows; storage file may linger (cleanup cron)
- **Priority:** HIGH

### L8. Orphaned resource cleanup
- **Actor:** system
- **Entry:** cron `cleanup-orphaned-resources` (schedule TBD)
- **Touchpoints:** deletes storage files not referenced in `resources`
- **Priority:** HIGH (cost + data residency)

### L9. Resource preview / audio player
- **Actor:** parent / teacher
- **Entry:** `ResourcePreviewModal`, `AudioPlayer`
- **Touchpoints:** signed URL generation; MIME handling
- **Priority:** MEDIUM (XSS via embed if mishandled)

### L10. Category management
- **Actor:** owner | admin | teacher
- **Entry:** `ManageCategoriesModal`
- **Touchpoints:** CRUD `resource_categories`
- **Priority:** LOW

---

## Section 1.M — Notes

### M1. Lesson note save (teacher)
- **Actor:** owner | admin | teacher (lesson teacher)
- **Entry:** `LessonNotesForm` on `LessonDetailPanel`
- **Touchpoints:** `useLessonNotes` → direct insert/update on `lesson_notes` (RLS + `can_edit_lesson()`); column-level privacy (`teacher_private_notes` never exposed to parents) enforced by RPC-only read access
- **Referenced audits:** `audit-feature-19-lesson-notes.md`
- **Priority:** CRITICAL (column-level privacy)

### M2. Notes notification to parent on save
- **Actor:** system
- **Entry:** on lesson note save (from `useLessonForm`)
- **Touchpoints:** `useNotesNotification` → `send-notes-notification` edge fn → Resend
- **Priority:** HIGH (parent data exposure vector if non-private fields leak)

### M3. Staff notes explorer (cross-student search)
- **Actor:** owner | admin | teacher
- **Entry:** `/notes` (`NotesExplorer`)
- **Touchpoints:** `useNotesExplorer` → `get_lesson_notes_for_staff` RPC (returns full notes including `teacher_private_notes`) → `NoteCard`, `NotesFilterBar`, `NotesStatsBar`
- **Priority:** HIGH

### M4. Parent view of lesson notes
- **Actor:** parent
- **Entry:** `/portal/schedule` or child detail
- **Touchpoints:** `get_parent_lesson_notes` RPC (REDACTS `teacher_private_notes`)
- **Priority:** CRITICAL (RPC-only privacy boundary)

### M5. Student quick-note popover (register)
- **Actor:** owner | admin | teacher
- **Entry:** register row → `StudentNotesPopover`
- **Touchpoints:** `useStudentQuickNotes` → reads recent notes for student (via RPC)
- **Priority:** MEDIUM

### M6. Student lesson-note history on student detail
- **Actor:** owner | admin | teacher
- **Entry:** `/students/:id` → notes tab
- **Touchpoints:** `useStudentLessonNotes` / `useStudentDetail`
- **Priority:** MEDIUM

---
