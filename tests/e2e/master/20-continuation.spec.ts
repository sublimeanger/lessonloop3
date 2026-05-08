/**
 * 20 — Continuation (term continuation)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §20
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.parent);
});

test.describe('Continuation page (/continuation)', () => {
  test.use({ storageState: AUTH.owner });
  test('renders without error', async ({ page }) => {
    await goTo(page, '/continuation');
    await assertNoErrorBoundary(page);
  });
});

test.fixme('§20 — create run with 10 students → 10 response rows', async () => {});
test.fixme('§20 — reminder fires send-continuation-reminder', async () => {});
test.fixme('§20 — parent responds via authed portal /portal/continuation', async () => {});
test.fixme('§20 — parent responds via unauthed token /respond/continuation?token=X', async () => {});
test.fixme('§20 — process deadline → non-respondents marked per default', async () => {});
test.fixme('§20 — materialise → lessons rows created in calendar', async () => {});
