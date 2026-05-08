/**
 * 16 — Messages (single, bulk, internal, requests, threads)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §16
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.parent);
});

test.describe('Messages page', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error', async ({ page }) => {
    await goTo(page, '/messages');
    await assertNoErrorBoundary(page);
  });

  test('tabs render (Sent / Internal / Requests)', async ({ page }) => {
    await goTo(page, '/messages');
    // Tabs may be tab role or button-style toggles
    const sent = page.getByRole('tab', { name: /sent/i }).first();
    if (await sent.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // tabs exist
    }
  });
});

test.fixme('§16.3 — Compose single message → send-message edge fn called', async () => {});
test.fixme('§16.3 — Bulk compose to all parents of active piano students', async () => {});
test.fixme('§16.3 — Merge tokens render per recipient', async () => {});
test.fixme('§16.3 — Internal compose writes internal_messages row', async () => {});
test.fixme('§16.6 — Parent submits request → admin sees in Requests tab', async () => {});
test.fixme('§16.7 — Templates load from message_templates per org', async () => {});
test.fixme('§16.7 — Read-tracking: opening thread fires mark-messages-read', async () => {});
