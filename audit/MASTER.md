# LessonLoop production-readiness — MASTER tracker

**Last updated:** 2026-05-08
**Owner:** Jamie McKaye
**Goal:** zero P0 reds + acceptable P1 yellows = ready to launch publicly.

## Legend

State: ✅ green / 🟡 partial / 🔴 broken / ❓ untested / ⏸ deferred-to-post-launch
Criticality: **P0** revenue/auth/data-integrity / **P1** core UX / **P2** admin/ops / **P3** nice-to-have

## How to use this

`/sweep` slash command picks the next P0 ❓ row and runs the standard audit template (smoke / functional / edge / RLS / mobile / Sentry). Update the row's State + Last audited + Notes. Open findings → file in `audit/findings/`.

## ⚠️ Reset 2026-05-08

Per launch-week directive: every row that was previously ✅ from migration validation has been reset to ❓ and must be re-audited freshly under the `/sweep` framework. Migration-era validation was structural (does the function exist? does it parse?), not behavioural (does the customer journey work?). Pre-launch we need fresh end-to-end behavioural verification on everything.

The previous ✅ flags are now in the row's "Notes" column for context — useful as "the structural plumbing was verified" but no longer counted as launch-ready.

## Summary

- **Total rows:** 132
- **P0 rows:** 58 (0 ✅ launch-verified, 6 🟡, 4 🔴, 48 ❓)
- **Sentry events 7d:** TBD (refresh weekly)
- **Last full sweep:** never

## Known launch blockers (tracked separately in `audit/00-launch-readiness.md`)

- Google OAuth verification (consent screen) — **2-6 week lead time**
- Sentry source maps upload
- Source Supabase decommission
- Apple OAuth provider config
- CSP allow-list `api.pwnedpasswords.com`
- Stripe Checkout branding

## Auth & Onboarding

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Email signup → onboarding wizard end-to-end | src/pages/Signup.tsx → onboarding-setup → complete_onboarding RPC | P0 | 🟡 | 2026-05-08 | Code path clean: form validation incl 8-char/strength≥2 password, duplicate-email obfuscation handled, AbortController 30s timeout, idempotency check, complete_onboarding RPC verified end-to-end via service_role. Resend SMTP configured (smtp.resend.com → noreply@lessonloop.net). AuthContext async-callback hang fixed (62a9282). 🟡 awaits browser-confirmed first real customer signup. |
| Email + password sign-in | src/pages/Login.tsx | P0 | 🟡 | 2026-05-08 | Code path clean (account-enum mitigation, validation, AuthContext fix landed). 2 security gaps filed: weak password policy (6-char min, no chars) + CAPTCHA disabled. See audit/findings/2026-05-08-supabase-{password-policy-too-weak,captcha-disabled}.md |
| Google OAuth | src/pages/Login.tsx → supabase.auth | P0 | ⏸ | 2026-05-08 | UI button hidden via VITE_SOCIAL_AUTH_GOOGLE flag; OAuth client in Google verification (2-6 wk lead). Re-enable + audit when verification approves. |
| Apple OAuth | src/pages/Login.tsx | P0 | ⏸ | 2026-05-08 | UI button hidden via VITE_SOCIAL_AUTH_APPLE flag; provider not configured at dest Supabase. Re-enable post-config. |
| Password reset request | src/pages/ForgotPassword.tsx | P0 | ❓ | — | |
| Password reset complete | src/pages/ResetPassword.tsx | P0 | ❓ | — | needs CSP fix for pwnedpasswords.com first |
| Email verification | src/pages/VerifyEmail.tsx | P0 | ❓ | — | gate before app access |
| Onboarding wizard | src/pages/Onboarding.tsx → onboarding-setup → complete_onboarding RPC | P0 | 🟡 | 2026-05-08 | covered by "Email signup → onboarding wizard end-to-end" row above |
| Accept invite (staff/parent) | src/pages/AcceptInvite.tsx → invite-accept fn | P0 | ❓ | — | also exercises invite-get fn |
| Profile ensure on first login | supabase/functions/profile-ensure | P0 | ❓ | — | runs on every login; verify idempotency |
| Account delete (GDPR) | supabase/functions/account-delete | P1 | ❓ | — | irreversible; test on throwaway account |
| GDPR data export | supabase/functions/gdpr-export | P1 | ❓ | — | also see gdpr-delete fn |
| GDPR full delete | supabase/functions/gdpr-delete | P1 | ❓ | — | distinct from account-delete |

