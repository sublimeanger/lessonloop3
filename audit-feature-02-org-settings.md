# Audit Report — Feature 2: Organisation Settings

**Date:** 2026-03-15
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Organisation profile, branding, timezone, currency, tier limits, academic terms, deletion, org-level defaults
**Verdict:** **NOT PRODUCTION READY** — 5 blocking issues identified

---

## 1. Files Audited (Full List)

### Database Migrations
| File | Purpose |
|------|---------|
| `supabase/migrations/20260119231348_e28c56b1-*.sql` | Core organisations table, RLS policies, helper functions, triggers |
| `supabase/migrations/20260123014004_aa81f3ca-*.sql` | Add address and payment terms columns |
| `supabase/migrations/20260123215702_112ae08b-*.sql` | `org-logos` storage bucket and policies |
| `supabase/migrations/20260125171857_*` | Subscription plan/status columns, Stripe fields |
| `supabase/migrations/20260128083806_1b496d73-*.sql` | Hardening columns: buffer_minutes, overdue_reminder_days, auto_pause |
| `supabase/migrations/20260128111419_066122eb-*.sql` | CHECK constraint on parent_reschedule_policy |
| `supabase/migrations/20260130162532_a2767bf6-*.sql` | Teachers table with default_lesson_length_mins |
| `supabase/migrations/20260209170759_02ea1b94-*.sql` | Terms table (org-scoped academic terms) |
| `supabase/migrations/20260212230115_*` | Stripe Connect columns |
| `supabase/migrations/20260212231349_c899eb79-*.sql` | Payment method columns (bank details, online_payments) |
| `supabase/migrations/20260220004823_478f35a4-*.sql` | Schedule hours + validation trigger |
| `supabase/migrations/20260220152917_418e7ebd-*.sql` | `parent_org_info` restricted view |
| `supabase/migrations/20260220152926_dbabd94c-*.sql` | Set security_invoker on parent_org_info view |
| `supabase/migrations/20260222164345_e13bad2c-*.sql` | Make-up waitlist expiry column |
| `supabase/migrations/20260222195918_c149ccf0-*.sql` | Student limit trigger |
| `supabase/migrations/20260222220553_6c3321ca-*.sql` | Teacher limit trigger |
| `supabase/migrations/20260222220714_7035a332-*.sql` | Subscription active enforcement triggers |
| `supabase/migrations/20260222221125_9bef25a1-*.sql` | cancels_at column |
| `supabase/migrations/20260222221139_78314066-*.sql` | Subscription field protection trigger |
| `supabase/migrations/20260223004626_6a886441-*.sql` | Credit expiry/limit columns |
| `supabase/migrations/20260224140346_02507376-*.sql` | Teacher payment visibility toggles |
| `supabase/migrations/20260224150000_invoice_branding_*.sql` | Brand colors, invoice prefix/digits |
| `supabase/migrations/20260228100000_term_continuation.sql` | Continuation notice/reminder columns |
| `supabase/migrations/20260315100300_fix_prevent_org_id_mutation.sql` | org_id immutability trigger |

