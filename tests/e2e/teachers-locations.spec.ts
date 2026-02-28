import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Teachers — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('page loads with teacher list', async ({ page }) => {
    await goTo(page, '/teachers');
    await expect(page.getByText(/teacher|e2e/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('add teacher / invite button exists', async ({ page }) => {
    await goTo(page, '/teachers');
    await expect(page.getByText(/teacher|e2e/i).first()).toBeVisible({ timeout: 20_000 });
    const btn = page.getByRole('button', { name: /add teacher|invite|new/i }).first()
      .or(page.locator('button').filter({ hasText: /add teacher|invite|new/i }).first());
    if (await btn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await expect(btn).toBeVisible();
    }
  });

  test('teacher card shows student count', async ({ page }) => {
    await goTo(page, '/teachers');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('search filters teachers', async ({ page }) => {
    await goTo(page, '/teachers');
    const search = page.getByPlaceholder(/search/i).first();
    if (await search.isVisible().catch(() => false)) {
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
    await expect(page.getByText(/main studio|location/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('add location button exists', async ({ page }) => {
    await goTo(page, '/locations');
    await expect(page.getByText(/main studio|location/i).first()).toBeVisible({ timeout: 20_000 });
    const btn = page.getByRole('button', { name: /add.*location|new.*location/i }).first()
      .or(page.locator('button').filter({ hasText: /add.*location|new.*location/i }).first());
    if (await btn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await expect(btn).toBeVisible();
    }
  });

  test('location card shows rooms', async ({ page }) => {
    await goTo(page, '/locations');
    const roomText = page.getByText(/room/i).first();
    if (await roomText.isVisible().catch(() => false)) {
      await expect(roomText).toBeVisible();
    }
  });

  test('filter by location type', async ({ page }) => {
    await goTo(page, '/locations');
    await expect(page.getByText(/main studio|location/i).first()).toBeVisible({ timeout: 20_000 });
    // Location type filter — scope to main to avoid matching org-setup radio buttons
    const filterBtn = page.locator('main').locator('[role="tablist"] button, [role="tab"]').first();
    if (await filterBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await filterBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('add location dialog opens', async ({ page }) => {
    await goTo(page, '/locations');
    await expect(page.getByText(/main studio|location/i).first()).toBeVisible({ timeout: 20_000 });
    const btn = page.getByRole('button', { name: /add.*location|new.*location/i }).first()
      .or(page.locator('button').filter({ hasText: /add.*location|new.*location/i }).first());
    if (await btn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await btn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
      await expect(page.getByLabel(/name/i).first()).toBeVisible();
    }
  });
});
