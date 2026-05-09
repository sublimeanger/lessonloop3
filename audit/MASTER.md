# LessonLoop production-readiness — MASTER tracker

**Last updated:** 2026-05-09 (after 7th-session — §22 Settings launch-visible mutations + §27 prefs/dedup + JWT-injection fixture)
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

- **Total rows:** 180
- **State:** 14 🟢 verified / 150 🟡 structurally-verified-pending-browser / 6 🔴 launch-blockers / 10 ⏸ deferred-post-launch / **0 ❓ untouched**
- **Last full sweep:** 2026-05-08 (this audit)
- **Findings produced:** 16 in `audit/findings/`

## Known launch blockers (tracked separately in `audit/00-launch-readiness.md`)

- Google OAuth verification (consent screen) — **2-6 week lead time**; user-buttons hidden behind env flag
- Source Supabase decommission
- Apple OAuth provider config
- Cookie consent banner
- Anthropic sub-processor disclosure
- Stripe Checkout branding
- Cloudflare proxy decision for `app.lessonloop.net` (currently bypasses CF — see findings/2026-05-08-cloudflare-app-subdomain-not-proxied)
- Edge fn Sentry instrumentation (0 functions instrumented — see Sentry edge-fn row)
- Stripe Checkout branding

## Auth & Onboarding

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Email signup → onboarding wizard end-to-end | src/pages/Signup.tsx → onboarding-setup → complete_onboarding RPC | P0 | 🟡 | 2026-05-08 | Code path clean: form validation incl 8-char/strength≥2 password, duplicate-email obfuscation handled, AbortController 30s timeout, idempotency check, complete_onboarding RPC verified end-to-end via service_role. Resend SMTP configured (smtp.resend.com → noreply@lessonloop.net). AuthContext async-callback hang fixed (62a9282). 🟡 awaits browser-confirmed first real customer signup. |
| Email + password sign-in | src/pages/Login.tsx | P0 | 🟡 | 2026-05-08 | Code path clean (account-enum mitigation, validation, AuthContext fix landed). 2 security gaps filed: weak password policy (6-char min, no chars) + CAPTCHA disabled. See audit/findings/2026-05-08-supabase-{password-policy-too-weak,captcha-disabled}.md |
| Google OAuth | src/pages/Login.tsx → supabase.auth | P0 | ⏸ | 2026-05-08 | UI button hidden via VITE_SOCIAL_AUTH_GOOGLE flag; OAuth client in Google verification (2-6 wk lead). Re-enable + audit when verification approves. |
| Apple OAuth | src/pages/Login.tsx | P0 | ⏸ | 2026-05-08 | UI button hidden via VITE_SOCIAL_AUTH_APPLE flag; provider not configured at dest Supabase. Re-enable post-config. |
| Password reset request | src/pages/ForgotPassword.tsx | P0 | 🟡 | 2026-05-08 | uses `useAuth().resetPassword`; structurally clean; depends on Supabase recovery email template (verified branded HTML); pending E2E |
| Password reset complete | src/pages/ResetPassword.tsx | P0 | 🟡 | 2026-05-08 | onAuthStateChange callback is **synchronous** (not the AuthContext bug pattern); uses `supabase.auth.updateUser({password})`; PasswordStrengthIndicator reads HIBP via api.pwnedpasswords.com (CSP fixed today); 5s timeout fallback present; PASSWORD_MIN_LENGTH=8 matches Supabase policy |
| Email verification | src/pages/VerifyEmail.tsx | P0 | 🟡 | 2026-05-08 | uses `supabase.auth.getUser` + `supabase.auth.resend({type:'signup'})`; structurally clean; pending E2E |
| Onboarding wizard | src/pages/Onboarding.tsx → onboarding-setup → complete_onboarding RPC | P0 | 🟡 | 2026-05-08 | covered by "Email signup → onboarding wizard end-to-end" row above |
| Accept invite (staff/parent) | src/pages/AcceptInvite.tsx → invite-accept fn | P0 | 🟡 | 2026-05-08 | invite-accept fn audit: JWT auth + per-user rate limit + token lookup + 4 guards (not-found / owner-role-blocked / already-accepted / expired) + email-match check (prevents stealing); idempotent guardian/teacher creation; teacher-limit enforcement against organisations.max_teachers; final updates: org_membership upsert → mark accepted → set current_org_id + has_completed_onboarding |
| Profile ensure on first login | supabase/functions/profile-ensure | P0 | 🟢 | 2026-05-08 | JWT auth + per-user rate limit + service-role for admin; race-condition-safe (handles 23505 unique violation from handle_new_user trigger); idempotent (returns existing profile if already created); generic error messages no info leak |
| Account delete (GDPR) | supabase/functions/account-delete | P1 | 🟡 | 2026-05-08 | tight rate limit (2/5min for irreversible); sole-owner check prevents orphaning orgs; cascade order org_memberships → profile → auth.admin.deleteUser; relies on auth.users CASCADE FKs for downstream cleanup; pending throwaway-account E2E |
| GDPR data export | supabase/functions/gdpr-export | P1 | 🟡 | 2026-05-08 | JWT auth + owner/admin gate on current_org_id; user-scoped supabase client (RLS enforced); pulls students/guardians/lessons/invoices/payments to CSV bundle; pending E2E |
| GDPR full delete | supabase/functions/gdpr-delete | P1 | 🟡 | 2026-05-08 | org-side admin-driven anonymise/soft-delete for student/guardian PII; uses RPC `anonymise_guardian` for guardian path; ownership check (entity belongs to org); audit_log entry on every action |