## Dashboard & navigation

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Owner/admin dashboard | src/pages/Dashboard.tsx | P1 | 🟡 | 2026-05-08 | Code path clean: 4 role-specific dashboards (Finance/Teacher/Academy/Solo), parent → portal redirect, proper loading + no-org empty state. RPCs `get_invoice_stats` + `get_revenue_report` confirmed in DB. 5+ parallel useQuery — perf TBD on real load. Awaits browser-confirmed render + Sentry baseline. |
| Marketing root redirect | src/components/shared/AuthRedirect.tsx | P1 | ❓ | — | / behaviour for logged-out vs logged-in |
| External marketing redirects | src/config/routes.ts (38 paths) | P2 | ❓ | — | redirect to lessonloop.net |
| 404 page | src/pages/NotFound.tsx | P2 | ❓ | — | |
| Help page | src/pages/Help.tsx | P3 | ❓ | — | |
| Settings (org config) | src/pages/Settings.tsx | P1 | ❓ | — | wide surface; many sub-tabs |

## Calendar & Lessons

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Calendar page (drag-drop) | src/pages/CalendarPage.tsx | P0 | 🟡 | 2026-05-08 | 9 RLS policies on lessons + 9 on lesson_participants. RPCs `bulk_update_lessons`, `bulk_cancel_lessons`, `can_edit_lesson`, `is_lesson_teacher`, `is_assigned_teacher` confirmed. Drag/resize logic complex — awaits browser smoke. |
| Recurring lesson template create | src/pages/RecurringTemplateDetail.tsx | P0 | 🟡 | 2026-05-08 | covered by Calendar RLS; awaits browser test |
| Recurring run detail / exceptions | src/pages/RecurringRunDetail.tsx | P0 | 🟡 | 2026-05-08 | covered by Calendar RLS; awaits browser test |
| Single lesson CRUD | src/pages/CalendarPage.tsx | P0 | 🟡 | 2026-05-08 | covered above |
| Make-up lesson dashboard | src/pages/MakeUpDashboard.tsx | P1 | ❓ | — | |
| Make-up offer notification | supabase/functions/notify-makeup-offer | P1 | ❓ | — | |
| Make-up match notification | supabase/functions/notify-makeup-match | P1 | ❓ | — | |
| Daily register | src/pages/DailyRegister.tsx | P1 | 🟡 | 2026-05-08 | attendance_records: 6 RLS policies (admin r/w/d, finance r, teacher r-assigned). No USING(true). Awaits browser test. |
| Batch attendance | src/pages/BatchAttendance.tsx | P1 | 🟡 | 2026-05-08 | covered above |
| Continuation flow (term rollover) | src/pages/Continuation.tsx + create-continuation-run + bulk-process-continuation | P0 | ❓ | — | term-end critical path |
| Continuation respond (parent) | supabase/functions/continuation-respond | P0 | ❓ | — | |
| Term adjustment processor | supabase/functions/process-term-adjustment | P1 | ❓ | — | |
| Lesson notes explorer | src/pages/NotesExplorer.tsx | P2 | ❓ | — | |
| Notes notification | supabase/functions/send-notes-notification | P2 | ❓ | — | |

## Students & Guardians

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Students list / CRUD | src/pages/Students.tsx | P0 | 🟡 | 2026-05-08 | 9 RLS policies (admin r/w/d, finance r, teacher r-assigned, parent r-linked, soft-delete + trial-block guard); `get_students_for_org` RPC confirmed. No USING(true) footguns. Awaits browser CRUD test. |
| Student detail | src/pages/StudentDetail.tsx | P0 | 🟡 | 2026-05-08 | covered by Students RLS audit; awaits browser nav |
| CSV import (mapping step) | src/pages/StudentsImport.tsx → csv-import-mapping fn | P1 | 🟡 | 2026-05-08 | Gemini AI column mapping (gemini-flash-latest); GEMINI_API_KEY required; structural ok, fresh test pending |
| CSV import (execute) | supabase/functions/csv-import-execute | P1 | 🟡 | 2026-05-08 | bulk insert into students/teachers/instruments/org_memberships; deterministic (no AI); structural ok, fresh test pending |
| Guardian batch invite | supabase/functions/batch-invite-guardians | P1 | ❓ | — | bulk send to all family heads |
| Family/guardian linking | src/pages/Students.tsx panels | P1 | ❓ | — | |
| Streak notification | supabase/functions/streak-notification | P3 | ❓ | — | |

