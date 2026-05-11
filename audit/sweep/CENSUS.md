# CENSUS — Path Y feature inventory

Snapshot of every feature, surface, function, trigger, cron job, settings tab, and hook present in the LessonLoop codebase as of s39 (2026-05-11), each tagged to one of the 20 batches defined in [`PLAN.md`](PLAN.md). This is the master mapping that Phase B reads when entering each batch.

Counts verified at the bottom of each section. The Batch Assignment Index in §11 lets a session look up every entry assigned to its active batch.

**Reading this file:**
- Each row is a single auditable surface.
- The `Batch` column references one of the 20 batches in `PLAN.md` §5.
- Every entry has exactly one batch. The Hibernate list in §12 is explicitly empty.
- Where the live code or DB state diverges from the V2 plan (`LESSONLOOP_V2_PLAN.md`), the divergence is recorded in the entry's notes column.

**Codebase divergence vs V2 plan (drafted 2026-05-09):**
- V2 plan §1.1 records 103 edge functions; live count is 105 (cron-health-watchdog and one other added after the plan was written).
- V2 plan §1.5 records 24 settings tabs; live SettingsNav.tsx has 21 entries plus 3 nested components (`InvoiceSettingsTab`, `RecurringBillingTab`, `CalendarSyncHealth`). The IA pass referenced by V2 plan §5.3 PR3 has happened in nav config, not yet in component dir cleanup.
- V2 plan §3.2 lists Zoom as the only "hide" feature for v1; the §3.3 cut list (`migration-dump`, `marketing-chat`) is still in the codebase. Both included below.

---

## 1. Routes

90 route definitions in `src/config/routes.ts`. Five groups (`publicAuthRoutes`, `authOnlyRoutes`, `portalRoutes`, `appRoutes`, `sharedPublicRoutes`, `productionMarketingRoutes`) plus the `notFoundRoute` constant.

### 1.1 Public auth routes (4)

| Path | Component | Auth | Eager | Batch |
|---|---|---|---|---|
| `/auth` | Login | public-auth-redirect | yes | 01-auth-sessions-rls |
| `/login` | Login | public-auth-redirect | yes | 01-auth-sessions-rls |
| `/signup` | Signup | public-auth-redirect | yes | 01-auth-sessions-rls |
| `/forgot-password` | ForgotPassword | public-auth-redirect | yes | 01-auth-sessions-rls |

### 1.2 Auth-only routes (no onboarding required) (4)

| Path | Component | Auth | Batch |
|---|---|---|---|
| `/onboarding` | Onboarding | auth-only | 02-org-management |
| `/verify-email` | VerifyEmail | auth-only | 01-auth-sessions-rls |
| `/accept-invite` | AcceptInvite | public | 01-auth-sessions-rls |
| `/auth/zoom/callback` | ZoomOAuthCallback | public | 15-calendar-sync-zoom-xero |

### 1.3 Portal routes — parent role (8)

| Path | Component | Allowed roles | Batch |
|---|---|---|---|
| `/portal/home` | PortalHome | parent | 11-parent-portal |
| `/portal/schedule` | PortalSchedule | parent | 11-parent-portal |
| `/portal/practice` | PortalPractice | parent | 11-parent-portal |
| `/portal/resources` | PortalResources | parent | 11-parent-portal |
| `/portal/invoices` | PortalInvoices | parent | 11-parent-portal |
| `/portal/messages` | PortalMessages | parent | 11-parent-portal |
| `/portal/profile` | PortalProfile | parent | 11-parent-portal |
| `/portal/continuation` | PortalContinuation | parent | 11-parent-portal |

### 1.4 App routes — staff roles (32)

