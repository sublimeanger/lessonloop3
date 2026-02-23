# LessonLoop — Code-Level Audit Guide

> **For:** External code auditor reviewing the repository  
> **Platform:** LessonLoop — UK music lesson scheduling, billing & portal SaaS  
> **Last updated:** 2026-02-23  
> **Regulatory context:** UK GDPR, ICO guidance, HMRC 6-year record-keeping  
> **Related:** See also `docs/AUDIT_TEST_CHECKLIST.md` for 160 functional test cases

---

## Table of Contents

1. [Repository Structure](#1-repository-structure)
2. [Authentication & Session Management](#2-authentication--session-management)
3. [Authorisation & RBAC](#3-authorisation--rbac)
4. [Row-Level Security (RLS)](#4-row-level-security-rls)
5. [Multi-Tenancy & Data Isolation](#5-multi-tenancy--data-isolation)
6. [Edge Functions (Backend)](#6-edge-functions-backend)
7. [Financial Integrity](#7-financial-integrity)
8. [Input Validation & Sanitisation](#8-input-validation--sanitisation)
9. [GDPR & Data Protection](#9-gdpr--data-protection)
10. [Subscription & Plan Enforcement](#10-subscription--plan-enforcement)
11. [Calendar Sync & iCal Security](#11-calendar-sync--ical-security)
12. [AI Subsystem (LoopAssist)](#12-ai-subsystem-loopassist)
13. [Audit Trail](#13-audit-trail)
14. [Client-Side Security](#14-client-side-security)
15. [Environment & Secrets](#15-environment--secrets)
16. [Automated Tests](#16-automated-tests)
17. [Database Migrations](#17-database-migrations)

---

## 1. Repository Structure

```
├── src/                          # React frontend (Vite + TypeScript + Tailwind)
│   ├── components/               # UI components by domain
│   ├── hooks/                    # Custom React hooks (data fetching, business logic)
│   ├── lib/                      # Utility libraries (validation, sanitisation, etc.)
│   ├── pages/                    # Route-level page components
│   └── integrations/supabase/    # Auto-generated Supabase client & types
├── supabase/
│   ├── functions/                # Edge Functions (Deno runtime, server-side)
│   │   ├── _shared/              # Shared utilities (CORS, auth, rate limiting)
│   │   └── [function-name]/      # Individual edge functions
│   └── migrations/               # SQL migration files (180+ migrations)
├── docs/                         # Architecture & compliance documentation
└── public/                       # Static assets
```

### Key Auto-Generated Files (DO NOT AUDIT FOR MANUAL EDITS)
- `src/integrations/supabase/client.ts` — Supabase client singleton
- `src/integrations/supabase/types.ts` — Database type definitions (reflects live schema)

---

## 2. Authentication & Session Management

### Files to Review

| File | What to Check |
|---|---|
| `src/pages/Login.tsx` | Login form, credential handling, error messages (no account enumeration) |
| `src/pages/Signup.tsx` | Registration flow, password requirements, ToS/Privacy consent |
| `src/pages/ForgotPassword.tsx` | Password reset initiation (no email enumeration) |
| `src/pages/ResetPassword.tsx` | Token-based password reset completion |
| `src/pages/VerifyEmail.tsx` | Email verification enforcement |
| `src/components/auth/AuthForm.tsx` | Shared auth form logic |
| `src/components/auth/ProtectedRoute.tsx` | Route guard — redirects unauthenticated users to `/auth` |
| `src/components/auth/AuthProvider.tsx` | Session management, token refresh, auth state context |
| `src/pages/AcceptInvite.tsx` | Invite acceptance flow (token validation) |

### What to Verify
- Email auto-confirm is **disabled** (users must verify email before login)
- No sensitive data in JWT payload (only `sub`, `role`, `iss`, `exp`)
- Session tokens are refreshed automatically via Supabase client
- Password reset invalidates old password
- No hardcoded credentials anywhere

---

## 3. Authorisation & RBAC

### Role Hierarchy
`owner` > `admin` > `teacher` / `finance` > `parent`

### Database Functions (SQL — review in migrations or query `pg_proc`)

| Function | File / Location | Purpose |
|---|---|---|
| `is_org_admin(_user_id, _org_id)` | Migration SQL | Returns true for `owner` or `admin` with active membership |
| `is_org_staff(_user_id, _org_id)` | Migration SQL | Returns true for `owner`, `admin`, `teacher`, `finance` |
| `is_org_scheduler(_user_id, _org_id)` | Migration SQL | Returns true for `owner`, `admin`, `teacher` |
| `is_org_finance_team(_user_id, _org_id)` | Migration SQL | Returns true for `owner`, `admin`, `finance` |
| `is_org_member(_user_id, _org_id)` | Migration SQL | Returns true for any active membership |
| `is_parent_of_student(_user_id, _student_id)` | Migration SQL | Checks `guardians` → `student_guardians` link |
| `is_invoice_payer(_user_id, _invoice_id)` | Migration SQL | Checks if user is the payer (guardian or student's guardian) |
| `is_lesson_teacher(_user_id, _lesson_id)` | Migration SQL | Checks if user is the teacher for a specific lesson |
| `is_assigned_teacher(_user_id, _org_id, _student_id)` | Migration SQL | Checks teacher-student assignment |
| `can_edit_lesson(_user_id, _lesson_id)` | Migration SQL | Teacher owns the lesson OR user is admin |
| `has_role(_user_id, _role)` | Migration SQL | Checks `user_roles` table |
| `get_user_roles(_user_id)` | Migration SQL | Returns array of roles |

### Frontend Role Checks

| File | What to Check |
|---|---|
| `src/hooks/useFeatureGate.ts` | Feature gating by subscription plan |
| `src/components/layout/` | Navigation filtering by role (owner/admin/teacher/finance/parent) |
| `src/components/settings/` | Settings tabs visibility per role |

### Critical Checks
- **Role escalation prevention**: Can a user promote themselves? Check RLS `WITH CHECK` on `org_memberships` INSERT/UPDATE
- **Owner protection**: Can an admin demote/remove the owner? Check RLS policies on `org_memberships`
- **Membership status**: Do all role checks filter by `status = 'active'`?
- All `SECURITY DEFINER` functions set `search_path TO 'public'` (prevents search_path injection)

---

## 4. Row-Level Security (RLS)

### Where to Find Policies
All RLS policies are defined in `supabase/migrations/*.sql`. Search for:
```sql
CREATE POLICY
ALTER TABLE ... ENABLE ROW LEVEL SECURITY
```

### Critical Tables to Audit

| Table | Key RLS Concern |
|---|---|
| `students` | Org-scoped; parents see only linked children; soft-delete filtering |
| `guardians` | Org-scoped; parent sees own record only |
| `lessons` | Org-scoped; teacher sees own lessons; parent sees children's lessons |
| `lesson_participants` | Org-scoped; links students to lessons |
| `invoices` | Org-scoped; parent sees only payer invoices (`is_invoice_payer`) |
| `invoice_items` | Org-scoped; follows invoice visibility |
| `payments` | Org-scoped; finance team only for writes |
| `attendance_records` | Org-scoped; teacher marks own lessons only |
| `audit_log` | **No UPDATE/DELETE policies** (immutable); SELECT restricted to admins |
| `org_memberships` | **Critical**: WITH CHECK must prevent role escalation |
| `invites` | Admin-only INSERT; token-based acceptance |
| `calendar_connections` | `user_id = auth.uid()` scoping (personal tokens) |
| `ai_action_proposals` | Admin-only execution |
| `make_up_credits` | Org-scoped; `FOR UPDATE` lock prevents double-redemption |
| `internal_messages` | Sender or recipient only |

### Lookup/Reference Tables (intentionally public SELECT)
These tables have `USING (true)` on SELECT — verify this is intentional:
- `instruments` (global + org-custom)
- `exam_boards` (global reference data)
- `grade_levels` (global reference data)
- `kickstarter_signups` (marketing, public INSERT)

### RLS Completeness Checklist
- [ ] Every table has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] No `USING (true)` on INSERT/UPDATE/DELETE policies (except intentional public tables above)
- [ ] All data tables filter by `org_id` in their policies
- [ ] Parent access uses `is_parent_of_student()` or `is_invoice_payer()`, not direct org membership
- [ ] `service_role` bypasses are only in edge functions, never in client code

---

## 5. Multi-Tenancy & Data Isolation

### Architecture
- Every data table has an `org_id` column with a foreign key to `organisations`
- RLS policies enforce `org_id` scoping on every query
- Organisation context is managed client-side via `useOrg()` hook

### Files to Review

| File | What to Check |
|---|---|
| `src/components/auth/OrgProvider.tsx` (or equivalent) | How `currentOrg` is set and stored |
| All hooks in `src/hooks/` | Every Supabase query must include `.eq('org_id', ...)` |
| All edge functions | Must validate org membership before data access |

### Critical Checks
- **Org switching**: When a user switches orgs, verify all data context changes
- **Direct API calls**: A user crafting a Supabase request with another org's ID gets empty results (not 403)
- **Edge functions**: All validate the caller's org membership before returning data

---

## 6. Edge Functions (Backend)

### Location: `supabase/functions/`

### Shared Utilities

| File | Purpose | Audit Focus |
|---|---|---|
| `_shared/cors.ts` | CORS header management | Allowed origins not `*` in production |
| `_shared/cron-auth.ts` | Cron job authentication | Validates `x-cron-secret` header against `INTERNAL_CRON_SECRET` env var |
| `_shared/rate-limit.ts` | Rate limiting for AI and other endpoints | Per-user request caps |
| `_shared/escape-html.ts` | HTML escaping for email templates | XSS prevention in emails |
| `_shared/check-notification-pref.ts` | Notification preference checking | Opt-in defaults |

### Auth-Required Functions (must check `Authorization` header)

| Function | Auth Level | Purpose |
|---|---|---|
| `looopassist-chat` | Authenticated + org member | AI chat assistant |
| `looopassist-execute` | Authenticated + **admin only** | AI action execution |
| `gdpr-export` | Authenticated + **admin only** | Data export (Art. 15) |
| `gdpr-delete` | Authenticated + **admin only** | Data deletion/anonymisation |
| `create-billing-run` | Authenticated + finance team | Bulk invoice generation |
| `calendar-oauth-start` | Authenticated | Google OAuth initiation |
| `calendar-oauth-callback` | Token-based | Google OAuth completion |
| `calendar-sync-lesson` | Authenticated | Sync lesson to Google Calendar |
| `send-invoice-email` | Authenticated + finance team | Email invoice to payer |
| `send-bulk-message` | Authenticated + admin | Bulk messaging |
| `onboarding-setup` | Authenticated | Organisation setup wizard |
| `stripe-*` | Various | Stripe integration endpoints |

### Cron-Triggered Functions (must validate `x-cron-secret`)

| Function | Purpose |
|---|---|
| `invoice-overdue-check` | Mark overdue invoices |
| `installment-overdue-check` | Mark overdue installments |
| `installment-upcoming-reminder` | 3-day upcoming payment reminder |
| `credit-expiry` | Expire make-up credits |
| `credit-expiry-warning` | 3-day credit expiry warning |
| `overdue-reminders` | Send overdue invoice reminders |
| `trial-expired` | Expire trial organisations |
| `trial-reminder-*` | Trial expiry reminders (1/3/7 day) |
| `trial-winback` | Win-back emails |
| `waitlist-expiry` | Expire old waitlist entries |
| `calendar-refresh-busy` | Refresh Google Calendar busy blocks |
| `cleanup-orphaned-resources` | Clean up orphaned resource shares |
| `streak-notification` | Practice streak milestone notifications |
| `ical-expiry-reminder` | iCal token expiry reminders |

### Public/Token-Based Functions

| Function | Auth Method | Audit Focus |
|---|---|---|
| `calendar-ical-feed` | Token in query string | Token validation, expiry check, no data without valid token |
| `invite-get` | Token in query string | Token validation, expiry check |
| `invite-accept` | Token in body | Token validation, one-time use |
| `send-contact-message` | None (public) | Rate limiting, input validation |
| `marketing-chat` | None (public) | Rate limiting, no data access |
| `stripe-webhook` | Stripe signature | Webhook signature verification |

### Critical Checks per Edge Function
1. **Authentication**: Does it verify the JWT? Does it use `supabase.auth.getUser()`?
2. **Authorisation**: Does it check role/membership before acting?
3. **Org scoping**: Does it filter all queries by org_id?
4. **Error handling**: Does it return generic errors (no stack traces, no DB schema leaks)?
5. **Service role usage**: Uses `SUPABASE_SERVICE_ROLE_KEY` only server-side, never exposed
6. **Input validation**: Are request body fields validated before use?

---

## 7. Financial Integrity

### Database Functions

| Function | File | What to Verify |
|---|---|---|
| `create_invoice_with_items()` | Migration SQL | Subtotal = Σ(qty × unit_price); VAT calculation; credit locking with `FOR UPDATE` |
| `record_payment_and_update_status()` | Migration SQL | Overpayment prevention (>1% tolerance); status transitions; installment waterfall |
| `void_invoice()` | Migration SQL | Terminal state enforcement; credit restoration; audit logging |
| `enforce_invoice_status_transition()` | Migration SQL (trigger) | `paid` and `void` are terminal; `draft` → only `sent` or `void`; no skipping states |
| `generate_invoice_number()` | Migration SQL | Sequential per org per year; `LL-YYYY-NNNNN` format |
| `generate_installments()` | Migration SQL | Last installment absorbs rounding; custom schedule sum validation |
| `redeem_make_up_credit()` | Migration SQL | `FOR UPDATE` lock; redeemed_at/expired_at checks prevent double-use |
| `get_invoice_stats()` | Migration SQL | Accurate aggregation (not row-limited) |
| `get_revenue_report()` | Migration SQL | Period comparison; finance team auth check |

### Frontend Financial Code

| File | What to Check |
|---|---|
| `src/hooks/useInvoices.ts` | Invoice CRUD operations |
| `src/hooks/useInvoiceInstallments.ts` | Payment plan management |
| `src/hooks/useMakeUpCredits.ts` | Credit management |
| `src/hooks/useAvailableCredits.ts` | Available credit queries |
| `src/hooks/useBillingRuns.ts` | Bulk billing run initiation |
| `src/hooks/useStripePayment.ts` | Stripe payment processing |
| `src/hooks/useStripeConnect.ts` | Stripe Connect onboarding |
| `src/components/invoices/` | Invoice UI components |
| `src/pages/InvoiceDetail.tsx` | Invoice detail page |
| `src/pages/Invoices.tsx` | Invoice list page |
| `src/lib/pricing-config.ts` | Subscription plan pricing |

### Critical Checks
- All monetary values stored as **minor units (pence)** — no floating-point arithmetic
- Currency defaults to **GBP**
- Invoice status transitions enforced by trigger (not just UI)
- Payment overpayment check in DB function (not just frontend)
- Make-up credit double-redemption prevented by `FOR UPDATE` lock
- Billing run deduplication: `get_unbilled_lesson_ids()` excludes already-billed lessons

---

## 8. Input Validation & Sanitisation

### Server-Side Validation

| File | What to Check |
|---|---|
| `src/lib/validation.ts` | Shared validation rules (email, phone, dates, etc.) |
| `src/lib/schemas.ts` | Zod schemas for form validation |
| `src/lib/sanitize.ts` | HTML/XSS sanitisation utilities |
| `src/lib/resource-validation.ts` | File upload validation (type, size, name) |
| `src/lib/fileUtils.ts` | File handling utilities |
| `supabase/functions/_shared/escape-html.ts` | Server-side HTML escaping |

### Database-Level Validation (Triggers)

| Trigger | Table | What it Validates |
|---|---|---|
| `validate_attendance_participant` | `attendance_records` | Student must be a lesson participant |
| `check_lesson_conflicts` | `lessons` | No teacher or room double-booking |
| `validate_schedule_hours` | `organisations` | Schedule hours between 0-23, end > start |
| `enforce_invoice_status_transition` | `invoices` | Valid status state machine |
| `check_subscription_active` | `lessons`, `students`, `invoices` | Org subscription must be active |
| `check_teacher_limit` | `org_memberships` | Teacher count within plan limit |
| `protect_subscription_fields` | `organisations` | Subscription fields only writable by service_role |
| `protect_onboarding_flag` | `profiles` | Onboarding flag only writable by service_role |

### XSS Prevention

| Technology | Where Used |
|---|---|
| DOMPurify (`dompurify`) | Sanitising user-generated HTML content before rendering |
| `rehype-sanitize` | Sanitising markdown content (lesson notes shared with parents) |
| `escapeHtml()` | Edge function email templates |
| React's built-in escaping | JSX text content (automatic) |

### File Upload Validation
- **Location**: `src/lib/resource-validation.ts`
- Max file size: 50MB
- Allowed MIME types: PDF, images, audio, video, Word documents
- Filename sanitisation

---

## 9. GDPR & Data Protection

### Edge Functions

| Function | File | Purpose |
|---|---|---|
| `gdpr-export` | `supabase/functions/gdpr-export/index.ts` | Art. 15 data export (CSV per entity) |
| `gdpr-delete` | `supabase/functions/gdpr-delete/index.ts` | Anonymisation + soft-delete |

### Audit Focus

- **Export scoping**: Does `gdpr-export` filter ALL queries by the caller's org_id?
- **Anonymisation**: Does `gdpr-delete` scrub PII fields (`first_name='Deleted'`, `last_name='User'`, email/phone/dob=NULL)?
- **Financial preservation**: Are invoices and payments retained after anonymisation (HMRC 6-year requirement)?
- **Audit logging**: Are GDPR actions logged to `audit_log`?
- **Auth check**: Both functions require admin role

### Soft-Delete Pattern
- `students`, `guardians` have `deleted_at` column
- RLS policies filter `deleted_at IS NULL` for non-admin users
- `cleanup_resource_shares_on_student_archive()` trigger cleans up related data

### Related Frontend

| File | What to Check |
|---|---|
| `src/hooks/useGDPR.ts` | GDPR operations hook |
| `src/hooks/useDeleteValidation.ts` | Pre-deletion dependency checking |
| `src/components/students/DeleteValidationDialog.tsx` | Deletion UI with dependency warnings |

---

## 10. Subscription & Plan Enforcement

### Database Triggers

| Trigger | Applied To | What it Does |
|---|---|---|
| `check_subscription_active` | `lessons`, `students`, `invoices` | Blocks INSERT when org subscription is inactive/expired |
| `check_teacher_limit` | `org_memberships` | Blocks adding teachers beyond plan limit |
| `protect_subscription_fields` | `organisations` | Prevents client-side modification of subscription fields |

### Database Functions

| Function | Purpose |
|---|---|
| `is_org_active(_org_id)` | Checks subscription status (active/trialing with valid trial) |
| `is_org_write_allowed(_org_id)` | Checks write eligibility (active/trialing/past_due) |

### Frontend Gating

| File | What to Check |
|---|---|
| `src/hooks/useFeatureGate.ts` | Feature availability per plan |
| `src/hooks/useSubscription.ts` | Subscription state management |
| `src/hooks/useSubscriptionCheckout.ts` | Stripe checkout flow |
| `src/hooks/useUsageCounts.ts` | Current usage vs plan limits |
| `src/components/subscription/` | Subscription UI components |
| `src/lib/pricing-config.ts` | Plan definitions and limits |

### Edge Functions

| Function | Purpose |
|---|---|
| `stripe-subscription-checkout` | Creates Stripe checkout session |
| `stripe-webhook` | Processes Stripe events (subscription changes) |
| `stripe-customer-portal` | Redirects to Stripe billing portal |
| `trial-expired` | Marks expired trials as inactive |
| `trial-reminder-*` | Sends trial expiry reminder emails |

### Critical Checks
- `protect_subscription_fields` trigger: verify it correctly resets ALL subscription columns for non-service-role
- Trial expiry: `check_subscription_active` does real-time check (not just cron-based)
- `past_due` status: allows reads but should warn user

---

## 11. Calendar Sync & iCal Security

### Edge Functions

| Function | Auth Method | Purpose |
|---|---|---|
| `calendar-oauth-start` | JWT | Initiates Google OAuth flow |
| `calendar-oauth-callback` | State token | Handles OAuth callback, stores tokens |
| `calendar-sync-lesson` | JWT | Syncs lesson to Google Calendar |
| `calendar-fetch-busy` | JWT | Fetches busy blocks from Google |
| `calendar-refresh-busy` | Cron secret | Bulk refresh of busy blocks |
| `calendar-disconnect` | JWT | Removes calendar connection |
| `calendar-ical-feed` | Token in query string | Serves iCal feed |
| `ical-expiry-reminder` | Cron secret | Warns about expiring iCal tokens |

### Files to Review

| File | What to Check |
|---|---|
| `src/hooks/useCalendarConnections.ts` | Token generation, URL construction |
| `src/hooks/useCalendarSync.ts` | Google Calendar sync logic |
| `src/hooks/useCalendarActions.ts` | Calendar action handlers |
| `src/components/settings/CalendarIntegrationsTab.tsx` | Settings UI |
| `src/components/settings/CalendarSyncHealth.tsx` | Admin sync health dashboard |

### Critical Checks
- **iCal token**: Generated with `gen_random_bytes(32)` (256-bit entropy)?
- **Token expiry**: iCal tokens expire after 90 days; expired tokens return 401
- **Feed scoping**: Parent feeds return only their children's lessons; teacher feeds return only their lessons
- **OAuth tokens**: Stored in `calendar_connections` table, protected by RLS (`user_id = auth.uid()`)
- **Google API credentials**: Stored in environment secrets, not in code
- **Cron auth**: `calendar-refresh-busy` validates `x-cron-secret`
- **RLS on `calendar_connections`**: Users can only see/modify their own connections

### Database Functions

| Function | Purpose |
|---|---|
| `generate_ical_token()` | Generates 64-char hex token |
| `get_org_calendar_health(p_org_id)` | Admin-only sync health overview |
| `get_org_sync_error_count(p_org_id)` | Lightweight error count for dashboard |

---

## 12. AI Subsystem (LoopAssist)

### Edge Functions

| Function | Auth Level | Purpose |
|---|---|---|
| `looopassist-chat` | Authenticated + org member | Chat with AI, read-only data queries |
| `looopassist-execute` | Authenticated + **admin only** | Execute AI-proposed actions |
| `parent-loopassist-chat` | Authenticated + parent | Parent-scoped AI chat |

### Files to Review

| File | What to Check |
|---|---|
| `supabase/functions/looopassist-chat/index.ts` | ~1880 lines — data context building, prompt construction, action proposal |
| `supabase/functions/looopassist-execute/index.ts` | Action execution with confirmation |
| `supabase/functions/parent-loopassist-chat/index.ts` | Parent-scoped variant |
| `supabase/functions/_shared/rate-limit.ts` | Rate limiting implementation |
| `src/hooks/useLoopAssist.ts` | Frontend AI chat hook |
| `src/hooks/useParentLoopAssist.ts` | Parent portal AI chat |
| `src/components/loopassist/` | AI chat UI components |

### Database Tables

| Table | Purpose |
|---|---|
| `ai_conversations` | Chat conversation metadata |
| `ai_messages` | Chat message history |
| `ai_action_proposals` | Proposed actions with status tracking |
| `ai_interaction_metrics` | Usage analytics |
| `rate_limits` | Per-user rate limit tracking |

### Critical Checks
- **Data scoping**: All queries in `buildDataContext()` filter by `org_id`
- **No cross-tenant leakage**: Parent chat returns only linked children's data
- **Action confirmation**: `ai_action_proposals.status` must be `pending` until user confirms
- **Admin-only execution**: `looopassist-execute` checks `is_org_admin`
- **Rate limiting**: `check_rate_limit()` function enforces per-user caps
- **Prompt injection**: `sanitiseForPrompt()` strips control characters and role prefixes
- **AI actions logged**: All proposals and executions recorded in `ai_action_proposals`

---

## 13. Audit Trail

### Database Table: `audit_log`

| Column | Type | Purpose |
|---|---|---|
| `org_id` | uuid | Organisation scoping |
| `actor_user_id` | uuid | Who performed the action |
| `action` | text | Action type (e.g. `payment_recorded`, `invoice_voided`) |
| `entity_type` | text | What was affected (e.g. `invoice`, `attendance_record`) |
| `entity_id` | uuid | Specific entity ID |
| `before` | jsonb | State before change |
| `after` | jsonb | State after change |
| `created_at` | timestamptz | When it happened |

### RLS Policies on `audit_log`
- **SELECT**: Admin only (`is_org_admin`)
- **INSERT**: Allowed for authenticated users (logged by triggers/functions)
- **UPDATE**: **No policy** (immutable)
- **DELETE**: **No policy** (immutable)

### Triggers that Write to Audit Log

| Trigger/Function | Source | What it Logs |
|---|---|---|
| `audit_attendance_changes()` | `attendance_records` INSERT/UPDATE/DELETE | Before/after state of attendance |
| `record_payment_and_update_status()` | Called by payment flow | Payment amount, method, new status |
| `void_invoice()` | Called by void flow | Installments voided, credits restored |
| `generate_installments()` | Called by payment plan setup | Installment count, frequency, remaining |
| `redeem_make_up_credit()` | Called by credit redemption | Credit ID, lesson ID, student ID, value |
| `update_practice_streak()` | `practice_logs` INSERT | Streak milestones (3, 7, 14, 30, 60, 100) |

### Frontend Audit Viewing

| File | What to Check |
|---|---|
| `src/hooks/useAuditLog.ts` | Audit log queries (admin-gated) |
| `src/lib/auditLog.ts` | Audit log utility functions |

---

## 14. Client-Side Security

### Environment Variables

| File | What to Check |
|---|---|
| `src/lib/env.ts` | Environment variable validation at startup |

**Verify**:
- Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID` are exposed to the client
- No service role key, API secrets, or private keys in any `VITE_*` variable
- No hardcoded keys in source code (search for `sk_`, `secret_`, API key patterns)

### Content Security

| File | What to Check |
|---|---|
| `src/lib/sanitize.ts` | DOMPurify configuration |
| `src/lib/resource-validation.ts` | File upload constraints |
| `src/lib/error-handler.ts` | Error handling (no stack traces to user) |
| `src/lib/logger.ts` | Logging configuration |
| `src/lib/sentry.ts` | Error reporting configuration (no PII in reports) |

### Routing & Access Control

| File | What to Check |
|---|---|
| `src/App.tsx` or routing config | Route definitions, which routes are protected |
| `src/components/auth/ProtectedRoute.tsx` | Auth guard implementation |
| `src/pages/portal/` | Parent portal pages — verify parent-scoped data access |

---

## 15. Environment & Secrets

### Edge Function Secrets (Server-Side Only)

These should exist as environment variables in the edge function runtime, **never in client code**:

| Secret | Used By |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | All edge functions (elevated access) |
| `SUPABASE_URL` | All edge functions |
| `INTERNAL_CRON_SECRET` | Cron-triggered functions |
| `RESEND_API_KEY` | Email-sending functions |
| `GOOGLE_CLIENT_ID` | Calendar OAuth functions |
| `GOOGLE_CLIENT_SECRET` | Calendar OAuth functions |
| `STRIPE_SECRET_KEY` | Stripe functions |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` function |
| `FRONTEND_URL` | Email templates (link construction) |

### Verification Steps
1. `grep -r "SUPABASE_SERVICE_ROLE_KEY" src/` — should return zero results
2. `grep -r "sk_live\|sk_test" src/` — should return zero results
3. `grep -r "GOOGLE_CLIENT_SECRET" src/` — should return zero results
4. Verify `.env` is in `.gitignore`
5. Check that `src/lib/env.ts` only exports publishable keys

---

## 16. Automated Tests

### Test Infrastructure

| File/Directory | What it Contains |
|---|---|
| `src/__tests__/` or `src/**/*.test.ts` | Vitest test files (~274 tests across 18 files) |
| `docs/TEST_PLAN.md` | Master traceability matrix mapping tests to system requirements |
| `vitest.config.ts` or `vite.config.ts` | Test runner configuration |

### Test Coverage Areas
- Authentication flows (login, signup, password reset)
- RBAC enforcement (role-based access checks)
- Financial calculations (invoice totals, VAT, credits)
- Scheduling conflict detection
- Input validation (Zod schemas)
- GDPR operations
- Subscription enforcement

### Running Tests
```bash
npm test
# or
bunx vitest run
```

---

## 17. Database Migrations

### Location: `supabase/migrations/`

180+ migration files in chronological order. Key areas to review:

### Finding Specific Migrations
```bash
# Find all RLS policies
grep -l "CREATE POLICY" supabase/migrations/*.sql

# Find all triggers
grep -l "CREATE TRIGGER" supabase/migrations/*.sql

# Find all functions
grep -l "CREATE.*FUNCTION" supabase/migrations/*.sql

# Find all SECURITY DEFINER functions
grep -l "SECURITY DEFINER" supabase/migrations/*.sql
```

### Migration Audit Checklist
- [ ] All `SECURITY DEFINER` functions set `search_path TO 'public'`
- [ ] No migrations grant permissions to `anon` role on sensitive tables
- [ ] No migrations disable RLS on any table
- [ ] No migrations contain hardcoded secrets or credentials
- [ ] `ON DELETE CASCADE` used appropriately (not on financial records)
- [ ] Financial tables (`invoices`, `payments`) never have hard-delete operations

---

## Quick-Start Audit Commands

```bash
# 1. Check for exposed secrets in frontend code
grep -rn "service_role\|sk_live\|sk_test\|GOOGLE_CLIENT_SECRET" src/

# 2. Find all Supabase queries without org_id filtering
grep -rn "\.from(" src/hooks/ | grep -v "org_id"

# 3. Find all edge functions and their auth patterns
grep -rn "auth.getUser\|validateCronAuth\|Authorization" supabase/functions/*/index.ts

# 4. Check for tables without RLS
# (Run via SQL): SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
# AND tablename NOT IN (SELECT tablename FROM pg_tables WHERE rowsecurity = true);

# 5. Find all USING(true) policies
grep -rn "USING (true)\|USING(true)" supabase/migrations/*.sql

# 6. Check for direct DOM manipulation (XSS risk)
grep -rn "dangerouslySetInnerHTML\|innerHTML" src/

# 7. Find all SECURITY DEFINER functions
grep -rn "SECURITY DEFINER" supabase/migrations/*.sql

# 8. Check for hardcoded URLs or keys
grep -rn "supabase\.co\|supabase\.com" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".d.ts"
```

---

## Related Documentation

| Document | Path | Contents |
|---|---|---|
| System Overview | `docs/SYSTEM_OVERVIEW.md` | Architecture and module overview |
| Data Model | `docs/DATA_MODEL.md` | ERD diagrams and table relationships |
| Security Model | `docs/SECURITY_MODEL.md` | RBAC, RLS, and security architecture |
| API Reference | `docs/API_REFERENCE.md` | Edge function API documentation |
| Audit Logging | `docs/AUDIT_LOGGING.md` | Audit trail architecture |
| GDPR Compliance | `docs/GDPR_COMPLIANCE.md` | Data protection implementation |
| AI Subsystem | `docs/AI_SUBSYSTEM.md` | LoopAssist architecture and safety |
| Test Plan | `docs/TEST_PLAN.md` | Automated test traceability matrix |
| Performance | `docs/PERFORMANCE.md` | Performance considerations |
| Functional Tests | `docs/AUDIT_TEST_CHECKLIST.md` | 160 functional test cases for live testing |