## Teachers & Payroll

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Teachers list / CRUD | src/pages/Teachers.tsx | P0 | 🟡 | 2026-05-08 | 6 RLS policies (admin r/w/d, finance r). No USING(true). Smoke 200. Awaits browser CRUD test. |
| Locations | src/pages/Locations.tsx | P1 | ❓ | — | rooms, pricing |
| Payroll report | src/pages/reports/Payroll.tsx | P1 | ❓ | — | |
| Teacher performance report | src/pages/reports/TeacherPerformance.tsx | P2 | ❓ | — | |

## Invoicing & Payments

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Invoices list | src/pages/Invoices.tsx | P0 | 🟡 | 2026-05-08 | invoices: 6 RLS policies (admin/finance r, parent-via-guardian r). No USING(true). Awaits browser test. |
| Invoice detail / line edit | src/pages/InvoiceDetail.tsx | P0 | 🟡 | 2026-05-08 | invoice_items: 5 RLS policies. CHECK constraints (NOT VALID) on prices/amounts/quantities (per claude.md). |
| Invoice PDF generation | supabase/functions/generate-invoice-pdf | P0 | 🟡 | 2026-05-08 | service-role-only fn (verify_jwt=false post-Phase-5); caches in invoice-pdfs bucket; signed URL response or inline base64. End-to-end render not yet exercised on dest. |
| Send invoice email (parent) | supabase/functions/send-invoice-email | P0 | 🟡 | 2026-05-08 | User JWT + rate limit + Resend SMTP (smtp.resend.com → noreply@lessonloop.net configured). Awaits real send test. |
| Send invoice email (internal copy) | supabase/functions/send-invoice-email-internal | P1 | 🟡 | 2026-05-08 | service-role-only (Phase 5 reconfigured); Awaits browser-driven test |
| Stripe checkout (one-off invoice payment) | supabase/functions/stripe-create-checkout | P0 | 🟡 | 2026-05-08 | User JWT + rate-limit + invoiceId required. Confirmed via 6.A.2 browser test on subscription path; one-off-invoice path still untested. Branding gap noted in 00-launch-readiness. |
| Stripe payment intent (custom) | supabase/functions/stripe-create-payment-intent | P0 | ❓ | — | |
| Stripe customer portal | supabase/functions/stripe-customer-portal | P1 | ❓ | — | |
| Stripe webhook (events) | supabase/functions/stripe-webhook | P0 | 🟡 | 2026-05-08 | constructEventAsync fix verified (commit baa072c); two-phase dedup pattern; 90s stale threshold. Confirmed via test customer.created. Real-world payment flow not yet exercised on destination. |
| Stripe verify session | supabase/functions/stripe-verify-session | P0 | ❓ | — | post-checkout return |
| List payment methods | supabase/functions/stripe-list-payment-methods | P1 | ❓ | — | |
| Detach payment method | supabase/functions/stripe-detach-payment-method | P1 | ❓ | — | |
| Update auto-pay preferences | supabase/functions/stripe-update-payment-preferences | P0 | ❓ | — | |
| Backfill default PM (admin) | supabase/functions/admin-backfill-default-pm | P2 | ❓ | — | |
| Process refund | supabase/functions/stripe-process-refund | P0 | ❓ | — | |
| Refund notification | supabase/functions/send-refund-notification | P1 | ❓ | — | |
| Receipt email | supabase/functions/send-payment-receipt | P1 | ❓ | — | |
| Auto-pay run (installment) | supabase/functions/stripe-auto-pay-installment | P0 | ❓ | — | cron-driven |
| Auto-pay alert | supabase/functions/send-auto-pay-alert | P1 | ❓ | — | |
| Auto-pay failure notification | supabase/functions/send-auto-pay-failure-notification | P0 | ❓ | — | |
| Dispute notification | supabase/functions/send-dispute-notification | P1 | ❓ | — | Stripe dispute webhook fan-out |
| Recurring billing run create | supabase/functions/create-billing-run | P0 | 🟡 | 2026-05-08 | 1048 lines, mature. User JWT + role check (owner/admin/finance) + rate limit. ISO-date + run_type enum validation (BIL-H1 / BIL-L3 fixes). billing_runs RLS: 4 policies. End-to-end run not yet exercised on dest. |
| Recurring billing alert | supabase/functions/send-recurring-billing-alert | P1 | ❓ | — | |

