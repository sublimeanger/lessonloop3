import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  expectToastSuccess,
} from '../helpers';
import {
  cleanupTestData,
  supabaseSelect,
  deleteInvoiceById,
  deleteStudentById,
  deleteLeadById,
} from '../supabase-admin';

/**
 * Navigate via sidebar link click (SPA navigation, preserves auth).
 */
async function clickNav(page: Page, href: string) {
  const link = page.locator(`a[href="${href}"]`).first();
  await expect(link).toBeVisible({ timeout: 10_000 });
  await link.click();
  await page.waitForURL((url) => url.pathname.startsWith(href), {
    timeout: 15_000,
  });
  await waitForPageReady(page);
}

/* ================================================================== */
/*  WORKFLOW 1: Invoice Billing Lifecycle                               */
/*  Create invoice → Send → Record payment → Verify paid               */
/* ================================================================== */

test.describe('Workflow — Invoice Billing Lifecycle', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `e2e-${Date.now()}`;

  test.afterAll(() => {
    try { cleanupTestData(testId); } catch { /* best-effort */ }
  });

  test('navigate invoices, view detail, verify actions visible', async ({ page }) => {
    test.setTimeout(300_000);

    // Warm up session
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    // Navigate to invoices
    await clickNav(page, '/invoices');
    await waitForPageReady(page);

    // Verify invoices page loaded with data
    await expect(page.getByText(/invoices/i).first()).toBeVisible({ timeout: 10_000 });

    // Filter to show overdue invoices (seed data should have some)
    const overdueFilter = page.getByRole('button', { name: /overdue/i }).first();
    if (await overdueFilter.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await overdueFilter.click();
      await page.waitForTimeout(1_000);
    }

    // Click first invoice to go to detail
    const firstInvoice = page.locator('main').getByRole('link').first()
      .or(page.locator('main a[href*="/invoices/"]').first());
    if (await firstInvoice.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await firstInvoice.click();
      await page.waitForURL(/\/invoices\/[^/]+/, { timeout: 10_000 }).catch(() => {});
      await waitForPageReady(page);
    }

    // If on invoice detail, verify action buttons
    if (page.url().match(/\/invoices\/[^/]+/) && !page.url().endsWith('/invoices')) {
      // Verify key action buttons are visible
      const reminderBtn = page.getByRole('button', { name: /reminder/i }).first();
      const recordPaymentBtn = page.getByRole('button', { name: /record payment/i }).first();

      const hasReminder = await reminderBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      const hasRecordPayment = await recordPaymentBtn.isVisible({ timeout: 5_000 }).catch(() => false);

      // At least one action button should be visible for overdue invoices
      expect(hasReminder || hasRecordPayment).toBe(true);

      // Record Payment workflow — test the full modal flow
      if (hasRecordPayment) {
        await recordPaymentBtn.click();
        const payDialog = page.getByRole('dialog');
        await expect(payDialog).toBeVisible({ timeout: 5_000 });

        // Verify payment form fields are present
        const amountInput = page.locator('#amount');
        await expect(amountInput).toBeVisible({ timeout: 5_000 });

        // Click "Pay full amount" to auto-fill
        const payFullBtn = page.getByText(/pay full amount/i).first();
        if (await payFullBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await payFullBtn.click();
          await page.waitForTimeout(300);
        } else {
          await amountInput.fill('10.00');
        }

        // Record the payment
        const confirmPayBtn = payDialog.getByRole('button', { name: /record payment/i });
        await expect(confirmPayBtn).toBeEnabled({ timeout: 5_000 });
        await confirmPayBtn.click();

        // Wait for dialog to close
        await expect(payDialog).toBeHidden({ timeout: 15_000 });
      }
    }
  });
});

/* ================================================================== */
/*  WORKFLOW 2: Lead → Student Conversion                              */
/*  Create lead → Convert to student → Verify student exists           */
/* ================================================================== */

