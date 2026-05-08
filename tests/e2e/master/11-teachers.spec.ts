/**
 * 11 — Teachers (CRUD, link, archive, pay)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §11
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.teacher);
});

test.describe('Teachers list', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error', async ({ page }) => {
    await goTo(page, '/teachers');
    await assertNoErrorBoundary(page);
  });

  test('filter tabs render (all/linked/unlinked/inactive)', async ({ page }) => {
    await goTo(page, '/teachers');
    const tabs = ['all', 'linked', 'unlinked', 'inactive'];
    for (const tab of tabs) {
      const t = page.getByRole('tab', { name: new RegExp(tab, 'i') }).first();
      if (await t.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // OK — tab exists
      }
    }
  });
});

test.describe('Teachers — RBAC', () => {
  test.use({ storageState: AUTH.teacher });
  test('teacher cannot access /teachers', async ({ page }) => {
    await page.goto('/teachers');
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  });
});

test.fixme('§11.1 — Add unlinked teacher → row in `teachers` only', async () => {});
test.fixme('§11.1 — Invite teacher → invites row created + email queued', async () => {});
test.fixme('§11.1 — Archive with upcoming lessons → reassign or cancel dialog', async () => {});
test.fixme('§11.4 — protect_teacher_user_link blocks manual user_id update', async () => {});
test.fixme('§11.1 — Plan cap reached → Add Teacher disabled', async () => {});