## Subscriptions & Trial

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Tier/subscription checkout | supabase/functions/stripe-subscription-checkout | P0 | ❓ | — | self-serve upgrade |
| Billing history | supabase/functions/stripe-billing-history | P1 | ❓ | — | |
| Stripe Connect onboard | supabase/functions/stripe-connect-onboard | P1 | ❓ | — | per-org Connect flow |
| Stripe Connect status check | supabase/functions/stripe-connect-status | P1 | ❓ | — | |
| Trial banner / countdown | cross-cutting in app shell | P1 | ❓ | — | |
| Tier-gated feature access | cross-cutting helpers | P0 | ❓ | — | verify Haiku/Sonnet routing for LoopAssist + feature gates |

## Integrations

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Google Calendar OAuth | calendar-oauth-{start,callback} | P0 | 🟡 | 2026-05-08 | verify_jwt=false on callback ✓; 1 active Google connection in production (last sync 14:00 UTC today, token still valid). 1 errored connection (refresh_token revoked — user reconnect required). Needs fresh E2E sign-in by Jamie |
| Calendar disconnect | calendar-disconnect | P1 | 🟡 | 2026-05-08 | structural verify only |
| Calendar busy fetch (now) | calendar-fetch-busy | P1 | 🟡 | 2026-05-08 | calendar-refresh-busy cron firing every 15 min; sync_status='active' for 1 connection |
| Calendar lesson sync (write back) | calendar-sync-lesson | P0 | 🟡 | 2026-05-08 | idempotency fixed in 9c72ca3; fresh sync of a real lesson + verify single Google event pending Jamie |
| iCal feed (read-only export) | calendar-ical-feed | P1 | 🟡 | 2026-05-08 | tokenised URL; 1 Apple iCal connection in DB but `last_sync_at='2026-04-03'` (>30 days stale) — see findings |
| Zoom OAuth start | zoom-oauth-start | P0 | 🟡 | 2026-05-08 | verify_jwt=false ✓; no production Zoom connections yet (table calendar_connections has 0 rows with provider='zoom') |
| Zoom OAuth callback | zoom-oauth-callback + src/pages/ZoomOAuthCallback.tsx | P0 | 🟡 | 2026-05-08 | structural; E2E pending Jamie |
| Zoom lesson sync | zoom-sync-lesson | P0 | 🟡 | 2026-05-08 | idempotency preemptively fixed; full E2E pending Jamie |
| Xero OAuth start | xero-oauth-start | P0 | 🟡 | 2026-05-08 | verify_jwt=false ✓; 2 connections in production (both with expired access tokens — refresh-on-demand via shared/xero-auth.ts) |
| Xero OAuth callback | xero-oauth-callback | P0 | 🟡 | 2026-05-08 | verify_jwt=false ✓ |
| Xero invoice sync | xero-sync-invoice | P0 | 🟡 | 2026-05-08 | schema drift fix 2c4b410 + FK fix 025a423; auto_sync_invoices=true on both connections; fresh sync pending Jamie |
| Xero payment sync | xero-sync-payment | P0 | 🟡 | 2026-05-08 | NOT NULL drift fix 9c72ca3; auto_sync_payments=true on both connections; fresh sync pending Jamie |
| Xero disconnect | xero-disconnect | P1 | 🟡 | 2026-05-08 | structural verify only |

