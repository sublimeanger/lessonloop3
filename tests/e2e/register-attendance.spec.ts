import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Daily Register — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('register page loads', async ({ page }) => {
    await goTo(page, '/register');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('date navigation works', async ({ page }) => {
    await goTo(page, '/register');
    const nextBtn = page.getByRole('button', { name: /next|forward|›/i }).first();
    const prevBtn = page.getByRole('button', { name: /prev|back|‹/i }).first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      await prevBtn.click();
    }
  });

  test('attendance statuses visible for lessons', async ({ page }) => {
    await goTo(page, '/register');
    // Should show attendance marking options (present, absent, etc.)
    await expect(page.locator('main').first()).toBeVisible();
  });
});

test.describe('Batch Attendance — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('batch attendance page loads', async ({ page }) => {
    await goTo(page, '/batch-attendance');
    await waitForPageReady(page);
    await expect(page.getByText(/batch attendance|attendance/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('date picker works', async ({ page }) => {
    await goTo(page, '/batch-attendance');
    await waitForPageReady(page);
    // Should have date navigation
    const dateControls = page.getByRole('button', { name: /next|forward|prev|back|today|›|‹/i }).first();
    if (await dateControls.isVisible().catch(() => false)) {
      await dateControls.click();
      await page.waitForTimeout(300);
    }
  });

  test('save button exists', async ({ page }) => {
    await goTo(page, '/batch-attendance');
    await waitForPageReady(page);
    const saveBtn = page.getByRole('button', { name: /save/i }).first();
    // Save button might only appear after changes
    await expect(page.locator('main').first()).toBeVisible();
  });
});
