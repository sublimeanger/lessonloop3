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

## Section 1.N — LoopAssist

### N1. Staff LoopAssist chat (streaming)
- **Actor:** owner | admin | teacher | finance
- **Entry:** global drawer `LoopAssistDrawer` (`LoopAssistContext`)
- **Touchpoints:** `useLoopAssist` → `looopassist-chat` edge fn → Anthropic Claude API (Haiku 4.5 or Sonnet 4.5 per plan) → Block 1 cached knowledge base (`knowledge-base.ts`), Block 2 dynamic context → tool calls include `query_org_data` for live analytics → streaming via `consumeAnthropicStream`
- **Daily cap:** 200 requests/org/day
- **Referenced audits:** `audit-feature-24-loopassist.md`
- **Priority:** CRITICAL (LLM tool execution; auth boundary on tools)

### N2. LoopAssist action execution
- **Actor:** owner | admin (based on action-registry)
- **Entry:** `ActionCard` approve
- **Touchpoints:** `looopassist-execute` edge fn → mutates org data (marking attendance, creating lesson, sending message) → role-permission check mirrored from `lib/action-registry.ts`
- **Priority:** CRITICAL (mutation from LLM output)

### N3. Parent LoopAssist chat
- **Actor:** parent
- **Entry:** `PortalHome` or LoopAssist widget
- **Touchpoints:** `parent-loopassist-chat` edge fn — must only scope queries to parent's children
- **Priority:** CRITICAL (cross-family data leak risk)

### N4. Marketing AI chat (public)
- **Actor:** public
- **Entry:** `/` marketing or contact page widget (`MarketingChatWidget`)
- **Touchpoints:** `marketing-chat` edge fn → public LLM endpoint; rate-limited
- **Priority:** HIGH (public LLM endpoint, cost + abuse)

### N5. Proactive alerts
- **Actor:** system / staff (passive display)
- **Entry:** `ProactiveAlerts` component
- **Touchpoints:** queries org data, surfaces recommendations
- **Priority:** MEDIUM

### N6. First-run onboarding / welcome for LoopAssist
- **Actor:** staff
- **Entry:** `LoopAssistIntroModal`, `ProactiveWelcome`
- **Touchpoints:** `useLoopAssistFirstRun` → `banner_dismissals` / preferences
- **Priority:** LOW

### N7. Message feedback capture
- **Actor:** staff
- **Entry:** `MessageFeedback` inline
- **Touchpoints:** insert into feedback table (telemetry)
- **Priority:** LOW

---

## Section 1.O — Subscriptions & Trials (LessonLoop's own billing)

### O1. Trial start (at org creation)
- **Actor:** owner
- **Entry:** `onboarding-setup` edge fn
- **Touchpoints:** sets `organisations.subscription_status='trialing'`, `trial_ends_at`; fields protected by `protect_subscription_fields` trigger (service_role or Stripe webhook only)
- **Priority:** CRITICAL (protected column surface)

### O2. Trial reminder emails
- **Actor:** system
- **Entry:** cron: `trial-reminder-7day`, `trial-reminder-3day`, `trial-reminder-1day`
- **Touchpoints:** Resend; respects unsub preferences
- **Priority:** MEDIUM

### O3. Trial expiry
- **Actor:** system
- **Entry:** cron `trial-expired`
- **Touchpoints:** flips `subscription_status='expired'`; UI shows `TrialExpiredModal`; `useFeatureGate` blocks features
- **Priority:** HIGH

### O4. Trial winback email
- **Actor:** system
- **Entry:** cron `trial-winback` (post-expiry)
- **Touchpoints:** re-engagement email
- **Priority:** LOW

### O5. Subscription checkout (upgrade from trial / plan change)
- **Actor:** owner (NOT admin — owner-only per claude.md)
- **Entry:** `/settings` → Billing (`BillingTab`)
- **Touchpoints:** `useSubscriptionCheckout` → `stripe-subscription-checkout` edge fn (verifies JWT + owner) → Stripe Checkout hosted flow → `stripe-webhook` `checkout.session.completed` (subscription branch) → updates `organisations` subscription fields → `customer.subscription.{created,updated}` lifecycle
- **Priority:** CRITICAL (money + role gate)

### O6. Customer portal (cancel / update plan)
- **Actor:** owner only
- **Entry:** `BillingTab` → "Manage subscription"
- **Touchpoints:** `stripe-customer-portal` edge fn → Stripe portal → `customer.subscription.{updated,deleted}` webhook
- **Priority:** CRITICAL (cancellation + reactivation)

### O7. Subscription payment failure → dunning
- **Actor:** system
- **Entry:** `stripe-webhook` `invoice.payment_failed`
- **Touchpoints:** `handleSubscriptionPaymentFailed` → updates `organisations.subscription_status`; Stripe Smart Retries active; UI surfaces `UpgradeBanner`
- **Priority:** CRITICAL

### O8. Feature-gate enforcement
- **Actor:** any
- **Entry:** any gated feature
- **Touchpoints:** `useFeatureGate` → reads `organisations.subscription_plan` against `_shared/plan-config.ts` → `FeatureGate` wraps components; also enforced server-side in relevant edge fns
- **Referenced audits:** `audit-feature-25-subscriptions.md`
- **Priority:** CRITICAL (client vs server consistency)

### O9. Auto-transition solo→studio plan
- **Actor:** system
- **Entry:** migration `20260316360003_auto_transition_solo_to_studio.sql`
- **Touchpoints:** trigger-based promotion at some threshold
- **Priority:** HIGH (silent plan change)

