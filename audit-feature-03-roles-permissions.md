# Audit Report — Feature 3: Roles & Permissions

**Date:** 2026-03-15
**Auditor:** Claude Code (automated)
**Scope:** Every file, function, RLS policy, and database object involved in role definitions, assignment, gating, and enforcement.

---

## 1. Files Audited

### Database & Migrations
- `supabase/migrations/20260119230917_*` — profiles, user_roles, app_role ENUM, handle_new_user trigger
- `supabase/migrations/20260119231348_*` — organisations, org_memberships, invites, RLS helpers (is_org_member, has_org_role, is_org_admin, get_user_org_ids, get_org_role), handle_new_organisation trigger
- `supabase/migrations/20260119232402_*` — students, guardians, student_guardians, rooms + RLS
- `supabase/migrations/20260119233145_*` — lessons, lesson_participants, attendance_records, availability/time-off + RLS
- `supabase/migrations/20260119234233_*` — invoices, invoice_items, payments, billing_runs + RLS
- `supabase/migrations/20260119235724_*` — guardians.user_id, parent helper functions, parent RLS policies, message_requests
- `supabase/migrations/20260120002039_*` — audit_log table + triggers (students, lessons, invoices, payments, org_memberships)
- `supabase/migrations/20260120215727_*` — is_org_staff, is_org_scheduler, is_org_finance_team, is_assigned_teacher, is_lesson_teacher
- `supabase/migrations/20260130162532_*` — teachers table (decoupled from auth) + RLS + teachers_with_pay view
- `supabase/migrations/20260222204533_*` — invites_role_not_owner CHECK constraint
- `supabase/migrations/20260224120000_role_change_rls_enforcement.sql` — restrictive update policy, protect_owner_role trigger, org_memberships_no_owner_insert constraint
- `supabase/migrations/20260314120000_*` — get_teachers_with_pay RPC (replaces view)
- `supabase/migrations/20260315100300_*` — prevent_org_id_change trigger on 8 tables
- 60+ additional migration files with table-specific RLS policies

### Edge Functions (81 total)
- All 81 functions in `supabase/functions/` — index.ts for each
- `supabase/functions/_shared/` — cors.ts, cron-auth.ts, rate-limit.ts, check-notification-pref.ts, escape-html.ts, sanitise-ai-input.ts, plan-config.ts

### Frontend
- `src/contexts/AuthContext.tsx` — AppRole type, fetchRoles via get_user_roles RPC, hasRole, isOwnerOrAdmin, isTeacher, isParent
- `src/contexts/OrgContext.tsx` — org_memberships query, currentRole, isOrgAdmin, isOrgOwner
- `src/config/routes.ts` — all route definitions with allowedRoles
- `src/components/auth/RouteGuard.tsx` — RouteGuard + PublicRoute components
- `src/components/layout/AppSidebar.tsx` — soloOwnerGroups, ownerAdminGroups, teacherGroups, financeGroups, parentGroups
- `src/components/settings/SettingsNav.tsx` — adminOnly tab filtering
- `src/integrations/supabase/types.ts` — generated TypeScript types

---

## 2. Role Definitions

### Where Defined
| Layer | Location | Details |
|-------|----------|---------|
| Database ENUM | `CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'teacher', 'finance', 'parent')` | Migration `20260119230917` |
| TypeScript type | `src/contexts/AuthContext.tsx:9` | `export type AppRole = 'owner' \| 'admin' \| 'teacher' \| 'finance' \| 'parent'` |
| OrgContext type | `src/contexts/OrgContext.tsx:10` | `MembershipStatus = 'active' \| 'invited' \| 'disabled'` |

### How Stored
- **org_memberships.role**: `app_role` ENUM (constrained, not free text) — **GOOD**
- **user_roles.role**: `app_role` ENUM — legacy table from pre-multi-org era
- **UNIQUE constraint**: `(org_id, user_id)` on org_memberships — a user can only have ONE role per org — **GOOD**
- **Multi-org**: A user CAN be a member of multiple orgs. Active org determined by `profiles.current_org_id`

### Role Assignment Flows
| Flow | Mechanism | Details |
|------|-----------|---------|
| Signup | `handle_new_user()` trigger | Creates profile + `user_roles` row with `owner` |
| Onboarding | `onboarding-setup` edge function | Creates org + membership via `handle_new_organisation()` trigger → owner membership |
| Invite | `invite-accept` edge function | Uses service_role to upsert org_membership with invited role |
| Manual change | RLS UPDATE on org_memberships | Owner/admin only, protected by trigger |

