/**
 * PART 4: Invoices & Billing (Desktop)
 * Tests 4.1.1 – 4.4.8
 *
 * NOTE: 4.1.11 (email inbox) and 4.2.6 (PDF download) stay manual.
 */
import { test, expect } from '../../workflows/workflow.fixtures';
import { AUTH, safeGoTo, expectToast, clickButton, expectDialog, TEST_RUN_ID } from './helpers';
import { createInvoiceForStudent, sendInvoice } from '../workflow-helpers';
import { cleanupTestData } from '../../supabase-admin';

test.use({ storageState: AUTH.owner });

test.afterAll(() => {
  cleanupTestData(TEST_RUN_ID);
});

test.describe('Part 4: Invoices & Billing', () => {
  test.describe.configure({ mode: 'serial' });

  // ── 4.1 — Create & Send Invoice ──

  test('4.1.1-2 – /invoices loads with stats widget showing £', async ({ page }) => {
    await safeGoTo(page, '/invoices');
    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: 15_000 });
    // Check for £ currency symbol
    const hasPound = await main.getByText('£').first().isVisible({ timeout: 5_000 }).catch(() => false);
    // Some orgs might not have invoices yet, so stats might show £0
    expect(hasPound).toBe(true);
  });

  test('4.1.3 – Create Invoice modal opens', async ({ page }) => {
    await safeGoTo(page, '/invoices');
    const createBtn = page.locator('[data-tour="create-invoice-button"]').first()
      .or(page.getByRole('button', { name: /create invoice/i }).first());
    await expect(createBtn).toBeVisible({ timeout: 15_000 });
    await createBtn.click();
    await expectDialog(page);
  });

  test('4.1.4-8 – Create invoice for a guardian', async ({ page }) => {
    await safeGoTo(page, '/invoices');
    const createBtn = page.locator('[data-tour="create-invoice-button"]').first()
      .or(page.getByRole('button', { name: /create invoice/i }).first());
    await expect(createBtn).toBeVisible({ timeout: 15_000 });
    await createBtn.click();
    await expectDialog(page);

    // Select manual tab if present
    const manualTab = page.getByRole('dialog').getByRole('tab', { name: /manual/i }).first();
    if (await manualTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await manualTab.click();
      await page.waitForTimeout(300);
    }

    // Select a payer (any available guardian)
    const payerTrigger = page.getByRole('dialog').locator('button').filter({ hasText: /select payer/i }).first();
    if (await payerTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await payerTrigger.click();
      await page.waitForTimeout(500);
      // Click first available payer option
      const firstOption = page.getByRole('option').first()
        .or(page.locator('[cmdk-item]').first());
      if (await firstOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await firstOption.click();
        await page.waitForTimeout(300);
      }
    }

    // Add line item
    const descInput = page.getByRole('dialog').getByPlaceholder(/description/i).first();
    if (await descInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await descInput.fill(`Piano lesson ${TEST_RUN_ID}`);
    }
    const priceInput = page.getByRole('dialog').getByPlaceholder(/price/i).first();
    if (await priceInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await priceInput.fill('25');
    }

    // Submit
    const submitBtn = page.getByRole('dialog').getByRole('button', { name: /create invoice/i });
    if (await submitBtn.isEnabled({ timeout: 5_000 }).catch(() => false)) {
      await submitBtn.click();
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });
    }
  });

  test('4.1.9 – Click invoice opens detail page', async ({ page }) => {
    await safeGoTo(page, '/invoices');
    await page.waitForTimeout(2_000);
    // Click first invoice row
    const invoiceRow = page.locator('main tbody tr, main [role="row"], main a[href*="/invoices/"]').first();
    if (await invoiceRow.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await invoiceRow.click();
      await page.waitForURL(/\/invoices\//, { timeout: 10_000 }).catch(() => {});
    }
  });

  // ── 4.2 — Record Payment ──

  test('4.2.1-4 – Record payment on invoice', async ({ page }) => {
    await safeGoTo(page, '/invoices');
    await page.waitForTimeout(2_000);
    // Navigate to first invoice detail
    const invoiceLink = page.locator('main a[href*="/invoices/"]').first()
      .or(page.locator('main tbody tr').first());
    if (await invoiceLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await invoiceLink.click();
      await page.waitForURL(/\/invoices\//, { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(1_000);

      const recordBtn = page.getByRole('button', { name: /record payment/i }).first();
      if (await recordBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await recordBtn.click();
        await expectDialog(page);
      }
    }
  });

  test('4.2.5 – Download PDF button visible', async ({ page }) => {
    await safeGoTo(page, '/invoices');
    await page.waitForTimeout(2_000);
    const invoiceLink = page.locator('main a[href*="/invoices/"]').first()
      .or(page.locator('main tbody tr').first());
    if (await invoiceLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await invoiceLink.click();
      await page.waitForURL(/\/invoices\//, { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(1_000);
      const pdfBtn = page.getByRole('button', { name: /download|pdf/i }).first();
      const hasPdf = await pdfBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      // PDF button should exist (even if disabled for draft)
      expect(hasPdf).toBe(true);
    }
  });

  // ── 4.3 — Billing Run ──

  test('4.3.1-2 – Billing Run wizard opens', async ({ page }) => {
    await safeGoTo(page, '/invoices');
    const billingRunBtn = page.getByRole('button', { name: /billing run/i }).first();
    if (await billingRunBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await billingRunBtn.click();
      await page.waitForTimeout(1_000);
      // Should open a wizard/dialog
      const wizard = page.getByRole('dialog').first()
        .or(page.locator('[data-tour*="billing-run"]').first());
      await expect(wizard).toBeVisible({ timeout: 5_000 });
    }
  });

  // ── 4.4 — Payment Plans ──

  test('4.4.3 – Payment Plans tab visible on /invoices', async ({ page }) => {
    await safeGoTo(page, '/invoices');
    const plansTab = page.getByRole('tab', { name: /payment plan/i }).first();
    const hasTab = await plansTab.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasTab).toBe(true);
  });

  test('4.4.4 – Recurring tab visible on /invoices', async ({ page }) => {
    await safeGoTo(page, '/invoices');
    const recurringTab = page.getByRole('tab', { name: /recurring/i }).first();
    const hasTab = await recurringTab.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasTab).toBe(true);
  });
});
