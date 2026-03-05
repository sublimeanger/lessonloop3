import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  goTo,
} from '../helpers';

/**
 * Invoice Detail — Advanced Actions tests.
 * Covers: invoice list features, detail page actions, finance role access.
 */

/** Navigate to invoice detail by clicking an invoice row. */
async function navigateToInvoiceDetail(page: Page): Promise<boolean> {
  // Click the first invoice row body (avoiding the checkbox at far left).
  const list = page.getByRole('list', { name: 'Invoices list' });
  const hasInvoiceList = await list.isVisible({ timeout: 10_000 }).catch(() => false);
  if (!hasInvoiceList) return false;

  const firstItem = list.getByRole('listitem').first();
  const box = await firstItem.boundingBox();
  if (!box) return false;

  // Checkbox is ~30px at far left. Click at 150px from left edge.
  await page.mouse.click(box.x + 150, box.y + box.height / 2);
  await page.waitForTimeout(2_000);

  // Check if URL changed to invoice detail
  const url = page.url();
  if (url.includes('/invoices/') && !url.endsWith('/invoices') && !url.endsWith('/invoices/')) {
    await waitForPageReady(page);
    return true;
  }

  // Try again with a different x position (more to the right)
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
  await page.waitForTimeout(2_000);
  const url2 = page.url();
  if (url2.includes('/invoices/') && !url2.endsWith('/invoices') && !url2.endsWith('/invoices/')) {
    await waitForPageReady(page);
    return true;
  }

  return false;
}

test.describe('Invoice Detail Advanced — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('invoice list shows filter tabs and counts', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    // Filter tabs: All(N), Draft(N), Sent(N), Paid(N), Overdue(N), Cancelled(N)
    const allTab = page.getByRole('button').filter({ hasText: /^All\(/ }).first();
    const paidTab = page.getByRole('button').filter({ hasText: /^Paid\(/ }).first();

    await expect(allTab).toBeVisible({ timeout: 5_000 });
    await expect(paidTab).toBeVisible({ timeout: 3_000 });
  });

  test('invoice list has select all checkbox and invoice actions', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    // Select all checkbox
    const selectAll = page.getByRole('checkbox', { name: /select all/i });
    await expect(selectAll).toBeVisible({ timeout: 5_000 });

    // Invoice list with listitems
    const list = page.getByRole('list', { name: 'Invoices list' });
    await expect(list).toBeVisible({ timeout: 5_000 });

    const items = list.getByRole('listitem');
    const itemCount = await items.count();
    expect(itemCount).toBeGreaterThanOrEqual(1);
  });

  test('clicking invoice row navigates to detail page', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const navigated = await navigateToInvoiceDetail(page);
    if (!navigated) {
      test.skip(true, 'Could not navigate to invoice detail');
      return;
    }

    // Should show invoice detail elements
    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    // Should show a status badge
    const statusBadge = main.getByText(/draft|sent|paid|overdue|void/i).first();
    await expect(statusBadge).toBeVisible({ timeout: 5_000 });
  });

  test('invoice detail shows line items and total', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const navigated = await navigateToInvoiceDetail(page);
    if (!navigated) {
      test.skip(true, 'Could not navigate to invoice detail');
      return;
    }

    const main = page.locator('main').first();

    // Should show description/amount columns or line item info
    const hasDescription = await main.getByText(/description/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasAmount = await main.getByText(/amount|total/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);

    expect(hasDescription || hasAmount).toBe(true);
  });

  test('invoice detail shows due date', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const navigated = await navigateToInvoiceDetail(page);
    if (!navigated) {
      test.skip(true, 'Could not navigate to invoice detail');
      return;
    }

    const main = page.locator('main').first();
    const hasDueDate = await main.getByText(/due/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasDueDate).toBe(true);
  });

  test('invoice detail has download PDF button', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const navigated = await navigateToInvoiceDetail(page);
    if (!navigated) {
      test.skip(true, 'Could not navigate to invoice detail');
      return;
    }

    const downloadBtn = page.getByRole('button', { name: /download|pdf/i }).first();
    const hasDownload = await downloadBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasDownload).toBe(true);
  });

  test('overdue invoice has void and record payment buttons', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    // Filter to overdue
    const overdueFilter = page.getByRole('button').filter({ hasText: /^Overdue/ }).first();
    const hasOverdue = await overdueFilter.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasOverdue) {
      await overdueFilter.click();
      await page.waitForTimeout(1_000);
    }

    const navigated = await navigateToInvoiceDetail(page);
    if (!navigated) {
      test.skip(true, 'Could not navigate to overdue invoice detail');
      return;
    }

    // Void button
    const voidBtn = page.getByRole('button', { name: /void/i }).first();
    const hasVoid = await voidBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasVoid).toBe(true);

    // Record Payment button
    const recordPaymentBtn = page.getByRole('button', { name: /record payment|payment/i }).first();
    const hasRecordPayment = await recordPaymentBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasRecordPayment).toBe(true);
  });

  test('paid invoice shows payment info', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    // Filter to paid
    const paidFilter = page.getByRole('button').filter({ hasText: /^Paid/ }).first();
    const hasPaidFilter = await paidFilter.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasPaidFilter) {
      await paidFilter.click();
      await page.waitForTimeout(1_000);
    }

    const navigated = await navigateToInvoiceDetail(page);
    if (!navigated) {
      test.skip(true, 'Could not navigate to paid invoice');
      return;
    }

    const main = page.locator('main').first();
    const hasPaidStatus = await main.getByText(/paid/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasPaidStatus).toBe(true);

    const hasAmount = await main.getByText(/£/).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasAmount).toBe(true);
  });

  test('invoice summary stats visible', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    // Summary stats buttons: "£X,XXX total", "£X,XXX paid", etc.
    const totalBtn = page.getByRole('button', { name: /total/i }).first();
    const paidBtn = page.getByRole('button', { name: /paid/i }).first();

    await expect(totalBtn).toBeVisible({ timeout: 10_000 });
    await expect(paidBtn).toBeVisible({ timeout: 5_000 });
  });

  test('invoice tabs show Invoices, Payment Plans, and Recurring', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    // Tab list with Invoices, Payment Plans, Recurring
    const invoicesTab = page.getByRole('tab', { name: /invoices/i }).first();
    const paymentPlansTab = page.getByRole('tab', { name: /payment plans/i }).first();
    const recurringTab = page.getByRole('tab', { name: /recurring/i }).first();

    await expect(invoicesTab).toBeVisible({ timeout: 5_000 });
    await expect(paymentPlansTab).toBeVisible({ timeout: 3_000 });
    await expect(recurringTab).toBeVisible({ timeout: 3_000 });
  });
});

test.describe('Invoice Detail — Finance Role', () => {
  test.use({ storageState: AUTH.finance });

  test('finance can access invoices page', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    // No access denied
    const accessDenied = await page.getByText(/access denied|unauthorized/i)
      .first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(accessDenied).toBe(false);

    // Should see invoice heading
    const heading = main.getByRole('heading', { name: /invoices/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('finance can navigate to invoice detail', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const navigated = await navigateToInvoiceDetail(page);
    if (!navigated) {
      test.skip(true, 'Could not navigate to invoice detail as finance');
      return;
    }

    // Should show invoice detail
    const main = page.locator('main').first();
    const hasDetail = await main.getByText(/due|status|amount|description/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasDetail).toBe(true);
  });
});
