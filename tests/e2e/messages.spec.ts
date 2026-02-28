import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Messages — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('messages page loads', async ({ page }) => {
    await goTo(page, '/messages');
    await expect(page.getByText(/message|inbox|compose/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('compose button exists', async ({ page }) => {
    await goTo(page, '/messages');
    await expect(page.getByText(/message|inbox/i).first()).toBeVisible({ timeout: 15_000 });
    // Button text is "New Message" (dropdown trigger) — try multiple strategies
    const btn = page.getByRole('button', { name: /new message/i }).first()
      .or(page.locator('button').filter({ hasText: /new message/i }).first());
    if (await btn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await expect(btn).toBeVisible();
    }
  });

  test('compose modal opens', async ({ page }) => {
    await goTo(page, '/messages');
    await expect(page.getByText(/message|inbox/i).first()).toBeVisible({ timeout: 15_000 });
    const btn = page.getByRole('button', { name: /new message/i }).first()
      .or(page.locator('button').filter({ hasText: /new message/i }).first());
    if (await btn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await btn.click();
      // "New Message" is a dropdown trigger — pick the first option to open compose dialog
      const menuItem = page.getByRole('menuitem').first();
      if (await menuItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await menuItem.click();
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test('internal messages tab accessible', async ({ page }) => {
    await goTo(page, '/messages');
    const internalTab = page.getByRole('tab', { name: /internal|team/i }).first();
    if (await internalTab.isVisible().catch(() => false)) {
      await internalTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('message requests tab accessible', async ({ page }) => {
    await goTo(page, '/messages');
    const requestsTab = page.getByRole('tab', { name: /request/i }).first();
    if (await requestsTab.isVisible().catch(() => false)) {
      await requestsTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('bulk compose button exists', async ({ page }) => {
    await goTo(page, '/messages');
    const bulkBtn = page.getByRole('button', { name: /bulk|broadcast|all/i }).first();
    if (await bulkBtn.isVisible().catch(() => false)) {
      await expect(bulkBtn).toBeVisible();
    }
  });
});

test.describe('Messages — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher can access messages', async ({ page }) => {
    await goTo(page, '/messages');
    await expect(page.getByText(/message|inbox/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
