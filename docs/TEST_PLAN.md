# LessonLoop — Systematic E2E Test Plan

> **Last updated:** 2026-02-07
> **Total test cases:** ~274 across 18 files
> **Framework:** Vitest + jsdom + @testing-library/react
> **Status:** All tests passing ✅

---

## Test ID Traceability Matrix

| Plan ID | Priority | Test File | Module | Tests |
|---|---|---|---|---|
| LL-AUTH-P0-01 | P0 | `src/test/auth/RouteGuard.test.tsx` | Auth & routing | Role-based redirects, guard enforcement, public route handling |
| LL-SCH-P0-01 | P0 | `src/test/calendar/ConflictDetection.test.ts` | Calendar | Student/teacher/room conflicts, closures, availability, travel buffer |
| LL-BIL-P0-01 | P0 | `src/test/billing/InvoiceCalculations.test.ts` | Billing | VAT calc, line items, credit offsets, billing run deduplication |
| LL-CRD-P0-01 | P0 | `src/test/billing/MakeUpCredits.test.ts` | Credits | Issuance, double-redemption block, expiry filtering, notice eligibility |
| LL-SEC-P0-01 | P0 | `src/test/permissions/FeatureGate.test.ts` | Permissions | Feature matrix per plan, trial expiry gating |
| LL-SEC-P0-01 | P0 | `src/test/permissions/RoleNavigation.test.ts` | Permissions | Nav item visibility per role (owner/admin/teacher/finance/parent) |
| LL-AUD-P0-01 | P0 | `src/test/audit/AuditLog.test.ts` | Audit | Entry structure, change descriptions, actor resolution |
| LL-REG-P0-01 | P0 | `src/test/register/Attendance.test.ts` | Register | Attendance upsert, lesson completion, teacher scope |
| LL-PAY-P0-01 | P0 | `src/test/portal/ParentPortal.test.ts` | Parent portal | Invoice scoping, children list, Pay Now, message requests |
| LL-SUB-P0-01 | P0 | `src/test/subscription/PlanGating.test.ts` | Subscription | Plan limits, upgrade paths, limit boundary checks |
| LL-CRM-P1-02 | P1 | `src/test/crm/DeleteValidation.test.ts` | CRM | Deletion blocking for students/guardians/teachers/locations/rooms |
| LL-SCH-P0-02 | P1 | `src/test/calendar/RecurringSeries.test.ts` | Calendar | this_only vs this_and_future edits, deep link params |
| LL-RPT-P1-01 | P1 | `src/test/reports/InvoiceStats.test.ts` | Reports | Stats aggregation, overdue detection, status filtering |
| LL-MSG-P0-01 | P1 | `src/test/messaging/MessageRequests.test.ts` | Messaging | Request creation, types, status lifecycle |
| LL-PRC-P1-01 | P1 | `src/test/practice/PracticeStreaks.test.ts` | Practice | Streak tier calc, assignment validation |
| LL-SET-P1-01 | P1 | `src/test/settings/OrgSettings.test.ts` | Settings | VAT, cancellation notice, reschedule policy |
| LL-PER-P2-01 | P2 | `src/test/performance/CalendarLoad.test.ts` | Performance | 500+ lesson stress, abort controller, page size limits |
| LL-PER-P2-02 | P2 | `src/test/performance/BillingScale.test.ts` | Performance | Large-scale dedup, multi-student payer grouping |

---

## Coverage by Module

| Module | P0 | P1 | P2 | Total |
|---|---|---|---|---|
| Auth & Permissions | 3 files | — | — | ~50 tests |
| Calendar & Scheduling | 1 file | 1 file | 1 file | ~45 tests |
| Billing & Invoicing | 2 files | 1 file | 1 file | ~55 tests |
| CRM & Data Integrity | — | 1 file | — | ~20 tests |
| Parent Portal | 1 file | — | — | ~15 tests |
| Messaging | — | 1 file | — | ~12 tests |
| Practice & Streaks | — | 1 file | — | ~10 tests |
| Audit & Compliance | 1 file | — | — | ~15 tests |
| Settings & Config | — | 1 file | — | ~15 tests |
| Subscription & Gating | 1 file | — | — | ~20 tests |
| Performance & Scale | — | — | 2 files | ~20 tests |

---

## Test Infrastructure

### Helper Files (`src/test/helpers/`)

| File | Purpose |
|---|---|
| `mockSupabase.ts` | Chainable PostgREST query builder mock with configurable per-table responses |
| `mockAuth.ts` | Pre-built AuthContext states for each role (owner, admin, teacher, finance, parent) |
| `mockOrg.ts` | Pre-built OrgContext states for each org type and subscription tier |
| `testWrappers.tsx` | React wrapper with QueryClientProvider + MemoryRouter + TooltipProvider |

### Mocking Strategy

- **Supabase client**: `vi.mock('@/integrations/supabase/client')` with chainable builders
- **Auth context**: `vi.mock('@/contexts/AuthContext')` returning role-specific state
- **Org context**: `vi.mock('@/contexts/OrgContext')` returning org/subscription state
- **React Router**: `MemoryRouter` with configurable `initialEntries`
- **React Query**: Fresh `QueryClient` per test (retry: false, gcTime: 0)

---

## Running Tests

```bash
# Run full suite
npm test

# Run specific phase
npx vitest run src/test/auth/ src/test/calendar/ src/test/billing/ src/test/permissions/ src/test/audit/ src/test/register/ src/test/portal/ src/test/subscription/

# Run single file
npx vitest run src/test/billing/InvoiceCalculations.test.ts

# Watch mode
npx vitest --watch
```

---

## Browser E2E Validation Checklist

### P0 Flows (Verified)
- [x] Owner login → dashboard with KPIs and org branding
- [x] Calendar week view renders with lessons
- [x] Invoice stats widget shows correct counts
- [x] Student management (create, view, edit)

### P1 Flows (Verified)
- [x] Dashboard KPI cards load with seeded data
- [x] Calendar renders 3,300+ lessons without errors
- [x] Invoice stats (draft/sent/overdue/paid) match data
- [x] Student list and detail pages functional

### P2 Flows (Verified)
- [x] Agency demo data (300+ students, 3,300+ lessons) loads successfully
- [x] Week view calendar renders at scale

---

## Priority Definitions

| Priority | Definition | Gate |
|---|---|---|
| **P0** | Blocks release. Must pass before any deploy. | Smoke suite |
| **P1** | Regression coverage. Must pass before major release. | Regression suite |
| **P2** | Performance and scale. Validates system under load. | Extended suite |

---

## UK-Specific Validations

- All financial calculations use minor units (pence) to avoid floating-point errors
- VAT at 20% standard rate tested explicitly
- Currency code defaults to GBP
- Date formatting follows DD/MM/YYYY convention
- Timezone defaults to Europe/London
