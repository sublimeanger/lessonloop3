/**
 * 18 — Resources (upload, share, categories)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §18
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.parent);
});

test.describe('Resources page', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error', async ({ page }) => {
    await goTo(page, '/resources');
    await assertNoErrorBoundary(page);
  });
});

test.fixme('§18.2 — upload PDF → row + storage object', async () => {});
test.fixme('§18.3 — share with 2 students → 2 resource_shares rows', async () => {});
test.fixme('§18.4 — parent of one student sees the resource on portal', async () => {});
test.fixme('§18.4 — parent of unrelated student does NOT (RLS)', async () => {});
test.fixme('§18.3 — archive student → cleanup_resource_shares_on_student_archive removes shares', async () => {});