## Dashboard & navigation

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Owner/admin dashboard | src/pages/Dashboard.tsx | P1 | 🟡 | 2026-05-08 | Code path clean: 4 role-specific dashboards (Finance/Teacher/Academy/Solo), parent → portal redirect, proper loading + no-org empty state. RPCs `get_invoice_stats` + `get_revenue_report` confirmed in DB. 5+ parallel useQuery — perf TBD on real load. Awaits browser-confirmed render + Sentry baseline. |
| Marketing root redirect | src/components/shared/AuthRedirect.tsx | P1 | 🟡 | 2026-05-08 | structural; defer to E2E browser test |
| External marketing redirects | src/config/routes.ts (38 paths) | P2 | 🟡 | 2026-05-08 | static redirect map to lessonloop.net; structural ok |
| 404 page | src/pages/NotFound.tsx | P2 | 🟡 | 2026-05-08 | structural |
| Help page | src/pages/Help.tsx | P3 | 🟡 | 2026-05-08 | static content |
| Settings (org config) | src/pages/Settings.tsx | P1 | 🟡 | 2026-05-09 | wide surface; many sub-tabs (org info, calendar, accounting, messaging, billing); each tab uses RLS-scoped queries via dedicated hooks. [E2E real per 4c34bf0]: §22.2 schedule_hours valid+invalid trigger / parent_reschedule_policy 3-value PATCH / §22.20 continuation 3-field atomic / §22.4 invites INSERT / §22.9 music custom-instrument CRUD. All 21 launch-visible per-tab smoke loads pass |

## Calendar & Lessons

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Calendar page (drag-drop) | src/pages/CalendarPage.tsx | P0 | 🟡 | 2026-05-08 | 9 RLS policies on lessons + 9 on lesson_participants. RPCs `bulk_update_lessons`, `bulk_cancel_lessons`, `can_edit_lesson`, `is_lesson_teacher`, `is_assigned_teacher` confirmed. Drag/resize logic complex — awaits browser smoke. |
| Recurring lesson template create | src/pages/RecurringTemplateDetail.tsx | P0 | 🟡 | 2026-05-08 | covered by Calendar RLS; awaits browser test |
| Recurring run detail / exceptions | src/pages/RecurringRunDetail.tsx | P0 | 🟡 | 2026-05-08 | covered by Calendar RLS; awaits browser test |
| Single lesson CRUD | src/pages/CalendarPage.tsx | P0 | 🟡 | 2026-05-08 | covered above |
| Make-up lesson dashboard | src/pages/MakeUpDashboard.tsx | P1 | 🟡 | 2026-05-08 | drives `respond_to_makeup_offer`/`cancel_booked_makeup` RPCs (parent-side) and admin/teacher matching UI. RLS on `make_up_waitlist` properly scoped per parent-portal sweep |
| Make-up offer notification | supabase/functions/notify-makeup-offer | P1 | 🟡 | 2026-05-08 | dual auth (user JWT or service role); structural ok; sends offer email to guardians |
| Make-up match notification | supabase/functions/notify-makeup-match | P1 | 🟡 | 2026-05-08 | service-role-only invoke (`Authorization === Bearer ${serviceRoleKey}`); called by pg_net trigger when match is made; notifies admins |
| Daily register | src/pages/DailyRegister.tsx | P1 | 🟡 | 2026-05-08 | attendance_records: 6 RLS policies (admin r/w/d, finance r, teacher r-assigned). No USING(true). Awaits browser test. |
| Batch attendance | src/pages/BatchAttendance.tsx | P1 | 🟡 | 2026-05-08 | covered above |
| Continuation flow (term rollover) | src/pages/Continuation.tsx + create-continuation-run + bulk-process-continuation | P0 | 🟡 | 2026-05-09 | 1381+453 LoC, mature. create-continuation-run has dual auth: service-role-bearer for cron deadline path, user JWT + owner/admin role check for manual trigger. bulk-process-continuation user JWT + owner/admin (service-role internally for DB ops). [E2E real per 35631ad — §20.4 create happy path + RBAC 403 + validation 400, §20.5 process_deadline both assumed_continuing branches, §20.7 bulk-process confirmed flow extends recurrence + materialises lessons + flips run to completed]. Term-end critical. |
| Continuation respond (parent) | supabase/functions/continuation-respond | P0 | 🟡 | 2026-05-09 | DB-token auth (random `response_token` on `term_continuation_responses` row) — no user JWT required (parent clicks email link); rate-limited by token hash; status guard prevents replay; deadline enforced server-side. [E2E real per a5dec8b §20.1 authed + §20.2 public token + §20.3 invalid token 4xx + 65bde4e fix to verify_jwt=false] |
| Term adjustment processor | supabase/functions/process-term-adjustment | P1 | 🟡 | 2026-05-08 | 969 LoC; JWT auth + role check (owner/admin/finance); structural ok |
| Lesson notes explorer | src/pages/NotesExplorer.tsx | P2 | 🟡 | 2026-05-08 | structural; data via RLS-scoped queries |
| Notes notification | supabase/functions/send-notes-notification | P2 | 🟡 | 2026-05-08 | JWT auth + rate limit; structural ok |

