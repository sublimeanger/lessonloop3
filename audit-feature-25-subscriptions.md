# Audit — Feature 25: Subscription & Plans

**Date:** 2026-03-16
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Stripe subscription management, tier limits, enforcement, upgrade/downgrade flows, trial handling, protect_subscription_fields trigger

---

## 1. Files Audited

### Database (Migrations)
| # | File | Purpose |
|---|------|---------|
| 1 | `supabase/migrations/20260125171857_*.sql` | Base subscription_plan/status enums, initial subscription fields on organisations |
| 2 | `supabase/migrations/20260222195918_*.sql` | `check_student_limit()` trigger on students |
| 3 | `supabase/migrations/20260222220553_*.sql` | Initial teacher limit trigger |
| 4 | `supabase/migrations/20260222220714_*.sql` | `is_org_write_allowed()` + `check_subscription_active()` functions |
| 5 | `supabase/migrations/20260222220737_*.sql` | `stripe_webhook_events` deduplication table |
| 6 | `supabase/migrations/20260222220835_*.sql` | `past_due_since` column for grace period |
| 7 | `supabase/migrations/20260222221039_*.sql` | `protect_subscription_fields()` trigger (initial) |
| 8 | `supabase/migrations/20260222221104_*.sql` | `check_subscription_active()` with real-time trial expiry check |
| 9 | `supabase/migrations/20260222221125_*.sql` | `cancels_at` column |
| 10 | `supabase/migrations/20260222221139_*.sql` | Updated `protect_subscription_fields()` with `cancels_at` |
| 11 | `supabase/migrations/20260303120000_*.sql` | 7-day grace period enforcement + triggers on guardians/attendance/practice_logs |
| 12 | `supabase/migrations/20260315100400_*.sql` | `teacher_limit_exceeded` boolean column |
| 13 | `supabase/migrations/20260315220010_*.sql` | Teacher limit trigger fix (TCH-01, race-safe with FOR UPDATE) |

### Edge Functions
| # | File | Purpose |
|---|------|---------|
| 14 | `supabase/functions/stripe-subscription-checkout/index.ts` | Creates Stripe Checkout sessions for subscription upgrades |
| 15 | `supabase/functions/stripe-webhook/index.ts` | Handles all Stripe events: subscription lifecycle, payments, refunds |
| 16 | `supabase/functions/stripe-customer-portal/index.ts` | Opens Stripe Billing Portal for subscription management |
| 17 | `supabase/functions/trial-expired/index.ts` | Cron: finds expired trials, downgrades, sends email |
| 18 | `supabase/functions/invite-accept/index.ts` | Checks teacher limit before accepting invite |
| 19 | `supabase/functions/onboarding-setup/index.ts` | Sets initial trial state on org creation |
| 20 | `supabase/functions/_shared/plan-config.ts` | Canonical PLAN_LIMITS, CANCELLED_LIMITS, TRIAL_DAYS |

### Frontend
| # | File | Purpose |
|---|------|---------|
| 21 | `src/hooks/useSubscription.ts` | Main subscription state hook (PLAN_LIMITS, status derivation) |
| 22 | `src/hooks/useFeatureGate.ts` | Feature gating by plan (FEATURE_MATRIX, FEATURE_MIN_PLAN) |
| 23 | `src/hooks/useUsageCounts.ts` | Student/teacher/location usage counts + limit checks |
| 24 | `src/hooks/useSubscriptionCheckout.ts` | Stripe checkout initiation + portal opening |
| 25 | `src/lib/pricing-config.ts` | Centralized pricing display config (PLAN_KEY_MAP, PRICING_CONFIG) |
| 26 | `src/contexts/OrgContext.tsx` | Organisation context with subscription fields + realtime updates |
| 27 | `src/components/settings/BillingTab.tsx` | Complete billing UI: status, usage, plan selection, downgrade confirmation |
| 28 | `src/components/subscription/FeatureGate.tsx` | `<FeatureGate>`, `<FeatureLockedOverlay>`, `<LimitReached>`, `<FeatureBadge>` |
| 29 | `src/components/subscription/UpgradeBanner.tsx` | Trial/upgrade banner with countdown |
| 30 | `src/components/subscription/TrialExpiredModal.tsx` | Trial expiration modal |
| 31 | `src/pages/Students.tsx` | Student limit enforcement UI |
| 32 | `src/pages/Teachers.tsx` | Teacher limit enforcement UI |
| 33 | `src/pages/Locations.tsx` | Location multi_location feature gate |
| 34 | `src/test/subscription/PlanGating.test.ts` | Unit tests for plan limits + state derivation |