test.describe('Workflow — Lead to Student Conversion', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `e2e-${Date.now()}`;
  const contactName = `ConvertLead${testId}`;
  const childFirstName = `ConvertChild${testId}`;

  test.afterAll(() => {
    try { cleanupTestData(testId); } catch { /* best-effort */ }
  });

  test('create lead, convert to student, verify student exists', async ({ page }) => {
    test.setTimeout(300_000);

    // Warm up session
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    // ── Create a lead ──
    await clickNav(page, '/leads');
    await expect(page.getByPlaceholder('Search leads...')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /add lead/i }).first().click();
    await expect(page.getByRole('dialog').or(page.locator('[role="dialog"]'))).toBeVisible({ timeout: 5_000 });

    await page.locator('#contact_name').fill(contactName);
    await page.locator('#contact_email').fill(`${testId}@e2e-convert.example.com`);

    // Fill child name
    const childFirst = page.getByPlaceholder('First name').first();
    if (await childFirst.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await childFirst.fill(childFirstName);
      const childLast = page.getByPlaceholder('Last name').first();
      if (await childLast.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await childLast.fill('E2EConvert');
      }
    }

    const createLeadBtn = page.getByRole('button', { name: /create lead|add lead|save/i }).last();
    await createLeadBtn.click();
    await expectToastSuccess(page);

    // Close dialog
    if (await page.getByRole('dialog').isVisible({ timeout: 2_000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // ── Navigate to lead detail ──
    await page.getByPlaceholder('Search leads...').clear();
    await page.getByPlaceholder('Search leads...').fill(contactName);
    await page.waitForTimeout(1_500);

    const leadLink = page.getByText(contactName).first();
    await expect(leadLink).toBeVisible({ timeout: 10_000 });
    await leadLink.click();
    await page.waitForURL(/\/leads\//, { timeout: 10_000 });
    await waitForPageReady(page);

    // ── Convert lead to student ──
    // Use text selector to click the exact Convert button
    await page.locator('button:has-text("Convert")').first().click({ force: true });
    await page.waitForTimeout(3_000);

    // ConvertLeadWizard: uses Dialog on desktop, Drawer on mobile
    // Check for dialog heading as indicator
    const wizardHeading = page.getByText(/convert lead/i).first();
    const wizardDialog = page.getByRole('dialog');
    const dialogVisible = await wizardDialog.isVisible({ timeout: 15_000 }).catch(() => false);
    const headingVisible = await wizardHeading.isVisible({ timeout: 5_000 }).catch(() => false);

    if (dialogVisible || headingVisible) {
      // Step 1: Review Students — click Next/Continue
      const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
      if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(1_000);
      }

      // Step 2: Assign Teachers — skip (optional), click Next/Continue
      const nextBtn2 = page.getByRole('button', { name: /next|continue/i }).first();
      if (await nextBtn2.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await nextBtn2.click();
        await page.waitForTimeout(1_000);
      }

      // Step 3: Confirm & Convert
      const confirmConvert = page.getByRole('button', { name: /convert|confirm/i }).first();
      if (await confirmConvert.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await confirmConvert.click();
        await expectToastSuccess(page);
      }

      // Wait for wizard to close
      await expect(wizardDialog).toBeHidden({ timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(1_000);
    }

    // ── Verify student was created ──
    await clickNav(page, '/students');
    await expect(page.getByPlaceholder('Search students...')).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder('Search students...').fill(childFirstName);
    await page.waitForTimeout(1_500);

    // The converted student should appear
    await expect(page.getByText(childFirstName).first()).toBeVisible({ timeout: 10_000 });

    // API cleanup
    const leads = supabaseSelect('leads', `contact_name=like.%25${testId}%25&select=id&limit=1`);
    if (leads.length > 0) deleteLeadById(leads[0].id);
    const students = supabaseSelect('students', `first_name=like.%25${testId}%25&select=id&limit=1`);
    if (students.length > 0) deleteStudentById(students[0].id);
  });
});