## AI

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| LoopAssist chat (staff) | looopassist-chat | P0 | 🟡 | 2026-05-08 | Anthropic Claude — Sonnet (academy/agency/custom) or Haiku (free/solo); date-pinned snapshots claude-sonnet-4-5-20250929 + claude-haiku-4-5-20251001; ANTHROPIC_API_KEY required; prompt-injection sanitiser on org-pref injection (control chars + system: prefix + "ignore previous instructions"); 7744 historical conversations carried over; last activity 2026-05-03 (pre-migration); fresh chat test pending Jamie |
| LoopAssist execute (tool calls) | looopassist-execute | P0 | 🟡 | 2026-05-08 | deterministic SQL execution from `ai_action_proposals`; 31 historical proposals; user-confirm gate; structural ok |
| Parent LoopAssist chat | parent-loopassist-chat | P1 | 🟡 | 2026-05-08 | Anthropic Claude; structural ok, awaits parent-portal browser test |
| CSV import column mapping | csv-import-mapping | P1 | 🟡 | 2026-05-08 | Gemini Flash (gemini-flash-latest); GEMINI_API_KEY required; structural ok |
| Marketing chat | marketing-chat | P2 | ⏸ | — | marketing site separate stack — out of cutover |

## Messaging

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Messages inbox (staff) | src/pages/Messages.tsx | P1 | ❓ | — | |
| Send single message | supabase/functions/send-message | P0 | ❓ | — | |
| Send bulk message | supabase/functions/send-bulk-message | P0 | ❓ | — | rate-limit + batching |
| Send parent message | supabase/functions/send-parent-message | P1 | ❓ | — | |
| Send parent enquiry (public form) | supabase/functions/send-parent-enquiry | P1 | ❓ | — | |
| Send contact message (marketing) | supabase/functions/send-contact-message | P2 | ❓ | — | |
| Internal message notify | supabase/functions/notify-internal-message | P1 | ❓ | — | |
| Mark messages read | supabase/functions/mark-messages-read | P2 | ❓ | — | |
| Push notification | supabase/functions/send-push | P2 | ⏸ | — | post-launch |

## Leads / Booking / Waitlist

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Leads list | src/pages/Leads.tsx | P1 | ❓ | — | |
| Lead detail | src/pages/LeadDetail.tsx | P1 | ❓ | — | |
| Public booking page | src/pages/public/BookingPage.tsx | P1 | ❓ | — | /book/:slug |
| Booking get slots | supabase/functions/booking-get-slots | P1 | ❓ | — | |
| Booking submit | supabase/functions/booking-submit | P1 | ❓ | — | |
| Enrolment waitlist | src/pages/EnrolmentWaitlistPage.tsx | P1 | ❓ | — | |
| Send enrolment offer | supabase/functions/send-enrolment-offer | P1 | ❓ | — | |
| Waitlist respond | supabase/functions/waitlist-respond | P1 | ❓ | — | parent action |
| Send cancellation notification | supabase/functions/send-cancellation-notification | P1 | ❓ | — | |
| Send invite email (staff/parent) | supabase/functions/send-invite-email | P0 | ❓ | — | account creation path |
| Invite get (token lookup) | supabase/functions/invite-get | P0 | ❓ | — | |
| Invite accept | supabase/functions/invite-accept | P0 | ❓ | — | |

## Practice & Resources

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Practice tracker (staff) | src/pages/Practice.tsx | P2 | ❓ | — | |
| Resources library | src/pages/Resources.tsx | P2 | ❓ | — | file uploads to Supabase Storage |

## Reports

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Reports index | src/pages/Reports.tsx | P2 | ❓ | — | |
| Revenue | src/pages/reports/Revenue.tsx | P1 | ❓ | — | |
| Outstanding | src/pages/reports/Outstanding.tsx | P1 | ❓ | — | |
| Lessons delivered | src/pages/reports/LessonsDelivered.tsx | P2 | ❓ | — | |
| Cancellations | src/pages/reports/Cancellations.tsx | P2 | ❓ | — | |
| Utilisation | src/pages/reports/Utilisation.tsx | P2 | ❓ | — | |
| Attendance report | src/pages/reports/AttendanceReport.tsx | P2 | ❓ | — | |