### Edge Functions
| File | Reads Org | Writes Org |
|------|-----------|------------|
| `supabase/functions/onboarding-setup/index.ts` | No | Yes (full creation) |
| `supabase/functions/stripe-webhook/index.ts` | Yes | Yes (subscription fields) |
| `supabase/functions/stripe-connect-onboard/index.ts` | Yes | Yes (Stripe Connect) |
| `supabase/functions/stripe-connect-status/index.ts` | Yes | Yes (Stripe Connect status) |
| `supabase/functions/trial-expired/index.ts` | Yes | Yes (downgrade limits) |
| `supabase/functions/seed-demo-data/index.ts` | Yes | Yes (demo setup) |
| `supabase/functions/booking-get-slots/index.ts` | Yes | No |
| `supabase/functions/create-billing-run/index.ts` | Yes | No |
| `supabase/functions/send-enrolment-offer/index.ts` | Yes | No |
| `supabase/functions/looopassist-chat/index.ts` | Yes | No |
| `supabase/functions/parent-loopassist-chat/index.ts` | Yes | No |
| `supabase/functions/looopassist-execute/index.ts` | Yes | No |
| `supabase/functions/calendar-ical-feed/index.ts` | Yes | No |
| `supabase/functions/invite-get/index.ts` | Yes | No |
| `supabase/functions/credit-expiry-warning/index.ts` | Yes | No |
| `supabase/functions/send-payment-receipt/index.ts` | Yes | No |
| `supabase/functions/auto-pay-upcoming-reminder/index.ts` | Yes | No |
| `supabase/functions/overdue-reminders/index.ts` | Yes | No |
| `supabase/functions/invoice-overdue-check/index.ts` | Yes | No |
| `supabase/functions/process-term-adjustment/index.ts` | Yes | No |
| `supabase/functions/create-continuation-run/index.ts` | Yes | No |
| `supabase/functions/stripe-process-refund/index.ts` | Yes | No |
| `supabase/functions/_shared/plan-config.ts` | — | — (shared config) |

### Frontend Components
| File | Purpose |
|------|---------|
| `src/contexts/OrgContext.tsx` | Organisation data loading, context provider, realtime subscription |
| `src/hooks/useSubscription.ts` | Subscription state, PLAN_LIMITS, tier feature flags |
| `src/hooks/useOrgTimezone.ts` | Timezone-aware formatting hook |
| `src/hooks/useOrgMembers.ts` | Team member management |
| `src/hooks/useOrgPaymentPreferences.ts` | Parent-facing payment prefs via restricted view |
| `src/components/settings/OrganisationTab.tsx` | Org name, address, timezone, currency, teacher visibility |
| `src/components/settings/BrandingTab.tsx` | Logo upload, brand colours, invoice branding |
| `src/components/settings/BillingTab.tsx` | Subscription tier display, upgrade flow |
| `src/components/settings/InvoiceSettingsTab.tsx` | VAT, payment terms, overdue reminders |
| `src/components/settings/SchedulingSettingsTab.tsx` | Schedule hours, cancellation notice |
| `src/components/settings/ContinuationSettingsTab.tsx` | Term continuation defaults |
| `src/components/settings/OrgMembersTab.tsx` | Team members, role changes |
| `src/components/settings/SettingsNav.tsx` | Settings tab navigation (22 tabs, 12 admin-only) |
| `src/pages/Settings.tsx` | Settings page router with role-based tab visibility |
| `src/lib/utils.ts` | Currency formatting (formatCurrencyMinor, currencySymbol), timezone formatting |
| `src/integrations/supabase/types.ts` | Generated TypeScript types |

---

## 2. Schema Documentation: `organisations` Table

### Core Columns
| Column | Type | Default | NOT NULL | Constraint |
|--------|------|---------|----------|------------|
| `id` | UUID | `gen_random_uuid()` | Yes | PRIMARY KEY |
| `name` | TEXT | — | Yes | — |
| `org_type` | `org_type` ENUM | `'solo_teacher'` | Yes | Values: solo_teacher, studio, academy, agency |
| `country_code` | TEXT | `'GB'` | Yes | — |
| `currency_code` | TEXT | `'GBP'` | Yes | No CHECK — any text accepted |
| `timezone` | TEXT | `'Europe/London'` | Yes | No CHECK — any text accepted |
| `vat_enabled` | BOOLEAN | `false` | Yes | — |
| `vat_rate` | NUMERIC(5,2) | `0` | Yes | No range CHECK |
| `vat_registration_number` | TEXT | NULL | No | — |
| `created_by` | UUID | — | Yes | FK → auth.users(id) ON DELETE SET NULL |
| `created_at` | TIMESTAMPTZ | `now()` | Yes | — |
| `address` | TEXT | NULL | No | — |

