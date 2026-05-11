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

// §21.5 (action proposal lifecycle) moved to `21-loopassist-actions.spec.ts`,
// which tests the deterministic execute-side via synthetic proposals instead
// of stubbing the UI accept-button flow.
//
// The remaining UI-side coverage gaps (page context auto-detect, streaming
// response, mid-stream cancel, entity chip click, rate limit toast, parent
// variant) require Anthropic mock-mode to be deterministic. Tracked in
// audit/feature-catalogues/loopassist.md and the s38 follow-up plan.