## Students & Guardians

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Students list / CRUD | src/pages/Students.tsx | P0 | 🟡 | 2026-05-08 | 9 RLS policies (admin r/w/d, finance r, teacher r-assigned, parent r-linked, soft-delete + trial-block guard); `get_students_for_org` RPC confirmed. No USING(true) footguns. Awaits browser CRUD test. |
| Student detail | src/pages/StudentDetail.tsx | P0 | 🟡 | 2026-05-08 | covered by Students RLS audit; awaits browser nav |
| CSV import (mapping step) | src/pages/StudentsImport.tsx → csv-import-mapping fn | P1 | 🟡 | 2026-05-08 | Gemini AI column mapping (gemini-flash-latest); GEMINI_API_KEY required; structural ok, fresh test pending |
| CSV import (execute) | supabase/functions/csv-import-execute | P1 | 🟡 | 2026-05-09 | bulk insert into students/teachers/instruments/org_memberships; deterministic (no AI); [E2E real per a482407 — §10.7 5 tests: dry-run validation, execute + undo round-trip, malformed row, CSV duplicates, missing first_name] [PROMOTABLE 🟡→🟢] |
| Guardian batch invite | supabase/functions/batch-invite-guardians | P1 | 🟡 | 2026-05-08 | JWT auth; structural ok; bulk send via Resend |
| Family/guardian linking | src/pages/Students.tsx panels | P1 | 🟡 | 2026-05-08 | direct table queries on `student_guardians` + `guardians` with RLS scope (admin r/w/d); structural ok |
| Streak notification | supabase/functions/streak-notification | P3 | 🟡 | 2026-05-08 | cron-only via `validateCronAuth`; structural ok |

## Teachers & Payroll

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Teachers list / CRUD | src/pages/Teachers.tsx | P0 | 🟡 | 2026-05-08 | 6 RLS policies (admin r/w/d, finance r). No USING(true). Smoke 200. Awaits browser CRUD test. |
| Locations | src/pages/Locations.tsx | P1 | 🟡 | 2026-05-08 | direct table queries (`locations`, `rooms`, `closure_dates`); every mutation scoped with `.eq('org_id', currentOrg.id)` belt+RLS-suspenders pattern; structural ok |
| Payroll report | src/pages/reports/Payroll.tsx | P1 | 🟡 | 2026-05-08 | uses React Query hook in `useReports.ts`; data via RLS-scoped table queries with org_id filter; structural ok |
| Teacher performance report | src/pages/reports/TeacherPerformance.tsx | P2 | 🟡 | 2026-05-08 | uses React Query hook in `useReports.ts`; data via RLS-scoped table queries with org_id filter; structural ok |

