

# LessonLoop Systematic E2E Test Plan -- Implementation

## Overview

This plan implements the uploaded 980-line test plan as a rigorous, multi-layered testing suite. The work is structured into **3 phases**, prioritised by the document's P0/P1/P2 tiers, and uses two testing strategies:

1. **Vitest unit/integration tests** -- testing hooks, utility logic, permission gating, data transformations, and component rendering in isolation
2. **Browser-based E2E validation** -- using the browser tool to walk through real flows against the live preview with seeded data

---

## Phase 1: P0 Smoke Suite (Blocks Release)

These are the 12 P0 test cases from the plan. Each will be implemented as both a Vitest test file (where applicable) and a browser walkthrough.

### 1.1 Test Files to Create

**`src/test/auth/RouteGuard.test.tsx`** -- LL-AUTH-P0-01
- Test that each role routes to the correct landing page (owner/admin to /dashboard, teacher to /dashboard with scoped data, finance to /dashboard, parent to /portal/home)
- Test that unauthenticated users are redirected to /login
- Test that onboarding-incomplete users are redirected to /onboarding
- Test that PublicRoute redirects authenticated users appropriately
- Test allowedRoles enforcement (finance cannot access /calendar, teacher cannot access /invoices, parent cannot access staff routes)

**`src/test/calendar/ConflictDetection.test.ts`** -- LL-SCH-P0-01
- Test student double-booking returns severity: 'error'
- Test teacher overlap returns severity: 'error'
- Test room collision returns severity: 'error'
- Test external calendar conflict returns severity: 'warning' (not blocking)
- Test closure date returns error when block_scheduling_on_closures is true, warning when false
- Test teacher time-off returns severity: 'error'
- Test teacher outside availability returns severity: 'warning'
- Test travel buffer between locations generates correct warning

**`src/test/billing/InvoiceCalculations.test.ts`** -- LL-BIL-P0-01 / LL-BIL-P0-02
- Test VAT calculation (0% and 20%)
- Test subtotal, tax, and total computations
- Test credit offset reduces total correctly (never below 0)
- Test line item quantity * unit_price = amount
- Test billing run deduplication (multi-student payer receives one invoice)
- Test billing run skips already-billed lesson IDs

**`src/test/billing/MakeUpCredits.test.ts`** -- LL-CRD-P0-01
- Test credit issuance records origin lesson
- Test credit cannot be double-redeemed (redeemed_at is already set)
- Test expired credits are filtered from availableCredits
- Test credit eligibility check against cancellation_notice_hours

**`src/test/permissions/FeatureGate.test.ts`** -- LL-SEC-P0-01
- Test FEATURE_MATRIX returns correct access per plan
- Test trial expired blocks access
- Test each plan's limits (teacher count, multi-location, etc.)

**`src/test/permissions/RoleNavigation.test.ts`** -- LL-SEC-P0-01
- Test getNavItems returns correct nav items per role
- Test owner/admin sees full navigation (13 items including Teachers, Locations)
- Test finance sees only Dashboard, Invoices, Reports, Messages, Settings, Help
- Test teacher sees own-scoped items (no Teachers, Locations, Invoices)
- Test parent sees portal navigation only

**`src/test/audit/AuditLog.test.ts`** -- LL-AUD-P0-01
- Test audit log entry structure (actor, timestamp, entity_type, action, before/after)
- Test getChangeDescription produces correct descriptions for each entity type
- Test actor name resolution from profiles

**`src/test/register/Attendance.test.ts`** -- LL-REG-P0-01
- Test attendance upsert with present/absent/late statuses
- Test mark lesson complete changes status to 'completed'
- Test teacher scope filter (teacher sees only own lessons)

**`src/test/portal/ParentPortal.test.ts`** -- LL-PAY-P0-01 / LL-MSG-P0-01
- Test useParentSummary returns oldest unpaid invoice for Pay Now
- Test parent invoices are scoped to guardian's payer_guardian_id
- Test children list only includes linked students
- Test message request creation requires guardian context

