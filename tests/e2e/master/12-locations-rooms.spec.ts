/**
 * 12 — Locations & rooms
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §12
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
});

test.describe('Locations page', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error', async ({ page }) => {
    await goTo(page, '/locations');
    await assertNoErrorBoundary(page);
  });
});

test.fixme('§12.2 — add school location + 2 rooms', async () => {});
test.fixme('§12.2 — set primary auto-unchecks previous', async () => {});
test.fixme('§12.2 — delete room with upcoming lesson is blocked', async () => {});
test.fixme('§12.2 — archive location with no lessons succeeds', async () => {});