## Invoicing & Payments

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Invoices list | src/pages/Invoices.tsx | P0 | 🟡 | 2026-05-09 | invoices: 6 RLS policies (admin/finance r, parent-via-guardian r). No USING(true). [E2E real per d7bc927 §13 — 10 tests covering filter/status/role-gate]. |
| Invoice detail / line edit | src/pages/InvoiceDetail.tsx | P0 | 🟡 | 2026-05-09 | invoice_items: 5 RLS policies. CHECK constraints on prices/amounts/quantities. [E2E real per d7bc927 §14 — 12 tests covering line items / status transitions / patch trigger / send-invoice-email round-trip]. |
| Invoice PDF generation | supabase/functions/generate-invoice-pdf | P0 | 🟡 | 2026-05-08 | service-role-only fn (verify_jwt=false post-Phase-5); caches in invoice-pdfs bucket; signed URL response or inline base64. End-to-end render not yet exercised on dest. |
| Send invoice email (parent) | supabase/functions/send-invoice-email | P0 | 🟡 | 2026-05-08 | User JWT + rate limit + Resend SMTP (smtp.resend.com → noreply@lessonloop.net configured). Awaits real send test. |
| Send invoice email (internal copy) | supabase/functions/send-invoice-email-internal | P1 | 🟡 | 2026-05-08 | service-role-only (Phase 5 reconfigured); Awaits browser-driven test |
| Stripe checkout (one-off invoice payment) | supabase/functions/stripe-create-checkout | P0 | 🟡 | 2026-05-08 | User JWT + rate-limit + invoiceId required. Confirmed via 6.A.2 browser test on subscription path; one-off-invoice path still untested. Branding gap noted in 00-launch-readiness. |
| Stripe payment intent (custom) | supabase/functions/stripe-create-payment-intent | P0 | 🟡 | 2026-05-08 | JWT auth + rate limit; standard Stripe@14.21 client; structural ok |
| Stripe customer portal | supabase/functions/stripe-customer-portal | P1 | 🟡 | 2026-05-08 | JWT auth + membership check before creating portal session; structural ok |
| Stripe webhook (events) | supabase/functions/stripe-webhook | P0 | 🟡 | 2026-05-09 | constructEventAsync fix verified (baa072c); two-phase dedup; 90s stale threshold. [E2E real per 499d54b §24.12 true-replay 2 tests — HMAC-SHA256 sign synthetic Stripe events, prove webhook-layer + RPC-layer dedup]. Live endpoint we_1TUlSHAzPfYm94ux4mOfF72i now subscribed to 18-event superset (was 6). |
| Stripe verify session | supabase/functions/stripe-verify-session | P0 | 🟡 | 2026-05-08 | JWT auth + invoice org_id ownership check; post-checkout return; structural ok |
| List payment methods | supabase/functions/stripe-list-payment-methods | P1 | 🟡 | 2026-05-08 | JWT auth + guardian/org scoped lookup; structural ok |
| Detach payment method | supabase/functions/stripe-detach-payment-method | P1 | 🟡 | 2026-05-08 | JWT auth + guardian-scoped lookup + Stripe-side pm.customer match check (prevents cross-customer detach); auto-clears default_payment_method_id on self-detach |
| Update auto-pay preferences | supabase/functions/stripe-update-payment-preferences | P0 | 🟡 | 2026-05-08 | JWT auth + user_id/org_id scoped guardian lookup; structural ok |
| Backfill default PM (admin) | supabase/functions/admin-backfill-default-pm | P2 | 🟡 | 2026-05-08 | cron-auth via x-cron-secret (operator-triggered, not scheduled); RPC `backfill_guardian_default_pm_set` with idempotency check at write time |
| Process refund | supabase/functions/stripe-process-refund | P0 | 🟡 | 2026-05-08 | JWT auth + rate limit; structural ok; pending E2E refund test |
| Refund notification | supabase/functions/send-refund-notification | P1 | 🟡 | 2026-05-08 | service-role-only invoke (`Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` exact match); RESEND_API_KEY required |
| Receipt email | supabase/functions/send-payment-receipt | P1 | 🟡 | 2026-05-09 | service-role-only via `.includes(serviceKey)` (slightly weaker than `===` but still gated); RESEND_API_KEY required; called from stripe-webhook payment_intent.succeeded handler. [E2E real per 1fca3c2]: §27 RBAC auth gate (anon→401, no-auth→401), §27.2 prefs-honoring DB-shape (upsert+SELECT round-trip + absent-row default-on), §27 dedup unique partial idx_message_log_payment_receipt_dedup. Live fn-invocation with prefs=false deferred — service-role key in .env.test drifted post-2026-05-08 migration |
| Auto-pay run (installment) | supabase/functions/stripe-auto-pay-installment | P0 | 🟡 | 2026-05-08 | cron-auth via x-cron-secret; daily 09:00 UTC; verified firing in cron sweep |
| Auto-pay alert | supabase/functions/send-auto-pay-alert | P1 | 🟡 | 2026-05-08 | service-role-only invoke; 6h dedup keyed on org_id via message_log; RESEND_API_KEY required |
| Auto-pay failure notification | supabase/functions/send-auto-pay-failure-notification | P0 | 🟡 | 2026-05-08 | service-role-only invoke; structural ok |
| Dispute notification | supabase/functions/send-dispute-notification | P1 | 🟡 | 2026-05-08 | service-role-only invoke; called from stripe-webhook charge.dispute.* handlers |
| Recurring billing run create | supabase/functions/create-billing-run | P0 | 🟡 | 2026-05-08 | 1048 lines, mature. User JWT + role check (owner/admin/finance) + rate limit. ISO-date + run_type enum validation (BIL-H1 / BIL-L3 fixes). billing_runs RLS: 4 policies. End-to-end run not yet exercised on dest. |
| Recurring billing alert | supabase/functions/send-recurring-billing-alert | P1 | 🟡 | 2026-05-08 | service-role-only invoke; structural ok |