---

## 3. Complete RLS Matrix

### Security-Definer Helper Functions
| Function | Purpose | Used By |
|----------|---------|---------|
| `is_org_member(user_id, org_id)` | Active member of any role | Most SELECT policies |
| `is_org_admin(user_id, org_id)` | Owner OR admin | Admin-gated mutations |
| `is_org_staff(user_id, org_id)` | Owner/admin/teacher/finance (NOT parent) | Staff-only tables |
| `is_org_scheduler(user_id, org_id)` | Owner/admin/teacher | Scheduling tables |
| `is_org_finance_team(user_id, org_id)` | Owner/admin/finance | Financial operations |
| `has_org_role(user_id, org_id, role)` | Specific role check | Parent-specific policies |
| `get_org_role(user_id, org_id)` | Returns role value | Edge function lookups |
| `is_parent_of_student(user_id, student_id)` | Guardian→student link | Parent data scoping |
| `is_invoice_payer(user_id, invoice_id)` | Invoice payer check | Parent invoice access |
| `is_assigned_teacher(user_id, org_id, student_id)` | Teacher↔student assignment | Teacher data scoping |
| `is_lesson_teacher(user_id, lesson_id)` | Teaches this lesson | Lesson edit access |

All functions are `SECURITY DEFINER` with `SET search_path = public` — **prevents search_path injection**.

### Table × Role × Operation Matrix

**Legend:** ✅ = allowed, ❌ = denied, 🔒 = admin-only (owner+admin), 👤 = self-only, 📖 = read-only

#### Core Tables

| Table | Owner | Admin | Teacher | Finance | Parent |
|-------|-------|-------|---------|---------|--------|
| **organisations** | SELECT ✅ UPDATE ✅ DELETE ✅ | SELECT ✅ UPDATE ✅ | SELECT ✅ | SELECT ✅ | ❌ (no is_org_member) |
| **org_memberships** | SELECT ✅ INSERT 🔒 UPDATE 🔒 DELETE 🔒¹ | SELECT ✅ INSERT 🔒 UPDATE 🔒 DELETE 🔒¹ | SELECT ✅ | SELECT ✅ | SELECT ✅ |
| **invites** | ALL 🔒 | ALL 🔒 | ❌ | ❌ | ❌ |
| **profiles** | 👤 own row only | 👤 own row only | 👤 own row only | 👤 own row only | 👤 own row only |
| **user_roles** | SELECT 👤 | SELECT 👤 | SELECT 👤 | SELECT 👤 | SELECT 👤 |

¹ Cannot delete owner-role memberships (policy: `role != 'owner'`)

#### Teaching Tables

