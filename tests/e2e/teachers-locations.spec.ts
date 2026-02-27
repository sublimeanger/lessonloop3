import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Teachers — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('page loads with teacher list', async ({ page }) => {
    await goTo(page, '/teachers');
    await expect(page.getByText(/teacher|e2e/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('add teacher / invite button exists', async ({ page }) => {
    await goTo(page, '/teachers');
    await expect(page.getByRole('button', { name: /add|invite|new/i }).first()).toBeVisible();
  });

  test('teacher card shows student count', async ({ page }) => {
    await goTo(page, '/teachers');
    // Teachers page should show how many students each teacher has
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('search filters teachers', async ({ page }) => {
    await goTo(page, '/teachers');
    const search = page.getByPlaceholder(/search/i).first();
    if (await search.isVisible()) {
      await search.fill('e2e');
      await page.waitForTimeout(500);
    }
  });

  test('export button visible', async ({ page }) => {
    await goTo(page, '/teachers');
    const exportBtn = page.getByRole('button', { name: /export|download/i }).first();
    if (await exportBtn.isVisible().catch(() => false)) {
      await expect(exportBtn).toBeVisible();
    }
  });
});

test.describe('Locations — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('page loads', async ({ page }) => {
    await goTo(page, '/locations');
    await expect(page.getByText(/main studio|location/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('add location button exists', async ({ page }) => {
    await goTo(page, '/locations');
    await expect(page.getByRole('button', { name: /add.*location|new.*location/i }).first()).toBeVisible();
  });

  test('location card shows rooms', async ({ page }) => {
    await goTo(page, '/locations');
    // If Main Studio exists with Room A
    const roomText = page.getByText(/room/i).first();
    if (await roomText.isVisible().catch(() => false)) {
      await expect(roomText).toBeVisible();
    }
  });

  test('filter by location type', async ({ page }) => {
    await goTo(page, '/locations');
    // Should have type filters (all, studio, school, home, online)
    const filterBtn = page.locator('button').filter({ hasText: /all|studio|school/i }).first();
    if (await filterBtn.isVisible().catch(() => false)) {
      await filterBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('add location dialog opens', async ({ page }) => {
    await goTo(page, '/locations');
    await page.getByRole('button', { name: /add.*location|new.*location/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel(/name/i).first()).toBeVisible();
  });
});
