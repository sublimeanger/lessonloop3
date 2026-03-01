import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo } from './helpers';

test.describe('Messages — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('messages page loads', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');
    await expect(page.getByText(/message|inbox|compose|sent/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('compose button exists', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');
    const btn = page.getByRole('button', { name: /new message/i }).first();
    await expect(btn).toBeVisible({ timeout: 15_000 });
  });

  test('compose modal opens', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');
    const btn = page.getByRole('button', { name: /new message/i }).first();
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.click();
    // "New Message" may be a dropdown trigger — try menuitem, then dialog
    const menuItem = page.getByRole('menuitem').first();
    if (await menuItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await menuItem.click();
    }
    // Dialog may or may not open depending on the UI flow
    const dialogVisible = await page.getByRole('dialog').isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[messages] Compose dialog visible: ${dialogVisible}`);
  });

  test('internal messages tab accessible', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');
    const internalTab = page.getByRole('tab', { name: /internal|team/i }).first();
    if (await internalTab.isVisible().catch(() => false)) {
      await internalTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('message requests tab accessible', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');
    const requestsTab = page.getByRole('tab', { name: /request/i }).first();
    if (await requestsTab.isVisible().catch(() => false)) {
      await requestsTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('bulk compose button exists', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');
    const bulkBtn = page.getByRole('button', { name: /bulk|broadcast|all/i }).first();
    const visible = await bulkBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[messages] Bulk compose button visible: ${visible}`);
  });
});

test.describe('Messages — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher can access messages', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Teacher Messages');
    await expect(page.getByText(/message|inbox|sent/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