---

## Section 1.P — Payroll

### P1. Payroll report view (date range)
- **Actor:** owner | admin | finance | teacher (own rows only)
- **Entry:** `/reports/payroll` (`pages/reports/Payroll.tsx`)
- **Touchpoints:** `usePayroll` → reads `lessons` + `lesson_participants` + `attendance_records` + `teachers.pay_rate_type` / `pay_rate_value` → computes teacher totals (per_lesson | hourly | percentage)
- **Referenced audits:** `audit-feature-26-payroll.md`
- **Priority:** CRITICAL (money path — though read-only; percentage math + attendance exclusions)

### P2. Payroll CSV export
- **Actor:** owner | admin | finance
- **Entry:** `/reports/payroll` → Export
- **Touchpoints:** client-side CSV generation; `useDataExport`
- **Priority:** HIGH (PII egress)

### P3. Percentage pay rate (added April 2026)
- **Actor:** derived from teacher config
- **Entry:** teacher edit (see B5)
- **Touchpoints:** migration `20260404210000_add_percentage_pay_rate_type.sql`; payroll resolver applies rate against revenue from attended lessons
- **Priority:** HIGH (new money logic)

---

## Section 1.Q — Reports & Exports

### Q1. Dashboard widgets
- **Actor:** owner | admin | teacher | finance
- **Entry:** `/dashboard`
- **Touchpoints:** various hooks (`useUrgentActions`, `useTodayLessons`, `useUsageCounts`, `usePaymentAnalytics`)
- **Priority:** LOW (read-only)

### Q2. Revenue report
- **Actor:** owner | admin | finance
- **Entry:** `/reports/revenue`
- **Touchpoints:** aggregates `payments.paid_minor` vs `invoices.total_minor`; migration `20260316360002_fix_revenue_report_paid_minor.sql`
- **Priority:** HIGH (reporting accuracy — financial)

### Q3. Outstanding report
- **Actor:** owner | admin | finance
- **Entry:** `/reports/outstanding`
- **Touchpoints:** unpaid invoices aged; currency-aware
- **Priority:** HIGH

### Q4. Lessons delivered report
- **Actor:** owner | admin | teacher
- **Entry:** `/reports/lessons`
- **Touchpoints:** attended lesson counts
- **Priority:** MEDIUM

### Q5. Cancellation report
- **Actor:** owner | admin
- **Entry:** `/reports/cancellations`
- **Priority:** MEDIUM

### Q6. Attendance report
- **Actor:** owner | admin | teacher
- **Entry:** `/reports/attendance`
- **Touchpoints:** `useAttendanceReport`
- **Priority:** MEDIUM

### Q7. Utilisation report
- **Actor:** owner | admin
- **Entry:** `/reports/utilisation`
- **Touchpoints:** capacity vs booked calculation
- **Priority:** MEDIUM

### Q8. Teacher performance report
- **Actor:** owner | admin
- **Entry:** `/reports/teacher-performance`
- **Touchpoints:** `useTeacherPerformance`
- **Priority:** MEDIUM

### Q9. CSV export on all 8 reports
- **Actor:** owner | admin | finance (per report)
- **Entry:** per-page Export button
- **Touchpoints:** client-side CSV
- **Priority:** HIGH (PII egress, financial egress)

---

## Section 1.R — GDPR

### R1. GDPR data export (per-subject, parent or staff)
- **Actor:** any authenticated user (for self)
- **Entry:** `/settings` → Privacy (`PrivacyTab`) or portal profile
- **Touchpoints:** `useGDPRExport` → `gdpr-export` edge fn → queries all tables scoped to `auth.uid()` → returns JSON
- **Priority:** CRITICAL

### R2. GDPR account delete (right to erasure)
- **Actor:** any authenticated user
- **Entry:** `/settings` → Privacy
- **Touchpoints:** `useGDPRDelete` → `gdpr-delete` edge fn → hard-delete or anonymise across tables; `useDeletionCandidates` previews impact
- **Priority:** CRITICAL (destructive; cascade correctness)

### R3. Account delete (owner self-serve)
- **Actor:** owner
- **Entry:** `ProfileTab`
- **Touchpoints:** `account-delete` edge fn → org ownership check → cascades to all org data
- **Priority:** CRITICAL (org destruction)

### R4. Notification preference opt-out / list-unsubscribe
- **Actor:** any recipient
- **Entry:** settings → Notifications or List-Unsubscribe mail header
- **Touchpoints:** `notification_preferences` rows; all email dispatch respects them
- **Priority:** HIGH (compliance)

### R5. Child data restrictions (parent-RPC only access)
- **Actor:** parent
- **Entry:** portal
- **Touchpoints:** `students.notes` restricted from parents at RPC level; `get_parent_lesson_notes` strips private notes
- **Priority:** CRITICAL

---

## Section 1.S — Native (iOS / Android)

### S1. App launch / deep-link handling
- **Actor:** any user on native
- **Entry:** app open / universal link / push tap
- **Touchpoints:** `lib/native/init.ts` → sets up Capacitor; `lib/native/deepLinks.ts` parses `/accept-invite`, invoice links, etc. and routes via `NativeInitializer`
- **Priority:** HIGH (deep-link open-redirect surface)

### S2. Push notification registration & delivery
- **Actor:** authenticated user on native
- **Entry:** on login (post-auth)
- **Touchpoints:** `services/pushNotifications.ts` → Capacitor Push → registers device token → stored on `profiles` or dedicated table → `send-push` edge fn delivers via APNs/FCM
- **Priority:** HIGH (PII-bearing channel + token rotation)