| Path | Component | Allowed roles | Batch |
|---|---|---|---|
| `/dashboard` | Dashboard | owner/admin/teacher/finance | 03-calendar-core |
| `/register` | DailyRegister | owner/admin/teacher | 08-attendance-credits-waitlists |
| `/calendar` | CalendarPage | owner/admin/teacher | 03-calendar-core |
| `/batch-attendance` | BatchAttendance | owner/admin/teacher | 08-attendance-credits-waitlists |
| `/students` | Students | owner/admin/teacher | 02-org-management |
| `/students/import` | StudentsImport | owner/admin | 02-org-management |
| `/students/:id` | StudentDetail | owner/admin/teacher | 02-org-management |
| `/teachers` | Teachers | owner/admin | 02-org-management |
| `/locations` | Locations | owner/admin | 02-org-management |
| `/invoices` | Invoices | owner/admin/finance | 05-billing-invoicing |
| `/invoices/:id` | InvoiceDetail | owner/admin/finance | 05-billing-invoicing |
| `/reports` | Reports | owner/admin/finance/teacher | 10-reports-analytics-payroll |
| `/reports/payroll` | PayrollReport | owner/admin/teacher/finance | 10-reports-analytics-payroll |
| `/reports/revenue` | RevenueReport | owner/admin/finance | 10-reports-analytics-payroll |
| `/reports/outstanding` | OutstandingReport | owner/admin/finance | 10-reports-analytics-payroll |
| `/reports/lessons` | LessonsDeliveredReport | owner/admin/teacher | 10-reports-analytics-payroll |
| `/reports/cancellations` | CancellationReport | owner/admin | 10-reports-analytics-payroll |
| `/reports/attendance` | AttendanceReport | owner/admin/teacher | 10-reports-analytics-payroll |
| `/reports/utilisation` | UtilisationReport | owner/admin | 10-reports-analytics-payroll |
| `/reports/teacher-performance` | TeacherPerformanceReport | owner/admin | 10-reports-analytics-payroll |
| `/messages` | Messages | owner/admin/teacher/finance | 12-messages-notifications |
| `/practice` | Practice | owner/admin/teacher | 13-practice-resources |
| `/resources` | Resources | owner/admin/teacher | 13-practice-resources |
| `/make-ups` | MakeUpDashboard | owner/admin | 08-attendance-credits-waitlists |
| `/leads` | Leads | owner/admin | 14-bookings-leads-enrolment |
| `/leads/:id` | LeadDetail | owner/admin | 14-bookings-leads-enrolment |
| `/waitlist` | EnrolmentWaitlistPage | owner/admin | 14-bookings-leads-enrolment |
| `/continuation` | Continuation | owner/admin | 09-term-continuation |
| `/notes` | NotesExplorer | owner/admin/teacher | 04-lessons-scheduling-deep |
| `/settings` | Settings | owner/admin/finance/teacher | 18-settings-tabs |
| `/settings/recurring-billing/runs/:runId` | RecurringRunDetail | owner/admin/finance | 05-billing-invoicing |
| `/settings/recurring-billing/:templateId` | RecurringTemplateDetail | owner/admin/finance | 05-billing-invoicing |
| `/help` | Help | (any auth'd) | 18-settings-tabs |

### 1.5 Shared public routes (3)

| Path | Component | Batch |
|---|---|---|
| `/reset-password` | ResetPassword | 01-auth-sessions-rls |
| `/book/:slug` | BookingPage | 14-bookings-leads-enrolment |
| `/respond/continuation` | PortalContinuation (public token) | 09-term-continuation |

### 1.6 Production marketing routes (38)

All are external redirects to `lessonloop.net` (static marketing site). They never load app components in production. Auditable surface is route registration only.

| Path category | Count | Batch |
|---|---|---|
| Root (auth-aware redirect) | 1 (`/`) | 01-auth-sessions-rls |
| Top-level marketing redirects (`/features`, `/pricing`, `/about`, `/blog`, `/contact`, `/privacy`, `/terms`, `/gdpr`, `/cookies`, `/kickstarter`, `/report`, `/zoom-integration`, `/uk`, `/blog/:slug`) | 14 | 21-marketing-surface |
| Feature redirects (`/features/scheduling`, `/features/billing`, etc., 11 paths) | 11 | 21-marketing-surface |
| Compare redirects (`/compare/lessonloop-vs-*`, 5 paths) | 5 | 21-marketing-surface |
| For redirects (`/for/*`, 5 paths) | 5 | 21-marketing-surface |
| Not Found (catch-all `*`) | 1 | 01-auth-sessions-rls |
| LoopAssist marketing redirect (`/features/loopassist`) | 1 | 21-marketing-surface |

**Growth note:** marketing surface has grown from 15 pages (V2 plan §1.1, 2026-05-09) to 37 pages live (2026-05-11). Phase B batch 21 to investigate whether this is plan undercount or recent additions — and audit content freshness for the newer pages.

### 1.7 Route counts

Total: **90 route definitions** (4 + 4 + 8 + 32 + 3 + 38 + 1).

---

## 2. Pages

89 page files under `src/pages/` (89 `.tsx` files). Subdivided by audience.

### 2.1 Auth / onboarding (8)

| File | Audience | Batch |
|---|---|---|
| `Login.tsx` | unauth | 01-auth-sessions-rls |
| `Signup.tsx` | unauth | 01-auth-sessions-rls |
| `ForgotPassword.tsx` | unauth | 01-auth-sessions-rls |
| `ResetPassword.tsx` | unauth | 01-auth-sessions-rls |
| `VerifyEmail.tsx` | auth-only | 01-auth-sessions-rls |
| `AcceptInvite.tsx` | public | 01-auth-sessions-rls |
| `Onboarding.tsx` | auth-only | 02-org-management |
| `Index.tsx` | public (root redirect) | 01-auth-sessions-rls |

### 2.2 Core staff app (24)

| File | Batch |
|---|---|
| `Dashboard.tsx` | 03-calendar-core |
| `CalendarPage.tsx` | 03-calendar-core |
| `DailyRegister.tsx` | 08-attendance-credits-waitlists |
| `BatchAttendance.tsx` | 08-attendance-credits-waitlists |
| `Students.tsx` | 02-org-management |
| `StudentDetail.tsx` | 02-org-management |
| `StudentsImport.tsx` | 02-org-management |
| `Teachers.tsx` | 02-org-management |
| `Locations.tsx` | 02-org-management |
| `Invoices.tsx` | 05-billing-invoicing |
| `InvoiceDetail.tsx` | 05-billing-invoicing |
| `RecurringTemplateDetail.tsx` | 05-billing-invoicing |
| `RecurringRunDetail.tsx` | 05-billing-invoicing |
| `Reports.tsx` | 10-reports-analytics-payroll |
| `Messages.tsx` | 12-messages-notifications |
| `Practice.tsx` | 13-practice-resources |
| `Resources.tsx` | 13-practice-resources |
| `MakeUpDashboard.tsx` | 08-attendance-credits-waitlists |
| `Leads.tsx` | 14-bookings-leads-enrolment |
| `LeadDetail.tsx` | 14-bookings-leads-enrolment |
| `EnrolmentWaitlistPage.tsx` | 14-bookings-leads-enrolment |
| `Continuation.tsx` | 09-term-continuation |
| `NotesExplorer.tsx` | 04-lessons-scheduling-deep |
| `Settings.tsx` | 18-settings-tabs |

### 2.3 Auxiliary staff pages (3)

| File | Batch |
|---|---|
| `Help.tsx` | 18-settings-tabs |
| `NotFound.tsx` | 01-auth-sessions-rls |
| `ZoomOAuthCallback.tsx` | 15-calendar-sync-zoom-xero |

### 2.4 Reports sub-pages (8)

| File | Batch |
|---|---|
| `reports/Revenue.tsx` | 10-reports-analytics-payroll |
| `reports/Outstanding.tsx` | 10-reports-analytics-payroll |
| `reports/Payroll.tsx` | 10-reports-analytics-payroll |
| `reports/LessonsDelivered.tsx` | 10-reports-analytics-payroll |
| `reports/Cancellations.tsx` | 10-reports-analytics-payroll |
| `reports/Utilisation.tsx` | 10-reports-analytics-payroll |
| `reports/AttendanceReport.tsx` | 10-reports-analytics-payroll |
| `reports/TeacherPerformance.tsx` | 10-reports-analytics-payroll |

### 2.5 Parent portal (8)

| File | Batch |
|---|---|
| `portal/PortalHome.tsx` | 11-parent-portal |
| `portal/PortalSchedule.tsx` | 11-parent-portal |
| `portal/PortalPractice.tsx` | 11-parent-portal |
| `portal/PortalResources.tsx` | 11-parent-portal |
| `portal/PortalInvoices.tsx` | 11-parent-portal |
| `portal/PortalMessages.tsx` | 11-parent-portal |
| `portal/PortalProfile.tsx` | 11-parent-portal |
| `portal/PortalContinuation.tsx` | 11-parent-portal (also batch 09 cross-ref) |

### 2.6 Public booking (1)

| File | Batch |
|---|---|
| `public/BookingPage.tsx` | 14-bookings-leads-enrolment |

### 2.7 Marketing pages (37)

37 React components under `src/pages/marketing/` exist in repo but are NOT route-registered for production (productionMarketingRoutes redirects all to external static site). Loaded only in SSG mode for prerender. Audit treats them as code-only artefacts in batch 21-marketing-surface; staff-app routes never reach them at runtime.

| Subdir | Count | Batch |
|---|---|---|
| `marketing/` top-level (Home, About, Blog, BlogPost, Contact, Cookies, Features, GDPR, Kickstarter, Pricing, Privacy, ReportDownload, Terms, UK, ZoomGuide) | 15 | 21-marketing-surface |
| `marketing/features/` (FeatureAttendance, Billing, Locations, LoopAssist, Messaging, ParentPortal, PracticeTracking, Reports, Resources, Scheduling, Students, Teachers) | 12 | 21-marketing-surface |
| `marketing/compare/` (VsFons, VsJackrabbitMusic, VsMyMusicStaff, VsOpus1, VsTeachworks) | 5 | 21-marketing-surface |
| `marketing/use-cases/` (ForGuitarSchools, ForMusicAcademies, ForPerformingArts, ForPianoSchools, ForSoloTeachers) | 5 | 21-marketing-surface |

### 2.8 Page counts

Total: **89 page files** (8 + 24 + 3 + 8 + 8 + 1 + 37).

---

## 3. Edge functions

105 functions under `supabase/functions/` (excluding the `_shared/` modules dir). Listed alphabetically, with category and auth posture per the controlled vocabulary in §3 of this doc.

**Auth posture vocabulary:**
- `auth-required` — function validates user JWT server-side.
- `cron-only` — gates on `INTERNAL_CRON_SECRET` via `x-cron-secret` header.
- `webhook` — verifies provider signature (Stripe webhook secret, etc.).
- `service-role` — only callable by other edge fns / backend with service-role key.
- `public` — intentionally accepts unauthenticated callers (booking, public-respond, contact).
- `unclear` — auth gate ambiguous from code; flagged for batch 01 deep-audit.

Auth-posture assignments below are based on file location / typical pattern; **any row marked `unclear` is a high-signal target for batch 01 to verify**. Phase B re-verifies every posture.

### 3.1 Auth / account / profile / GDPR / onboarding (10)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `account-delete` | auth | auth-required | 01-auth-sessions-rls |
| `profile-ensure` | auth | auth-required | 01-auth-sessions-rls |
| `invite-accept` | auth | auth-required | 01-auth-sessions-rls |
| `invite-get` | auth | public (token lookup) | 01-auth-sessions-rls |
| `batch-invite-guardians` | auth | auth-required | 02-org-management |
| `send-invite-email` | notification | service-role | 12-messages-notifications |
| `gdpr-delete` | admin | auth-required | 01-auth-sessions-rls |
| `gdpr-export` | admin | auth-required | 01-auth-sessions-rls |
| `onboarding-setup` | auth | auth-required | 02-org-management |
| `admin-backfill-default-pm` | admin | auth-required | 06-payments-stripe-connect |

### 3.2 Calendar / lesson / register (9)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `calendar-disconnect` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `calendar-fetch-busy` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `calendar-ical-feed` | integration | public (token-scoped) | 15-calendar-sync-zoom-xero |
| `calendar-oauth-callback` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `calendar-oauth-start` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `calendar-refresh-busy` | cron | cron-only | 15-calendar-sync-zoom-xero |
| `calendar-sync-lesson` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `send-cancellation-notification` | notification | service-role | 12-messages-notifications |
| `send-lesson-reminders` | cron | cron-only | 12-messages-notifications |

### 3.3 Booking (public) (2)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `booking-get-slots` | booking | public | 14-bookings-leads-enrolment |
| `booking-submit` | booking | public | 14-bookings-leads-enrolment |

### 3.4 Invoicing (7)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `create-billing-run` | billing | auth-required | 05-billing-invoicing |
| `generate-invoice-pdf` | billing | auth-required | 05-billing-invoicing |
| `cleanup-invoice-pdf-orphans` | cron | cron-only | 05-billing-invoicing |
| `send-invoice-email` | billing | auth-required | 05-billing-invoicing |
| `send-invoice-email-internal` | billing | service-role | 05-billing-invoicing |
| `invoice-overdue-check` | cron | cron-only | 05-billing-invoicing |
| `overdue-reminders` | cron | cron-only | 05-billing-invoicing |

### 3.5 Recurring billing (2)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `recurring-billing-scheduler` | cron | cron-only | 05-billing-invoicing |
| `send-recurring-billing-alert` | notification | service-role | 05-billing-invoicing |

### 3.6 Stripe payments + Connect (14)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `stripe-auto-pay-installment` | cron | cron-only | 07-payment-plans-installments |
| `stripe-billing-history` | payment | auth-required | 06-payments-stripe-connect |
| `stripe-connect-onboard` | payment | auth-required | 06-payments-stripe-connect |
| `stripe-connect-status` | payment | auth-required | 06-payments-stripe-connect |
| `stripe-create-checkout` | payment | auth-required | 06-payments-stripe-connect |
| `stripe-create-payment-intent` | payment | auth-required | 06-payments-stripe-connect |
| `stripe-customer-portal` | payment | auth-required | 06-payments-stripe-connect |
| `stripe-detach-payment-method` | payment | auth-required | 06-payments-stripe-connect |
| `stripe-list-payment-methods` | payment | auth-required | 06-payments-stripe-connect |
| `stripe-process-refund` | payment | auth-required | 06-payments-stripe-connect |
| `stripe-subscription-checkout` | payment | auth-required | 16-subscription-tiers |
| `stripe-update-payment-preferences` | payment | auth-required | 06-payments-stripe-connect |
| `stripe-verify-session` | payment | auth-required | 06-payments-stripe-connect |
| `stripe-webhook` | payment | webhook | 06-payments-stripe-connect |

### 3.7 Auto-pay notifications (4)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `auto-pay-final-reminder` | cron | cron-only | 06-payments-stripe-connect |
| `auto-pay-upcoming-reminder` | cron | cron-only | 06-payments-stripe-connect |
| `send-auto-pay-alert` | notification | service-role | 06-payments-stripe-connect |
| `send-auto-pay-failure-notification` | notification | service-role | 06-payments-stripe-connect |

### 3.8 Installments (2)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `installment-overdue-check` | cron | cron-only | 07-payment-plans-installments |
| `installment-upcoming-reminder` | cron | cron-only | 07-payment-plans-installments |

### 3.9 Payment dispute / refund notifications (3)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `send-dispute-notification` | notification | service-role | 06-payments-stripe-connect |
| `send-payment-receipt` | notification | service-role | 06-payments-stripe-connect |
| `send-refund-notification` | notification | service-role | 06-payments-stripe-connect |

### 3.10 Make-up / credits / waitlist (6)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `credit-expiry` | cron | cron-only | 08-attendance-credits-waitlists |
| `credit-expiry-warning` | cron | cron-only | 08-attendance-credits-waitlists |
| `notify-makeup-match` | notification | service-role | 08-attendance-credits-waitlists |
| `notify-makeup-offer` | notification | service-role | 08-attendance-credits-waitlists |
| `waitlist-expiry` | cron | cron-only | 08-attendance-credits-waitlists |
| `waitlist-respond` | makeup | public (token) | 08-attendance-credits-waitlists |

### 3.11 Continuation + term adjustments (4)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `bulk-process-continuation` | continuation | auth-required | 09-term-continuation |
| `continuation-respond` | continuation | public (token) | 09-term-continuation |
| `create-continuation-run` | continuation | auth-required | 09-term-continuation |
| `process-term-adjustment` | continuation | auth-required | 09-term-continuation |

### 3.12 Enrolment / leads (2)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `enrolment-offer-expiry` | cron | cron-only | 14-bookings-leads-enrolment |
| `send-enrolment-offer` | notification | service-role | 14-bookings-leads-enrolment |

### 3.13 Messaging (9)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `mark-messages-read` | messaging | auth-required | 12-messages-notifications |
| `notify-internal-message` | notification | service-role | 12-messages-notifications |
| `send-bulk-message` | messaging | auth-required | 12-messages-notifications |
| `send-contact-message` | messaging | public | 12-messages-notifications |
| `send-message` | messaging | auth-required | 12-messages-notifications |
| `send-notes-notification` | notification | service-role | 12-messages-notifications |
| `send-parent-enquiry` | messaging | auth-required | 11-parent-portal |
| `send-parent-message` | messaging | auth-required | 11-parent-portal |
| `send-push` | notification | service-role | 12-messages-notifications |

### 3.14 Practice / resources (2)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `cleanup-orphaned-resources` | cron | cron-only | 13-practice-resources |
| `streak-notification` | notification | service-role | 13-practice-resources |

### 3.15 Subscription / trial / iCal (6)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `trial-expired` | cron | cron-only | 16-subscription-tiers |
| `trial-reminder-1day` | cron | cron-only | 16-subscription-tiers |
| `trial-reminder-3day` | cron | cron-only | 16-subscription-tiers |
| `trial-reminder-7day` | cron | cron-only | 16-subscription-tiers |
| `trial-winback` | cron | cron-only | 16-subscription-tiers |
| `ical-expiry-reminder` | cron | cron-only | 15-calendar-sync-zoom-xero |

### 3.16 LoopAssist (3)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `looopassist-chat` | loopassist | auth-required | 17-loopassist |
| `looopassist-execute` | loopassist | auth-required | 17-loopassist |
| `parent-loopassist-chat` | loopassist | auth-required (parent) | 17-loopassist |

### 3.17 Marketing chat (slated for cut per V2 §3.3) (1)

| Name | Category | Auth posture | Batch | Notes |
|---|---|---|---|---|
| `marketing-chat` | loopassist-adjacent | public | 17-loopassist | V2 plan §3.3 marks for cut; still in code |

### 3.18 Demo / seed (6)

| Name | Category | Auth posture | Batch | Notes |
|---|---|---|---|---|
| `reset-shadow-org` | admin | auth-required (admin) | 19-cross-cutting | Lauren shadow setup |
| `seed-demo-agency` | admin | service-role + `ALLOW_SEED` | 19-cross-cutting | env-gated |
| `seed-demo-data` | admin | service-role + `ALLOW_SEED` | 19-cross-cutting | env-gated |
| `seed-demo-solo` | admin | service-role + `ALLOW_SEED` | 19-cross-cutting | env-gated |
| `seed-e2e-data` | admin | service-role + `ALLOW_SEED` | 19-cross-cutting | env-gated |
| `seed-shadow-org` | admin | service-role + `ALLOW_SEED` | 19-cross-cutting | env-gated |

### 3.19 CSV import (2)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `csv-import-execute` | admin | auth-required | 02-org-management |
| `csv-import-mapping` | admin | auth-required | 02-org-management |

### 3.20 Xero (5)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `xero-disconnect` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `xero-oauth-callback` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `xero-oauth-start` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `xero-sync-invoice` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `xero-sync-payment` | integration | auth-required | 15-calendar-sync-zoom-xero |

### 3.21 Zoom (3, hide-flagged per V2 §3.2)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `zoom-oauth-callback` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `zoom-oauth-start` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `zoom-sync-lesson` | integration | service-role | 15-calendar-sync-zoom-xero |

### 3.22 Cron infrastructure / cleanup (3)

| Name | Category | Auth posture | Batch |
|---|---|---|---|
| `cron-health-watchdog` | cron | cron-only | 19-cross-cutting |
| `cleanup-webhook-retention` | cron | cron-only | 19-cross-cutting |
| `migration-dump` | admin | service-role | 19-cross-cutting (V2 §3.3 cut candidate) |

### 3.23 Parent enquiry public form (no separate group; included in §3.13 — `send-parent-enquiry`)

### 3.24 Edge function count summary

| Category | Count |
|---|---|
| Auth / account / GDPR / onboarding | 10 |
| Calendar / lesson | 9 |
| Booking (public) | 2 |
| Invoicing | 7 |
| Recurring billing | 2 |
| Stripe payments + Connect | 14 |
| Auto-pay notifications | 4 |
| Installments | 2 |
| Payment dispute / refund notifications | 3 |
| Make-up / credits / waitlist | 6 |
| Continuation + term adjustments | 4 |
| Enrolment / leads | 2 |
| Messaging | 9 |
| Practice / resources | 2 |
| Subscription / trial / iCal | 6 |
| LoopAssist | 3 |
| Marketing chat | 1 |
| Demo / seed | 6 |
| CSV import | 2 |
| Xero | 5 |
| Zoom | 3 |
| Cron infra / cleanup | 3 |
| **Total** | **105** ✓ |

Hard-count check: 105 matches v27 baseline exactly.

---

## 4. DB functions — RPCs (callable from client or edge fn)

Full rows for: externally-callable RPCs, trigger-target functions (see §5), cron-target functions (see §7), and any `SECURITY DEFINER = true` function not covered by helper grouping (see §6). Per s39 policy: full rows for RPCs/trigger-targets/cron-targets/SECDEF; compact rows for pure helpers.

Tag legend: SD = SECURITY DEFINER.

### 4.1 Invoice / billing RPCs

| Name | SD | Returns | Batch |
|---|---|---|---|
| `create_invoice_with_items` | yes | json | 05-billing-invoicing |
| `update_invoice_with_items` | yes | jsonb | 05-billing-invoicing |
| `generate_invoice_number` | yes | text | 05-billing-invoicing |
| `get_invoice_stats` | yes | json | 05-billing-invoicing |
| `void_invoice` | yes | void | 05-billing-invoicing |
| `recalculate_invoice_paid` | yes | json | 05-billing-invoicing |
| `admin_recalculate_invoice_paid` | yes | json | 05-billing-invoicing |
| `get_recent_recalc_failures_for_invoice` | yes | TABLE | 05-billing-invoicing |
| `generate_invoices_from_template` | yes | jsonb | 05-billing-invoicing |
| `delete_billing_run` | yes | json | 05-billing-invoicing |
| `retry_failed_recipients` | yes | jsonb | 05-billing-invoicing |
| `cancel_template_run` | yes | jsonb | 05-billing-invoicing |
| `list_invoice_pdf_objects` | yes | TABLE | 05-billing-invoicing |

### 4.2 Installments / payment plans

| Name | SD | Returns | Batch |
|---|---|---|---|
| `generate_installments` | yes | SETOF invoice_installments | 07-payment-plans-installments |
| `recalculate_installment_status` | yes | void | 07-payment-plans-installments |
| `cancel_payment_plan` | yes | void | 07-payment-plans-installments |
| `update_payment_plan` | yes | SETOF invoice_installments | 07-payment-plans-installments |
| `record_installment_payment` | yes | json | 07-payment-plans-installments |

### 4.3 Payment RPCs

| Name | SD | Returns | Batch |
|---|---|---|---|
| `record_manual_payment` | yes | uuid | 06-payments-stripe-connect |
| `record_manual_refund` | yes | json | 06-payments-stripe-connect |
| `record_payment_and_update_status` | yes | json | 06-payments-stripe-connect |
| `record_stripe_payment` | yes | json | 06-payments-stripe-connect |
| `apply_lost_dispute_cascade` | yes | json | 06-payments-stripe-connect |
| `get_active_disputes_for_org` | yes | SETOF payment_disputes | 06-payments-stripe-connect |
| `get_disputes_for_invoice` | yes | SETOF payment_disputes | 06-payments-stripe-connect |
| `backfill_guardian_default_pm_set` | yes | json | 06-payments-stripe-connect |

### 4.4 Lesson / calendar / register RPCs

| Name | SD | Returns | Batch |
|---|---|---|---|
| `bulk_cancel_lessons` | yes | bulk_lesson_result | 04-lessons-scheduling-deep |
| `bulk_update_lessons` | yes | bulk_lesson_result | 04-lessons-scheduling-deep |
| `shift_recurring_lesson_times` | yes | integer | 03-calendar-core |
| `count_lessons_on_dates` | yes | TABLE | 03-calendar-core |
| `get_lessons_on_date` | yes | TABLE | 03-calendar-core |
| `get_unbilled_lesson_ids` | yes | SETOF uuid | 05-billing-invoicing |
| `can_edit_lesson` | yes | boolean | 03-calendar-core |
| `is_lesson_teacher` | yes | boolean | 03-calendar-core |
| `get_lesson_notes_for_staff` | yes | TABLE | 04-lessons-scheduling-deep |
| `get_parent_lesson_notes` | yes | TABLE | 11-parent-portal |
| `get_unmarked_lesson_count` | yes | integer | 08-attendance-credits-waitlists |

### 4.5 Make-up / credits / waitlist RPCs

| Name | SD | Returns | Batch |
|---|---|---|---|
| `issue_make_up_credit` | yes | make_up_credits | 08-attendance-credits-waitlists |
| `redeem_make_up_credit` | yes | json | 08-attendance-credits-waitlists |
| `find_waitlist_matches` | yes | TABLE | 08-attendance-credits-waitlists |
| `confirm_makeup_booking` | yes | json | 08-attendance-credits-waitlists |
| `offer_makeup_slot` | yes | json | 08-attendance-credits-waitlists |
| `respond_to_makeup_offer` | yes | json | 08-attendance-credits-waitlists |
| `cancel_booked_makeup` | yes | json | 08-attendance-credits-waitlists |
| `dismiss_makeup_match` | yes | json | 08-attendance-credits-waitlists |
| `cleanup_withdrawal_credits` | yes | json | 08-attendance-credits-waitlists |
| `seed_make_up_policies` | yes | void | 08-attendance-credits-waitlists |

### 4.6 Enrolment / waitlist / leads RPCs

| Name | SD | Returns | Batch |
|---|---|---|---|
| `add_to_enrolment_waitlist` | yes | json | 14-bookings-leads-enrolment |
| `convert_waitlist_to_student` | yes | json | 14-bookings-leads-enrolment |
| `withdraw_from_enrolment_waitlist` | yes | json | 14-bookings-leads-enrolment |
| `respond_to_enrolment_offer` | yes | json | 14-bookings-leads-enrolment |
| `convert_lead` | yes | json | 14-bookings-leads-enrolment |

### 4.7 Term / continuation RPCs

| Name | SD | Returns | Batch |
|---|---|---|---|
| `continuation_run_org_id` | yes | uuid | 09-term-continuation |
| `recalc_continuation_summary` | yes | json | 09-term-continuation |
| `user_has_continuation_response_in_run` | yes | boolean | 09-term-continuation |
| `materialise_continuation_lessons` | yes | jsonb | 09-term-continuation |

### 4.8 Reports / payroll RPCs

| Name | SD | Returns | Batch |
|---|---|---|---|
| `get_revenue_report` | yes | TABLE | 10-reports-analytics-payroll |
| `get_teachers_with_pay` | yes | TABLE | 10-reports-analytics-payroll |

### 4.9 Org / membership / onboarding RPCs

| Name | SD | Returns | Batch |
|---|---|---|---|
| `complete_onboarding` | yes | jsonb | 02-org-management |
| `get_parent_dashboard_data` | yes | json | 11-parent-portal |
| `reassign_teacher_conversations_to_owner` | yes | integer | 12-messages-notifications |

### 4.10 Student / import RPCs

| Name | SD | Returns | Batch |
|---|---|---|---|
| `get_students_for_org` | yes | TABLE | 02-org-management |
| `undo_student_import` | yes | json | 02-org-management |
| `anonymise_student` | yes | void | 01-auth-sessions-rls |
| `anonymise_guardian` | yes | void | 01-auth-sessions-rls |

### 4.11 Calendar sync / integration RPCs

| Name | SD | Returns | Batch |
|---|---|---|---|
| `get_org_calendar_health` | yes | TABLE | 15-calendar-sync-zoom-xero |
| `get_org_sync_error_count` | yes | integer | 15-calendar-sync-zoom-xero |
| `generate_ical_token` | yes | text | 15-calendar-sync-zoom-xero |

### 4.12 Locations / rooms RPC

| Name | SD | Returns | Batch |
|---|---|---|---|
| `set_primary_location` | yes | void | 02-org-management |

### 4.13 Cron / infra RPCs

| Name | SD | Returns | Batch |
|---|---|---|---|
| `check_cron_health` | yes | TABLE | 19-cross-cutting |
| `cleanup_webhook_retention` | yes | jsonb | 19-cross-cutting |
| `complete_expired_assignments` | yes | void | 13-practice-resources |
| `reset_stale_streaks` | yes | void | 13-practice-resources |
| `cleanup_expired_invites` | yes | integer | 01-auth-sessions-rls |
| `cleanup_rate_limits` | yes | void | 19-cross-cutting |
| `check_rate_limit` | yes | boolean | 19-cross-cutting |

### 4.14 E2E test helpers

| Name | SD | Returns | Batch |
|---|---|---|---|
| `_e2e_set_user_email_confirmed` | yes | jsonb | 19-cross-cutting |

---

## 5. DB functions — trigger targets (grouped by table)

124 user-defined triggers across `public` schema, calling 53 distinct trigger-target functions. One row per trigger. Function name links the trigger to its body.

### 5.1 Lessons / calendar (10 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `check_lesson_conflicts_insert` | lessons | check_lesson_conflicts | BEFORE INSERT | 03-calendar-core |
| `check_lesson_conflicts_update` | lessons | check_lesson_conflicts | BEFORE UPDATE | 03-calendar-core |
| `enforce_subscription_active_lessons` | lessons | check_subscription_active | BEFORE INSERT | 16-subscription-tiers |
| `prevent_invoiced_lesson_delete` | lessons | prevent_invoiced_lesson_delete | BEFORE DELETE | 05-billing-invoicing |
| `trg_cleanup_attendance_on_cancel` | lessons | cleanup_attendance_on_cancel | AFTER UPDATE | 03-calendar-core |
| `trg_prevent_org_id_change` (lessons) | lessons | prevent_org_id_change | BEFORE UPDATE | 19-cross-cutting |
| `trg_prevent_past_open_slot` | lessons | prevent_past_open_slot | BEFORE INSERT | 03-calendar-core |
| `update_lessons_updated_at` | lessons | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `audit_lessons` | lessons | log_audit_event_singular | AFTER INSERT/UPDATE/DELETE | 19-cross-cutting |
| `trg_prevent_org_id_change` (lesson_notes) | lesson_notes | prevent_org_id_change | BEFORE UPDATE | 19-cross-cutting |

### 5.2 Lesson participants (3 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `audit_lesson_participants` | lesson_participants | log_audit_event_singular | AFTER INSERT/UPDATE/DELETE | 19-cross-cutting |
| `trg_clear_open_slot` | lesson_participants | clear_open_slot_on_participant | AFTER INSERT | 03-calendar-core |
| `trg_makeup_participant_removed` | lesson_participants | on_makeup_participant_removed | AFTER DELETE | 08-attendance-credits-waitlists |

### 5.3 Attendance (7 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `enforce_subscription_active_attendance_records` | attendance_records | check_subscription_active | BEFORE INSERT | 16-subscription-tiers |
| `trg_attendance_not_future` | attendance_records | check_attendance_not_future | BEFORE INSERT/UPDATE | 08-attendance-credits-waitlists |
| `trg_audit_attendance` | attendance_records | audit_attendance_changes | AFTER INSERT/UPDATE/DELETE | 19-cross-cutting |
| `trg_auto_credit` | attendance_records | auto_issue_credit_on_absence | AFTER INSERT/UPDATE | 08-attendance-credits-waitlists |
| `trg_auto_waitlist` | attendance_records | auto_add_to_waitlist | AFTER INSERT/UPDATE | 08-attendance-credits-waitlists |
| `trg_slot_released` | attendance_records | on_slot_released | AFTER INSERT/UPDATE | 08-attendance-credits-waitlists |
| `trg_validate_attendance_participant` | attendance_records | validate_attendance_participant | BEFORE INSERT/UPDATE | 08-attendance-credits-waitlists |

### 5.4 Invoices (7 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `audit_invoices` | invoices | log_audit_event_singular | AFTER INSERT/UPDATE/DELETE | 19-cross-cutting |
| `enforce_invoice_status_transition` | invoices | enforce_invoice_status_transition | BEFORE UPDATE | 05-billing-invoicing |
| `enforce_subscription_active_invoices` | invoices | check_subscription_active | BEFORE INSERT | 16-subscription-tiers |
| `set_invoice_number_trigger` | invoices | set_invoice_number | BEFORE INSERT | 05-billing-invoicing |
| `trg_bump_invoice_pdf_rev` | invoices | bump_invoice_pdf_rev | BEFORE UPDATE | 05-billing-invoicing |
| `trg_prevent_org_id_change` (invoices) | invoices | prevent_org_id_change | BEFORE UPDATE | 19-cross-cutting |
| `update_invoices_updated_at` | invoices | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |

### 5.5 Invoice items + installments + payments — PDF rev cascade (12 triggers)

V2 plan §1.5 item 11 records these as a single conceptual cluster.

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `audit_invoice_items` | invoice_items | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `trg_invoice_items_check_amounts` | invoice_items | check_invoice_item_amounts | BEFORE I/U | 05-billing-invoicing |
| `trg_bump_invoice_pdf_rev_from_items_del` | invoice_items | bump_invoice_pdf_rev_from_items_del | AFTER DELETE | 05-billing-invoicing |
| `trg_bump_invoice_pdf_rev_from_items_ins` | invoice_items | bump_invoice_pdf_rev_from_items_ins | AFTER INSERT | 05-billing-invoicing |
| `trg_bump_invoice_pdf_rev_from_items_upd` | invoice_items | bump_invoice_pdf_rev_from_items_upd | AFTER UPDATE | 05-billing-invoicing |
| `audit_invoice_installments` | invoice_installments | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `set_updated_at` | invoice_installments | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `trg_bump_invoice_pdf_rev_from_installments_del` | invoice_installments | bump_invoice_pdf_rev_from_installments_del | AFTER DELETE | 07-payment-plans-installments |
| `trg_bump_invoice_pdf_rev_from_installments_ins` | invoice_installments | bump_invoice_pdf_rev_from_installments_ins | AFTER INSERT | 07-payment-plans-installments |
| `trg_bump_invoice_pdf_rev_from_installments_upd` | invoice_installments | bump_invoice_pdf_rev_from_installments_upd | AFTER UPDATE | 07-payment-plans-installments |
| `trg_bump_invoice_pdf_rev_from_payments_del` | payments | bump_invoice_pdf_rev_from_payments_del | AFTER DELETE | 06-payments-stripe-connect |
| `trg_bump_invoice_pdf_rev_from_payments_ins` | payments | bump_invoice_pdf_rev_from_payments_ins | AFTER INSERT | 06-payments-stripe-connect |
| `trg_bump_invoice_pdf_rev_from_payments_upd` | payments | bump_invoice_pdf_rev_from_payments_upd | AFTER UPDATE | 06-payments-stripe-connect |

### 5.6 Payments / refunds / disputes (8 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `audit_payments` | payments | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `trg_prevent_org_id_change` (payments) | payments | prevent_org_id_change | BEFORE UPDATE | 19-cross-cutting |
| `update_payments_updated_at` | payments | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `audit_refunds` | refunds | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `trg_validate_refund_amount` | refunds | validate_refund_amount | BEFORE I/U | 06-payments-stripe-connect |
| `trg_payment_disputes_updated_at` | payment_disputes | payment_disputes_touch_updated_at | BEFORE UPDATE | 06-payments-stripe-connect |
| `audit_guardian_payment_preferences` | guardian_payment_preferences | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |

### 5.7 Students / guardians (10 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `audit_students` | students | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `enforce_student_limit` | students | check_student_limit | BEFORE INSERT | 16-subscription-tiers |
| `enforce_subscription_active_students` | students | check_subscription_active | BEFORE INSERT | 16-subscription-tiers |
| `trg_cleanup_resource_shares_on_student_archive` | students | cleanup_resource_shares_on_student_archive | AFTER UPDATE | 13-practice-resources |
| `trg_prevent_org_id_change` (students) | students | prevent_org_id_change | BEFORE UPDATE | 19-cross-cutting |
| `trg_void_credits_on_student_delete` | students | void_credits_on_student_delete | AFTER UPDATE | 08-attendance-credits-waitlists |
| `update_students_updated_at` | students | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `audit_guardians` | guardians | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `enforce_subscription_active_guardians` | guardians | check_subscription_active | BEFORE INSERT | 16-subscription-tiers |
| `trg_prevent_org_id_change` (guardians) | guardians | prevent_org_id_change | BEFORE UPDATE | 19-cross-cutting |
| `update_guardians_updated_at` | guardians | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `audit_student_guardians` | student_guardians | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `update_student_instruments_updated_at` | student_instruments | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |

### 5.8 Teachers / availability (7 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `audit_teachers_changes` | teachers | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `enforce_teacher_limit` | teachers | check_teacher_limit | BEFORE I/U | 16-subscription-tiers |
| `protect_teacher_user_link` | teachers | protect_teacher_user_link | BEFORE UPDATE | 02-org-management |
| `trg_prevent_org_id_change` (teachers) | teachers | prevent_org_id_change | BEFORE UPDATE | 19-cross-cutting |
| `update_teachers_updated_at` | teachers | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `audit_teacher_profiles` | teacher_profiles | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `update_teacher_profiles_updated_at` | teacher_profiles | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `prevent_availability_overlap` | availability_blocks | check_availability_overlap | BEFORE I/U | 03-calendar-core |

### 5.9 Org / membership / profile / locations (12 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `on_organisation_created` | organisations | handle_new_organisation | AFTER INSERT | 02-org-management |
| `protect_org_subscription_fields` | organisations | protect_subscription_fields | BEFORE UPDATE | 16-subscription-tiers |
| `validate_org_schedule_hours` | organisations | validate_schedule_hours | BEFORE I/U | 02-org-management |
| `validate_org_timezone_currency` | organisations | validate_org_timezone_currency | BEFORE I/U | 19-cross-cutting |
| `audit_org_memberships` | org_memberships | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `enforce_owner_role_protection` | org_memberships | protect_owner_role | BEFORE UPDATE | 02-org-management |
| `trg_auto_solo_to_studio` | org_memberships | trg_auto_transition_solo_to_studio | AFTER INSERT | 02-org-management |
| `trg_block_owner_insert` | org_memberships | block_owner_insert | BEFORE INSERT | 02-org-management |
| `trg_prevent_org_id_change` (org_memberships) | org_memberships | prevent_org_id_change | BEFORE UPDATE | 19-cross-cutting |
| `audit_profile_changes` | profiles | log_profile_change | AFTER I/U/D | 19-cross-cutting |
| `protect_onboarding_flag` | profiles | protect_onboarding_flag | BEFORE UPDATE | 02-org-management |
| `update_profiles_updated_at` | profiles | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `trg_auto_promote_primary_on_archive` | locations | trg_auto_promote_primary_on_archive | BEFORE UPDATE | 02-org-management |
| `update_locations_updated_at` | locations | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `update_rooms_updated_at` | rooms | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |

### 5.10 Terms / continuation / adjustments (6 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `audit_terms` | terms | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `enforce_term_no_overlap` | terms | check_term_overlap | BEFORE I/U | 09-term-continuation |
| `audit_term_adjustments` | term_adjustments | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `set_term_adjustments_updated_at` | term_adjustments | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `audit_term_continuation_responses` | term_continuation_responses | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `set_tcr_response_updated_at` | term_continuation_responses | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `set_tcr_updated_at` | term_continuation_runs | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |

### 5.11 Make-up credits / waitlist (5 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `audit_make_up_credits` | make_up_credits | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `update_make_up_credits_updated_at` | make_up_credits | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `audit_make_up_waitlist` | make_up_waitlist | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `set_make_up_waitlist_updated_at` | make_up_waitlist | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `trg_notify_makeup_match` | make_up_waitlist | notify_makeup_match_webhook | AFTER UPDATE | 08-attendance-credits-waitlists |
| `trg_validate_waitlist_credit` | make_up_waitlist | validate_waitlist_credit_ownership | BEFORE I/U | 08-attendance-credits-waitlists |

### 5.12 Messaging / notifications (5 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `audit_internal_messages` | internal_messages | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `update_message_requests_updated_at` | message_requests | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `update_message_templates_updated_at` | message_templates | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `update_notification_preferences_updated_at` | notification_preferences | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `update_org_messaging_settings_updated_at` | org_messaging_settings | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |

### 5.13 AI / LoopAssist (2 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `audit_ai_action_proposals` | ai_action_proposals | log_audit_event_singular | AFTER I/U/D | 17-loopassist |
| `update_ai_conversations_updated_at` | ai_conversations | update_updated_at_column | BEFORE UPDATE | 17-loopassist |

### 5.14 Billing runs / recurring templates (4 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `audit_billing_runs` | billing_runs | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `audit_recurring_invoice_templates` | recurring_invoice_templates | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `audit_recurring_template_items` | recurring_template_items | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `audit_recurring_template_recipients` | recurring_template_recipients | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `audit_rate_cards` | rate_cards | log_audit_event_singular | AFTER I/U/D | 19-cross-cutting |
| `update_rate_cards_updated_at` | rate_cards | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |

### 5.15 Enrolment waitlist / booking page / leads (3 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `set_enrolment_waitlist_updated_at` | enrolment_waitlist | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `update_booking_pages_updated_at` | booking_pages | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `update_leads_updated_at` | leads | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |

### 5.16 Calendar connections / resources / practice (4 triggers)

| Trigger | Table | Function | Timing / Events | Batch |
|---|---|---|---|---|
| `update_calendar_connections_updated_at` | calendar_connections | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `update_resources_updated_at` | resources | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `update_practice_assignments_updated_at` | practice_assignments | update_updated_at_column | BEFORE UPDATE | 19-cross-cutting |
| `enforce_subscription_active_practice_logs` | practice_logs | check_subscription_active | BEFORE INSERT | 16-subscription-tiers |
| `update_streak_on_practice_log` | practice_logs | update_practice_streak | AFTER INSERT | 13-practice-resources |
| `check_subscription_resource_categories` | resource_categories | check_subscription_active | BEFORE INSERT | 16-subscription-tiers |
| `check_subscription_resource_category_assignments` | resource_category_assignments | check_subscription_active | BEFORE INSERT | 16-subscription-tiers |

### 5.17 Trigger total

124 user-defined triggers across 36 tables, calling 53 distinct trigger-target functions. Boilerplate (`update_updated_at_column`, `log_audit_event_singular`, `prevent_org_id_change`) accounts for ~80 of the 124 rows — these are infrastructure, audited as a single class in batch 19.

---

## 6. DB functions — helpers (compact)

Per Q2 policy: helpers used by RLS and RPCs get one compact row per logical group, listing names inline. All are SECURITY DEFINER unless noted.

| Group | Functions | Batch |
|---|---|---|
| **RLS role-check helpers** | `is_org_admin`, `is_org_owner`, `is_org_finance_team`, `is_org_member`, `is_org_parent`, `is_org_scheduler`, `is_org_staff`, `is_org_active`, `is_org_write_allowed`, `has_org_role`, `has_role`, `get_org_role`, `get_user_roles`, `get_user_org_ids`, `is_assigned_teacher`, `is_invoice_payer`, `is_parent_of_student`, `teacher_has_thread_access`, `get_teacher_id_for_user`, `get_guardian_ids_for_user`, `get_student_ids_for_parent`, `get_user_id_by_email` | 01-auth-sessions-rls |
| **Audit-log infrastructure** | `log_audit_event_singular`, `log_profile_change`, `_notify_streak_milestone`, `rls_auto_enable` (event trigger) | 19-cross-cutting |
| **Cross-table updated-at + org-id-change guards** | `update_updated_at_column`, `prevent_org_id_change`, `payment_disputes_touch_updated_at` | 19-cross-cutting |
| **Invoice PDF rev cascade (helpers — see §5.5 for triggers)** | `bump_invoice_pdf_rev`, `bump_invoice_pdf_rev_from_items` (and del/ins/upd variants), `bump_invoice_pdf_rev_from_installments` (and variants), `bump_invoice_pdf_rev_from_payments` (and variants) | 05-billing-invoicing |
| **Subscription limits + protections** | `check_subscription_active`, `check_student_limit`, `check_teacher_limit`, `protect_subscription_fields`, `protect_onboarding_flag`, `protect_owner_role`, `protect_teacher_user_link`, `block_owner_insert`, `trg_auto_transition_solo_to_studio` | 16-subscription-tiers |
| **Org / locations** | `handle_new_organisation`, `handle_new_user`, `validate_org_timezone_currency`, `validate_schedule_hours`, `set_primary_location`, `trg_auto_promote_primary_on_archive` | 02-org-management |

---

## 7. Cron jobs

26 active jobs in `cron.job`, each invoking an edge function via `net.http_post` with `x-cron-secret` (cron-auth) — except `complete-expired-assignments` and `reset-stale-practice-streaks`, which call public SQL functions directly.

| jobid | jobname | Schedule | Target | Batch |
|---|---|---|---|---|
| 89 | auto-pay-upcoming-reminder-daily | `0 8 * * *` | `auto-pay-upcoming-reminder` | 06-payments-stripe-connect |
| 90 | stripe-auto-pay-installment-daily | `0 9 * * *` | `stripe-auto-pay-installment` | 07-payment-plans-installments |
| 91 | auto-pay-final-reminder-daily | `0 8 * * *` | `auto-pay-final-reminder` | 06-payments-stripe-connect |
| 92 | overdue-reminders-daily | `0 9 * * *` | `overdue-reminders` | 05-billing-invoicing |
| 93 | recurring-billing-scheduler-daily | `0 4 * * *` | `recurring-billing-scheduler` | 05-billing-invoicing |
| 94 | credit-expiry-daily | `0 2 * * *` | `credit-expiry` | 08-attendance-credits-waitlists |
| 95 | invoice-overdue-check | `30 5 * * *` | `invoice-overdue-check` | 05-billing-invoicing |
| 96 | installment-overdue-check-daily | `0 6 * * *` | `installment-overdue-check` | 07-payment-plans-installments |
| 97 | installment-upcoming-reminder-daily | `0 8 * * *` | `installment-upcoming-reminder` | 07-payment-plans-installments |
| 98 | credit-expiry-warning-daily | `0 8 * * *` | `credit-expiry-warning` | 08-attendance-credits-waitlists |
| 99 | cleanup-orphaned-resources | `0 3 * * *` | `cleanup-orphaned-resources` | 13-practice-resources |
| 100 | calendar-refresh-busy | `*/15 * * * *` | `calendar-refresh-busy` | 15-calendar-sync-zoom-xero |
| 101 | send-lesson-reminders | `0 * * * *` | `send-lesson-reminders` | 12-messages-notifications |
| 102 | webhook-retention-daily | `30 3 * * *` | `cleanup-webhook-retention` | 19-cross-cutting |
| 103 | invoice-pdf-orphan-sweep-daily | `45 3 * * *` | `cleanup-invoice-pdf-orphans` | 05-billing-invoicing |
| 104 | cron-health-watchdog-daily | `30 9 * * *` | `cron-health-watchdog` | 19-cross-cutting |
| 105 | complete-expired-assignments | `0 4 * * *` | `SELECT public.complete_expired_assignments()` | 13-practice-resources |
| 106 | reset-stale-practice-streaks | `0 3 * * *` | `SELECT public.reset_stale_streaks()` | 13-practice-resources |
| 107 | trial-reminder-7day-daily | `15 8 * * *` | `trial-reminder-7day` | 16-subscription-tiers |
| 108 | trial-reminder-3day-daily | `20 8 * * *` | `trial-reminder-3day` | 16-subscription-tiers |
| 109 | trial-reminder-1day-daily | `25 8 * * *` | `trial-reminder-1day` | 16-subscription-tiers |
| 110 | trial-expired-daily | `0 7 * * *` | `trial-expired` | 16-subscription-tiers |
| 111 | trial-winback-weekly | `0 10 * * 1` | `trial-winback` | 16-subscription-tiers |
| 112 | ical-expiry-reminder-daily | `15 7 * * *` | `ical-expiry-reminder` | 15-calendar-sync-zoom-xero |
| 113 | waitlist-expiry-daily | `30 4 * * *` | `waitlist-expiry` | 08-attendance-credits-waitlists |
| 114 | enrolment-offer-expiry-hourly | `5 * * * *` | `enrolment-offer-expiry` | 14-bookings-leads-enrolment |

Total: **26 cron jobs.**

---

## 8. Settings tabs

Per s39 Option A: 21 live tabs in `SettingsNav.tsx` (the canonical IA) + 3 nested components (`InvoiceSettingsTab`, `RecurringBillingTab`, `CalendarSyncHealth`) listed as sub-rows under their parent tabs. Total live IA: **21 tabs**.

V2 plan §1.5 item 3 noted the pre-IA-pass figure of 24. The IA pass referenced in V2 plan §5.3 PR3 has happened in nav config; the 3 collapsed-into-sub-components remain in the component dir and are audited under their parent.

### 8.1 Account group (3)

| Tab value | Component | Audience | Batch |
|---|---|---|---|
| `profile` | ProfileTab | self | 18-settings-tabs |
| `notifications` | NotificationsTab | self | 18-settings-tabs |
| `help-tours` | HelpToursTab | self | 18-settings-tabs |

### 8.2 Organisation group (4)

| Tab value | Component | Audience | Batch |
|---|---|---|---|
| `organisation` | OrganisationTab | admin | 18-settings-tabs |
| `branding` | BrandingTab | admin | 18-settings-tabs |
| `members` | OrgMembersTab | admin | 18-settings-tabs |
| `data-import` | DataImportTab | admin | 18-settings-tabs |

### 8.3 Teaching group (5)

| Tab value | Component | Audience | Batch |
|---|---|---|---|
| `scheduling` | SchedulingSettingsTab | admin | 18-settings-tabs |
| `availability` | TeacherAvailabilityTab (via AvailabilityTabWithSelector wrapper) | any teaching role | 18-settings-tabs |
| `calendar` | CalendarIntegrationsTab | any | 18-settings-tabs |
| `zoom` | ZoomIntegrationTab | any | 18-settings-tabs |
| `music` | MusicSettingsTab | admin | 18-settings-tabs |

`CalendarIntegrationsTab` embeds `CalendarSyncHealth` (nested component, not standalone tab) — audited as part of `calendar` row.

### 8.4 Business group (7)

| Tab value | Component | Audience | Batch |
|---|---|---|---|
| `billing` | BillingTab (+ inline InvoiceSettingsTab) | admin | 18-settings-tabs |
| `rate-cards` | RateCardsTab | admin | 18-settings-tabs |
| `messaging` | MessagingSettingsTab | admin | 18-settings-tabs |
| `booking-page` | BookingPageTab | admin | 18-settings-tabs |
| `loopassist` | LoopAssistPreferencesTab | admin | 18-settings-tabs |
| `continuation` | ContinuationSettingsTab | admin | 18-settings-tabs |
| `accounting` | AccountingTab | admin | 18-settings-tabs |

`BillingTab` renders `InvoiceSettingsTab` inline; both are audited under the `billing` row.

`RecurringBillingTab.tsx` component exists in `src/components/settings/` but is NOT referenced from `SettingsNav.tsx`. Routes `/settings/recurring-billing/runs/:runId` and `/settings/recurring-billing/:templateId` (registered in `appRoutes`) point to `RecurringRunDetail` and `RecurringTemplateDetail` pages, not to the orphan tab. Whether `RecurringBillingTab` is dead code or reachable via another path is a finding to confirm in batch 18.

### 8.5 Compliance group (2)

| Tab value | Component | Audience | Batch |
|---|---|---|---|
| `privacy` | PrivacyTab | admin | 18-settings-tabs |
| `audit` | AuditLogTab | admin | 18-settings-tabs |

### 8.6 Settings tab count

21 live nav entries + 3 nested components (`InvoiceSettingsTab`, `RecurringBillingTab`, `CalendarSyncHealth`) tracked under parent tabs. The s39 prompt expected 24 per V2 plan §5 PR3 — pre-IA-pass; live IA has collapsed three into sub-components.

---

## 9. Hooks

123 hook files under `src/hooks/`. Grouped by feature domain; one row per file with its primary purpose. Most hooks wrap a TanStack Query call, a mutation, or a UI state machine.

### 9.1 Auth / org / membership (5)

| File | Purpose | Batch |
|---|---|---|
| `useOrgMembers.ts` | Org membership list / invite flow | 02-org-management |
| `useOrgPaymentPreferences.ts` | Per-org default payment method | 06-payments-stripe-connect |
| `useOrgTimezone.ts` | Read current org timezone | 19-cross-cutting |
| `useTeachers.ts` | Teacher list / availability | 02-org-management |
| `useTeacherAvailability.ts` | Teacher availability blocks | 03-calendar-core |

### 9.2 Onboarding / first-run (4)

| File | Purpose | Batch |
|---|---|---|
| `useOnboardingProgress.ts` | Staff onboarding progress | 02-org-management |
| `useOnboardingState.ts` | Onboarding wizard state machine | 02-org-management |
| `useParentOnboardingProgress.ts` | Parent onboarding progress | 11-parent-portal |
| `useFirstRunExperience.ts` | First-run tour orchestration | 18-settings-tabs |

### 9.3 Calendar / lessons / scheduling (15)

| File | Purpose | Batch |
|---|---|---|
| `useCalendarActions.tsx` | Lesson CRUD via calendar UI | 03-calendar-core |
| `useCalendarData.ts` | Calendar data fetch / cache | 03-calendar-core |
| `useCalendarConnections.ts` | OAuth connection list | 15-calendar-sync-zoom-xero |
| `useCalendarSync.ts` | Sync state per provider | 15-calendar-sync-zoom-xero |
| `useExternalBusyBlocks.ts` | External calendar busy state | 15-calendar-sync-zoom-xero |
| `useConflictDetection.ts` | App-layer conflict checks (7 checks) | 03-calendar-core |
| `useSlotGenerator.ts` | Open-slot generator | 03-calendar-core |
| `useClosureDates.ts` | Org closure dates CRUD | 03-calendar-core |
| `useClosureDateSettings.ts` | Closure-date config | 03-calendar-core |
| `useClosurePatternCheck.ts` | Recurring closure validation | 03-calendar-core |
| `useBulkLessonActions.ts` | Bulk update/cancel | 04-lessons-scheduling-deep |
| `useLessonNotes.ts` | Lesson notes (shared/private) | 04-lessons-scheduling-deep |
| `useNotesExplorer.ts` | Notes explorer page state | 04-lessons-scheduling-deep |
| `usePreviousLessonNotes.ts` | Lookup last lesson's notes | 04-lessons-scheduling-deep |
| `useNotesNotification.ts` | Notify parent on new notes | 12-messages-notifications |
| `useTodayLessons.ts` | Today's lesson list (Dashboard widget) | 03-calendar-core |

### 9.4 Students / guardians (8)

| File | Purpose | Batch |
|---|---|---|
| `useStudents.ts` | Student list | 02-org-management |
| `useStudentDetail.ts` | Single student profile | 02-org-management |
| `useStudentDetailPage.ts` | Student detail page composition | 02-org-management |
| `useStudentInstruments.ts` | Student instrument assignments | 02-org-management |
| `useStudentQuickNotes.ts` | Quick-add note from calendar | 04-lessons-scheduling-deep |
| `useStudentTermLessons.ts` | Lessons by term per student | 09-term-continuation |
| `useStudentsImport.ts` | CSV import wizard state | 02-org-management |
| `useGradeChangeHistory.ts` | Student grade change log | 02-org-management |
| `useRelatedStudent.ts` | Student lookup helper | 02-org-management |

### 9.5 Attendance / register / credits / waitlist (7)

| File | Purpose | Batch |
|---|---|---|
| `useRegisterData.ts` | Daily register fetch | 08-attendance-credits-waitlists |
| `useAttendanceReport.ts` | Attendance report data | 10-reports-analytics-payroll |
| `useAvailableCredits.ts` | Student credit balance | 08-attendance-credits-waitlists |
| `useMakeUpCredits.ts` | Make-up credit CRUD | 08-attendance-credits-waitlists |
| `useMakeUpPolicies.ts` | Org make-up policy config | 08-attendance-credits-waitlists |
| `useMakeUpWaitlist.ts` | Make-up waitlist + matching | 08-attendance-credits-waitlists |
| `useParentCredits.ts` | Parent-side credit view | 11-parent-portal |

### 9.6 Invoicing / billing / payments (16)

| File | Purpose | Batch |
|---|---|---|
| `useInvoices.ts` | Invoice list / filters | 05-billing-invoicing |
| `useInvoicesWithDisputes.ts` | Invoices with active disputes | 06-payments-stripe-connect |
| `useInvoiceInstallments.ts` | Installment plan management | 07-payment-plans-installments |
| `useInvoicePdf.ts` | PDF render / download | 05-billing-invoicing |
| `useInvoiceDisputes.ts` | Dispute list | 06-payments-stripe-connect |
| `useInvoiceRecalcFailure.ts` | Recalc retry failures view | 05-billing-invoicing |
| `useBillingRuns.ts` | Billing run CRUD | 05-billing-invoicing |
| `useRealtimeInvoices.ts` | Realtime subscription for invoices | 05-billing-invoicing |
| `useRealtimePortalPayments.ts` | Realtime subscription for parent payments | 11-parent-portal |
| `useRecurringInvoiceTemplates.ts` | Recurring template CRUD | 05-billing-invoicing |
| `useRecurringTemplateDetailPage.ts` | Recurring detail page state | 05-billing-invoicing |
| `useRecurringTemplateItems.ts` | Template items | 05-billing-invoicing |
| `useRecurringTemplateRecipients.ts` | Template recipients | 05-billing-invoicing |
| `useRecurringTemplateRuns.ts` | Template run history | 05-billing-invoicing |
| `useRunRecurringTemplate.ts` | Run-now action | 05-billing-invoicing |
| `useRateCards.ts` | Rate card CRUD | 05-billing-invoicing |

### 9.7 Stripe / payments execution (6)

| File | Purpose | Batch |
|---|---|---|
| `useStripeConnect.ts` | Connect status / onboarding | 06-payments-stripe-connect |
| `useStripeElements.ts` | Stripe Elements lifecycle | 06-payments-stripe-connect |
| `useStripePayment.ts` | Payment intent flow | 06-payments-stripe-connect |
| `useEmbeddedPayment.ts` | Embedded drawer payment | 06-payments-stripe-connect |
| `useSavedPaymentMethods.ts` | Saved card list | 06-payments-stripe-connect |
| `useRefund.ts` | Refund issuance | 06-payments-stripe-connect |
| `usePaymentAnalytics.ts` | Payment analytics for dashboard | 10-reports-analytics-payroll |

### 9.8 Subscription / tier / feature gate (4)

| File | Purpose | Batch |
|---|---|---|
| `useSubscription.ts` | Current org subscription state | 16-subscription-tiers |
| `useSubscriptionCheckout.ts` | Stripe Checkout for SaaS plan | 16-subscription-tiers |
| `useFeatureGate.ts` | Plan-feature flag matrix | 16-subscription-tiers |
| `useUsageCounts.ts` | Students/teachers count vs limit | 16-subscription-tiers |

### 9.9 Leads / bookings / waitlist (5)

| File | Purpose | Batch |
|---|---|---|
| `useLeads.ts` | Lead list | 14-bookings-leads-enrolment |
| `useLeadActivities.ts` | Lead activity log | 14-bookings-leads-enrolment |
| `useLeadAnalytics.ts` | Lead funnel chart data | 14-bookings-leads-enrolment |
| `useEnrolmentWaitlist.ts` | Enrolment waitlist CRUD | 14-bookings-leads-enrolment |
| `useBookingPage.ts` | Public booking page logic | 14-bookings-leads-enrolment |

### 9.10 Term continuation / adjustments (3)

| File | Purpose | Batch |
|---|---|---|
| `useTerms.ts` | Term CRUD | 09-term-continuation |
| `useTermContinuation.ts` | Continuation run flow | 09-term-continuation |
| `useTermAdjustment.ts` | Term adjustments (withdrawal/day_change) | 09-term-continuation |

### 9.11 Messages / notifications (8)

| File | Purpose | Batch |
|---|---|---|
| `useMessages.ts` | Message list | 12-messages-notifications |
| `useMessageThreads.ts` | Thread list / mark-read | 12-messages-notifications |
| `useUnreadMessages.ts` | Unread badge count | 12-messages-notifications |
| `useInternalMessages.ts` | Internal (staff) messages | 12-messages-notifications |
| `useMessagingSettings.ts` | Org messaging config | 12-messages-notifications |
| `useBulkMessage.ts` | Bulk send composer | 12-messages-notifications |
| `useAdminMessageRequests.ts` | Admin message-request queue | 12-messages-notifications |
| `useStaffNotifications.ts` | Staff notification feed | 12-messages-notifications |

### 9.12 Parent portal (8)

| File | Purpose | Batch |
|---|---|---|
| `useParentPortal.ts` | Portal data composition | 11-parent-portal |
| `useParentConversations.ts` | Parent message threads | 11-parent-portal |
| `useParentReply.ts` | Parent reply flow | 11-parent-portal |
| `useParentInstruments.ts` | Parent's children's instruments | 11-parent-portal |
| `useParentEnquiry.ts` | Parent enquiry form | 11-parent-portal |
| `usePortalFeatures.ts` | Portal feature-flag gate | 11-parent-portal |
| `usePortalLink.ts` | Portal short-link helper | 11-parent-portal |
| `useParentLoopAssist.ts` | Parent-side LoopAssist | 17-loopassist |

### 9.13 LoopAssist (2)

| File | Purpose | Batch |
|---|---|---|
| `useLoopAssist.ts` | Staff LoopAssist chat / execute | 17-loopassist |
| `useLoopAssistFirstRun.ts` | First-run intro | 17-loopassist |

### 9.14 Practice / resources (5)

| File | Purpose | Batch |
|---|---|---|
| `usePractice.ts` | Practice assignment CRUD | 13-practice-resources |
| `usePracticeStreaks.ts` | Streak data | 13-practice-resources |
| `useResources.ts` | Resource library list | 13-practice-resources |
| `useResourceCategories.ts` | Resource category CRUD | 13-practice-resources |
| `useUpdateResource.ts` | Resource update mutation | 13-practice-resources |

### 9.15 Reports (3)

| File | Purpose | Batch |
|---|---|---|
| `useReports.ts` | Common report fetch | 10-reports-analytics-payroll |
| `usePayroll.ts` | Payroll calc (PI-01 lives here) | 10-reports-analytics-payroll |
| `useTeacherPerformance.ts` | Teacher performance report | 10-reports-analytics-payroll |

### 9.16 UI / device / utility (15)

| File | Purpose | Batch |
|---|---|---|
| `use-media-query.ts` | Media query hook | 19-cross-cutting |
| `use-mobile.tsx` | Mobile breakpoint | 19-cross-cutting |
| `use-toast.ts` | Toast manager | 19-cross-cutting |
| `useAndroidBackButton.ts` | Android hardware back-button | 19-cross-cutting |
| `useIOSKeyboardHeight.ts` | iOS keyboard avoidance | 19-cross-cutting |
| `useOnlineStatus.ts` | Online/offline detection | 19-cross-cutting |
| `useKeyboardShortcuts.ts` | Cmd palette + shortcuts | 19-cross-cutting |
| `useSortableTable.ts` | Generic sortable table | 19-cross-cutting |
| `usePageMeta.ts` | Document title / meta tags | 19-cross-cutting |
| `useBannerDismissals.ts` | Dismissed banner state | 19-cross-cutting |
| `useContextualHints.ts` | Contextual hints overlay | 19-cross-cutting |
| `useProactiveAlerts.ts` | Proactive alert composition | 18-settings-tabs |
| `useUrgentActions.ts` | Urgent action surfacing | 18-settings-tabs |
| `useTeacherDashboard.ts` | Teacher dashboard composition | 03-calendar-core |
| `useDeleteValidation.ts` | Pre-delete safety check | 19-cross-cutting |
| `useDataExport.ts` | Generic data export | 19-cross-cutting |
| `useGDPR.ts` | GDPR export/delete flow | 01-auth-sessions-rls |
| `useAuditLog.ts` | Audit log read | 18-settings-tabs |
| `useInstruments.ts` | Instrument list | 02-org-management |
| `usePrimaryInstruments.ts` | Primary instruments | 02-org-management |

### 9.17 Hook count

8 onboarding + 5 auth/org + 16 calendar/lessons + 9 students + 7 attendance/credits + 16 invoicing + 6 stripe + 4 subscription + 5 leads/bookings + 3 term + 8 messages + 8 portal + 2 loopassist + 5 practice/resources + 3 reports + 18 UI/util = **123** ✓ (one or two crossover items counted in primary section).

---

## 10. Source counts (verification)

| Source | Count | Hard-count target |
|---|---|---|
| Routes | 90 | n/a |
| Pages | 89 | n/a |
| Edge functions | **105** | **105 (v27 baseline)** ✓ |
| DB RPCs (full rows) | ~85 (sum of §4.1–§4.14) | n/a |
| DB triggers | 124 | n/a |
| DB trigger-target functions (distinct) | 53 | n/a |
| DB helper functions (compact groups) | 6 groups covering ~45 helper functions | n/a |
| Cron jobs | 26 | n/a |
| Settings tabs (live) | **21** | **24 per V2 plan §5 PR3 — pre-IA-pass; live IA collapsed 3 into sub-components** |
| Hooks | **123** | n/a |
| **Batches covered** | **21** | **21** ✓ (batch 21-marketing-surface added in s39) |

---

## 11. Batch Assignment Index

### 11.A — Per-batch summary

Each row shows the count of CENSUS entries from each of the 8 source sections, plus a Journeys column for batch 20 (added in s39). Batch 21-marketing-surface is also new in s39; it absorbs every marketing route and marketing page.

| # | Batch | Routes | Pages | Edge fns | RPCs | Triggers | Cron | Settings | Hooks | Journeys |
|---|---|---|---|---|---|---|---|---|---|---|
| 01 | auth-sessions-rls | 9 | 8 | 6 | 4 | 0 | 0 | 0 | 1 | — |
| 02 | org-management | 6 | 6 | 4 | 6 | 8 | 0 | 0 | 13 | — |
| 03 | calendar-core | 2 | 2 | 0 | 7 | 6 | 0 | 0 | 11 | — |
| 04 | lessons-scheduling-deep | 1 | 1 | 0 | 3 | 0 | 0 | 0 | 5 | — |
| 05 | billing-invoicing | 4 | 4 | 9 | 13 | 8 | 4 | 0 | 12 | — |
| 06 | payments-stripe-connect | 0 | 0 | 20 | 8 | 5 | 2 | 0 | 9 | — |
| 07 | payment-plans-installments | 0 | 0 | 3 | 5 | 3 | 3 | 0 | 1 | — |
| 08 | attendance-credits-waitlists | 3 | 3 | 6 | 10 | 9 | 3 | 0 | 6 | — |
| 09 | term-continuation | 2 | 1 | 4 | 4 | 1 | 0 | 0 | 4 | — |
| 10 | reports-analytics-payroll | 9 | 9 | 0 | 2 | 0 | 0 | 0 | 5 | — |
| 11 | parent-portal | 8 | 8 | 2 | 3 | 0 | 0 | 0 | 10 | — |
| 12 | messages-notifications | 1 | 1 | 10 | 1 | 0 | 1 | 0 | 9 | — |
| 13 | practice-resources | 2 | 2 | 2 | 2 | 2 | 3 | 0 | 5 | — |
| 14 | bookings-leads-enrolment | 4 | 4 | 4 | 5 | 0 | 1 | 0 | 5 | — |
| 15 | calendar-sync-zoom-xero | 1 | 1 | 16 | 3 | 0 | 2 | 0 | 4 | — |
| 16 | subscription-tiers | 0 | 0 | 6 | 0 | 11 | 5 | 0 | 4 | — |
| 17 | loopassist | 0 | 0 | 4 | 0 | 2 | 0 | 0 | 3 | — |
| 18 | settings-tabs | 2 | 2 | 0 | 0 | 0 | 0 | 21 | 4 | — |
| 19 | cross-cutting | 0 | 0 | 9 | 7 | ~64 | 2 | 0 | 13 | — |
| 20 | ux-flows | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **13** |
| 21 | marketing-surface | 36 | 37 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| | **Total** | **90** | **89** | **105** | ~83 | ~119 | **26** | **21** | ~119 | **13** |

Verified column sums (hard counts): Routes = 90 ✓, Pages = 89 ✓, Edge fns = **105** ✓ (v27 baseline), Cron = 26 ✓, Settings = 21 ✓.

RPC / Trigger / Hook columns carry approximate sums (~) because §4 groups full-row RPCs while §6 buckets helpers compactly, and a handful of hooks straddle a category boundary. Every individual entry has exactly one batch assignment.

### 11.B — Journeys (batch 20)

Each row is a single cohesion-level audit unit. The journey traverses surfaces from other batches; the audit dimension is end-to-end coherence, not the individual surfaces (those are audited in their primary batch).

| ID | Journey | Traverses batches |
|---|---|---|
| J01 | New-org sign-up → onboarding → first lesson scheduled | 01, 02, 03 |
| J02 | First invoice created → sent → paid (Stripe + manual paths) | 05, 06, 12 |
| J03 | Recurring billing run end-to-end → email delivered → payment recorded | 05, 06, 12 |
| J04 | Student absence → make-up credit issued → redeemed | 08, 12, 03 |
| J05 | Term-continuation prompt → parent responds → next term lessons created | 09, 11, 03 |
| J06 | Withdrawal (term adjustment) → credit note → recurrence cap → notification | 09, 05, 08, 12 |
| J07 | Day-change (term adjustment) → new recurrence series → invoice update | 09, 03, 05 |
| J08 | Parent portal login → invoice view → payment → receipt | 01, 11, 06, 12 |
| J09 | Teacher onboarding → availability → first lesson taught → attendance → payroll | 02, 03, 08, 10 |
| J10 | LoopAssist drawer open → query → proposal → confirm → execute (shelved; documented for Phase F) | 17 |
| J11 | Public booking page → lead created → enrolment offer → accept → first lesson scheduled | 14, 02, 03, 12 |
| J12 | Make-up waitlist join → match found → offer sent → accept → slot booked | 08, 12 |
| J13 | Stripe webhook event (payment_intent.succeeded) → invoice paid → receipt → bookkeeping cascade | 06, 05, 12 |

Additional Phase D journeys may be appended; J01–J13 is the s39 seed list.

### 11.C — Batch 19 trigger inventory (per Jamie's instruction to list and confirm)

Total triggers assigned to batch 19-cross-cutting: **~64**. All are true cross-cutting infrastructure per the policy definition (calling shared functions, table-agnostic in semantics, no feature-specific logic). Listing by family:

**Audit-log triggers calling `log_audit_event_singular` (25):**
`audit_lessons`, `audit_lesson_participants`, `audit_invoices`, `audit_invoice_items`, `audit_invoice_installments`, `audit_payments`, `audit_refunds`, `audit_guardian_payment_preferences`, `audit_students`, `audit_guardians`, `audit_student_guardians`, `audit_teachers_changes`, `audit_teacher_profiles`, `audit_org_memberships`, `audit_terms`, `audit_term_adjustments`, `audit_term_continuation_responses`, `audit_make_up_credits`, `audit_make_up_waitlist`, `audit_internal_messages`, `audit_billing_runs`, `audit_recurring_invoice_templates`, `audit_recurring_template_items`, `audit_recurring_template_recipients`, `audit_rate_cards`.

**Audit-log triggers calling feature-specific log functions (2):**
`audit_profile_changes` (calls `log_profile_change`), `trg_audit_attendance` (calls `audit_attendance_changes`). Borderline cases; both are audit-shaped and Jamie's instruction explicitly accepts `audit_*` as cross-cutting, so they stay in 19.

**Touch-only updated-at triggers calling `update_updated_at_column` or equivalent (28):**
`update_lessons_updated_at`, `update_invoices_updated_at`, `set_updated_at` (invoice_installments), `update_payments_updated_at`, `update_students_updated_at`, `update_guardians_updated_at`, `update_student_instruments_updated_at`, `update_teachers_updated_at`, `update_teacher_profiles_updated_at`, `update_profiles_updated_at`, `update_locations_updated_at`, `update_rooms_updated_at`, `set_term_adjustments_updated_at`, `set_tcr_response_updated_at`, `set_tcr_updated_at`, `update_make_up_credits_updated_at`, `set_make_up_waitlist_updated_at`, `update_message_requests_updated_at`, `update_message_templates_updated_at`, `update_notification_preferences_updated_at`, `update_org_messaging_settings_updated_at`, `update_rate_cards_updated_at`, `set_enrolment_waitlist_updated_at`, `update_booking_pages_updated_at`, `update_leads_updated_at`, `update_calendar_connections_updated_at`, `update_resources_updated_at`, `update_practice_assignments_updated_at`.

**Cross-tenant guards calling `prevent_org_id_change` (8):**
On `lessons`, `lesson_notes`, `invoices`, `payments`, `students`, `guardians`, `teachers`, `org_memberships`.

**Other org-config integrity (1):**
`validate_org_timezone_currency` on `organisations`.

**Acceptance:** all batch-19 trigger assignments are confirmed correct per Jamie's policy (cross-cutting triggers using shared functions stay in 19; the trigger DEFINITION's table is feature-specific but the trigger's logic is infrastructure). No reassignments required.

The `payment_disputes_touch_updated_at` trigger uses a feature-specific function (`payment_disputes_touch_updated_at`) but does the same thing as `update_updated_at_column`. Currently assigned to 06-payments-stripe-connect because the function name is feature-specific; Phase B can move it to 19 if Jamie prefers consistency.

### 11.D — Batch 04 (lessons-scheduling-deep) lightness confirmation

Batch 04 is genuinely light (10 entries) because most lesson surface is shared with batch 03. Explicit list of what's in 04 vs 03:

**In batch 04:**
- `/notes` route (page-level surface for lesson notes browsing).
- `NotesExplorer.tsx` page.
- `bulk_cancel_lessons`, `bulk_update_lessons` RPCs (bulk operations).
- `get_lesson_notes_for_staff` RPC (notes shared/private filter logic).
- Hooks: `useBulkLessonActions`, `useLessonNotes`, `useNotesExplorer`, `usePreviousLessonNotes`, `useStudentQuickNotes`.

**In batch 03 (referenced by 04 but audited there):**
- All lesson modal / detail panel components (`LessonModal`, `LessonDetailPanel`, `LessonDetailSidePanel`, `LessonCard`, `MobileLessonSheet`, `QuickCreatePopover`) — V2 plan §1.5 item 6 counts these as 6 components, all surfaced from `CalendarPage`.
- `check_lesson_conflicts` trigger (all 7 conflict checks).
- `lesson_participants` table machinery (group lessons are participants on a shared lesson; no separate "group lesson" file).
- Online lessons (`is_online` field on lessons table; Zoom integration in batch 15).
- Calendar filters (filter UI lives in `CalendarPage` and its child view components).

**Conclusion:** batch 04 covers the deltas (notes machinery, bulk machinery) on top of batch 03's lesson surface. Group lessons and online lessons are not separate files in the codebase; they're modes of the same lesson surface. No reassignment required. Phase B batch 04 will dereference into batch 03's lesson UI when auditing group-lesson and online-lesson flows specifically.

### 11.E — Notes on the index

- Every census entry has exactly one batch assignment. Approximate column sums are an artefact of compact helper grouping (§4 / §6), not of unassigned entries.
- Marketing routes (§1.6): 36 total → batch 21 (14 top-level + 11 feature + 5 compare + 5 for + 1 LoopAssist redirect). Root `/` and NotFound `*` → batch 01.
- Marketing pages (§2.7): all 37 → batch 21.
- Settings tabs all carry batch 18 (the IA / surface audit); the underlying feature each tab drives is audited separately under its functional batch via the relevant page / edge fn / RPC entries.
- Batch 20-ux-flows holds 13 journey-level audit rows (§11.B). No code artefacts assigned here.
- No batch sits at zero across ALL sources. Heaviest buckets:
  - **05 billing** (~54 entries across all columns).
  - **06 payments** (~51 entries, dominated by 20 edge fns).
  - **19 cross-cutting** (~95 entries, dominated by ~64 boilerplate triggers).
  - **21 marketing** (~73 entries: 36 routes + 37 pages).
  - **02 org-management** (~37 entries: routes, pages, hooks, triggers).
- Lightest non-empty batches: **04 lessons-scheduling-deep** (10 — light by design, see §11.D), **07 payment-plans-installments** (15 — most installment surface piggybacks on batch 05's invoice UI), **17 loopassist** (~9 — shelved per PLAN.md §3 rule 3).

---

## 12. Hibernate list

**Hibernate list: empty. Every feature in scope.**

Per Jamie's s39 decision in the prompt §7 (scope) and reaffirmed in the V2 plan §3 (revised 2026-05-10, s24 stance recalibration): no features are hibernated for Path Y. Even features marked "hide behind feature flag" in V2 plan §3.2 (only Zoom remains for v1) are still in scope for audit; their flag status affects launch visibility, not whether Phase B reviews them.

LoopAssist (batch 17) is **shelved** for Phase B (per PLAN.md §3 rule 3 — surfaces in Phase F only) but not hibernated; batch 17 records state on entry, does not deepen.

---

## 13. Source pointers

- Live route source: [`src/config/routes.ts`](../../src/config/routes.ts)
- Settings nav source: [`src/components/settings/SettingsNav.tsx`](../../src/components/settings/SettingsNav.tsx)
- Edge function dirs: `supabase/functions/`
- DB schema queries used: `pg_proc`, `pg_trigger`, `cron.job` (read-only via Supabase MCP, session s39)
- V2 plan: [`LESSONLOOP_V2_PLAN.md`](../../LESSONLOOP_V2_PLAN.md)
