
# Comprehensive System Hardening & E2E Validation Plan

## Overview

With the database cleared and security hardened, this plan covers systematic end-to-end testing plus additional hardening measures to ensure LessonLoop is production-bulletproof.

---

## Phase 1: End-to-End User Journey Testing

### 1.1 New User Signup → Onboarding → Dashboard ✅ PASSED

**Test Flow:**
1. Navigate to `/signup` and create a new account
2. Verify auto-login redirects to `/onboarding`
3. Complete profile step (name, org type selection)
4. Select subscription plan → Start Free Trial
5. Confirm redirect to `/dashboard`
6. Verify FirstRunExperience overlay appears

**Validation Points:**
- ✅ Profile created in `profiles` table
- ✅ Organisation created with 30-day trial
- ✅ `org_memberships` links user as `owner`
- ✅ `has_completed_onboarding = true`

---

### 1.2 First Student Creation ✅ PASSED

**Test Flow:**
1. Open StudentWizard from quick actions
2. Enter student details (name, email, DOB)
3. Create new guardian with email and phone
4. Set teaching defaults (location, teacher, rate card)
5. Verify success screen shows created data

**Validation Points:**
- ✅ Student record in `students` table
- ✅ Guardian record in `guardians` table
- ✅ Junction record in `student_guardians` with `is_primary_payer = true`
- ✅ Teaching defaults populated on student record

---

### 1.3 First Lesson Scheduling 🔧 FIX APPLIED

**Test Flow:**
1. Open Calendar and click time slot
2. Select created student → verify defaults auto-populate
3. Set lesson type, duration, and notes
4. Enable recurring (weekly for 4 weeks)
5. Save → verify lessons appear on calendar

**Bug Found & Fixed:**
- Conflict detection was getting stuck in "Checking..." state
- Root cause: Race conditions in useEffect cleanup and state management
- Fix: Simplified debounce logic, added hard 8-second timeout fallback, improved checkKey stability

**Status:** Fix deployed - needs retest

---

### 1.4 Invoice Creation & Payment

**Test Flow:**
1. Navigate to Invoices → Create Invoice
2. Select "From Lessons" tab
3. Choose date range covering scheduled lessons
4. Select lessons and verify payer auto-selected
5. Apply any make-up credits (if present)
6. Generate invoice → verify in list

**Validation Points:**
- Invoice with status `draft`
- `invoice_items` linked to lessons
- Lessons marked as billed (`billing_run_id` populated)
- Credit offset calculated correctly

**Payment Recording:**
1. Open invoice detail
2. Click "Record Payment"
3. Enter full amount → verify status changes to `paid`
4. Test partial payment → verify status remains `sent` with payment recorded

---

## Phase 2: Parent Portal Validation

### 2.1 Guardian Invitation Flow

**Test Flow:**
1. From Settings → Org Members, invite guardian email with `parent` role
2. Accept invite via magic link
3. Login as guardian
4. Verify redirect to `/portal/home`

**Validation Points:**
- Invite token created and sent
- New user gets `parent` role in `org_memberships`
- RouteGuard correctly restricts to portal routes

---

### 2.2 Portal Feature Testing

**Test Items:**
- View upcoming lessons for linked children
- View outstanding invoices with correct balances
- Submit reschedule/cancellation requests
- Practice timer functionality
- Message sending to teacher

---

## Phase 3: Performance & Resilience Hardening

### 3.1 Query Performance Optimisation

**Current State:** Hooks use default React Query settings

**Improvements:**
| Area | Change |
|------|--------|
| Dashboard queries | Add `staleTime: 30000` (30s) to reduce refetches |
| Calendar lessons | Add prefetching for adjacent weeks |
| Invoice list | Add pagination with limit 50 |
| Student list | Add virtual scrolling for 100+ students |

---

### 3.2 Network Resilience

**Improvements:**
- Add exponential backoff to all mutations
- Add offline detection banner with retry mechanism
- Add request timeout handling (30s max)

---

### 3.3 Graceful Degradation

**Improvements:**
- Wrap major dashboard sections in ErrorBoundary (already done at App level)
- Add skeleton loaders for all data-dependent components
- Add retry buttons on failed data fetches

---

## Phase 4: Observability & Monitoring

### 4.1 Error Tracking

**Implementation:**
- Add client-side error logging to edge function
- Log: error message, stack trace, user ID, route, timestamp
- Store in `error_logs` table for admin review

---

### 4.2 Health Metrics Dashboard (Optional)

**Track:**
- Active users (last 24h)
- Failed payments count
- Edge function error rates
- Overdue invoice count

---

## Phase 5: Data Integrity Safeguards

### 5.1 Orphaned Record Prevention

**Already Implemented:**
- Cascade deletes on FK relationships
- GDPR soft-delete with `deleted_at`
- Admin cleanup edge function

**Additional Check:**
- Add scheduled job to detect orphaned `lesson_participants` without lessons
- Add scheduled job to detect `invoice_items` without parent invoices

---

### 5.2 Payment Reconciliation Guards

**Already Implemented:**
- Double-payment protection in webhook
- Payment amount capped to outstanding balance
- Provider reference deduplication

**Additional Check:**
- Add warning when payment exceeds invoice total (should cap at outstanding)
- Add audit log entry for overpayment attempts

---

## Testing Order

```text
1. Signup & Onboarding
   │
   ├── Create Organisation
   │   ├── Verify trial dates
   │   └── Verify role assignment
   │
2. Core Data Setup
   │
   ├── Add Location
   ├── Add Rate Card
   ├── Create Student + Guardian
   │
3. Scheduling
   │
   ├── Create Single Lesson
   ├── Create Recurring Series
   ├── Test Conflict Detection
   │
4. Billing
   │
   ├── Run Billing Wizard
   ├── Manual Invoice
   ├── Record Payment
   ├── Verify Status Updates
   │
5. Parent Portal
   │
   ├── Invite Guardian
   ├── Portal Login
   ├── View Invoices
   └── Submit Request
```

---

## Technical Implementation Summary

| Category | Items |
|----------|-------|
| **E2E Tests** | 5 major user journeys to validate manually via browser |
| **Query Optimisation** | Add `staleTime` to 6 key hooks |
| **Error Handling** | Already have ErrorBoundary, add retry buttons to empty states |
| **Audit** | Payment overpayment warning |
| **Monitoring** | Optional error logging table |

---

## First Testing Step

Start with the core signup flow:

1. Go to `/signup`
2. Create account with test email
3. Complete onboarding as Solo Teacher
4. Verify dashboard loads with FirstRunExperience

This validates authentication, profile creation, organisation setup, and the complete onboarding self-healing flow in one journey.
