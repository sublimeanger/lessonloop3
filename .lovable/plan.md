

## Plan: Automate Patrick's System Test as Playwright E2E Specs

Convert the 17-part manual test document into automated Playwright E2E test files that Patrick (or CI) can run repeatedly. This gives permanent regression coverage rather than a one-time manual pass.

### What gets automated (~150 of ~200 test cases)

| Part | File | Coverage |
|------|------|----------|
| 1 | `signup-onboarding.spec.ts` | Signup validation, onboarding wizard steps, dashboard landing |
| 2 | `crud-students-lessons.spec.ts` | Add 3 students, guardians, 4 lessons, calendar views, search, CSV export |
| 3 | `attendance.spec.ts` | Daily register, batch attendance, lesson notes, student notes on register |
| 4 | `invoicing.spec.ts` | Create/send/pay invoice, billing run, payment plans |
| 5 | `messages.spec.ts` | Compose, thread view, internal notes, requests tab |
| 6 | `teachers-locations.spec.ts` | CRUD teachers, locations, rooms |
| 7 | `secondary-modules.spec.ts` | Leads, waitlist, make-ups, practice, resources, notes explorer |
| 8 | `bulk-operations.spec.ts` | Bulk slot generator, bulk edit/cancel lessons |
| 9 | `reports.spec.ts` | All 7 report types load, filters, exports |
| 10 | `settings.spec.ts` | All 21 settings tabs load and save |
| 11 | `loopassist.spec.ts` | Drawer open/close, keyboard shortcut, send query |
| 12 | `parent-portal.spec.ts` | Portal home, nav, schedule, invoices, messages, practice |
| 13 | `rbac-roles.spec.ts` | Teacher/finance/admin/parent access checks (extends existing `rbac.spec.ts`) |
| 14 | `mobile-responsive.spec.ts` | 390px viewport checks, no overflow, tap targets, page refresh |
| 15 | `keyboard-shortcuts.spec.ts` | `?`, `Cmd+K`, `Cmd+J`, Escape |

### What stays manual (~50 cases)

- Email inbox verification (1.2.4, 4.1.11)
- Stripe checkout redirect (16.3)
- Qualitative UX opinions (Part 17)
- Real PDF download verification (4.2.6)

### Structure

All files go in `tests/e2e/workflows/system-test/` with a shared setup that uses Patrick's accounts. Each file is independently runnable:

```
tests/e2e/workflows/system-test/
├── 01-signup-onboarding.spec.ts
├── 02-crud-data.spec.ts
├── 03-attendance.spec.ts
├── 04-invoicing.spec.ts
├── 05-messages.spec.ts
├── 06-teachers-locations.spec.ts
├── 07-secondary-modules.spec.ts
├── 08-bulk-operations.spec.ts
├── 09-reports.spec.ts
├── 10-settings.spec.ts
├── 11-loopassist.spec.ts
├── 12-parent-portal.spec.ts
├── 13-rbac-roles.spec.ts
├── 14-mobile-responsive.spec.ts
├── 15-keyboard-shortcuts.spec.ts
└── helpers.ts          (shared auth, cleanup, test data)
```

### Auth approach

- Parts 1 (fresh signup): Uses `generateTestId()` to create unique test emails, cleans up after
- Parts 2-11: Uses Patrick's owner auth state
- Part 12: Uses Patrick's parent auth state  
- Part 13: Uses all 4 role-specific auth states
- Part 14-15: Uses Patrick's owner auth state at 390px viewport

### Cleanup

Each spec uses `afterAll` to clean up created test data (students, lessons, invoices) via the existing `supabaseAdmin` helpers, scoped by `generateTestId()` prefixes.

### Environment

Tests use existing `.env.test` credentials plus Patrick's accounts. A new `AUTH` entry for each Patrick role will be added to the helpers.

### Implementation order

I'll build these in batches of 3-4 files per message, starting with the highest-priority launch blockers (Parts 1, 2, 4, 12, 13).

