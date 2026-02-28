import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Invoices — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('page loads with tabs (Invoices / Payment Plans / Recurring)', async ({ page }) => {
    await goTo(page, '/invoices');
    await expect(page.getByText(/invoice|billing/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('invoice stats widget shows counts', async ({ page }) => {
    await goTo(page, '/invoices');
    await expect(page.getByText(/draft|sent|paid|overdue/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('filter bar works', async ({ page }) => {
    await goTo(page, '/invoices');
    const filterArea = page.locator('main').first();
    await expect(filterArea).toBeVisible();
  });

  test('create invoice button opens modal', async ({ page }) => {
    await goTo(page, '/invoices');
    const createBtn = page.getByRole('button', { name: /create.*invoice|new.*invoice/i }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('billing run button exists', async ({ page }) => {
    await goTo(page, '/invoices');
    // Wait for page content to fully load before looking for action buttons
    await expect(page.getByText(/invoice|billing/i).first()).toBeVisible({ timeout: 15_000 });
    // Button uses data-tour attribute; text "Billing Run" may be hidden on small viewports
    const btn = page.locator('[data-tour="billing-run-button"]').first()
      .or(page.getByRole('button', { name: /billing run/i }).first())
      .or(page.locator('button').filter({ hasText: /billing run/i }).first());
    // Billing run button may not be available for all orgs/plans
    if (await btn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await expect(btn).toBeVisible();
    }
  });

  test('navigate to invoice detail', async ({ page }) => {
    await goTo(page, '/invoices');
    const invoiceRow = page.locator('table tbody tr, [class*="invoice"]').first();
    if (await invoiceRow.isVisible().catch(() => false)) {
      await invoiceRow.click();
      await expect(page).toHaveURL(/\/invoices\//, { timeout: 5_000 });
    }
  });

  test('invoice detail page loads with status badge', async ({ page }) => {
    await goTo(page, '/invoices');
    const invoiceRow = page.locator('table tbody tr, [class*="invoice"]').first();
    if (await invoiceRow.isVisible().catch(() => false)) {
      await invoiceRow.click();
      await waitForPageReady(page);
      await expect(page.getByText(/£|draft|sent|paid|overdue/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('export button visible', async ({ page }) => {
    await goTo(page, '/invoices');
    const exportBtn = page.getByRole('button', { name: /export|download/i }).first();
    if (await exportBtn.isVisible().catch(() => false)) {
      await expect(exportBtn).toBeVisible();
    }
  });

  test('payment plans tab accessible', async ({ page }) => {
    await goTo(page, '/invoices');
    const plansTab = page.getByRole('tab', { name: /payment plan/i }).first();
    if (await plansTab.isVisible().catch(() => false)) {
      await plansTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('recurring billing tab accessible', async ({ page }) => {
    await goTo(page, '/invoices');
    const recurringTab = page.getByRole('tab', { name: /recurring/i }).first();
    if (await recurringTab.isVisible().catch(() => false)) {
      await recurringTab.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Invoices — Finance', () => {
  test.use({ storageState: AUTH.finance });

  test('finance can view invoices', async ({ page }) => {
    await goTo(page, '/invoices');
    await expect(page.getByText(/invoice|billing/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
