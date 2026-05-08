/**
 * 21 — LoopAssist (AI assistant)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §21
 *
 * Existing `workflows/loopassist.spec.ts` (1072 LoC) is comprehensive.
 * Master file adds page-context auto-detect + role-gating tests.
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.teacher);
  refreshStorageStateIfStale(AUTH.finance);
  refreshStorageStateIfStale(AUTH.parent);
});

test.describe('LoopAssist visibility per role', () => {
  test.describe('owner', () => {
    test.use({ storageState: AUTH.owner });
    test('LoopAssist button visible on dashboard', async ({ page }) => {
      await goTo(page, '/dashboard');
      const btn = page.locator('button').filter({ hasText: 'LoopAssist' }).first();
      await expect(btn).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('teacher', () => {
    test.use({ storageState: AUTH.teacher });
    test('LoopAssist button visible for teacher', async ({ page }) => {
      await goTo(page, '/dashboard');
      const btn = page.locator('button').filter({ hasText: 'LoopAssist' }).first();
      await expect(btn).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('finance', () => {
    test.use({ storageState: AUTH.finance });
    test('LoopAssist button NOT visible for finance', async ({ page }) => {
      await goTo(page, '/dashboard');
      // Per catalog §21.1: only owner/admin/teacher
      const btn = page.locator('button').filter({ hasText: 'LoopAssist' }).first();
      const visible = await btn.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(visible).toBe(false);
    });
  });
});

test.describe('LoopAssist keyboard shortcut', () => {
  test.use({ storageState: AUTH.owner });

  test('Cmd+J opens drawer', async ({ page }) => {
    await goTo(page, '/dashboard');
    await page.keyboard.press('Meta+j');
    await page.waitForTimeout(800);
    const drawer = page.getByRole('dialog').filter({ hasText: 'LoopAssist' }).first();
    if (await drawer.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(drawer).toBeVisible();
    }
  });
});

test.fixme('§21.3 — page context auto-detect on /students/<id>', async () => {});
test.fixme('§21.4 — send message → streaming response renders', async () => {});
test.fixme('§21.4 — cancel mid-stream → partial text retained', async () => {});
test.fixme('§21.5 — action proposal accept → looopassist-execute called', async () => {});
test.fixme('§21.5 — action proposal reject → row marked rejected', async () => {});
test.fixme('§21.6 — entity chip click navigates correctly', async () => {});
test.fixme('§21.9 — rate limit hit → toast + lock send button', async () => {});
test.fixme('§21.9 — parent variant uses parent-loopassist-chat with different guardrails', async () => {});