**`src/test/subscription/PlanGating.test.ts`** -- LL-SUB-P0-01
- Test PLAN_LIMITS for each subscription tier
- Test useLimitCheck boundary enforcement
- Test upgrade path logic (trial -> teacher -> studio -> agency)
- Test plan-feature matrix matches expected access per plan

### 1.2 Browser E2E Validation (P0)

After tests are written, the following flows will be walked through in the live preview using the browser tool, leveraging the seeded demo data:

1. Login as owner -- verify dashboard loads with org branding
2. Navigate to /calendar -- create a lesson, verify defaults populate from student teaching defaults
3. Attempt student double-booking -- verify it is blocked with error conflict
4. Navigate to /invoices -- verify stats widget shows correct counts
5. Navigate to /register -- mark attendance (present, absent, late)
6. Navigate to /settings/audit -- verify recent actions appear in the audit log

---

## Phase 2: P1 Regression Suite

### 2.1 Test Files to Create

**`src/test/crm/DeleteValidation.test.ts`** -- LL-CRM-P1-02
- Test checkStudentDeletion blocks when future lessons exist
- Test checkStudentDeletion blocks when unpaid invoices exist
- Test checkStudentDeletion warns about unredeemed credits
- Test checkGuardianDeletion blocks when guardian is payer on unpaid invoices
- Test checkGuardianDeletion warns when student would have no remaining guardians
- Test checkTeacherRemoval blocks when teacher has upcoming lessons
- Test checkLocationDeletion blocks when location has scheduled lessons
- Test checkRoomDeletion blocks when room has scheduled lessons

**`src/test/calendar/RecurringSeries.test.ts`** -- LL-SCH-P0-02 / LL-SCH-P1-03
- Test that editing a single occurrence does not affect other occurrences in the series
- Test that editing future occurrences changes only events from the selected date onward
- Test that calendar deep links preserve date and teacher filters from URL params

**`src/test/reports/InvoiceStats.test.ts`** -- LL-RPT-P1-01
- Test invoice stats aggregation (outstanding, overdue, draft, paid counts and totals)
- Test overdue detection logic (sent invoices past due date)
- Test invoice filter by status maps to correct invoice sets

**`src/test/messaging/MessageRequests.test.ts`** -- LL-MSG-P0-01
- Test message request creation with all required fields
- Test request types (cancellation, reschedule, general)
- Test request status lifecycle (pending -> approved/declined)

**`src/test/practice/PracticeStreaks.test.ts`** -- LL-PRC-P1-01
- Test streak badge tier calculation
- Test assignment target validation

**`src/test/settings/OrgSettings.test.ts`** -- LL-SET-P1-01
- Test cancellation notice hours persist and affect credit eligibility
- Test reschedule policy modes drive portal behaviour

### 2.2 Browser E2E Validation (P1)

- Create a student using the wizard, link guardians, set primary payer
- Teacher card click -> calendar deep link with teacher filter applied
- Run a billing run and verify invoice deduplication (multi-student payer gets one invoice)
- Revenue, Outstanding, Payroll reports load with correct data
- PDF download works for draft/sent/paid invoices

---

## Phase 3: P2 Extended / Performance

**`src/test/performance/CalendarLoad.test.ts`** -- LL-PER-P2-01
- Test that useCalendarData handles 100+ lessons without crashing
- Test that abort controller properly cancels stale requests
- Test LESSONS_PAGE_SIZE limit is respected

**`src/test/performance/BillingScale.test.ts`** -- LL-PER-P2-02
- Test billing run with large payer groups does not create duplicate invoices
- Test Set-based deduplication of addedLessonIds

Browser validation:
- Load calendar with seeded agency demo data (3,300+ lessons) and verify week view renders
- Run billing run on large dataset, verify no duplicates

---

## Technical Approach

### Test Mocking Strategy

Since Vitest tests run in jsdom (no real Supabase), the following mocking patterns will be used:

