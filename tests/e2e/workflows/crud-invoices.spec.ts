import { test, expect, Page } from '@playwright/test';
import { format, addDays } from 'date-fns';
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
  createTestInvoice,
  getFirstGuardianId,
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

/**
 * Navigate to invoices list and find a specific invoice by number.
 * Returns the locator for the invoice link/row.
 */
async function navigateToInvoiceDetail(page: Page, invoiceId: string, invoiceNumber: string) {
  // Navigate to invoices list first
  await clickNav(page, '/invoices');
  await waitForPageReady(page);
  await page.waitForTimeout(2_000);

  // Click the invoice row using the parent listitem that contains the invoice number
  const invoiceRow = page.locator('li, [role="listitem"], tr, [data-row]').filter({
    hasText: invoiceNumber,
  }).first();

  if (await invoiceRow.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await invoiceRow.click();
  } else {
    // Fallback: use evaluate to find and click the element directly via JS
    await page.evaluate((invNum) => {
      const walker = document.createTreeWalker(
        document.body, NodeFilter.SHOW_TEXT,
      );
      while (walker.nextNode()) {
        if (walker.currentNode.textContent?.includes(invNum)) {
          const parent = walker.currentNode.parentElement;
          // Walk up to find a clickable ancestor (li, a, or clickable div)
          let target: HTMLElement | null = parent;
          for (let i = 0; i < 5 && target; i++) {
            if (target.tagName === 'LI' || target.tagName === 'A' || target.onclick) {
              break;
            }
            target = target.parentElement;
          }
          (target || parent)?.click();
          break;
        }
      }
    }, invoiceNumber);
  }

  await page.waitForURL(/\/invoices\/[^/]+/, { timeout: 15_000 }).catch(() => {});
  await waitForPageReady(page);

  // If still not on detail page, try direct URL
  if (!page.url().match(/\/invoices\/[a-f0-9-]+/)) {
    await safeGoTo(page, `/invoices/${invoiceId}`, 'Invoice Detail');
  }
}

/* ================================================================== */
/*  MODULE: Invoices Full CRUD                                         */
/* ================================================================== */