### S3. App state change (resume)
- **Actor:** any user
- **Entry:** Capacitor `App.appStateChange`
- **Touchpoints:** session refresh + query invalidation (see A9)
- **Priority:** HIGH

### S4. Status bar / keyboard / haptics / camera / share
- **Actor:** user
- **Entry:** various UI interactions
- **Touchpoints:** `lib/native/{statusBar,keyboard,haptics,camera,share,badge,browser,network}.ts`; `useIOSKeyboardHeight`
- **Priority:** LOW (UX)

### S5. Stripe / Apple IAP conflict handling
- **Actor:** user
- **Entry:** any payment UI on native
- **Touchpoints:** `platform.ts` detects native → hides Stripe payment UI (Apple IAP policy)
- **Priority:** HIGH (App Store compliance)

### S6. Android back button
- **Actor:** Android user
- **Entry:** hardware back
- **Touchpoints:** `useAndroidBackButton`
- **Priority:** LOW

### S7. Offline state
- **Actor:** any
- **Entry:** loss of connectivity
- **Touchpoints:** `useOnlineStatus`, `OfflineBanner`; query cache survives
- **Priority:** MEDIUM

---

## Section 1.T — Marketing Site → App Conversion

### T1. Static marketing site (Cloudflare Pages)
- **Actor:** public
- **Entry:** `lessonloop.net` (prerendered output in `marketing-html/`)
- **Touchpoints:** `scripts/prerender.mjs` loads `routes-ssg.ts` → writes HTML; **claude.md warns on `localhost` leak risk**
- **Priority:** HIGH (production hostname leak regression)

### T2. Marketing → app CTA (Sign up / Login)
- **Actor:** public
- **Entry:** marketing CTA → `app.lessonloop.net/signup`
- **Touchpoints:** link; sometimes pre-fills plan via query string
- **Priority:** MEDIUM

### T3. Contact form
- **Actor:** public
- **Entry:** marketing `/contact` or app-side `Contact`
- **Touchpoints:** `send-contact-message` edge fn → internal email
- **Priority:** HIGH (public write endpoint, spam vector)

### T4. Marketing AI chat
- **Actor:** public
- **Entry:** marketing widget
- **Touchpoints:** `marketing-chat` edge fn (LLM, rate-limited)
- **Priority:** HIGH (public LLM cost + abuse)

### T5. Public booking page
- **Actor:** public prospect
- **Entry:** `lessonloop.net/book/{slug}` → proxied to app `/book/:slug`
- **Touchpoints:** `BookingPage.tsx` → `booking-get-slots`, `booking-submit`; enquiry mode → `send-parent-enquiry` → `leads` pipeline (`convert_lead` RPC on qualification)
- **Priority:** CRITICAL (public write endpoint)

### T6. Lead pipeline management (inbound)
- **Actor:** owner | admin
- **Entry:** `/leads` (`Leads.tsx`)
- **Touchpoints:** `useLeads`, `useLeadActivities`, `useLeadAnalytics`, `LeadDetail` → `convert_lead` RPC to promote to students
- **Priority:** HIGH

### T7. Kickstarter / marketing page internal
- **Actor:** public
- **Entry:** `/kickstarter` → external redirect
- **Priority:** LOW

### T8. Report download (marketing gated content)
- **Actor:** public (lead capture)
- **Entry:** `pages/marketing/ReportDownload.tsx`
- **Touchpoints:** captures email → lead row; `send-contact-message` or similar
- **Priority:** MEDIUM

---

## Section 2.1 — Authn/Authz

### Frontend auth boundary
- `src/contexts/AuthContext.tsx` — `useAuth`, `signIn/signUp/signOut`, profile load, session watcher
- `src/contexts/OrgContext.tsx` — current org + role resolution, role switcher
- `src/components/auth/RouteGuard.tsx` — `RouteGuard`, `PublicRoute` (3s profile grace, 5s role grace, email-verified check, invite-return allowlist)
- `src/config/routes.ts` — declarative `allowedRoles` per route
- `src/hooks/useSubscription.ts`, `src/hooks/useFeatureGate.ts` — plan gating

### Role check helpers (client-side, DO NOT trust for sensitive writes)
- `AuthContext.hasRole`, `isOwnerOrAdmin`, `isTeacher`, `isParent`
- `OrgContext.currentRole`
- `canRoleAccess(path, role)` in `src/config/routes.ts`

