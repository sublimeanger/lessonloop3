/**
 * 17 — Practice (assignments, logs, streaks)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §17
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.parent);
});

test.describe('Practice page (staff)', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error', async ({ page }) => {
    await goTo(page, '/practice');
    await assertNoErrorBoundary(page);
  });
});

test.fixme('§17.2 — Create assignment writes practice_assignments row', async () => {});
test.fixme('§17.3 — Parent logs 30 min → log row + streak updated', async () => {});
test.fixme('§17.3 — Teacher reviews log → reviewed_at set', async () => {});
test.fixme('§17.4 — Streak milestone (3 days) sends streak-notification', async () => {});
test.fixme('§17.5 — reset_stale_streaks cron resets streaks with no log >2 days', async () => {});
test.fixme('§17.5 — complete_expired_assignments cron sets status=completed', async () => {});
