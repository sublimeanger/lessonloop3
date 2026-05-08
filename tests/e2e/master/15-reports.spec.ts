/**
 * 15 — Reports (8 reports)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §15
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
});

const REPORTS = [
  { path: '/reports', name: 'Reports hub' },
  { path: '/reports/payroll', name: 'Payroll' },
  { path: '/reports/revenue', name: 'Revenue' },
  { path: '/reports/outstanding', name: 'Outstanding' },
  { path: '/reports/lessons', name: 'Lessons delivered' },
  { path: '/reports/cancellations', name: 'Cancellations' },
  { path: '/reports/attendance', name: 'Attendance' },
  { path: '/reports/utilisation', name: 'Utilisation' },
  { path: '/reports/teacher-performance', name: 'Teacher performance' },
];

test.describe('Reports — basic load', () => {
  test.use({ storageState: AUTH.owner });

  for (const r of REPORTS) {
    test(`${r.name} (${r.path}) loads without error`, async ({ page }) => {
      await goTo(page, r.path);
      await assertNoErrorBoundary(page);
    });
  }
});

test.fixme('§15.4 — CSV export downloads file matching screen data', async () => {});
test.fixme('§15.4 — date range change updates data', async () => {});
test.fixme('§15.4 — empty state when no data in range', async () => {});