---

## 2. Tier Limits Matrix

### Numeric Limits

| Limit | Trial | Teacher (£12/mo) | Studio (£29/mo) | Agency (£79/mo) | Cancelled | Where Enforced |
|-------|-------|-------------------|------------------|------------------|-----------|----------------|
| **Max Teachers** | 1 | 1 | 5 | 9999 (unlimited) | 1 | DB trigger `check_teacher_limit()` on INSERT/UPDATE of `teachers` |
| **Max Students** | 9999 (unlimited) | 9999 | 9999 | 9999 | 5 | DB trigger `check_student_limit()` on INSERT of `students` |
| **Storage** | 500MB | 500MB | 2GB | 10GB | — | Frontend display only (no server enforcement found) |

### Feature Gating

| Feature | Trial | Teacher | Studio | Agency | Where Enforced |
|---------|-------|---------|--------|--------|----------------|
| Advanced Reports | No | Yes | Yes | Yes | Client: `useFeatureGate('advanced_reports')` |
| Multi-Location | No | No | Yes | Yes | Client: `useFeatureGate('multi_location')` in Locations.tsx |
| Custom Branding | No | No | Yes | Yes | Client: `useFeatureGate('custom_branding')` |
| API Access | No | No | No | Yes | Client: `useFeatureGate('api_access')` |
| LoopAssist AI | Yes | Yes | Yes | Yes | Client: `useFeatureGate('loop_assist')` |
| Priority Support | No | No | Yes | Yes | Client: `useFeatureGate('priority_support')` |
| Bulk Messaging | No | Yes | Yes | Yes | Client only |
| Payroll Reports | No | No | Yes | Yes | Client only |
| Billing Runs | No | Yes | Yes | Yes | Client only |
| Calendar Sync | No | Yes | Yes | Yes | Client: CalendarIntegrationsTab.tsx |
| Lead Pipeline | No | Yes | Yes | Yes | Client: Leads.tsx |
| Teacher Performance | No | No | Yes | Yes | Client: TeacherPerformance.tsx |

### Subscription Write Gating (DB-level)

| Table | Trigger | Blocks When |
|-------|---------|-------------|
| students | `enforce_subscription_active_students` | Subscription inactive (cancelled/expired/past_due >7d) |
| lessons | `enforce_subscription_active_lessons` | Same |
| invoices | `enforce_subscription_active_invoices` | Same |
| guardians | `enforce_subscription_active_guardians` | Same |
| attendance_records | `enforce_subscription_active_attendance_records` | Same |
| practice_logs | `enforce_subscription_active_practice_logs` | Same |
| resource_categories | `check_subscription_resource_categories` | Same |
| resource_category_assignments | `check_subscription_resource_category_assignments` | Same |

---

## 3. Findings

