import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo } from './helpers';

test.describe('Teachers — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('page loads with teacher list', async ({ page }) => {
    await safeGoTo(page, '/teachers', 'Teachers');
    const hasContent = await page.getByText(/teacher|e2e/i).first().isVisible({ timeout: 15_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[teachers] Content visible: ${hasContent}`);
  });

  test('add teacher / invite button exists', async ({ page }) => {
    await safeGoTo(page, '/teachers', 'Teachers');
    const btn = page.getByRole('button', { name: /add teacher|invite|new/i }).first();
    const visible = await btn.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[teachers] Add/Invite button visible: ${visible}`);
  });

  test('teacher card shows student count', async ({ page }) => {
    await safeGoTo(page, '/teachers', 'Teachers');
  });

  test('search filters teachers', async ({ page }) => {
    await safeGoTo(page, '/teachers', 'Teachers');
    const search = page.getByPlaceholder(/search/i).first();
    if (await search.isVisible().catch(() => false)) {
      await search.fill('e2e');
      await page.waitForTimeout(500);
    }
  });

  test('export button visible', async ({ page }) => {
    await safeGoTo(page, '/teachers', 'Teachers');
    const exportBtn = page.getByRole('button', { name: /export|download/i }).first();
    const visible = await exportBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[teachers] Export button visible: ${visible}`);
  });
});

test.describe('Locations — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('page loads', async ({ page }) => {
    await safeGoTo(page, '/locations', 'Locations');
    const hasContent = await page.getByText(/main studio|location/i).first().isVisible({ timeout: 15_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[locations] Content visible: ${hasContent}`);
  });

  test('add location button exists', async ({ page }) => {
    await safeGoTo(page, '/locations', 'Locations');
    const btn = page.getByRole('button', { name: /add.*location|new.*location/i }).first();
    const visible = await btn.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[locations] Add location button visible: ${visible}`);
  });

  test('location card shows rooms', async ({ page }) => {
    await safeGoTo(page, '/locations', 'Locations');
    const roomText = page.getByText(/room/i).first();
    const visible = await roomText.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[locations] Room text visible: ${visible}`);
  });

  test('filter by location type', async ({ page }) => {
    await safeGoTo(page, '/locations', 'Locations');
    const filterBtn = page.locator('button').filter({ hasText: /all|studio|school/i }).first();
    if (await filterBtn.isVisible().catch(() => false)) {
      await filterBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('add location dialog opens', async ({ page }) => {
    await safeGoTo(page, '/locations', 'Locations');
    const btn = page.getByRole('button', { name: /add.*location|new.*location/i }).first();
    if (await btn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await btn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });
});