## Subscriptions & Trial

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Tier/subscription checkout | supabase/functions/stripe-subscription-checkout | P0 | 🟡 | 2026-05-08 | JWT auth + membership check; self-serve upgrade; structural ok |
| Billing history | supabase/functions/stripe-billing-history | P1 | 🟡 | 2026-05-08 | JWT auth + membership check; structural ok |
| Stripe Connect onboard | supabase/functions/stripe-connect-onboard | P1 | 🟡 | 2026-05-08 | JWT auth + membership check; per-org Connect flow; structural ok |
| Stripe Connect status check | supabase/functions/stripe-connect-status | P1 | 🟡 | 2026-05-08 | JWT auth + membership check; structural ok |
| Trial banner / countdown | cross-cutting in app shell | P1 | 🟡 | 2026-05-08 | UI-only React component reading `subscription_status` + `trial_ends_at` from current org; structural ok |
| Tier-gated feature access | cross-cutting helpers | P0 | 🟡 | 2026-05-08 | LoopAssist tier routing verified in sweep 16-17 (Sonnet for academy/agency/custom, Haiku for free/solo); other tier gates UI-only, defer to browser test |

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
| Messages inbox (staff) | src/pages/Messages.tsx | P1 | 🟡 | 2026-05-09 | structural; data via RLS-scoped queries; basic page-load smoke covered |
| Send single message | supabase/functions/send-message | P0 | 🟡 | 2026-05-09 | JWT auth + rate limit; [E2E real per da619ca — §16.3 5 tests: happy path with DB-resolved recipient, missing-fields 400 (was 500 — fix landed), oversized 400, parent JWT 403, cross-org 403]. See finding 2026-05-09-send-message-missing-fields-500.md. [PROMOTABLE 🟡→🟢] |
| Send bulk message | supabase/functions/send-bulk-message | P0 | 🟡 | 2026-05-08 | JWT auth + rate limit + batching; structural ok |
| Send parent message | supabase/functions/send-parent-message | P1 | 🟡 | 2026-05-08 | JWT auth + rate limit; structural ok |
| Send parent enquiry (public form) | supabase/functions/send-parent-enquiry | P1 | 🟡 | 2026-05-08 | JWT auth + rate limit (public form auth via Bearer token from Supabase anon role); structural ok |
| Send contact message (marketing) | supabase/functions/send-contact-message | P2 | 🟡 | 2026-05-08 | public endpoint with honeypot field (`website`) + IP rate limit (5/hr); structural ok |
| Internal message notify | supabase/functions/notify-internal-message | P1 | 🟡 | 2026-05-08 | JWT auth; structural ok |
| Mark messages read | supabase/functions/mark-messages-read | P2 | 🟡 | 2026-05-08 | JWT auth + rate limit; structural ok |
| Push notification | supabase/functions/send-push | P2 | ⏸ | — | post-launch |

## Leads / Booking / Waitlist

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Leads list | src/pages/Leads.tsx | P1 | 🟡 | 2026-05-08 | structural; data flows through standard RLS-scoped queries |
| Lead detail | src/pages/LeadDetail.tsx | P1 | 🟡 | 2026-05-08 | structural |
| Public booking page | src/pages/public/BookingPage.tsx | P1 | 🟡 | 2026-05-08 | /book/:slug, fetches via booking-get-slots, submits via booking-submit |
| Booking get slots | supabase/functions/booking-get-slots | P1 | 🟡 | 2026-05-08 | public endpoint with IP rate limit (20 req/min); service-role to bypass RLS for `booking_pages.enabled=true` lookup; structural ok |
| Booking submit | supabase/functions/booking-submit | P1 | 🟡 | 2026-05-08 | public endpoint with IP rate limit (5/hr); slot validation + UUID/teacher_ref resolution; required-fields check (name, email); structural ok |
| Enrolment waitlist | src/pages/EnrolmentWaitlistPage.tsx | P1 | 🟡 | 2026-05-08 | UI for staff to manage `enrolment_waitlist` rows; standard RLS-scoped |
| Send enrolment offer | supabase/functions/send-enrolment-offer | P1 | 🟡 | 2026-05-08 | JWT auth; structural ok |
| Waitlist respond | supabase/functions/waitlist-respond | P1 | 🟡 | 2026-05-08 | JWT-tokenised public endpoint (signed with `WAITLIST_JWT_SECRET` via jose@5.2); HTML response page (no JSON); parent clicks email link; status guard prevents replay |
| Send cancellation notification | supabase/functions/send-cancellation-notification | P1 | 🟡 | 2026-05-08 | JWT auth; structural ok |
| Send invite email (staff/parent) | supabase/functions/send-invite-email | P0 | 🟡 | 2026-05-08 | JWT auth; account-creation path; calls Resend with branded template |
| Invite get (token lookup) | supabase/functions/invite-get | P0 | 🟡 | 2026-05-08 | public endpoint reading token from request body; returns invite metadata for AcceptInvite UI; structural ok |
| Invite accept | supabase/functions/invite-accept | P0 | 🟡 | 2026-05-08 | (same as auth-ancillaries entry above) JWT + token validation + email-match check + role allowlist + idempotent guardian/teacher creation |