| # | Severity | Area | Finding | Detail |
|---|----------|------|---------|--------|
| SUB-01 | **LOW** | Consistency | `teacher_limit_exceeded` flag is set but never read on frontend | The `checkTeacherLimitExceeded()` in stripe-webhook sets `teacher_limit_exceeded = true/false` on the organisations table, but no `.tsx` file reads this field. The flag exists in the DB and is properly set on downgrades, but there is no UI warning banner for admins about being over the teacher limit after a downgrade. The DB trigger (`check_teacher_limit`) still blocks *new* teacher creation, so enforcement works — the gap is informational only. |
| SUB-02 | **LOW** | Consistency | Feature gates are client-only — no server enforcement | Features like `multi_location`, `custom_branding`, `api_access`, `advanced_reports` are gated only via `useFeatureGate()` on the client. A user with API knowledge could bypass these by calling Supabase directly. However: (a) these features are UI convenience features, not security-critical data access, (b) RLS still scopes all data to the user's org, (c) no sensitive data is exposed. Acceptable for current stage. |
| SUB-03 | **INFO** | Limits | No `max_locations` enforced at DB level | Locations are gated via `useFeatureGate('multi_location')` (academy+ only), but there's no numeric limit on how many locations a studio/agency org can create. This is by design (no `max_locations` field exists), but worth noting. |
| SUB-04 | **INFO** | Limits | Storage limits are display-only | `STORAGE_LIMITS` in pricing-config.ts (500MB/2GB/10GB/unlimited) are shown in the UI but not enforced anywhere server-side. No file upload size checking against plan quota exists. |
| SUB-05 | **PASS** | Security | `protect_subscription_fields` trigger is comprehensive | Protects 9 fields: `subscription_plan`, `subscription_status`, `max_students`, `max_teachers`, `stripe_customer_id`, `stripe_subscription_id`, `trial_ends_at`, `past_due_since`, `cancels_at`. Only `service_role` can modify these. Client-side UPDATE to organisations table cannot tamper with subscription data. |
| SUB-06 | **PASS** | Security | Stripe webhook signature verification | `stripe.webhooks.constructEvent(body, signature, webhookSecret)` with proper error handling. Returns 400 on invalid signature. |
| SUB-07 | **PASS** | Security | Webhook deduplication | `stripe_webhook_events` table with unique constraint on `event_id`. Duplicate events return 200 with `duplicate: true` (graceful, no re-processing). |
| SUB-08 | **PASS** | Stripe | Subscription checkout auth | Owner/admin role check via `org_memberships`. Active subscription redirects to portal instead of creating new checkout. Checkout session expires in 30 minutes. |
| SUB-09 | **PASS** | Stripe | Plan change detection in webhook | `PRICE_TO_PLAN` reverse lookup detects plan changes via current price ID, even when changed through Stripe Portal (not just via LessonLoop UI). |
| SUB-10 | **PASS** | Downgrade | Teacher limit exceeded flag on downgrade | `checkTeacherLimitExceeded()` runs after every `subscription.updated` webhook. Counts active org_memberships with role='teacher'. Sets/clears flag correctly. |
| SUB-11 | **PASS** | Downgrade | Subscription deletion handling | `handleSubscriptionDeleted()` applies `CANCELLED_LIMITS` (5 students, 1 teacher), clears `stripe_subscription_id`, sets status to 'cancelled'. |
| SUB-12 | **PASS** | Trial | Trial initialization | `onboarding-setup` sets `subscription_status: 'trialing'`, `trial_ends_at: now + 30 days`, with plan-appropriate limits. |
| SUB-13 | **PASS** | Trial | Trial expiration | `trial-expired` cron finds expired trials, downgrades to `CANCELLED_LIMITS`, sends email via Resend with restore link. Uses `validateCronAuth()` for auth. |
| SUB-14 | **PASS** | Trial | Real-time trial expiry check | `check_subscription_active()` includes a real-time check: even if the cron hasn't run yet, DB trigger blocks inserts for orgs where `subscription_status = 'trialing' AND trial_ends_at < now()`. |
| SUB-15 | **PASS** | Grace Period | 7-day past_due grace period | `is_org_write_allowed()` allows writes for `past_due` orgs only within 7 days of `past_due_since`. Frontend `PAST_DUE_GRACE_DAYS = 7` matches. Backend `is_org_write_allowed()` uses `INTERVAL '7 days'`. |
| SUB-16 | **PASS** | Stripe | Payment failure handling | `invoice.payment_failed` webhook sets `subscription_status: 'past_due'` and records `past_due_since`. Recovery (subsequent successful payment) clears `past_due_since` via `subscription.updated` handler. |
| SUB-17 | **PASS** | Stripe | Pending cancellation | `cancel_at_period_end` detected in `subscription.updated`, `cancels_at` set to `current_period_end` timestamp. Frontend shows pending cancellation banner. |
| SUB-18 | **PASS** | Race Conditions | Teacher limit trigger uses FOR UPDATE lock | `check_teacher_limit()` locks the organisations row with `FOR UPDATE` before counting teachers, preventing race conditions where two concurrent inserts could exceed the limit. |
| SUB-19 | **PASS** | Consistency | Plan limits in sync | Backend `_shared/plan-config.ts` and frontend `useSubscription.ts` PLAN_LIMITS match. Frontend additionally overrides with `currentOrg.max_students/max_teachers` from DB (source of truth). |
| SUB-20 | **PASS** | UI | Billing status display | BillingTab shows: plan name, status badge (active/trial/past_due/cancelled), trial countdown, usage progress bars, limit warnings, pending cancellation banner, trial expired warning, plan selection grid with downgrade confirmation dialog. |
| SUB-21 | **PASS** | Invite | Teacher limit checked on invite-accept | `invite-accept` edge function checks teacher count against `max_teachers` before creating teacher record. Returns 403 with upgrade prompt message. |
| SUB-22 | **PASS** | Proration | Delegated to Stripe | Proration is not manually handled — Stripe manages it natively via subscription updates through the Customer Portal and checkout flow. This is correct. |