## Parent portal

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Portal home | src/pages/portal/PortalHome.tsx | P1 | 🟡 | 2026-05-08 | drives `respond_to_makeup_offer` + `cancel_booked_makeup` RPCs — both SECURITY DEFINER + auth.uid() check + guardian-belongs-to-org check + waitlist-belongs-to-guardian check + status guards + audit_log entries on every action. Robust. Browser test pending Jamie |
| Portal schedule | src/pages/portal/PortalSchedule.tsx | P1 | 🟡 | 2026-05-08 | data via React Query hooks (no direct supabase.from); RLS handles via parent ↔ student linkage |
| Portal practice | src/pages/portal/PortalPractice.tsx | P2 | 🟡 | 2026-05-08 | RLS verified: `practice_logs` Parent INSERT `WITH CHECK is_parent_of_student(auth.uid(), student_id)` — parents cannot create logs for unrelated students. SELECT/DELETE same guard. 0 logs in last 30 days (low usage); 61 historical. Browser test pending |
| Portal resources | src/pages/portal/PortalResources.tsx | P2 | 🟡 | 2026-05-08 | bucket `teaching-resources` confirmed `public=false`; access via signed URLs; structural ok |
| Portal invoices & pay | src/pages/portal/PortalInvoices.tsx | P0 | 🟡 | 2026-05-08 | RLS `Parent can view own invoices` uses `is_invoice_payer(auth.uid(), id)` — checks both `payer_guardian_id` direct path AND `payer_student_id → student_guardians → guardians.user_id` indirect path. Robust. Pay flow invokes `stripe-verify-session`. Browser test pending |
| Portal messages | src/pages/portal/PortalMessages.tsx | P1 | 🟡 | 2026-05-08 | data via hooks (no direct supabase.from); RLS handles |
| Portal profile | src/pages/portal/PortalProfile.tsx | P2 | 🟡 | 2026-05-08 | reads/writes `notification_preferences`, `guardians`, `profiles`; `guardians` Parent UPDATE policy uses `user_id = auth.uid()` — can only edit own record |
| Portal continuation | src/pages/portal/PortalContinuation.tsx | P0 | 🟡 | 2026-05-08 | invokes `continuation-respond` edge fn with tokenised payload; structural ok; full term-rollover E2E pending Jamie |
| Public continuation respond | /respond/continuation route | P0 | 🟡 | 2026-05-08 | tokenised URL no-auth path; needs E2E with a real continuation token |

## Cron / lifecycle jobs

| Cron | Source fn | Schedule | Criticality | State | Last verified |
|---|---|---|---|---|---|
| Trial reminder 7-day | trial-reminder-7day | daily 09:00 (assumed) | P1 | ❓ | — |
| Trial reminder 3-day | trial-reminder-3day | daily 09:00 (assumed) | P1 | ❓ | — |
| Trial reminder 1-day | trial-reminder-1day | daily 09:00 (assumed) | P1 | ❓ | — |
| Trial expired | trial-expired | daily | P0 | ❓ | — |
| Trial winback | trial-winback | weekly | P2 | ❓ | — |
| Recurring billing scheduler | recurring-billing-scheduler | daily 04:00 UTC | P0 | 🟡 | 2026-05-08 fired ok; output untested |
| Invoice overdue check | invoice-overdue-check | daily 05:30 UTC | P0 | 🟡 | 2026-05-08 fired ok |
| Installment overdue check | installment-overdue-check | daily 06:00 UTC | P0 | 🟡 | 2026-05-08 fired ok |
| Installment upcoming reminder | installment-upcoming-reminder | daily 08:00 UTC | P1 | 🟡 | 2026-05-08 fired ok |
| Auto-pay upcoming reminder | auto-pay-upcoming-reminder | daily 08:00 UTC | P1 | 🟡 | 2026-05-08 fired ok |
| Auto-pay final reminder | auto-pay-final-reminder | daily 08:00 UTC | P0 | 🟡 | 2026-05-08 fired ok |
| Stripe auto-pay installment | stripe-auto-pay-installment | daily 09:00 UTC | P0 | 🟡 | 2026-05-08 fired ok |
| Send lesson reminders | send-lesson-reminders | hourly | P1 | 🟡 | 2026-05-08 firing every hour; some 5s-timeout — see findings/2026-05-08-cron-net-http-post-5s-timeout |
| Calendar refresh busy | calendar-refresh-busy | every 15 min | P1 | 🟡 | 2026-05-08 firing every 15min; 5s-timeout common (function still completes) |
| Overdue reminders | overdue-reminders | daily 09:00 UTC | P1 | 🟡 | 2026-05-08 fired ok |
| Credit expiry | credit-expiry | daily 02:00 UTC | P0 | 🟡 | 2026-05-08 fired ok |
| Credit expiry warning | credit-expiry-warning | daily 08:00 UTC | P1 | 🟡 | 2026-05-08 fired ok |
| iCal expiry reminder | ical-expiry-reminder | daily | P2 | ❓ | not registered in pg_cron — verify |
| Enrolment offer expiry | enrolment-offer-expiry | hourly | P1 | ❓ | not registered in pg_cron — verify |
| Waitlist expiry | waitlist-expiry | daily | P1 | ❓ | not registered in pg_cron — verify |
| Cleanup orphaned resources | cleanup-orphaned-resources | daily 03:00 UTC | P2 | 🟡 | 2026-05-08 fired ok |
| Cleanup webhook retention | cleanup-webhook-retention | daily 03:30 UTC | P2 | 🟡 | 2026-05-08 fired ok |
| Cleanup invoice PDF orphans | cleanup-invoice-pdf-orphans | daily 03:45 UTC | P2 | 🟡 | 2026-05-08 fired ok |
| Cron health watchdog | cron-health-watchdog | daily 09:30 UTC | P0 | 🟢 | 2026-05-08 — fixed 3-bug chain in `check_cron_health()`; was 500'ing every run since deployment. Class A working; Class B no-op (separate finding) |
| Complete expired assignments (SQL fn) | complete_expired_assignments | daily 04:00 UTC | P1 | 🟡 | 2026-05-08 fired ok |
| Reset stale practice streaks (SQL fn) | reset_stale_streaks | daily 03:00 UTC | P2 | 🟡 | 2026-05-08 fired ok |