## Practice & Resources

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Practice tracker (staff) | src/pages/Practice.tsx | P2 | 🟡 | 2026-05-09 | RLS verified: `practice_logs` Staff INSERT uses `is_org_staff(auth.uid(), org_id)`. [E2E real per ec94ee3 §17.4 streak milestone audit_log + f7ee87d §17.5.5 reset_stale_streaks cron + §17.5.6 complete_expired_assignments cron via service-role RPC] |
| Resources library | src/pages/Resources.tsx | P2 | 🟡 | 2026-05-08 | Storage bucket `teaching-resources` confirmed `public=false`, 50MB cap, broad mime allowlist, RLS: staff INSERT/DELETE/SELECT scoped to own org via `org_memberships`; parents SELECT via `resource_shares` + `is_parent_of_student`. See cross-cutting Storage row |

## Reports

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Reports index | src/pages/Reports.tsx | P2 | 🟡 | 2026-05-08 | navigation hub; structural |
| Revenue | src/pages/reports/Revenue.tsx | P1 | 🟡 | 2026-05-09 | uses `get_revenue_report` SECURITY DEFINER RPC; pinned to current_org_id; [E2E data-correctness real per 3095a15 — paid invoice → current-month bucket label visible] |
| Outstanding | src/pages/reports/Outstanding.tsx | P1 | 🟡 | 2026-05-09 | uses RLS-scoped invoices query in `useReports.ts`; org_id filter belt+RLS; [E2E data-correctness real per 6205880 — sent invoice → "Current (0-7 days)" bucket invoice_number visible] [PROMOTABLE 🟡→🟢] |
| Lessons delivered | src/pages/reports/LessonsDelivered.tsx | P2 | 🟡 | 2026-05-09 | direct lessons table query, org_id-scoped + teacher-role auto-filter via `resolveTeacherId`; 10k limit per query with warning banner; [E2E data-correctness real per 3095a15 — completed lesson → owner teacher row visible] |
| Cancellations | src/pages/reports/Cancellations.tsx | P2 | 🟡 | 2026-05-09 | RLS-scoped lessons query; [E2E data-correctness real per 3095a15 — cancelled lesson + attendance with unique reason → reason text visible in byReason breakdown] |
| Utilisation | src/pages/reports/Utilisation.tsx | P2 | 🟡 | 2026-05-08 | RLS-scoped lessons + rooms + locations query; data-correctness E2E deferred to session 7 (needs room capacity + closure_dates seeds) |
| Attendance report | src/pages/reports/AttendanceReport.tsx | P2 | 🟡 | 2026-05-09 | RLS-scoped attendance_records query; [E2E data-correctness real per 3095a15 — present attendance + unique-named student → name visible in per-student aggregation] |

## Parent portal

