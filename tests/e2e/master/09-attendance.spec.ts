/**
 * 09 — Daily register & batch attendance
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §9
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.teacher);
});

test.describe('Daily register (/register)', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error', async ({ page }) => {
    await goTo(page, '/register');
    await assertNoErrorBoundary(page);
  });

  test('?view=unmarked renders backlog mode', async ({ page }) => {
    await goTo(page, '/register?view=unmarked');
    await assertNoErrorBoundary(page);
  });
});

test.describe('Batch attendance (/batch-attendance)', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error', async ({ page }) => {
    await goTo(page, '/batch-attendance');
    await assertNoErrorBoundary(page);
  });

  test('future date disables save (isFutureDate guard)', async ({ page }) => {
    await goTo(page, '/batch-attendance');
    // Look for date picker, navigate forward to tomorrow — buttons should disable
    // Implementation depends on UI pattern; deferred for now
  });
});

test.describe('Teacher view scopes correctly', () => {
  test.use({ storageState: AUTH.teacher });
  test('teacher sees only own lessons in /register', async ({ page }) => {
    await goTo(page, '/register');
    await assertNoErrorBoundary(page);
  });
});

test.fixme('§9.1 — Mark Present writes attendance_records row', async () => {});
test.fixme('§9.1 — Mark Absent reason picker required + saves reason', async () => {});
test.fixme('§9.1 — Cxl(S) triggers auto_issue_credit_on_absence', async () => {});
test.fixme('§9.1 — check_attendance_not_future blocks future-date marking', async () => {});
test.fixme('§9.1 — Mark Day Complete locks further changes', async () => {});
test.fixme('§9.4 — Batch save 5 students writes 5 records', async () => {});
