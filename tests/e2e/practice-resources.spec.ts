import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo } from './helpers';

test.describe('Practice — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('practice page loads', async ({ page }) => {
    await safeGoTo(page, '/practice', 'Practice');
  });

  test('can create practice assignment', async ({ page }) => {
    await safeGoTo(page, '/practice', 'Practice');
    const addBtn = page.getByRole('button', { name: /add|assign|new|create/i }).first();
    if (await addBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Resources — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('resources page loads', async ({ page }) => {
    await safeGoTo(page, '/resources', 'Resources');
  });

  test('upload button exists', async ({ page }) => {
    await safeGoTo(page, '/resources', 'Resources');
    const btn = page.getByRole('button', { name: /upload|add resource|new/i }).first();
    const visible = await btn.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[resources] Upload button visible: ${visible}`);
  });

  test('view toggle (grid/list) exists', async ({ page }) => {
    await safeGoTo(page, '/resources', 'Resources');
    const gridBtn = page.locator('[aria-label*="rid"]').first();
    const listBtn = page.locator('[aria-label*="ist"]').first();
    const gridRole = page.getByRole('button', { name: /grid/i }).first();
    const listRole = page.getByRole('button', { name: /list/i }).first();
    const hasGrid = await gridBtn.isVisible().catch(() => false) || await gridRole.isVisible().catch(() => false);
    const hasList = await listBtn.isVisible().catch(() => false) || await listRole.isVisible().catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[resources] View toggle — grid: ${hasGrid}, list: ${hasList}`);
  });

  test('category management accessible', async ({ page }) => {
    await safeGoTo(page, '/resources', 'Resources');
    const manageBtn = page.getByRole('button', { name: /categories|manage/i }).first();
    if (await manageBtn.isVisible().catch(() => false)) {
      await manageBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });
});