| Feature | Source | Criticality | State | Last audited | Notes |
|---|---|---|---|---|---|
| Portal home | src/pages/portal/PortalHome.tsx | P1 | 🟡 | 2026-05-09 | drives `respond_to_makeup_offer` + `cancel_booked_makeup` RPCs — both SECURITY DEFINER + auth.uid() + guardian-belongs-to-org + waitlist-belongs-to-guardian + status guards + audit_log entries. [E2E real per a5dec8b §26.4 makeup respond + acc6015 §26.6 schedule] [PROMOTABLE 🟡→🟢] |
| Portal schedule | src/pages/portal/PortalSchedule.tsx | P1 | 🟡 | 2026-05-09 | data via React Query hooks; RLS handles via parent ↔ student linkage; [E2E real per acc6015 — §26.6 8 tests: grouping, past collapsible, all 3 reschedule policies, GCal URL, ICS download, calendar-ical-feed VEVENT] [PROMOTABLE 🟡→🟢] |
| Portal practice | src/pages/portal/PortalPractice.tsx | P2 | 🟡 | 2026-05-09 | RLS verified: `practice_logs` Parent INSERT `WITH CHECK is_parent_of_student(auth.uid(), student_id)` — parents cannot create logs for unrelated students. SELECT/DELETE same guard. [E2E real per ec94ee3 §17.4 streak milestone audit_log + 26-parent-portal §26.7 practice_logs trigger] [PROMOTABLE 🟡→🟢] |
| Portal resources | src/pages/portal/PortalResources.tsx | P2 | 🟡 | 2026-05-08 | bucket `teaching-resources` confirmed `public=false`; access via signed URLs; structural ok |
| Portal invoices & pay | src/pages/portal/PortalInvoices.tsx | P0 | 🟡 | 2026-05-09 | RLS `Parent can view own invoices` uses `is_invoice_payer(auth.uid(), id)` — checks both `payer_guardian_id` direct + `payer_student_id → student_guardians → guardians.user_id` indirect. [E2E real per 39c11d9 §26.9 3 tests: pay full invoice end-to-end via stripe-create-payment-intent + UI smoke for PaymentDrawer + status filter + PDF download. Currency-error boundary regression test (production bug dbe1a51) also covered] [PROMOTABLE 🟡→🟢] |
| Portal messages | src/pages/portal/PortalMessages.tsx | P1 | 🟡 | 2026-05-09 | data via hooks; RLS handles; [E2E real per 0f91088 §26.10 compose 5 tests + 10ca3ad §26.10 reply 3 tests + happy path / 404 / cross-tenant 403] [PROMOTABLE 🟡→🟢] |
| Portal profile | src/pages/portal/PortalProfile.tsx | P2 | 🟡 | 2026-05-09 | reads/writes `notification_preferences`, `guardians`, `profiles`; `guardians` Parent UPDATE `user_id = auth.uid()`; [E2E real per 10ca3ad §26.11 — toggle switch + Save → notification_preferences upsert via service-role select pattern] [PROMOTABLE 🟡→🟢] |
| Portal continuation | src/pages/portal/PortalContinuation.tsx | P0 | 🟡 | 2026-05-09 | invokes `continuation-respond` edge fn with tokenised payload; [E2E real per a5dec8b §26.12 + 65bde4e fix for verify_jwt=false + §26.13 anonymous happy path] |
| Public continuation respond | /respond/continuation route | P0 | 🟡 | 2026-05-09 | tokenised URL no-auth path; [E2E real per a5dec8b §26.13 anonymous flow — verifies the 65bde4e fix didn't regress] |

## Cron / lifecycle jobs

| Cron | Source fn | Schedule | Criticality | State | Last verified |
|---|---|---|---|---|---|
| Trial reminder 7-day | trial-reminder-7day | daily 08:15 UTC | P1 | 🟢 | 2026-05-08 — registered in pg_cron via migration `20260508130000`. Was MISSING; see findings/2026-05-08-eight-edge-fns-never-registered-as-crons |
| Trial reminder 3-day | trial-reminder-3day | daily 08:20 UTC | P1 | 🟢 | 2026-05-08 — registered (was missing) |
| Trial reminder 1-day | trial-reminder-1day | daily 08:25 UTC | P1 | 🟢 | 2026-05-08 — registered (was missing) |
| Trial expired | trial-expired | daily 07:00 UTC | P0 | 🟢 | 2026-05-08 — registered (was missing — silent revenue leak fixed) |
| Trial winback | trial-winback | weekly Mon 10:00 UTC | P2 | 🟢 | 2026-05-08 — registered (was missing) |
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
| iCal expiry reminder | ical-expiry-reminder | daily 07:15 UTC | P2 | 🟢 | 2026-05-08 — registered (was missing) |
| Enrolment offer expiry | enrolment-offer-expiry | hourly :05 | P1 | 🟢 | 2026-05-08 — registered (was missing — offers now auto-expire) |
| Waitlist expiry | waitlist-expiry | daily 04:30 UTC | P1 | 🟢 | 2026-05-08 — registered (was missing — make-up offers now auto-expire) |
| Cleanup orphaned resources | cleanup-orphaned-resources | daily 03:00 UTC | P2 | 🟡 | 2026-05-08 fired ok |
| Cleanup webhook retention | cleanup-webhook-retention | daily 03:30 UTC | P2 | 🟡 | 2026-05-08 fired ok |
| Cleanup invoice PDF orphans | cleanup-invoice-pdf-orphans | daily 03:45 UTC | P2 | 🟡 | 2026-05-08 fired ok |
| Cron health watchdog | cron-health-watchdog | daily 09:30 UTC | P0 | 🟢 | 2026-05-08 — fixed 3-bug chain in `check_cron_health()`; was 500'ing every run since deployment. Class A working; Class B no-op (separate finding) |
| Complete expired assignments (SQL fn) | complete_expired_assignments | daily 04:00 UTC | P1 | 🟡 | 2026-05-09 fired ok; [E2E real per f7ee87d §17.5.6 — RPC behaviour proven on expired vs future-dated + NULL end_date seeds] |
| Reset stale practice streaks (SQL fn) | reset_stale_streaks | daily 03:00 UTC | P2 | 🟡 | 2026-05-09 fired ok; [E2E real per f7ee87d §17.5.5 — RPC behaviour proven on stale vs fresh seeds] |

## Mobile (Capacitor)

| Feature | Platform | Criticality | State | Notes |
|---|---|---|---|---|
| iOS native build | iOS | P0 | 🟡 | v1.2 in App Store review |
| Android native build | Android | P0 | 🟡 | 2026-05-08 — capacitor.config.ts ok (`appId: net.lessonloop.app`, androidScheme: https, allowMixedContent: false); android/app/build.gradle versionCode=1 versionName="1.0"; no built AAB artifact on disk in this clone — verify whether AAB was built in CI/elsewhere before submitting Play Store |
| Capacitor OAuth in-app browser | both | P1 | 🟡 | 2026-05-08 — wrapper at src/lib/native/browser.ts; structural ok; device E2E pending |
| Push notifications | both | P1 | ⏸ | deferred post-launch |
| Deep link handling (post-OAuth return) | both | P1 | 🟡 | 2026-05-08 — `src/lib/native/deepLinks.ts` listens to `CapApp.addListener('appUrlOpen')`; path-traversal protection (rejects `..`, `javascript:`, `data:`); URL allowlisted against `allRoutes` known-path prefixes; auth-callback + accept-invite paths handled specifically; structural ok |

## Cross-cutting / platform

| Concern | Criticality | State | Notes |
|---|---|---|---|
| RLS coverage | P0 | 🟡 | per Mega Audit + Phase 6 — broadly verified; per-feature RLS spot-checks happen during each /sweep run (especially parent ↔ staff data isolation, cross-org isolation) |
| Sentry capture (browser) | P1 | 🟢 | DSN wired 2026-05-08; @sentry/vite-plugin 4.4 wired into vite.config.ts with source-map upload + post-upload .map deletion (so .map files never reach CDN); SENTRY_AUTH_TOKEN/ORG/PROJECT set as Netlify build env on next deploy |
| Sentry capture (edge functions) | P1 | 🔴 | 2026-05-08 — confirmed NO Sentry instrumentation in any edge function (0 references to @sentry/deno or Sentry.init across all 100+ fns). Edge fn errors only surface in Supabase logs (mcp_get_logs service=edge-function) — no aggregation, no alerting beyond cron-health-watchdog. Recommend adding shared `_shared/sentry.ts` wrapper post-launch |
| Cookie consent banner | P1 | 🔴 | flagged in claude.md remaining items |
| Anthropic sub-processor disclosure | P1 | 🔴 | flagged in claude.md remaining items |
| Cloudflare WAF rules | P1 | 🔴 | 2026-05-08 — `app.lessonloop.net` is `proxied: false`, bypasses Cloudflare entirely. No edge WAF / DDoS / rate-limit. Removed stale `_lovable.app` TXT record. See findings/2026-05-08-cloudflare-app-subdomain-not-proxied. Decision required: flip orange-cloud or rely on Netlify alone |
| Rate limiting on auth endpoints | P0 | 🟡 | 2026-05-08 — verified Supabase defaults: 30/5min on signup/email/OTP/verify, 150 on token refresh. Adequate for launch but tightening pending CAPTCHA + Cloudflare WAF |
| CSP allow-list (pwnedpasswords) | P0 | 🟢 | 2026-05-08 fixed in index.html — added `https://api.pwnedpasswords.com` to connect-src; also removed stale `*.lovable.app` and `*.lovableproject.com` references (Lovable detached) |
| Auth tightening (HIBP, reauth, security emails) | P1 | 🟢 | 2026-05-08 — enabled `password_hibp_enabled`, `security_update_password_require_reauthentication`, and 6 security-event notification emails (password/email/MFA/identity-link changed) via Management API. See findings/2026-05-08-supabase-auth-tightening-pre-launch |
| Stripe Checkout branding | P1 | 🔴 | known launch blocker |
| Realtime subscriptions reconnect | P1 | 🟡 | 2026-05-08 — `useRealtimeInvoices` hook subscribes to 7 postgres_changes listeners on a single channel filtered by org_id=eq; cleanup via `removeChannel` on unmount; supabase-js handles WS reconnect automatically on sleep/wake. PERF-M5 noted in code (consolidate-listeners optimisation deferred). Per-feature mobile sleep/wake test pending Jamie |
| Storage bucket policies | P0 | 🟢 | 2026-05-08 — 5 buckets verified: `avatars` (public, 2MB cap, image-mime allowlist — tightened today), `org-logos` (public, 2MB, image-mime), `invoice-pdfs` (private, 10MB, PDF-only, service_role only), `migration-dump` (private, owner-only), `teaching-resources` (private, 50MB, broad mime; staff INSERT/UPDATE/DELETE in own org, parents SELECT via resource_shares + is_parent_of_student). All RLS robust. See findings/2026-05-08-storage-avatars-bucket-no-mime-or-size-limit |
| Source Supabase decommission | P0 | 🔴 | known launch blocker |

## Demo / dev / migration utilities (non-launch)

| Feature | Source | Criticality | State | Notes |
|---|---|---|---|---|
| Seed demo agency | seed-demo-agency | P3 | ⏸ | dev-only |
| Seed demo solo | seed-demo-solo | P3 | ⏸ | dev-only |
| Seed demo data | seed-demo-data | P3 | ⏸ | dev-only |
| Seed E2E data | seed-e2e-data | P3 | ⏸ | test-only |
| Migration dump | migration-dump | P3 | ⏸ | one-off cutover tool |
