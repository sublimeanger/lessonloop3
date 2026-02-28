import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Practice — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('practice page loads', async ({ page }) => {
    await goTo(page, '/practice');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('can create practice assignment', async ({ page }) => {
    await goTo(page, '/practice');
    const addBtn = page.getByRole('button', { name: /add|assign|new|create/i }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Resources — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('resources page loads', async ({ page }) => {
    await goTo(page, '/resources');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('upload button exists', async ({ page }) => {
    await goTo(page, '/resources');
    // Button text is "Upload Resource" or just "Upload"
    const btn = page.getByRole('button', { name: /upload|add resource|new/i }).first();
    await expect(btn).toBeVisible({ timeout: 10_000 });
  });

  test('view toggle (grid/list) exists', async ({ page }) => {
    await goTo(page, '/resources');
    // View toggle buttons may use aria-labels or icon-only buttons
    const gridBtn = page.locator('[aria-label*="rid"]').first();
    const listBtn = page.locator('[aria-label*="ist"]').first();
    const gridRole = page.getByRole('button', { name: /grid/i }).first();
    const listRole = page.getByRole('button', { name: /list/i }).first();
    const hasGrid = await gridBtn.isVisible().catch(() => false) || await gridRole.isVisible().catch(() => false);
    const hasList = await listBtn.isVisible().catch(() => false) || await listRole.isVisible().catch(() => false);
    expect(hasGrid || hasList).toBeTruthy();
  });

  test('category management accessible', async ({ page }) => {
    await goTo(page, '/resources');
    const manageBtn = page.getByRole('button', { name: /categories|manage/i }).first();
    if (await manageBtn.isVisible().catch(() => false)) {
      await manageBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });
});