- **Supabase client**: Mock `@/integrations/supabase/client` with vi.mock, returning chainable query builders that resolve to test data
- **Auth context**: Mock `useAuth` to return different user/profile/role combinations per test
- **Org context**: Mock `useOrg` to return different org types and subscription plans
- **React Router**: Use `MemoryRouter` for component tests requiring routing
- **React Query**: Wrap components in `QueryClientProvider` with a fresh QueryClient per test

### File Organisation

All test files will be placed alongside or mirroring the source structure:

```text
src/test/
  auth/
    RouteGuard.test.tsx
  calendar/
    ConflictDetection.test.ts
    RecurringSeries.test.ts
  billing/
    InvoiceCalculations.test.ts
    MakeUpCredits.test.ts
  permissions/
    FeatureGate.test.ts
    RoleNavigation.test.ts
  audit/
    AuditLog.test.ts
  register/
    Attendance.test.ts
  portal/
    ParentPortal.test.ts
  crm/
    DeleteValidation.test.ts
  reports/
    InvoiceStats.test.ts
  messaging/
    MessageRequests.test.ts
  practice/
    PracticeStreaks.test.ts
  settings/
    OrgSettings.test.ts
  subscription/
    PlanGating.test.ts
  performance/
    CalendarLoad.test.ts
    BillingScale.test.ts
  helpers/
    mockSupabase.ts       -- reusable Supabase mock factory
    mockAuth.ts           -- reusable Auth context mock
    mockOrg.ts            -- reusable Org context mock
    testWrappers.tsx      -- test wrapper with all providers
```

### Test Helpers (`src/test/helpers/`)

A shared mock infrastructure to avoid duplication:

- `mockSupabase.ts` -- factory that creates chainable .from().select().eq() mocks with configurable return data
- `mockAuth.ts` -- returns mock AuthContext values for each role
- `mockOrg.ts` -- returns mock OrgContext values for each org/subscription type
- `testWrappers.tsx` -- React wrapper component with QueryClientProvider, MemoryRouter, and mocked contexts

### Test IDs Mapping

Each test case is tagged with the plan's ID for traceability:

| Plan ID | Test File | Description |
|---|---|---|
| LL-AUTH-P0-01 | RouteGuard.test.tsx | Login + role routing |
| LL-SCH-P0-01 | ConflictDetection.test.ts | Calendar conflicts |
| LL-SCH-P0-02 | RecurringSeries.test.ts | Recurring edit modes |
| LL-REG-P0-01 | Attendance.test.ts | Daily register |
| LL-BIL-P0-01 | InvoiceCalculations.test.ts | Billing runs |
| LL-CRD-P0-01 | MakeUpCredits.test.ts | Credit lifecycle |
| LL-PAY-P0-01 | ParentPortal.test.ts | Parent pay flow |
| LL-MSG-P0-01 | MessageRequests.test.ts | Parent requests |
| LL-SEC-P0-01 | FeatureGate.test.ts + RoleNavigation.test.ts | Permissions |
| LL-AUD-P0-01 | AuditLog.test.ts | Audit log |
| LL-SUB-P0-01 | PlanGating.test.ts | Subscription gating |

### Execution Order

1. Create test helpers (mockSupabase, mockAuth, mockOrg, testWrappers) -- these are dependencies for all tests
2. Create Phase 1 P0 test files (all 10 files)
3. Run Vitest to verify all P0 tests pass
4. Browser E2E validation of P0 flows
5. Create Phase 2 P1 test files (6 files)
6. Run Vitest to verify P1 tests pass
7. Browser E2E validation of P1 flows
8. Create Phase 3 P2 test files (2 files)
9. Final full test suite run

### Estimated Output

- ~18 test files + 4 helper files = 22 new files
- ~150-200 individual test cases covering all P0/P1/P2 scenarios
- Each test file maps directly to a test plan ID for audit traceability
- Test plan document will be saved to the project at `docs/TEST_PLAN.md` for reference