### Subscription Columns
| Column | Type | Default | NOT NULL | Constraint |
|--------|------|---------|----------|------------|
| `subscription_plan` | ENUM | `'trial'` | Yes | Values: trial, solo_teacher, academy, agency, custom |
| `subscription_status` | ENUM | `'trialing'` | Yes | Values: trialing, active, past_due, cancelled, paused |
| `trial_ends_at` | TIMESTAMPTZ | NULL | No | — |
| `past_due_since` | TIMESTAMPTZ | NULL | No | — |
| `cancels_at` | TIMESTAMPTZ | NULL | No | — |
| `max_students` | INTEGER | 9999 | Yes | — |
| `max_teachers` | INTEGER | 1 | Yes | — |
| `stripe_customer_id` | TEXT | NULL | No | — |
| `stripe_subscription_id` | TEXT | NULL | No | — |

### Stripe Connect Columns
| Column | Type | Default | NOT NULL | Constraint |
|--------|------|---------|----------|------------|
| `stripe_connect_account_id` | TEXT | NULL | No | — |
| `stripe_connect_status` | TEXT | NULL | No | — |
| `stripe_connect_onboarded_at` | TIMESTAMPTZ | NULL | No | — |
| `platform_fee_percent` | NUMERIC | NULL | No | — |

### Branding Columns
| Column | Type | Default | NOT NULL | Constraint |
|--------|------|---------|----------|------------|
| `logo_url` | TEXT | NULL | No | — |
| `brand_color` | TEXT | `'#1a1a2e'` | No | — |
| `accent_color` | TEXT | `'#6366f1'` | No | — |
| `invoice_from_name` | TEXT | NULL | No | — |
| `invoice_footer_note` | TEXT | NULL | No | — |
| `invoice_number_prefix` | TEXT | NULL | No | — |
| `invoice_number_digits` | INTEGER | `5` | No | — |

### Payment Columns
| Column | Type | Default | NOT NULL | Constraint |
|--------|------|---------|----------|------------|
| `payment_methods_enabled` | TEXT[] | `'{card}'` | No | — |
| `bank_account_name` | TEXT | NULL | No | — |
| `bank_sort_code` | TEXT | NULL | No | — |
| `bank_account_number` | TEXT | NULL | No | — |
| `bank_reference_prefix` | TEXT | NULL | No | — |
| `online_payments_enabled` | BOOLEAN | `true` | No | — |

### Scheduling & Policy Columns
| Column | Type | Default | NOT NULL | Constraint |
|--------|------|---------|----------|------------|
| `default_lesson_length_mins` | INTEGER | `60` | Yes | On teachers table, not organisations |
| `billing_approach` | TEXT | `'termly'` | No | No CHECK — accepts any text |
| `block_scheduling_on_closures` | BOOLEAN | `false` | No | — |
| `schedule_start_hour` | INTEGER | `7` | Yes | Trigger validates 0-23 |
| `schedule_end_hour` | INTEGER | `21` | Yes | Trigger validates 0-23, must be > start |
| `cancellation_notice_hours` | INTEGER | NULL | No | — |
| `buffer_minutes_between_locations` | INTEGER | `0` | No | — |
| `overdue_reminder_days` | INTEGER[] | `'{7,14,30}'` | No | — |
| `auto_pause_lessons_after_days` | INTEGER | NULL | No | — |
| `parent_reschedule_policy` | TEXT | NULL | No | CHECK: self_service, request_only, admin_locked |

### Make-Up & Continuation Columns
| Column | Type | Default | NOT NULL | Constraint |
|--------|------|---------|----------|------------|
| `make_up_waitlist_expiry_weeks` | INTEGER | `8` | No | — |
| `credit_expiry_days` | INTEGER | `90` | No | — |
| `max_credits_per_term` | INTEGER | NULL | No | — |
| `continuation_notice_weeks` | INTEGER | `3` | No | — |
| `continuation_assumed_continuing` | BOOLEAN | `true` | No | — |
| `continuation_reminder_days` | INTEGER[] | `'{7,14}'` | No | — |