### Edge function JWT verification
- `supabase/config.toml` — 40 functions explicitly `verify_jwt = false` (platform flag disabled because it's incompatible with the signing-keys system per comment); all must perform manual JWT check with `supabaseAuth.auth.getUser()` against the `Authorization` header, then org-membership + role check
- **Enforcement burden:** every edge fn in the 40-list must individually: read auth header → create scoped client with anon key → `getUser()` → check `org_memberships` → check role
- Functions that run on cron use `service_role` directly via `_shared/cron-auth.ts`
- Stripe/Xero/public (booking, iCal, continuation-respond via token) intentionally bypass JWT — must enforce via signature or token verification

### RLS helper functions (SECURITY DEFINER)
Referenced across 83+ migrations:
- `is_org_admin(org_id)` — owner/admin check
- `is_org_staff(org_id)` — owner/admin/teacher/finance check
- `is_lesson_teacher(lesson_id)` — checks direct `teacher_user_id` AND indirect `teacher_id → teachers.user_id`
- `can_edit_lesson(lesson_id)` — combines admin + lesson teacher
- `is_parent_of_student(student_id)` — auth.uid → guardians.user_id → student_guardians → students chain
- Claude.md warning: PostgreSQL grants EXECUTE to PUBLIC by default; every SECURITY DEFINER fn MUST have internal auth check OR `REVOKE EXECUTE FROM authenticated`

### RLS policies by table (98 migrations touch policies)
Tables with RLS: all tables per claude.md. Group by domain:
- **Auth/org:** `organisations`, `org_memberships`, `profiles`, `org_invitations`
- **Academy:** `students`, `student_guardians`, `guardians`, `teachers`, `teacher_availability`, `teacher_instruments`, `locations`, `rooms`, `instruments`, `terms`, `closure_dates`, `rate_cards`
- **Scheduling:** `lessons`, `lesson_participants`, `recurrence_rules`, `external_busy_blocks`, `calendar_connections`, `zoom_connections`
- **Attendance:** `attendance_records`
- **Billing:** `billing_runs`, `invoices`, `invoice_items`, `invoice_installments`, `payments`, `refunds`
- **Stripe/Xero:** `stripe_webhook_events`, `xero_connections`, `xero_entity_mappings`
- **Continuation:** `term_continuation_runs`, `term_continuation_responses`
- **Credits/waitlist:** `make_up_credits`, `make_up_waitlist`, `enrolment_waitlist`
- **Notes/resources:** `lesson_notes`, `resources`, `resource_shares`, `resource_categories`
- **Messaging:** `internal_messages`, `payment_notifications`, `notification_preferences`
- **Pipeline:** `leads`, `lead_students`, `lead_activities`, `lead_follow_ups`, `booking_pages`, `booking_page_teachers`, `booking_page_instruments`
- **Practice:** `practice_logs`, `practice_assignments`
- **LoopAssist:** chat history, daily-cap counter tables
- **Meta:** audit log, banner_dismissals, hint_completions

### Key RLS patterns (to verify consistency per-table in Phase 2)
1. Org isolation via `org_memberships` lookup
2. `USING(true)` / `WITH CHECK(true)` explicitly banned on sensitive tables
3. `refunds` has no INSERT/UPDATE/DELETE for `authenticated` — service_role only via edge fn
4. `payment_notifications` INSERT restricted to service_role
5. `lesson_notes` read path forces RPC (column-level privacy)
6. `students.notes` restricted from parents at RPC level
7. Recent migration `20260401000000_auth_rls_hardening.sql` reinforces all of the above

### Route RBAC (from claude.md + routes.ts)
| Path | Allowed roles |
|---|---|
| `/settings` | owner, admin |
| `/dashboard` | owner, admin, teacher, finance |
| `/calendar` | owner, admin, teacher |
| `/invoices` | owner, admin, finance |
| `/teachers`, `/locations`, `/students/import`, `/make-ups`, `/leads`, `/waitlist`, `/continuation`, `/reports/cancellations`, `/reports/utilisation`, `/reports/teacher-performance` | owner, admin |
| `/reports/payroll` | owner, admin, teacher, finance |
| `/reports/revenue`, `/reports/outstanding` | owner, admin, finance |
| `/reports/lessons`, `/reports/attendance`, `/students`, `/practice`, `/resources`, `/register`, `/batch-attendance`, `/notes` | owner, admin, teacher |
| `/messages` | owner, admin, teacher, finance |
| `/portal/*` | parent |
| `/help` | all authenticated |

---

## Section 2.2 — Money Handling

### Integer minor-unit columns (every money value)
Per claude.md: all amounts stored as integer `*_minor`. Frontend renders via `formatCurrencyMinor(amount, currency)` only.

**DB tables with `*_minor`:**
- `invoices.total_minor`, `invoices.paid_minor`
- `invoice_items.unit_price_minor`, `invoice_items.amount_minor`, `invoice_items.quantity` (CHECK >= 0, NOT VALID)
- `invoice_installments.amount_minor` (derived)
- `payments.amount_minor`
- `refunds.amount_minor`
- `lesson_participants.rate_minor` (snapshot at create, preserved on edit)
- `rate_cards.rate_minor`
- `make_up_credits.amount_minor` (if stored as monetary)
- `term_continuation_responses` projection fields (preview totals)
- payroll computations aggregate from `lesson_participants.rate_minor` + `attendance_records`

**Migrations that touch money semantics (non-exhaustive):**
- `20260331160001_record_stripe_payment_paid_guard.sql` — payment paid-minor guard
- `20260316360002_fix_revenue_report_paid_minor.sql` — revenue report fix
- `20260331160000_record_manual_refund_rpc.sql` — manual refund RPC
- `20260316360001_fix_payment_plan_columns_cache.sql` — payment plan schema
- `20260331120000_fix_credit_term_dates_and_lesson_rate_fallback.sql` — lesson rate fallback
- `20260403000004_fix_credit_reversal_on_attendance_change.sql`
- `20260404210000_add_percentage_pay_rate_type.sql` — percentage payroll
- `20260404000000_add_lesson_reminder_org_settings.sql` (not money but tangent)

### Frontend money read/write surface (56 files)
Grouped:
- **Invoice UI:** `InvoiceList`, `InvoiceDetail`, `CreateInvoiceModal`, `SendInvoiceModal`, `RecordPaymentModal`, `RefundDialog`, `PaymentPlanSetup`, `InstallmentTimeline`, `PaymentPlansDashboard`, `PaymentPlanInvoiceCard`
- **Billing runs:** `BillingRunWizard`, `BillingRunHistory`
- **Hooks:** `useInvoices`, `useInvoiceInstallments`, `useBillingRuns`, `usePaymentAnalytics`, `useRefund`, `useReports`, `useRealtimeInvoices`, `usePayroll`, `useTeacherPerformance`, `useDataExport`
- **Credits:** `useMakeUpCredits`, `useAvailableCredits`, `useParentCredits`, `IssueCreditModal`, `MakeUpCreditsPanel`
- **Continuation (money projection):** `ContinuationRunWizard`, `ContinuationResponseDetail`, `Continuation.tsx`, `PortalContinuation`, `useTermContinuation`
- **Term adjustments:** `TermAdjustmentWizard`, `AdjustmentHistoryPanel`, `AdjustmentPreviewCard`, `useTermAdjustment`
- **Waitlist offers:** `OfferSlotDialog`, `WaitlistEntryDetail`
- **Portal:** `PortalHome`, `PortalInvoices`, `useParentPortal`

### Stripe money interactions (28 edge-fn files touch money)
- `stripe-create-payment-intent` — amount from DB (invoice `total_minor - paid_minor`), destination charge
- `stripe-create-checkout` — amount from DB
- `stripe-auto-pay-installment` — amount from `invoice_installments.amount_minor`
- `stripe-process-refund` — amount param server-verified vs `payments.amount_minor`
- `stripe-webhook` — reconciles `payment_intents`, `charge.refunded`, subscription invoice events → writes `payments.amount_minor`, `refunds.amount_minor`, `invoices.paid_minor`
- `stripe-subscription-checkout`, `stripe-customer-portal`, `stripe-billing-history` — subscription amounts from Stripe side (no minor write to org tables, but syncs `subscription_plan`)
- `record_stripe_payment_paid_guard` RPC — prevents overpay / double-credit
- `record_manual_refund` RPC — non-Stripe refund path
- **Rule (claude.md):** financial amounts always from DB, never from client

### Xero money interactions
- `xero-sync-invoice` — reads DB `invoice_items.unit_price_minor` → converts to Xero decimal
- `xero-sync-payment` — BLOCKED by scope (currently no-op / silent failure)

### Refund / void paths
- Stripe path: `stripe-process-refund` → Stripe → webhook `charge.refunded` → `refunds` row (service_role)
- Manual path: `record_manual_refund` RPC
- Invoice void: separate from refund; DB trigger on `invoices` enforces status transitions
- Billing run delete: `delete_billing_run` RPC — blocked if any child invoice paid/voided

### Currency handling
- `organisations.currency_code` (ISO 4217 validated)
- `formatCurrencyMinor(amount, currency)` in `src/lib/currency.ts` (likely) — never hardcoded `£`/`$`
- Xero sync converts using org currency

---

## Section 2.3 — State Machine Enforcement

### Invoice status: draft → sent → paid → voided
- **Enforced by:** DB trigger on `invoices` (per claude.md) + frontend `useInvoices` hints
- Migration files touching invoice status: `20260119234233_*.sql`, `20260120101844_*.sql`, and others under `supabase/migrations`
- Mutation points: `send-invoice-email` (draft→sent), payments trigger (sent→paid when `paid_minor=total_minor`), `stripe-webhook` (via record RPC), void action from UI
- Refund does NOT auto-void invoice (dual state — invoice still "paid", refund record exists)

### Payment status (implied)
- `payments` records are insert-only once written; unique constraint on Stripe PI id; three-layer idempotency per claude.md (`stripe_webhook_events` dedup + unique PI + `record_stripe_payment_paid_guard`)

### Refund lifecycle
- `refunds.voided_at` + `voided_by` — refunds themselves can be marked void (e.g. Stripe refund failed after record)
- RLS: no auth-role INSERT/UPDATE/DELETE; service_role only

### Make-up credit lifecycle
- States (inferred): active (voided_at IS NULL, consumed_at IS NULL) → consumed (consumed_at set) → voided (voided_at set)
- Consumption: atomic via `FOR UPDATE SKIP LOCKED`
- Void: `void_make_up_credit` RPC (sets voided_at, voided_by); cascade `void_credits_on_student_delete` trigger
- Auto-reverse on attendance change: migration `20260403000004_fix_credit_reversal_on_attendance_change.sql`
- `available_credits` view filters WHERE `voided_at IS NULL`

### Waitlist status
- `make_up_waitlist`: active → offered → accepted / declined / expired
- `enrolment_waitlist`: active → offered → accepted / declined / expired (mutual exclusion with makeup waitlist)
- Transitions via edge fns: `send-enrolment-offer`, `notify-makeup-offer`, `waitlist-respond`, cron `waitlist-expiry`, `enrolment-offer-expiry`
- Audit: `offer_notify_and_waitlist_audit` migration

### Continuation run status
- `term_continuation_runs`: draft → active → closed (deadline passed)
- `term_continuation_responses`: pending → continue / change / stop / no_response
- **Server-side deadline enforcement** per claude.md
- Recalc: `recalc_continuation_summary` RPC
- Bulk processing: `bulk-process-continuation` edge fn

### Lead pipeline
- `leads.status` via pipeline stages; `convert_lead` RPC promotes to student

### Subscription status (on `organisations`)
- trialing → active / past_due / expired / canceled
- Protected by `protect_subscription_fields` trigger (only service_role, Stripe webhook); auto-promotion via `20260316360003_auto_transition_solo_to_studio.sql`
- Transitions via `stripe-webhook` only

### Lesson status
- Implicit: `is_open_slot` flag flips to false on INSERT of first participant (trigger)
- `auto_complete_stale_lessons` migration auto-marks stale unmarked lessons (likely to "completed" with "present" default)
- Delete guarded if invoiced (trigger)

### Attendance records
- One row per (lesson, student); status enum; insertable/updateable; reversals cascade to credit reversal

### Xero sync mapping status
- LessonLoop `draft` → Xero `DRAFT`
- LessonLoop `sent` → Xero `AUTHORISED`
- LessonLoop `paid` → Xero `AUTHORISED` (NOT "PAID" because payments path is scope-blocked)
- LessonLoop `voided` → Xero `VOIDED`
- Mapping logic in `xero-sync-invoice/index.ts` — re-sync must not duplicate

---

## Section 2.4 — Idempotency

### Stripe webhook
- **Table:** `stripe_webhook_events` (event_id unique)
- **Mechanism:** INSERT on receipt; 23505 unique-violation → returns 200 `duplicate: true`; otherwise process
- **Layer 2:** `payments.stripe_payment_intent_id` unique constraint (per claude.md)
- **Layer 3:** `record_stripe_payment_paid_guard` RPC blocks over-application
- **TTL:** migration `20260331170000_webhook_events_ttl_guidance.sql` — must verify retention/cleanup

### Xero sync (invoice)
- **Table:** `xero_entity_mappings` (local_id, entity_type, xero_id, tenant) — dedups contact + invoice creation on re-sync
- **Mechanism:** look up existing mapping → PUT to update / POST to create; upsert mapping
- **Gap:** auto-sync from `create-billing-run` and `stripe-webhook` uses fire-and-forget `fetch` — must check idempotency guard prevents duplicate Xero invoices if webhook replays

### Billing run creation (`create-billing-run`)
- **Mechanism:** rate-limit + dedup check against existing billing run for (org, period) → prevents duplicate invoice sets
- **Gap area:** partial failure in multi-student loop — need to confirm rollback/retry semantics

### Email dispatch (Resend)
- **Mechanism:** `send-lesson-reminders` deduplicates by lesson+recipient (per claude.md 290 lines note)
- Other email edge fns (`send-invoice-email`, `send-bulk-message`, `send-absence-notification`, etc.) — **unclear dedup** — Phase 2 must check for "send twice" risk on double-click or retry
- Claude.md: "Email: Resend API, 3x retry" — internal HTTP retry may compound if Resend returns ambiguous response

### Cron-triggered edge functions
- `send-lesson-reminders` — dedup by lesson+recipient
- `invoice-overdue-check`, `installment-upcoming-reminder`, `installment-overdue-check` — must check before re-sending same day
- `credit-expiry`, `credit-expiry-warning`, `enrolment-offer-expiry`, `waitlist-expiry`, `ical-expiry-reminder` — operate on timestamps, inherent idempotent if "done" flag set
- `calendar-refresh-busy` — per-org refresh; overwrites `external_busy_blocks`
- `trial-reminder-{1,3,7}day`, `trial-expired`, `trial-winback` — must key by org + reminder type to avoid repeat

### CSV import
- `csv-import-execute` uses `import_batch_id` (migration `20260330000001_add_import_batch_id_to_students.sql`) for dedup + undo (`20260330000002_add_undo_student_import_rpc.sql`)
- **Replay risk:** same file re-uploaded — dedup basis unclear (email/name?)

### Stripe checkout session
- `stripe-create-checkout` — Stripe natively idempotent if same client reference passed; LessonLoop passes invoice_id

### OAuth callbacks (Xero / Zoom / Google)
- State token single-use
- `xero-oauth-callback` upserts `xero_connections` per (org, tenant) — re-auth overwrites existing row (intended)

### Frontend mutation idempotency (double-click protection)
- Claude.md: Zod + `isPending`/`isSaving` — but individual mutations must still be idempotent server-side
- React Query `retry: false` on mutations (App.tsx) — good

---

## Section 2.5 — Migrations vs Live Schema Risk (Lovable gap)

Claude.md warns: Lovable does NOT reliably apply Claude Code's SQL migrations. Any recent Claude Code migration may exist in repo but NOT in live Supabase DB until Jamie applies via SQL Editor. Remaining items section of claude.md already lists April 4 pending batch.

### Remaining (per claude.md "Remaining Items")
- Apply **April 4** SQL migrations: xero tables, dunning config, external_busy_blocks, percentage pay, hint_completions
- Apply via Supabase SQL Editor + `NOTIFY pgrst, 'reload schema'`

### Migrations in the last 60 days (risk window)

**April 2026 (highest risk — may not yet be live):**
- `20260404210000_add_percentage_pay_rate_type.sql` — adds `teachers.pay_rate_type` percentage variant; payroll hook depends on it
- `20260404160715_28e2d9d6-…sql` — generic Lovable-style name (needs content inspection)
- `20260404000000_add_lesson_reminder_org_settings.sql` — adds dunning/reminder columns on `organisations`
- `20260403000005_hint_completions.sql` — `hint_completions` table
- `20260403000004_fix_credit_reversal_on_attendance_change.sql` — credit reversal behaviour
- `20260403000003_count_lessons_on_dates_rpc.sql` — RPC used by slot generator preview
- `20260403000002_add_rooms_description_column.sql` — `rooms.description`
- `20260403000001_auto_promote_primary_on_archive.sql` — location trigger
- `20260403000000_complete_onboarding_rpc.sql` — RPC
- `20260401000002_void_credits_on_student_delete.sql` — trigger
- `20260401000001_add_convert_lead_rpc.sql` — `convert_lead` RPC
- `20260401000000_auth_rls_hardening.sql` — **RLS sweep** — most impactful if not applied

**Late March 2026:**
- `20260331170000_webhook_events_ttl_guidance.sql` — dedup TTL
- `20260331160001_record_stripe_payment_paid_guard.sql` — payment guard RPC
- `20260331160000_record_manual_refund_rpc.sql` — manual refund RPC
- `20260331150000_add_recalc_continuation_summary_rpc.sql`
- `20260331140001_offer_notify_and_waitlist_audit.sql`
- `20260331140000_validate_waitlist_credit_ownership.sql`
- `20260331130000_cleanup_withdrawal_credits.sql` — data cleanup
- `20260331120000_fix_credit_term_dates_and_lesson_rate_fallback.sql`
- `20260330234228_add_realtime_attendance_practice.sql`
- `20260330234227_auto_complete_stale_lessons.sql` — **silent data write**
- `20260330234226_add_get_unmarked_lesson_count_rpc.sql`
- `20260330232228_*.sql` — Lovable-style name
- `20260330000002_add_undo_student_import_rpc.sql`
- `20260330000001_add_import_batch_id_to_students.sql`

**Mid-March 2026 (likely applied — reference only):**
- `20260316*` batch — payment plans phase 1, audit fixes, revenue report fixes, subscription auto-transition
- `20260316350000_payment_plans_phase1.sql` — payment-plan schema (critical money)
- `20260316260000_fix_voided_credits_audit.sql` through `20260316340000_fix_external_audit_security.sql` — security hardening sweep

### Conventions (claude.md)
- All migration SQL idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS` before `CREATE`, `DO $$ BEGIN … EXCEPTION WHEN duplicate_object THEN NULL; END $$;` for constraints)
- CHECK constraints on existing tables use `NOT VALID` to avoid failing on legacy rows

### Risk heuristic for Phase 2
1. Cross-check each migration that adds/changes an RPC against frontend `supabase.rpc(...)` calls for that name — if not live, frontend call will fail silently (PGRST202) or throw
2. Cross-check RLS-changing migrations for "auth.users.email" style policies that may have reverted
3. For every new column (`pay_rate_type` percentage, `rooms.description`, dunning cols), if not live, writes silently drop the column

---

## Section 2.6 — Cron / Scheduled Functions

Per claude.md two cron jobs are explicitly named (14 + 15). The migrations directory shows at least two `cron.schedule` entries. All other "cron-flavoured" edge functions exist but their pg_cron schedule isn't declared in an in-repo migration — they're likely scheduled via Supabase dashboard (needs live-DB inspection in Phase 2).

### Confirmed via migration
| Edge fn | Schedule | Migration | Auth |
|---|---|---|---|
| `calendar-refresh-busy` | `*/30 * * * *` (every 30 min — note: claude.md says 15 min, drift) | `20260223100000_calsync_cron_guardian_health.sql` | `x-cron-secret` header via `_shared/cron-auth.ts` |
| `invoice-overdue-check` | `30 5 * * *` (05:30 daily) | `20260223174041_*.sql` | `x-cron-secret` via vault |

### Claude.md-declared
| Job # | Function | Schedule | Auth |
|---|---|---|---|
| 14 | `send-lesson-reminders` | Hourly | service_role_key |
| 15 | `calendar-refresh-busy` | Every 15 min (claude.md) | service_role_key |

**Discrepancy flag:** claude.md says "Every 15 minutes" but migration schedules `*/30 * * * *`. Needs live-DB confirmation.

### Edge functions that *appear* cron-driven (no declared schedule in repo)
These have no-JWT cron-style auth and mass-mailer patterns; Phase 2 must check Supabase dashboard:
- `auto-pay-upcoming-reminder` — prompts auto-pay
- `credit-expiry` — expires `make_up_credits`
- `credit-expiry-warning` — pre-expiry notice
- `enrolment-offer-expiry` — expires enrolment waitlist offers
- `installment-overdue-check` — payment plan dunning
- `installment-upcoming-reminder` — pre-installment reminder
- `invoice-overdue-check` — confirmed (see above)
- `overdue-reminders` — aged-invoice dunning
- `send-lesson-reminders` — cron 14 (claude.md)
- `calendar-refresh-busy` — cron 15 (claude.md)
- `streak-notification` — practice streak push
- `ical-expiry-reminder` — iCal token near-expiry
- `trial-expired`, `trial-reminder-1day`, `trial-reminder-3day`, `trial-reminder-7day`, `trial-winback` — trial lifecycle (5 distinct schedules)
- `waitlist-expiry` — expires makeup waitlist

### Cron auth
- `_shared/cron-auth.ts` — `x-cron-secret` header verification (vault-stored)
- Alternative: `verify_jwt=false` on these functions at config.toml level → called with `service_role_key` bearer token from pg_cron net.http_post

### Risks for Phase 2
- Drift between declared schedule (repo migration) and live pg_cron (dashboard) — see 30 vs 15 min calendar discrepancy
- Cron secret rotation path
- Per-org throttling not obvious — a cron that fans out to all orgs concurrently could thundering-herd Stripe/Resend/Xero

---

## Section 2.7 — External Integrations

### Stripe
- **Purpose:** payments (Connect destination), subscriptions, refunds
- **Code paths:**
  - Frontend hooks: `useStripeConnect`, `useStripePayment`, `useEmbeddedPayment`, `useStripeElements`, `useSavedPaymentMethods`, `useSubscription`, `useSubscriptionCheckout`, `useRefund`
  - Edge fns: `stripe-connect-onboard`, `stripe-connect-status`, `stripe-create-checkout`, `stripe-create-payment-intent`, `stripe-verify-session`, `stripe-list-payment-methods`, `stripe-detach-payment-method`, `stripe-update-payment-preferences`, `stripe-customer-portal`, `stripe-billing-history`, `stripe-subscription-checkout`, `stripe-auto-pay-installment`, `stripe-process-refund`, `stripe-webhook`
  - Shared config: `supabase/functions/_shared/plan-config.ts` (STRIPE_PRICE_* env → plan key mapping)
  - DB: `organisations.stripe_account_id`, `organisations.subscription_*`, `payments`, `refunds`, `invoices.paid_minor`, `stripe_webhook_events`
- **Failure modes:**
  - Webhook signature failure → 400 (Stripe retries)
  - DB failure → 500 (Stripe retries up to ~100×)
  - Duplicate event → 200 duplicate
  - Account deauthorized → `handleAccountDeauthorized` (needs rewire)
  - Platform refund failure (insufficient balance) → Stripe returns error
  - Subscription payment failure → `invoice.payment_failed` → dunning
  - Native: payment UI hidden (Apple IAP conflict)

### Xero
- **Purpose:** accounting mirror
- **Code paths:**
  - Frontend: `AccountingTab` in `src/components/settings/`
  - Edge fns: `xero-oauth-start`, `xero-oauth-callback`, `xero-disconnect`, `xero-sync-invoice`, `xero-sync-payment` (blocked)
  - Shared: `_shared/xero-auth.ts` (token refresh)
  - DB: `xero_connections`, `xero_entity_mappings`
- **Failure modes:**
  - Token expiry → `getValidXeroToken` refresh; if refresh fails → entire sync fails silently on fire-and-forget call from `create-billing-run` / `stripe-webhook`
  - Scope error (`invalid_scope`) for `accounting.transactions` — already fixed by using granular scopes
  - `accounting.payments` scope unavailable — payment sync silently no-ops
  - Duplicate invoice on re-sync if mapping missing → must rely on `xero_entity_mappings`
  - Rate limits (Xero: 60/min per tenant; daily limits) — no in-code throttle visible

### Google Calendar
- **Purpose:** two-way lesson sync + busy-block overlay
- **Code paths:**
  - Frontend: `useCalendarConnections`, `useCalendarSync`, `useExternalBusyBlocks`, `BusyBlockOverlay`, `CalendarIntegrationsTab`, `CalendarSyncHealth`
  - Edge fns: `calendar-oauth-start`, `calendar-oauth-callback`, `calendar-disconnect`, `calendar-sync-lesson`, `calendar-fetch-busy`, `calendar-refresh-busy` (cron), `calendar-ical-feed` (iCal subscription, token-auth)
  - DB: `calendar_connections`, `external_busy_blocks`
- **Failure modes:**
  - Token refresh failure → `CalendarSyncHealth` surfaces; `get_org_calendar_health` RPC
  - Event id drift if deleted externally
  - iCal token leakage → PII exposure (calendar-ical-feed is public!)

### Zoom
- **Purpose:** per-lesson meeting link
- **Code paths:**
  - Frontend: `useZoomSync`, `ZoomIntegrationTab`
  - Edge fns: `zoom-oauth-start`, `zoom-oauth-callback`, `zoom-sync-lesson`
  - DB: `zoom_connections`
- **Failure modes:** token expiry, meeting creation failure — falls through silently per historical patterns

### Anthropic (Claude API)
- **Purpose:** LoopAssist (staff + parent + marketing)
- **Code paths:**
  - Frontend: `LoopAssistContext`, `useLoopAssist`, `useParentLoopAssist`, `MarketingChatWidget`
  - Edge fns: `looopassist-chat` (staff), `looopassist-execute` (tool execution), `parent-loopassist-chat`, `marketing-chat`
  - KB: `supabase/functions/looopassist-chat/knowledge-base.ts` (Block 1 cached)
  - DB: daily-cap counter (per-org, 200/day), chat history, feedback
- **Failure modes:** 529 overload, streaming disconnect (`consumeAnthropicStream` null-body guard), tool-call looping, prompt injection via org data

### Resend (email)
- **Purpose:** all transactional email
- **Code paths:** used across every email edge fn
- **Conventions (claude.md):** 3x retry, `escapeHtml()`, List-Unsubscribe header, domain `lessonloop.net`
- **Failure modes:** bounce handling, transient 429, duplicates on retry ambiguity

### Capacitor (native)
- **Purpose:** iOS/Android wrapper
- **Code paths:**
  - `capacitor.config.ts`, `src/lib/native/*`, `src/lib/platform.ts`, `src/hooks/useAndroidBackButton.ts`, `src/services/pushNotifications.ts`
  - Deep-link parser: `src/lib/native/deepLinks.ts`
- **Failure modes:** push token drift, deep-link open-redirect, sync hang (`npx cap copy ios` workaround), iOS v1.3 pending after v1.2

### Supabase services
- Postgres: 70+ tables, 300+ migrations
- Auth: `supabase.auth` used in AuthContext
- Storage: `resources` bucket; signed URLs
- Realtime: enabled on `attendance_records`, `practice_logs` (migration 20260330234228), `invoices` (`useRealtimeInvoices`)
- Edge fns: 87+

### Cloudflare (planned)
- Marketing site on Cloudflare Pages
- WAF + CSP headers listed in "Remaining" — NOT YET ADDED

---
