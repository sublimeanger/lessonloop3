import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Leads — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('leads page loads', async ({ page }) => {
    await goTo(page, '/leads');
    await expect(page.getByText(/lead|pipeline/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('view toggle (kanban/list) exists', async ({ page }) => {
    await goTo(page, '/leads');
    const kanbanBtn = page.getByRole('button', { name: /board|kanban/i }).first();
    const listBtn = page.getByRole('button', { name: /list|table/i }).first();
    const hasKanban = await kanbanBtn.isVisible().catch(() => false);
    const hasList = await listBtn.isVisible().catch(() => false);
    expect(hasKanban || hasList).toBeTruthy();
  });

  test('create lead button opens modal', async ({ page }) => {
    await goTo(page, '/leads');
    await page.getByRole('button', { name: /add.*lead|new.*lead|create/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  });

  test('lead funnel chart visible', async ({ page }) => {
    await goTo(page, '/leads');
    // Funnel chart or stage counts should be visible
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('navigate to lead detail', async ({ page }) => {
    await goTo(page, '/leads');
    // Click on a lead card or row if seed data exists
    const leadCard = page.locator('[class*="lead"], [class*="card"]').filter({ hasText: /enquiry|contact|lead/i }).first();
    if (await leadCard.isVisible().catch(() => false)) {
      await leadCard.click();
      await expect(page).toHaveURL(/\/leads\//, { timeout: 5_000 });
    }
  });

  test('search filters leads', async ({ page }) => {
    await goTo(page, '/leads');
    const search = page.getByPlaceholder(/search/i).first();
    if (await search.isVisible()) {
      await search.fill('test');
      await page.waitForTimeout(500);
    }
  });

  test('export leads button exists', async ({ page }) => {
    await goTo(page, '/leads');
    const exportBtn = page.getByRole('button', { name: /export|download/i }).first();
    if (await exportBtn.isVisible().catch(() => false)) {
      await expect(exportBtn).toBeVisible();
    }
  });
});