### Visibility & AI Columns
| Column | Type | Default | NOT NULL | Constraint |
|--------|------|---------|----------|------------|
| `teacher_payment_notifications_enabled` | BOOLEAN | `true` | Yes | — |
| `teacher_payment_analytics_enabled` | BOOLEAN | `true` | Yes | — |
| `ai_preferences` | JSONB | NULL | No | — |
| `default_exam_board_id` | UUID | NULL | No | — |

---

## 3. Findings Table

| ID | Severity | Description | File(s) | Recommended Fix |
|----|----------|-------------|---------|-----------------|
| ORG-01 | **CRITICAL** | No CHECK constraint or validation on `timezone` column. Invalid IANA timezone string (e.g. "GMT+0", "InvalidZone") can be stored. All downstream code falls back to 'Europe/London' silently, masking the bug. | `20260119231348_*.sql`, `OrgContext.tsx:320` | Add DB CHECK against allowlist or validate via trigger. Frontend uses dropdown but direct API can bypass. |
| ORG-02 | **CRITICAL** | No CHECK constraint on `currency_code` column. Any text value accepted. Invalid currency would break `Intl.NumberFormat` and cause runtime errors in invoices/emails. | `20260119231348_*.sql` | Add CHECK constraint: `currency_code IN ('GBP','EUR','USD','AUD','CAD','NZD')` or validate via trigger. |
| ORG-03 | **HIGH** | Race condition in student/teacher limit triggers. `check_student_limit()` and `check_teacher_limit()` use count-then-check without `FOR UPDATE` lock on organisations row. Two concurrent INSERTs can both pass the check and exceed the limit. | `20260222195918_*.sql`, `20260222220553_*.sql` | Add `SELECT max_students INTO _max_students FROM organisations WHERE id = NEW.org_id FOR UPDATE` to acquire row lock. |
| ORG-04 | **HIGH** | Logo upload has no server-side MIME validation. Client validates `file.type.startsWith('image/')` but the `org-logos` bucket is public and RLS only checks membership, not file content. Attacker can bypass client validation and upload SVG with embedded XSS or non-image files. | `BrandingTab.tsx:208`, `20260123215702_*.sql` | Add storage policy or edge function with server-side MIME whitelist (image/png, image/jpeg, image/webp only). Block SVG. |
| ORG-05 | **HIGH** | `BillingTab.tsx` hardcodes `currencySymbol('GBP')` for subscription pricing display. Non-UK orgs see `£` symbol instead of their org currency. | `BillingTab.tsx:124` | Change to `currencySymbol(currentOrg?.currency_code \|\| 'GBP')` |
| ORG-06 | **HIGH** | `create-continuation-run` edge function has hardcoded 3-currency symbol map (EUR/USD/GBP only). AUD/CAD/NZD orgs get `$` instead of correct symbol in continuation emails. | `create-continuation-run/index.ts:938-939` | Use `Intl.NumberFormat()` (available in Deno) for currency formatting, matching the pattern in `overdue-reminders`. |
| ORG-07 | **MEDIUM** | `credit-expiry-warning` uses UTC `new Date().toISOString()` instead of org timezone for expiry date comparison. Credits may be flagged as expiring on wrong day for non-UTC timezones. | `credit-expiry-warning/index.ts:28-29` | Fetch org timezone and use `toLocaleDateString("en-CA", { timeZone: tz })` for date comparison. |
| ORG-08 | **MEDIUM** | `credit-expiry-warning` uses partial currency symbol mapping: `(code === "GBP") ? "£" : code`. Non-GBP codes render as ISO code (e.g., "EUR12.50") instead of symbol. | `credit-expiry-warning/index.ts:117` | Use `Intl.NumberFormat()` for consistent currency formatting. |
| ORG-09 | **MEDIUM** | No currency change warning/guard. Changing `currency_code` mid-operation affects new invoices but not existing ones. If rates remain in old currency's minor units, new invoices show wrong amounts (e.g., 2500 pence = £25 becomes $25 instead of ~$31). | `OrganisationTab.tsx:177` | Add confirmation dialog for currency changes. Optionally block if unpaid invoices exist. |
| ORG-10 | **MEDIUM** | `onboarding-setup` has hardcoded timezone-to-currency mapping covering only 6 timezone prefixes. Orgs in unlisted timezones (e.g., Asia/Tokyo, Africa/*) get defaulted to GBP. | `onboarding-setup/index.ts` | Expand mapping or require explicit currency selection during onboarding. |
| ORG-11 | **MEDIUM** | `send-enrolment-offer` edge function lacks role check. Any authenticated org member (including teacher/finance) can trigger enrolment offers. | `send-enrolment-offer/index.ts` | Add membership role check: owner/admin only. |
| ORG-12 | **MEDIUM** | No `billing_approach` CHECK constraint. Column accepts any text but frontend expects 'monthly', 'termly', or 'custom'. | Schema | Add CHECK constraint or convert to ENUM. |
| ORG-13 | **MEDIUM** | `vat_rate` has no range constraint. Negative rates or rates > 100% can be stored. | `20260119231348_*.sql` | Add CHECK: `vat_rate >= 0 AND vat_rate <= 100`. |
| ORG-14 | **LOW** | Organisation deletion is hard-delete with ON DELETE CASCADE. No soft-delete, no grace period, no data retention for compliance. | `20260119231348_*.sql` | Consider adding `deleted_at` TIMESTAMPTZ for soft-delete with 90-day retention. |
| ORG-15 | **LOW** | `stripe-connect-onboard` lacks idempotency protection. Calling twice could create duplicate Stripe Connect accounts. | `stripe-connect-onboard/index.ts` | Check if `stripe_connect_account_id` already exists before creating new account. |
| ORG-16 | **LOW** | 21 instances of `.toLocaleDateString()` in frontend (noted in claude.md as deferred). These use browser locale, not org timezone. | Various components | Post-beta: migrate to `useOrgTimezone()` hook. |
| ORG-17 | **LOW** | `booking-get-slots` public endpoint exposes org `schedule_start_hour` and `schedule_end_hour`. Minor information disclosure of operational hours. | `booking-get-slots/index.ts` | Acceptable for booking page functionality. Document as intended. |

---

## 4. RLS Policy Matrix

### `organisations` Table
| Action | Policy Name | Expression | Who Can? |
|--------|-------------|------------|----------|
| SELECT | "Users can view their organisations" | `is_org_member(auth.uid(), id)` | Any active member of the org |
| INSERT | "Authenticated users can create organisations" | `auth.uid() = created_by` | Any authenticated user (becomes owner via trigger) |
| UPDATE | "Org admins can update organisations" | `is_org_admin(auth.uid(), id)` | Owner or admin only |
| DELETE | "Org owners can delete organisations" | `has_org_role(auth.uid(), id, 'owner')` | Owner only |

**Cross-org isolation:** Verified. `is_org_member()` checks `org_memberships` for active membership. Member of org A cannot see org B.

### `org_memberships` Table
| Action | Policy Name | Expression | Who Can? |
|--------|-------------|------------|----------|
| SELECT | "Members can view org memberships" | `is_org_member(auth.uid(), org_id)` | Any active member |
| INSERT | "Org admins can create memberships" | `is_org_admin(auth.uid(), org_id)` | Owner or admin |
| UPDATE | "Org admins can update memberships" | `is_org_admin(auth.uid(), org_id)` | Owner or admin |
| DELETE | "Org admins can delete memberships" | `is_org_admin(auth.uid(), org_id) AND role != 'owner'` | Owner or admin (cannot delete owner) |

### `org-logos` Storage Bucket
| Action | Policy Name | Expression | Who Can? |
|--------|-------------|------------|----------|
| SELECT | "Public read access for logos" | `bucket_id = 'org-logos'` | Public (anyone) |
| INSERT | "Users can upload logos for their org" | org_id folder match + owner/admin role | Owner or admin |
| UPDATE | "Admins can update logos" | org_id folder match + owner/admin role | Owner or admin |
| DELETE | "Admins can delete logos" | org_id folder match + owner/admin role | Owner or admin |

### `parent_org_info` View
- Restricted column set: id, name, bank details, online_payments_enabled, currency_code, cancellation_notice_hours, parent_reschedule_policy
- `security_invoker = on` ensures underlying RLS is enforced
- Only authenticated users with org membership can read

### Subscription Field Protection
| Trigger | Protects | Logic |
|---------|----------|-------|
| `protect_org_subscription_fields` | subscription_plan, subscription_status, max_students, max_teachers, stripe_customer_id, stripe_subscription_id, trial_ends_at, past_due_since, cancels_at | Reverts changes unless caller is `service_role` |
| `prevent_org_id_change` | org_id on child tables | Blocks any org_id mutation |

### Role Access Summary
| Role | Can SELECT org? | Can UPDATE org? | Can DELETE org? | Can upload logo? |
|------|----------------|-----------------|-----------------|------------------|
| Owner | Yes | Yes | Yes | Yes |
| Admin | Yes | Yes | No | Yes |
| Teacher | Yes | No | No | No |
| Finance | Yes | No | No | No |
| Parent | Via restricted view only | No | No | No |

---

## 5. Tier Limits Documentation

### Limit Definitions

**Backend** (`supabase/functions/_shared/plan-config.ts`):
```
solo_teacher: { max_students: 9999, max_teachers: 1 }
academy:      { max_students: 9999, max_teachers: 5 }
agency:       { max_students: 9999, max_teachers: 9999 }
CANCELLED:    { max_students: 5,    max_teachers: 1 }
TRIAL_DAYS:   30
```

**Frontend** (`src/hooks/useSubscription.ts` — PLAN_LIMITS):
| Plan | Max Students | Max Teachers | Advanced Reports | Multi-Location | Custom Branding | API Access | LoopAssist | Priority Support |
|------|-------------|-------------|-----------------|----------------|----------------|------------|------------|-----------------|
| trial | 9999 | 1 | No | No | No | No | Yes | No |
| solo_teacher | 9999 | 1 | Yes | No | No | No | Yes | No |
| academy | 9999 | 5 | Yes | Yes | Yes | No | Yes | Yes |
| agency | 9999 | 9999 | Yes | Yes | Yes | Yes | Yes | Yes |
| custom | 9999 | 9999 | Yes | Yes | Yes | Yes | Yes | Yes |

### Enforcement Points

| Limit | Where Enforced | Mechanism | Error Message |
|-------|---------------|-----------|---------------|
| Max students | DB trigger `enforce_student_limit` | BEFORE INSERT on students | "Student limit reached for this plan. Please upgrade." |
| Max teachers | DB trigger `enforce_teacher_limit` | BEFORE INSERT on org_memberships | "Teacher limit reached for this plan. Please upgrade." |
| Subscription active | DB trigger `enforce_subscription_active_*` | BEFORE INSERT on students, lessons, invoices | "Your subscription is inactive. Please renew to continue." |
| Subscription fields | DB trigger `protect_org_subscription_fields` | BEFORE UPDATE on organisations | Silently reverts non-service_role changes |
| Feature flags | Frontend only (`useSubscription`) | UI gating | No error — features simply hidden |

### What Happens at Limit

- **Student limit hit:** INSERT fails with PostgreSQL exception. Frontend shows error toast.
- **Teacher limit hit:** INSERT into org_memberships fails. Invite flow shows error.
- **Subscription cancelled:** All new students, lessons, and invoices blocked. Existing data readable.
- **Trial expired:** Cron job (`trial-expired`) sets status to 'cancelled', limits to CANCELLED_LIMITS (5 students, 1 teacher). Owner emailed.
- **Downgrade (over limit):** Existing records preserved. New inserts blocked until under limit. No forced deletion of existing data.

### Race Condition Risk (ORG-03)
The limit triggers use `SELECT COUNT(*) ... INTO _current_count` followed by `IF _current_count >= _max_students`. Without `FOR UPDATE` on the organisations row, two concurrent transactions can both read the same count and both succeed, exceeding the limit by 1. Risk is low for typical usage but exists.

---

## 6. Timezone Propagation Map

### Where Org Timezone Is Read

| Location | File | Usage | Fallback |
|----------|------|-------|----------|
| Dashboard prefetch | `OrgContext.tsx:212` | Convert "today" to UTC for lesson query | `'Europe/London'` |
| Timezone formatting hook | `useOrgTimezone.ts:5,9` | Format dates/times in org timezone | `'Europe/London'` |
| Organisation settings | `OrganisationTab.tsx:107,120` | Display/edit timezone | `'Europe/London'` |
| Lesson form | `useLessonForm.ts` | Convert lesson times to UTC for storage | `'Europe/London'` |
| Billing run | `create-billing-run/index.ts:558` | Calculate "today" in org timezone | Read from DB |
| Invoice overdue check | `invoice-overdue-check/index.ts:33` | Calculate "today" in org timezone | Read from DB |
| Booking slots | `booking-get-slots/index.ts:85` | Calculate available slots in org timezone | Read from DB |
| iCal feed | `calendar-ical-feed/index.ts` | Set calendar timezone | Read from DB |
| Portal schedule | `PortalSchedule.tsx` | Display lesson times | `'Europe/London'` |
| Process term adjustment | `process-term-adjustment/index.ts` | Date calculations | Read from DB |

### Timezone Change Propagation

| Entity | Effect When TZ Changes | Notes |
|--------|----------------------|-------|
| Existing lessons | Display shifts (UTC timestamps unchanged) | Warning dialog shown to user |
| Future lessons | Created in new timezone | Correct |
| Existing invoices | Due dates unchanged (stored as dates) | Correct |
| Future billing runs | Use new timezone for "today" | Correct |
| Booking slots | Immediately use new timezone | Correct |
| iCal feed | Immediately use new timezone | Correct |

### Inconsistencies Found

1. **credit-expiry-warning** (ORG-07): Uses UTC `new Date()` instead of org timezone
2. **21 `.toLocaleDateString()` calls** (ORG-16): Use browser locale, not org timezone (deferred to post-beta)
3. **onboarding-setup**: No timezone validation — invalid string accepted

---

## 7. Currency Propagation Map

### Where Org Currency Is Read

| Location | File | Usage | Fallback |
|----------|------|-------|----------|
| Formatting utilities | `utils.ts:61-89` | `formatCurrency()`, `formatCurrencyMinor()`, `currencySymbol()` | `'GBP'` |
| Rate cards | `RateCardsTab.tsx:82` | Display rate amounts | `'GBP'` |
| Invoice creation | `CreateInvoiceModal.tsx:112` | Invoice currency | `'GBP'` |
| Invoice detail | `InvoiceDetail.tsx:128` | Display amounts | `'GBP'` |
| Billing tab | `BillingTab.tsx:124` | Subscription pricing | **Hardcoded 'GBP'** (ORG-05) |
| Billing run | `create-billing-run/index.ts` | Invoice generation | Read from DB |
| Continuation run | `create-continuation-run/index.ts:938` | Email currency symbol | **Hardcoded 3-way map** (ORG-06) |
| Credit expiry warning | `credit-expiry-warning/index.ts:117` | Email currency symbol | **Partial mapping** (ORG-08) |
| Overdue reminders | `overdue-reminders/index.ts:134` | Email currency formatting | `Intl.NumberFormat` (correct) |
| Payment receipt | `send-payment-receipt/index.ts` | Receipt formatting | Read from DB |
| LoopAssist chat | `looopassist-chat/index.ts` | AI context | Read from DB |
| Parent LoopAssist | `parent-loopassist-chat/index.ts` | AI context | Read from DB |
| All invoice components (~15) | Various | Display amounts | `'GBP'` fallback |

### Currency Change Propagation

| Entity | Effect When Currency Changes | Notes |
|--------|---------------------------|-------|
| Existing invoices | Keep stored `currency_code` | Invoices snapshot currency at creation |
| Future invoices | Use new currency | Amounts may be wrong if rates not updated |
| Rate cards | Display in new currency | Same numeric values, different currency |
| Lesson rates | Display in new currency | Same numeric values — **data integrity risk** |
| Emails | Use new currency for new emails | Old emails already sent |

### Inconsistencies Found

1. **BillingTab.tsx** (ORG-05): Hardcoded `currencySymbol('GBP')`
2. **create-continuation-run** (ORG-06): Only maps EUR/USD/GBP symbols
3. **credit-expiry-warning** (ORG-08): Partial symbol mapping, falls back to ISO code
4. **No currency change warning** (ORG-09): Can change currency without understanding impact on existing rates

---

## 8. Verdict

### **NOT PRODUCTION READY**

### Blocking Issues (Must Fix Before Launch)

| ID | Severity | Issue | Effort |
|----|----------|-------|--------|
| **ORG-01** | CRITICAL | No timezone validation — invalid values silently accepted | 30 min (add DB trigger or CHECK) |
| **ORG-02** | CRITICAL | No currency_code validation — invalid values cause runtime errors | 30 min (add CHECK constraint) |
| **ORG-03** | HIGH | Tier limit race condition — concurrent inserts can exceed limits | 15 min (add FOR UPDATE to triggers) |
| **ORG-04** | HIGH | Logo upload has no server-side file type validation | 1 hr (add storage hook or edge function) |
| **ORG-05** | HIGH | BillingTab hardcodes GBP for subscription pricing display | 5 min (use org currency) |

### Non-Blocking Issues (Fix Post-Beta)

| ID | Severity | Issue |
|----|----------|-------|
| ORG-06 | HIGH | Continuation email currency symbol limited to 3 currencies |
| ORG-07 | MEDIUM | Credit expiry warning uses UTC instead of org timezone |
| ORG-08 | MEDIUM | Credit expiry warning partial currency mapping |
| ORG-09 | MEDIUM | No currency change confirmation/guard |
| ORG-10 | MEDIUM | Onboarding timezone-to-currency mapping incomplete |
| ORG-11 | MEDIUM | send-enrolment-offer missing role check |
| ORG-12 | MEDIUM | billing_approach has no CHECK constraint |
| ORG-13 | MEDIUM | vat_rate has no range constraint |
| ORG-14 | LOW | Hard-delete org with no recovery period |
| ORG-15 | LOW | stripe-connect-onboard lacks idempotency |
| ORG-16 | LOW | 21 `.toLocaleDateString()` instances use browser locale |
| ORG-17 | LOW | booking-get-slots exposes schedule hours publicly |

### What's Working Well

- **RLS policies** are comprehensive and correctly isolate orgs. Cross-org leakage is not possible.
- **Subscription field protection** trigger prevents client-side tampering with plan/status/limits.
- **org_id immutability** trigger prevents data from being reassigned between orgs.
- **Realtime org refresh** ensures settings changes propagate to all open tabs immediately.
- **Logo upload UX** has good client-side validation (type, size, dimensions, resize).
- **Timezone change warning** dialog is well-implemented.
- **Invoice branding** architecture is solid with live preview.
- **parent_org_info** restricted view properly limits data exposure to parents.
- **Subscription enforcement** via DB triggers blocks writes when subscription is inactive.
- **Academic terms** properly scoped to organisations with cascading deletes.