## Mobile (Capacitor)

| Feature | Platform | Criticality | State | Notes |
|---|---|---|---|---|
| iOS native build | iOS | P0 | 🟡 | v1.2 in App Store review |
| Android native build | Android | P0 | ❓ | AAB built for Play Store |
| Capacitor OAuth in-app browser | both | P1 | ❓ | wrapper present; needs device E2E |
| Push notifications | both | P1 | ⏸ | deferred post-launch |
| Deep link handling (post-OAuth return) | both | P1 | ❓ | |

## Cross-cutting / platform

| Concern | Criticality | State | Notes |
|---|---|---|---|
| RLS coverage | P0 | 🟡 | per Mega Audit + Phase 6 — broadly verified; per-feature RLS spot-checks happen during each /sweep run (especially parent ↔ staff data isolation, cross-org isolation) |
| Sentry capture (browser) | P1 | 🟡 | DSN wired 2026-05-08; first real test is the AuthContext timeout fix landing today; source maps still missing |
| Sentry capture (edge functions) | P1 | ❓ | spot-check selected fns |
| Cookie consent banner | P1 | 🔴 | flagged in claude.md remaining items |
| Anthropic sub-processor disclosure | P1 | 🔴 | flagged in claude.md remaining items |
| Cloudflare WAF rules | P1 | ❓ | not configured for app.lessonloop.net |
| Rate limiting on auth endpoints | P0 | ❓ | verify Supabase auth defaults |
| CSP allow-list (pwnedpasswords) | P0 | 🔴 | known launch blocker |
| Stripe Checkout branding | P1 | 🔴 | known launch blocker |
| Realtime subscriptions reconnect | P1 | ❓ | sleep/wake on mobile devices |
| Storage bucket policies | P0 | ❓ | resources, invoice PDFs, avatars |
| Source Supabase decommission | P0 | 🔴 | known launch blocker |

## Demo / dev / migration utilities (non-launch)

| Feature | Source | Criticality | State | Notes |
|---|---|---|---|---|
| Seed demo agency | seed-demo-agency | P3 | ⏸ | dev-only |
| Seed demo solo | seed-demo-solo | P3 | ⏸ | dev-only |
| Seed demo data | seed-demo-data | P3 | ⏸ | dev-only |
| Seed E2E data | seed-e2e-data | P3 | ⏸ | test-only |
| Migration dump | migration-dump | P3 | ⏸ | one-off cutover tool |
