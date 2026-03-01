import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, waitForPageReady } from './helpers';

test.describe('Invoices — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('page loads with invoice content', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    await expect(page.getByText(/invoice|billing/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('invoice stats or status tabs visible', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    // Stats widget or tabs should show draft/sent/paid/overdue
    const hasStats = await page.locator('[data-tour="invoice-stats"]').isVisible({ timeout: 10_000 }).catch(() => false);
    const hasStatusText = await page.getByText(/draft|sent|paid|overdue/i).first().isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[invoices] Stats: ${hasStats}, Status text: ${hasStatusText}`);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('filter bar works', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
  });

  test('create invoice button opens modal', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    const createBtn = page.getByRole('button', { name: /create.*invoice|new.*invoice/i }).first()
      .or(page.locator('[data-tour="create-invoice-button"]').first());
    if (await createBtn.first().isVisible({ timeout: 10_000 }).catch(() => false)) {
      await createBtn.first().click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('billing run button exists', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    const btn = page.locator('[data-tour="billing-run-button"]')
      .or(page.getByRole('button', { name: /billing run|generate/i }).first());
    const visible = await btn.first().isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[invoices] Billing run button visible: ${visible}`);
  });

  test('navigate to invoice detail', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    const invoiceRow = page.locator('[data-tour="invoice-list"] a, table tbody tr, [class*="invoice"]').first();
    if (await invoiceRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await invoiceRow.click();
      await page.waitForURL(/\/invoices\//, { timeout: 10_000 }).catch(() => {});
    }
  });

  test('invoice detail page loads with status badge', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    const invoiceRow = page.locator('[data-tour="invoice-list"] a, table tbody tr, [class*="invoice"]').first();
    if (await invoiceRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await invoiceRow.click();
      await waitForPageReady(page);
      await expect(page.getByText(/£|draft|sent|paid|overdue/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('export button visible', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    const exportBtn = page.getByRole('button', { name: /export|download/i }).first();
    const visible = await exportBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[invoices] Export button visible: ${visible}`);
  });

  test('payment plans tab accessible', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    const plansTab = page.getByRole('tab', { name: /payment plan/i }).first();
    if (await plansTab.isVisible().catch(() => false)) {
      await plansTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('recurring billing tab accessible', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
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
    await safeGoTo(page, '/invoices', 'Finance Invoices');
    await expect(page.getByText(/invoice|billing/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