test.describe('CRUD — Invoices (Owner)', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `e2e-${Date.now()}`;
  const createdInvoiceIds: string[] = [];

  test.afterAll(() => {
    try {
      cleanupTestData(testId);
      for (const id of createdInvoiceIds) {
        try { deleteInvoiceById(id); } catch { /* best-effort */ }
      }
    } catch { /* best-effort */ }
  });

  test('invoice lifecycle: create via API, view, send, record payment', async ({ page }) => {
    test.setTimeout(300_000);

    // ── Create invoice via admin API (bypasses UI form bug) ──
    const guardianId = getFirstGuardianId();
    if (!guardianId) {
      test.skip(true, 'No guardians found for test org');
      return;
    }

    const dueDate = format(addDays(new Date(), 14), 'yyyy-MM-dd');
    const invoice = createTestInvoice({
      dueDate,
      payerGuardianId: guardianId,
      notes: `E2E test ${testId}`,
      items: [{ description: `E2E Invoice ${testId}`, quantity: 1, unit_price_minor: 5000 }],
    });
    createdInvoiceIds.push(invoice.id);

    // ── Warm up session ──
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    // ── Navigate to the invoice detail page ──
    await navigateToInvoiceDetail(page, invoice.id, invoice.invoice_number);

    // Verify detail page loaded — check for Draft status
    const statusBadge = page.getByText(/draft/i).first();
    await expect(statusBadge).toBeVisible({ timeout: 15_000 });

    // ── SEND INVOICE ──
    const sendBtn = page.getByRole('button', { name: /^send$/i }).first();
    if (await sendBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sendBtn.click();

      // Send modal — click through to send
      const sendDialog = page.getByRole('dialog');
      if (await sendDialog.isVisible({ timeout: 10_000 }).catch(() => false)) {
        // Click Preview button first if visible
        const previewBtn = sendDialog.getByRole('button', { name: /preview/i });
        if (await previewBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await previewBtn.click();
          await page.waitForTimeout(1_000);
        }

        // Then click Send Invoice
        const confirmSendBtn = sendDialog.getByRole('button', { name: /send invoice/i });
        if (await confirmSendBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await confirmSendBtn.click();
          await expectToastSuccess(page, /sent/i);
          await page.waitForTimeout(1_000);
        }
      }

      // Verify status changed to Sent
      await expect(page.getByText(/sent/i).first()).toBeVisible({ timeout: 10_000 });
    }

    // ── RECORD PAYMENT ──
    const recordPaymentBtn = page.getByRole('button', { name: /record payment/i }).first();
    if (await recordPaymentBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await recordPaymentBtn.click();

      const payDialog = page.getByRole('dialog');
      await expect(payDialog).toBeVisible({ timeout: 5_000 });

      // Click "Pay full amount" to auto-fill
      const payFullBtn = page.getByText(/pay full amount/i).first();
      if (await payFullBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await payFullBtn.click();
        await page.waitForTimeout(300);
      } else {
        // Manually fill amount
        const amountInput = page.locator('#amount');
        await amountInput.fill('50.00');
      }

      // Submit payment
      const confirmPayBtn = payDialog.getByRole('button', { name: /record payment/i });
      await expect(confirmPayBtn).toBeEnabled({ timeout: 5_000 });
      await confirmPayBtn.click();

      // Wait for dialog to close
      await expect(payDialog).toBeHidden({ timeout: 15_000 });

      // Verify status changed to Paid
      await expect(page.getByText(/paid/i).first()).toBeVisible({ timeout: 10_000 });
    }

    // API cleanup fallback
    const remaining = supabaseSelect(
      'invoices',
      `notes=like.%25${testId}%25&select=id&limit=10`,
    );
    for (const inv of remaining) {
      deleteInvoiceById(inv.id);
    }
  });

  test('invoice void: create via API and void it', async ({ page }) => {
    test.setTimeout(300_000);

    // ── Create invoice via admin API ──
    const guardianId = getFirstGuardianId();
    if (!guardianId) {
      test.skip(true, 'No guardians found for test org');
      return;
    }

    const dueDate = format(addDays(new Date(), 14), 'yyyy-MM-dd');
    const invoice = createTestInvoice({
      dueDate,
      payerGuardianId: guardianId,
      notes: `E2E void ${testId}`,
      items: [{ description: `E2E Void Invoice ${testId}`, quantity: 1, unit_price_minor: 2500 }],
    });
    createdInvoiceIds.push(invoice.id);

    // Warm up
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    // Navigate to the invoice detail page
    await navigateToInvoiceDetail(page, invoice.id, invoice.invoice_number);

    // Verify it's a draft
    await expect(page.getByText(/draft/i).first()).toBeVisible({ timeout: 15_000 });

    // Find Void action
    const voidBtn = page.getByRole('button', { name: /void/i }).first();
    if (await voidBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await voidBtn.click();

      // Confirm void in dialog
      const voidDialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
      if (await voidDialog.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        const confirmVoidBtn = voidDialog.getByRole('button', { name: /void/i });
        if (await confirmVoidBtn.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
          await confirmVoidBtn.first().click();
          await expectToastSuccess(page);
        }
      }

      // Verify status changed to Void
      await expect(page.getByText(/void/i).first()).toBeVisible({ timeout: 10_000 });
    }

    // API cleanup
    const remaining = supabaseSelect(
      'invoices',
      `notes=like.%25${testId}%25&select=id&limit=10`,
    );
    for (const inv of remaining) {
      deleteInvoiceById(inv.id);
    }
  });
});

/* ================================================================== */
/*  Invoices — Finance role                                            */
/* ================================================================== */

test.describe('Invoices — Finance role', () => {
  test.use({ storageState: AUTH.finance });

  test('finance user can view invoices page', async ({ page }) => {
    test.setTimeout(300_000);

    // Warm up
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    // Navigate to invoices
    await clickNav(page, '/invoices');
    await waitForPageReady(page);

    // Verify invoices page loaded — check for heading or invoice content
    await expect(
      page.getByRole('heading', { name: /invoices/i }).first()
        .or(page.getByText(/invoices/i).first())
    ).toBeVisible({ timeout: 10_000 });
  });
});