| Table | Owner | Admin | Teacher | Finance | Parent |
|-------|-------|-------|---------|---------|--------|
| **students** | ALL ✅ | ALL ✅ | SELECT ✅ INSERT ✅ UPDATE ✅ DELETE ❌ | SELECT ✅ INSERT ✅ UPDATE ✅ DELETE ❌ | SELECT 📖 (own children only) |
| **guardians** | ALL ✅ | ALL ✅ | SELECT ✅ INSERT ✅ UPDATE ✅ DELETE ❌ | SELECT ✅ INSERT ✅ UPDATE ✅ DELETE ❌ | SELECT 📖 (own record via user_id) |
| **student_guardians** | ALL ✅ | ALL ✅ | SELECT ✅ INSERT ✅ UPDATE ✅ DELETE ❌ | SELECT ✅ INSERT ✅ UPDATE ✅ DELETE ❌ | SELECT 📖 (own children links) |
| **teachers** | ALL ✅ | ALL ✅ | SELECT ✅ UPDATE 👤 | SELECT ✅ | SELECT ✅ |
| **lessons** | ALL ✅ | ALL ✅ | ALL (own lessons) | ❌² | SELECT 📖 (children's lessons) |
| **lesson_participants** | ALL ✅ | ALL ✅ | ALL (own lesson's) | ❌ | SELECT 📖 (own children) |
| **attendance_records** | ALL ✅ | ALL ✅ | ALL (own lesson's) | ❌ | SELECT 📖 (own children) |
| **lesson_notes** | ALL ✅ | ALL ✅ | ALL (own) via is_org_staff | ❌ | SELECT 📖 (visible_to_parents only) |
| **availability_blocks** | ALL ✅ | ALL ✅ | ALL (own teacher) | ❌ | ❌ |
| **time_off_blocks** | ALL ✅ | ALL ✅ | ALL (own teacher) | ❌ | ❌ |
| **recurrence_rules** | ALL ✅ | ALL ✅ | SELECT ✅ | SELECT ✅ | ❌ |
| **locations** | ALL ✅ | ALL ✅ | SELECT ✅ | SELECT ✅ | SELECT ✅ |
| **rooms** | ALL 🔒 | ALL 🔒 | SELECT ✅ | SELECT ✅ | ❌ |

² Finance users have no lesson SELECT policy — they cannot see individual lessons, only aggregate reports via RPCs.

#### Financial Tables

| Table | Owner | Admin | Teacher | Finance | Parent |
|-------|-------|-------|---------|---------|--------|
| **invoices** | ALL ✅ | ALL ✅ | SELECT ✅ | SELECT ✅ | SELECT 📖 (payer only) |
| **invoice_items** | ALL ✅ | ALL ✅ | SELECT ✅ | SELECT ✅ | SELECT 📖 (payer only) |
| **payments** | ALL ✅ | ALL ✅ | SELECT ✅ | SELECT ✅ | SELECT 📖 (payer only) |
| **billing_runs** | ALL 🔒 | ALL 🔒 | ❌ | ❌ | ❌ |
| **refunds** | ALL 🔒 | ALL 🔒 | ❌ | ❌ | ❌ |

#### Pipeline & CRM Tables

| Table | Owner | Admin | Teacher | Finance | Parent |
|-------|-------|-------|---------|---------|--------|
| **leads** | ALL via is_org_staff | ALL via is_org_staff | ALL via is_org_staff | ALL via is_org_staff | ❌ |
| **lead_students** | ALL via is_org_staff | ALL via is_org_staff | ALL via is_org_staff | ALL via is_org_staff | ❌ |
| **lead_activities** | ALL via is_org_staff | ALL via is_org_staff | ALL via is_org_staff | ALL via is_org_staff | ❌ |
| **lead_follow_ups** | ALL via is_org_staff | ALL via is_org_staff | ALL via is_org_staff | ALL via is_org_staff | ❌ |
| **make_up_credits** | Via RPC (role-checked) | Via RPC | Via RPC | ❌ | SELECT (own children) |
| **make_up_waitlist** | ALL 🔒 | ALL 🔒 | SELECT ✅ | ❌ | SELECT (own) + INSERT |
| **enrolment_waitlist** | ALL 🔒 | ALL 🔒 | ❌ | ❌ | ❌ |

#### Communication Tables

| Table | Owner | Admin | Teacher | Finance | Parent |
|-------|-------|-------|---------|---------|--------|
| **message_log** | SELECT ✅ | SELECT ✅ | SELECT ✅ | SELECT ✅ | ❌ |
| **message_templates** | ALL 🔒 | ALL 🔒 | SELECT ✅ | ❌ | ❌ |
| **message_requests** | ALL 🔒 | ALL 🔒 | ❌ | ❌ | INSERT+SELECT (own) |
| **internal_messages** | ALL ✅ | ALL ✅ | ALL ✅ | ALL ✅ | ❌ |
| **message_batches** | ALL 🔒 | ALL 🔒 | ❌ | ❌ | ❌ |

#### Other Tables

| Table | Owner | Admin | Teacher | Finance | Parent |
|-------|-------|-------|---------|---------|--------|
| **audit_log** | SELECT 🔒 | SELECT 🔒 | ❌ | ❌ | ❌ |
| **practice_assignments** | ALL via is_org_staff | ALL | ALL | ALL | SELECT (own children) |
| **practice_logs** | ALL via is_org_staff | ALL | ALL | ALL | SELECT+INSERT (own children) |
| **practice_streaks** | SELECT via is_org_staff | SELECT | SELECT | SELECT | SELECT (own children) |
| **resources** | ALL ✅ | ALL ✅ | ALL ✅ | ❌ | SELECT (shared) |
| **calendar_connections** | ALL 👤 | ALL 👤 | ALL 👤 | ❌ | ALL 👤 |
| **closure_dates** | ALL 🔒 | ALL 🔒 | SELECT ✅ | ❌ | ❌ |
| **terms** | ALL 🔒 | ALL 🔒 | SELECT ✅ | SELECT ✅ | ❌ |
| **notification_preferences** | ALL 👤 | ALL 👤 | ALL 👤 | ALL 👤 | ALL 👤 |
| **booking_pages** | ALL 🔒 | ALL 🔒 | ❌ | ❌ | ❌ |
| **stripe_webhook_events** | ❌ (service_role only) | ❌ | ❌ | ❌ | ❌ |
| **ai_conversations** | ALL 👤 | ALL 👤 | ALL 👤 | ALL 👤 | ALL 👤 |
| **instruments** | ALL 🔒 | ALL 🔒 | SELECT ✅ | SELECT ✅ | ❌ |
| **term_continuation_runs** | ALL 🔒 | ALL 🔒 | SELECT ✅ | ❌ | ❌ |
| **term_continuation_responses** | ALL 🔒 | ALL 🔒 | SELECT ✅ | ❌ | SELECT+UPDATE (own) |

### Tables Without RLS
All user-facing tables have RLS enabled. The `rate_limits` table has RLS enabled (checked). No tables found without RLS that should have it.

---

## 4. Edge Function Role Matrix

### Auth Pattern
All edge functions follow this pattern:
1. Validate `Authorization` header
2. Create user-scoped Supabase client
3. Call `getUser()` to validate token
4. For role-restricted operations: query `org_memberships` for caller's role
5. Rate limiting via `_shared/rate-limit.ts`

### Edge Function × Allowed Roles

| Function | Auth | Role Check | Allowed Roles | Notes |
|----------|------|------------|---------------|-------|
| **account-delete** | ✅ | ✅ | Any (self-delete), prevents sole owner | Guards against orphaning org |
| **booking-get-slots** | ❌ public | ❌ | Public | Public booking page |
| **booking-submit** | ❌ public | ❌ | Public | Public form submission, notifies owner/admin |
| **calendar-disconnect** | ✅ | ❌ | Any authenticated | User disconnects own calendar |
| **calendar-fetch-busy** | ✅ | ❌ | Any authenticated | Reads own calendar data |
| **calendar-ical-feed** | Token-based | ❌ | Token-verified | iCal feed with expiry |
| **calendar-oauth-callback** | ✅ | ❌ | Any authenticated | OAuth callback |
| **calendar-oauth-start** | ✅ | ❌ | Any authenticated | OAuth initiation |
| **calendar-refresh-busy** | ✅ | ❌ | Any authenticated | Refresh own busy blocks |
| **calendar-sync-lesson** | ✅ | ✅ | owner/admin/teacher | Syncs lesson to calendar |
| **cleanup-orphaned-resources** | Cron | N/A | Cron only | Scheduled cleanup |
| **continuation-respond** | Token-based | ❌ | Public (signed token) | Parent continuation response |
| **create-billing-run** | ✅ | ✅ | owner/admin/finance | Billing run creation |
| **create-continuation-run** | ✅ | ✅ | owner/admin | Continuation run |
| **credit-expiry** | Cron | N/A | Cron only | Credit expiry processing |
| **credit-expiry-warning** | Cron | N/A | Cron only | Email warnings |
| **csv-import-execute** | ✅ | ✅ | owner/admin | Data import |
| **csv-import-mapping** | ✅ | ✅ | owner/admin | CSV mapping |
| **enrolment-offer-expiry** | Cron | N/A | Cron only | Auto-expire offers |
| **gdpr-delete** | ✅ | ✅ | owner/admin | GDPR data deletion |
| **gdpr-export** | ✅ | ✅ | owner/admin | GDPR data export |
| **ical-expiry-reminder** | Cron | N/A | Cron only | iCal token expiry |
| **installment-overdue-check** | Cron | N/A | Cron only | Overdue installments |
| **installment-upcoming-reminder** | Cron | N/A | Cron only | Upcoming payment reminders |
| **invite-accept** | ✅ | ❌ | Any authenticated | Validates token + email match |
| **invite-get** | ❌ public | ❌ | Public | Read invite details by token |
| **invoice-overdue-check** | Cron | N/A | Cron only | Overdue invoice check |
| **looopassist-chat** | ✅ | ✅ | owner/admin/teacher/finance | Role-aware system prompt |
| **looopassist-execute** | ✅ | ✅ | owner/admin/teacher | AI action execution |
| **mark-messages-read** | ✅ | ✅ | Validates guardian ownership | Parent message marking |
| **marketing-chat** | ❌ public | ❌ | Public | Marketing site chatbot |
| **notify-internal-message** | ✅ | ✅ | org member | Internal message notification |
| **notify-makeup-match** | Cron/internal | N/A | Internal | Match notifications to admins |
| **notify-makeup-offer** | Cron/internal | N/A | Internal | Offer notifications to parents |
| **onboarding-setup** | ✅ | ❌ | Any authenticated | Creates org as owner |
| **overdue-reminders** | Cron | N/A | Cron only | Overdue email reminders |
| **parent-loopassist-chat** | ✅ | ✅ | parent | Separate parent AI chat |
| **process-term-adjustment** | ✅ | ✅ | owner/admin/finance | Term adjustment processing |
| **profile-ensure** | ✅ | ❌ | Any authenticated | Self-healing profile creation |
| **seed-demo-data** | ✅ | ❌ | Development only | Demo data seeding |
| **seed-e2e-data** | ✅ | ❌ | Testing only | E2E test data |
| **send-bulk-message** | ✅ | ✅ | owner/admin | Bulk message sending |
| **send-cancellation-notification** | ✅ | ✅ | owner/admin/teacher | Lesson cancellation notification |
| **send-contact-message** | ❌ public | ❌ | Public | Contact form |
| **send-enrolment-offer** | ✅ | ✅ | owner/admin | Waitlist enrolment offers |
| **send-invite-email** | ✅ | ✅ | owner/admin | Member invitation emails |
| **send-invoice-email** | ✅ | ✅ | owner/admin/finance | Invoice emails |
| **send-message** | ✅ | ✅ | owner/admin/teacher | Individual messages |
| **send-notes-notification** | ✅ | ✅ | owner/admin/teacher | Lesson notes notifications |
| **send-parent-enquiry** | ✅ | ✅ | parent | Parent enquiry to admin |
| **send-parent-message** | ✅ | ✅ | parent | Parent message to staff |
| **send-payment-receipt** | ✅ | ✅ | owner/admin/finance | Payment receipt emails |
| **send-push** | Internal | N/A | Internal trigger | Push notifications |
| **send-refund-notification** | ✅ | ✅ | owner/admin | Refund notification |
| **streak-notification** | Cron | N/A | Cron only | Practice streak notifications |
| **stripe-auto-pay-installment** | Cron/webhook | N/A | Internal | Auto-pay processing |
| **stripe-billing-history** | ✅ | ✅ | owner/admin | Stripe billing history |
| **stripe-connect-onboard** | ✅ | ✅ | owner/admin | Stripe Connect onboarding |
| **stripe-connect-status** | ✅ | ✅ | owner/admin | Stripe Connect status |
| **stripe-create-checkout** | ✅ | ✅ | parent (invoice payer) | Stripe payment checkout |
| **stripe-create-payment-intent** | ✅ | ✅ | parent (invoice payer) | Payment intent creation |
| **stripe-customer-portal** | ✅ | ✅ | owner | Stripe customer portal |
| **stripe-detach-payment-method** | ✅ | ✅ | parent (own method) | Detach payment method |
| **stripe-list-payment-methods** | ✅ | ✅ | parent (own methods) | List payment methods |
| **stripe-process-refund** | ✅ | ✅ | owner/admin | Refund processing |
| **stripe-subscription-checkout** | ✅ | ✅ | owner | Subscription management |
| **stripe-update-payment-preferences** | ✅ | ✅ | parent (own prefs) | Update payment preferences |
| **stripe-verify-session** | ✅ | ✅ | Any authenticated | Verify checkout session |
| **stripe-webhook** | Signature | N/A | Stripe webhook only | Webhook processing |
| **trial-expired** | Cron | N/A | Cron only | Trial expiry handling |
| **trial-reminder-1day** | Cron | N/A | Cron only | Trial reminder |
| **trial-reminder-3day** | Cron | N/A | Cron only | Trial reminder |
| **trial-reminder-7day** | Cron | N/A | Cron only | Trial reminder |
| **trial-winback** | Cron | N/A | Cron only | Win-back emails |
| **waitlist-expiry** | Cron | N/A | Cron only | Waitlist expiry processing |
| **waitlist-respond** | Token-based | ❌ | Public (signed token) | Waitlist response |
| **zoom-oauth-callback** | ✅ | ❌ | Any authenticated | Zoom OAuth callback |
| **zoom-oauth-start** | ✅ | ❌ | Any authenticated | Zoom OAuth start |
| **zoom-sync-lesson** | ✅ | ✅ | owner/admin/teacher | Zoom lesson sync |

### Cron Functions (authenticated via `_shared/cron-auth.ts`)
18 cron-triggered functions — all use shared cron auth, no user role check needed.

---

## 5. UI Route Access Matrix

### App Routes

| Route | Owner | Admin | Teacher | Finance | Parent |
|-------|-------|-------|---------|---------|--------|
| `/dashboard` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/register` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/calendar` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/batch-attendance` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/students` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/students/import` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/students/:id` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/teachers` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/locations` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/invoices` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `/invoices/:id` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `/reports` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/reports/payroll` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/reports/revenue` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `/reports/outstanding` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `/reports/lessons` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/reports/cancellations` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/reports/utilisation` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/reports/teacher-performance` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/messages` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/practice` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/resources` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/make-ups` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/leads` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/leads/:id` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/waitlist` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/continuation` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/notes` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/settings` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/help` | ✅ (all) | ✅ | ✅ | ✅ | ✅ |

### Portal Routes (Parent Only)

| Route | Parent |
|-------|--------|
| `/portal/home` | ✅ |
| `/portal/schedule` | ✅ |
| `/portal/practice` | ✅ |
| `/portal/resources` | ✅ |
| `/portal/invoices` | ✅ |
| `/portal/messages` | ✅ |
| `/portal/profile` | ✅ |
| `/portal/continuation` | ✅ |

### Settings Tabs (adminOnly filtering)

| Tab | Owner/Admin | Teacher/Finance |
|-----|------------|-----------------|
| Profile | ✅ | ✅ |
| Notifications | ✅ | ✅ |
| Help & Tours | ✅ | ✅ |
| Organisation | ✅ | ❌ |
| Branding | ✅ | ❌ |
| Members | ✅ | ❌ |
| Data & Import | ✅ | ❌ |
| Scheduling | ✅ | ❌ |
| Availability | ✅ | ✅ |
| Calendar Sync | ✅ | ✅ |
| Zoom | ✅ | ✅ |
| Music | ✅ | ❌ |
| Billing | ✅ | ❌ |
| Rate Cards | ✅ | ❌ |
| Messaging | ✅ | ❌ |
| Booking Page | ✅ | ❌ |
| LoopAssist AI | ✅ | ❌ |
| Continuation | ✅ | ❌ |
| Privacy & GDPR | ✅ | ❌ |
| Audit Log | ✅ | ❌ |

### RouteGuard Behaviour
- **No role**: Redirects to `/portal/home` (assumes parent)
- **Parent accessing staff route**: Redirects to `/portal/home`
- **Staff accessing unauthorized route**: Redirects to `/dashboard`
- **Unauthenticated**: Redirects to `/login`
- **No onboarding**: Redirects to `/onboarding`

---

## 6. Findings Table

| ID | Severity | Description | File(s) | Recommended Fix |
|----|----------|-------------|---------|-----------------|
| RP-01 | **LOW** | `org_memberships_no_owner_insert` CHECK constraint is vacuous — `role != 'owner' OR (role = 'owner')` evaluates to TRUE for all values, preventing nothing | `20260224120000_role_change_rls_enforcement.sql:64-69` | Rewrite as `role != 'owner'` or remove entirely. The RLS INSERT policy already requires `is_org_admin`, and owner creation is done via service_role which bypasses checks anyway. Defence in depth is provided by the `invites_role_not_owner` constraint and `invite-accept` function check. |
| RP-02 | **LOW** | `user_roles` table is a legacy table from pre-multi-org era. `get_user_roles` RPC still queries it. The `handle_new_user` trigger inserts `owner` into `user_roles` on every signup, but the actual role used at runtime comes from `org_memberships`. | `20260119230917_*.sql`, `src/contexts/AuthContext.tsx:90` | Consider deprecating `user_roles` table. The `get_user_roles` RPC result is fetched but the `currentRole` used for UI gating comes from `OrgContext` (which queries `org_memberships`). The `user_roles` data is stored in `AuthContext.roles` but only used for `hasRole()` checks. Verify all `hasRole()` call sites use org-scoped role instead. |
| RP-03 | **LOW** | Leads tables (`leads`, `lead_students`, `lead_activities`, `lead_follow_ups`) use `is_org_staff` which grants teacher+finance full CRUD. Routes restrict to owner/admin, but a teacher/finance could manipulate leads via direct Supabase API. | `20260224230000_lead_pipeline.sql`, `src/config/routes.ts:151-152` | Change leads RLS from `is_org_staff` to `is_org_admin` for INSERT/UPDATE/DELETE operations. Keep SELECT as `is_org_staff` if teachers should see leads. |
| RP-04 | **INFO** | `FORCE ROW LEVEL SECURITY` is not set on any table. This means the table owner (superuser/service_role) can bypass RLS. This is expected for Supabase edge functions using service_role. | All migration files | No action needed — this is the intended design for service_role edge functions. Just be aware that all edge functions using `SUPABASE_SERVICE_ROLE_KEY` bypass RLS entirely. |
| RP-05 | **INFO** | No guard preventing removal of the LAST owner from an org. The DELETE policy prevents deleting owner memberships (`role != 'owner'`), so an owner cannot be deleted via normal RLS. The `protect_owner_role` trigger prevents demoting an owner. However, `account-delete` edge function does check for sole-owner status before deletion. | `20260224120000_*.sql`, `supabase/functions/account-delete/index.ts` | Adequate protection exists. The delete policy blocks owner deletion, and account-delete checks sole ownership. No additional guard needed. |
| RP-06 | **INFO** | No realtime subscription on `org_memberships` for role change detection. When a member's role is changed, their UI won't reflect it until next page load / org context refresh. | `src/contexts/OrgContext.tsx` | Consider adding a realtime channel for `org_memberships` changes filtered to current user. Low priority — admin changes role infrequently. |
| RP-07 | **INFO** | `parents` can view ALL locations in an org via `has_org_role(auth.uid(), org_id, 'parent')` without scoping to their children's lesson locations. This is by design (parents need to see available locations for rescheduling). | `20260119235724_*.sql:162-167` | No action needed — intentional design. |
| RP-08 | **INFO** | Dual role systems: `user_roles` (global) and `org_memberships` (per-org). The frontend uses both: `AuthContext.roles` from `user_roles` and `OrgContext.currentRole` from `org_memberships`. The `isOwnerOrAdmin` in AuthContext checks the global `user_roles`, while `isOrgAdmin` in OrgContext checks org-specific membership. | `src/contexts/AuthContext.tsx`, `src/contexts/OrgContext.tsx` | Verify all permission checks use `OrgContext.currentRole` / `isOrgAdmin` / `isOrgOwner` rather than the global `AuthContext.hasRole()`. The global roles table could theoretically diverge from org-specific roles. |

---

## 7. Solo Teacher Mode Assessment

### How It Works
- **Detection**: `org_type === 'solo_teacher'` on the `organisations` table
- **Check location**: `AppSidebar.tsx:207` — `getNavGroups(role, orgType)` checks if role is owner/admin AND orgType is 'solo_teacher'
- **Simplified nav (`soloOwnerGroups`)**: Dashboard, Calendar, Students, Register, Practice, Resources, Notes, Invoices, Messages, Reports
- **Hidden in solo mode**: Teachers, Locations, Batch Attendance, Leads, Waitlist, Make-Ups, Continuation, Pipeline section

### Behaviour When Second Teacher Is Added
The org_type would need to change from `solo_teacher` to `studio` or `academy`. This is typically done in the organisation settings. When changed:
1. The `OrgContext` has a realtime subscription on `organisations` table — it will detect the org_type change
2. `getNavGroups()` will switch from `soloOwnerGroups` to `ownerAdminGroups` automatically
3. No page refresh needed — the realtime listener triggers `fetchOrganisations()`

### Assessment
- **Solo mode is correctly scoped**: Only affects sidebar navigation, not route access. Solo owners can still navigate to `/teachers` etc. by URL — the routes.ts allowedRoles still permit it.
- **No features break in solo mode**: All routes remain accessible, just hidden from nav.
- **Collapse back**: If org_type is changed back to `solo_teacher`, nav collapses correctly.
- **VERDICT: CORRECT** — Solo teacher mode is purely a UX simplification, not a security boundary.

---

## 8. Parent Isolation Assessment

### Data Scoping Chain
```
auth.users → guardians.user_id → student_guardians → students
```

### What Parents Can See
| Data | Scoping | Verdict |
|------|---------|---------|
| Students | `is_parent_of_student()` — only linked children | ✅ ISOLATED |
| Lessons | Via `lesson_participants` + `is_parent_of_student()` — children's lessons only | ✅ ISOLATED |
| Attendance | `is_parent_of_student()` — children only | ✅ ISOLATED |
| Invoices | `is_invoice_payer()` — only invoices where parent is payer | ✅ ISOLATED |
| Invoice items | Scoped to parent's invoices | ✅ ISOLATED |
| Payments | Scoped to parent's invoices | ✅ ISOLATED |
| Guardians | `user_id = auth.uid()` — own record only | ✅ ISOLATED |
| Student-guardian links | `is_parent_of_student()` — own children only | ✅ ISOLATED |
| Locations | All org locations visible | ⚠️ BY DESIGN |
| Teachers | All org teachers visible (SELECT) | ⚠️ BY DESIGN |
| Lesson notes | Visible notes for own children only | ✅ ISOLATED |
| Practice | Own children only | ✅ ISOLATED |
| Make-up credits | Own children only | ✅ ISOLATED |
| Messages | Own guardian messages only | ✅ ISOLATED |
| Continuation responses | Own responses only | ✅ ISOLATED |

### Can a Parent...
| Action | Answer | How |
|--------|--------|-----|
| See other parents' data? | **NO** | Guardian SELECT is `user_id = auth.uid()` |
| See other students? | **NO** | Student SELECT requires `is_parent_of_student()` |
| Modify student data? | **NO** | No INSERT/UPDATE/DELETE policies for parents on students |
| Access admin URLs by typing? | **NO** | RouteGuard redirects to `/portal/home` |
| Call admin API endpoints? | **NO** | RLS blocks at database level + edge functions check role |
| Unlink themselves from student? | **NO** | No DELETE policy for parents on student_guardians |
| See teacher pay rates? | **NO** | `teachers_with_pay` view masks pay data for non-admin/non-self |

### Assessment
- **VERDICT: STRONG ISOLATION** — Parent data isolation is enforced at both UI (RouteGuard) and database (RLS) layers. The `is_parent_of_student()` function chains through `guardians.user_id → student_guardians → students` correctly.

---

## 9. Role Change Security

### Protections in Place
1. **RLS UPDATE policy** (`20260224120000`): Only owner/admin can update memberships. Cannot set role to 'owner'. Cannot modify own membership.
2. **Trigger** (`protect_owner_role`): Blocks demoting an owner, promoting to owner, or self-role-change at database level.
3. **DELETE policy**: Owner memberships cannot be deleted (`role != 'owner'`).
4. **Invite constraint**: `invites_role_not_owner` CHECK prevents creating owner invites.
5. **invite-accept function**: Explicitly rejects `role === 'owner'` invites.
6. **Audit trail**: `audit_org_memberships` trigger logs all INSERT/UPDATE/DELETE on org_memberships.
7. **prevent_org_id_change trigger**: Prevents org_id mutation on org_memberships (tenant boundary).

### Can a user escalate their role?
| Attack Vector | Protected? | How |
|---------------|------------|-----|
| Direct UPDATE to org_memberships via Supabase API | ✅ | RLS policy + trigger blocks it |
| Set own role to owner | ✅ | protect_owner_role trigger + WITH CHECK |
| Modify own membership | ✅ | `user_id != auth.uid()` in WITH CHECK |
| Create owner invite | ✅ | invites_role_not_owner CHECK constraint |
| Accept forged invite | ✅ | Email matching in invite-accept |
| Spoof org_id to access other org | ✅ | All RLS checks org membership + prevent_org_id_change trigger |

---

## 10. Verdict

### ✅ PRODUCTION READY — all findings resolved

The roles & permissions system is well-designed and production-ready with multiple layers of defence:

1. **Database layer**: Properly constrained ENUM types, UNIQUE constraints, SECURITY DEFINER helper functions, comprehensive RLS policies on all tables.
2. **Trigger layer**: protect_owner_role, prevent_org_id_change, block_owner_insert, audit logging on role changes.
3. **Edge function layer**: Consistent auth validation, role checking for sensitive operations, rate limiting.
4. **UI layer**: Route-level guards with allowedRoles, sidebar filtering by role, adminOnly settings tabs.
5. **Parent isolation**: Strong scoping via guardian→student link chain, enforced at RLS level.
6. **Role escalation protection**: Multi-layered (RLS policy + trigger + edge function guard).

### Resolved Findings (migration `20260315220009_fix_roles_audit_findings.sql`)
- **RP-01** (LOW): ~~Vacuous CHECK constraint~~ → Replaced with `block_owner_insert` trigger that checks `current_setting('role') != 'service_role'`.
- **RP-02** (LOW): ~~Legacy `user_roles` table~~ → `get_user_roles` and `has_role` repointed to `org_memberships`. `handle_new_user` updated. `onboarding-setup` edge function updated. Table dropped.
- **RP-03** (LOW): ~~Leads RLS too broad~~ → All leads table policies changed from `is_org_staff` to `is_org_admin`, matching UI route restrictions (owner/admin only).