---

## 4. Plan Configuration Sources (Single Source of Truth Analysis)

| Source | Location | Used By |
|--------|----------|---------|
| **Backend plan limits** | `supabase/functions/_shared/plan-config.ts` | All edge functions (webhook, checkout, trial-expired) |
| **Frontend plan limits** | `src/hooks/useSubscription.ts` PLAN_LIMITS | Client-side limit display + gating |
| **Frontend pricing** | `src/lib/pricing-config.ts` | BillingTab, TrialExpiredModal (display only) |
| **Feature matrix** | `src/hooks/useFeatureGate.ts` FEATURE_MATRIX | All feature gating |
| **DB actual limits** | `organisations.max_students`, `organisations.max_teachers` | DB triggers (authoritative enforcement) |

The DB columns `max_students`/`max_teachers` are the authoritative source. They are set by edge functions using `plan-config.ts` limits and enforced by DB triggers. Frontend reads them from the org record. This is well-architected.

---

## 5. Security Summary

| Vector | Protected? | Mechanism |
|--------|-----------|-----------|
| Client modifying subscription fields | Yes | `protect_subscription_fields` trigger (reverts non-service_role changes) |
| Bypassing tier limits via direct API | Yes (numeric) / Partial (features) | DB triggers enforce student/teacher limits; feature gates are client-only |
| Forged webhooks | Yes | Stripe signature verification + deduplication table |
| Accessing features above tier | Partial | Client-side `useFeatureGate`; no server-side feature enforcement |
| Continued use after cancellation | Yes | `check_subscription_active()` triggers on 8 tables + real-time trial expiry check |
| Race condition on limit check | Yes | `FOR UPDATE` row lock in `check_teacher_limit()` |

---

## 6. Verdict

**PASS — Production Ready**

The subscription system is well-architected with defense in depth:

1. **DB-level enforcement** for hard limits (students, teachers) with race-safe triggers
2. **Webhook signature verification** with deduplication for Stripe event handling
3. **`protect_subscription_fields`** trigger prevents client-side tampering of all 9 subscription fields
4. **Comprehensive subscription lifecycle**: creation, upgrade, downgrade, cancellation, past_due grace period, trial expiry
5. **Consistent plan limits** across backend (plan-config.ts) and frontend (useSubscription.ts), with DB as authoritative source

**Minor gaps (non-blocking):**
- SUB-01: `teacher_limit_exceeded` flag is set but not surfaced in UI (enforcement still works via DB trigger)
- SUB-02: Feature gates are client-only (acceptable — these are UI features, not data access controls)
- SUB-04: Storage limits are display-only (no enforcement)

No critical or high severity findings.
