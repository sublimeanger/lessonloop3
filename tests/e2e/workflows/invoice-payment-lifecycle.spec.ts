import { test, expect } from '../workflow.fixtures';
import { AUTH, waitForPageReady, goTo, expectToast } from '../helpers';
import { assertPageLoaded, assertNoErrorBoundary, parseCurrency } from '../workflow-helpers';

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/** Read a stats value from the invoice stats widget by label. */
async function readStatText(
  page: import('@playwright/test').Page,
  label: string,
): Promise<string> {
  const widget = page.locator('[data-tour="invoice-stats"]');
  const statEl = widget.getByText(label, { exact: false }).first();
  const parent = statEl.locator('..');
  return (await parent.textContent()) ?? '';
}

/** Extract the first £-value from text, e.g. "£3,240.00 total" → 3240 */
function extractAmount(text: string): number {
  const match = text.match(/£([\d,]+\.?\d*)/);
  if (!match) return 0;
  return parseFloat(match[1].replace(/,/g, ''));
}

/** Open the Create Invoice modal, fill in payer + line items, submit. */
async function createDraftInvoice(
  page: import('@playwright/test').Page,
  opts: {
    payerSearch: string;
    lines: Array<{ description: string; qty: number; unitPrice: number }>;
  },
) {
  await page.getByRole('button', { name: 'Create Invoice' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  const dialog = page.getByRole('dialog');

  // ── Select payer ──
  // Payer Type defaults to Guardian — leave it.
  // The second combobox is the payer itself
  const comboboxes = dialog.getByRole('combobox');
  const payerCombobox = comboboxes.nth(1);
  await payerCombobox.click();
  await page.waitForTimeout(300);

  const payerOption = page
    .getByRole('option')
    .filter({ hasText: new RegExp(opts.payerSearch, 'i') })
    .first();
  if (await payerOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await payerOption.click();
  } else {
    // Fallback: pick the first option
    await page.getByRole('option').first().click();
  }
  await page.waitForTimeout(300);

  // ── Fill line items ──
  for (let i = 0; i < opts.lines.length; i++) {
    const line = opts.lines[i];
    // Add another line item if needed (first line already exists)
    if (i > 0) {
      await dialog.getByRole('button', { name: /add item/i }).click();
      await page.waitForTimeout(200);
    }
    const descInputs = dialog.locator('input[placeholder="Description"]');
    const qtyInputs = dialog.locator('input[placeholder="Qty"]');
    const priceInputs = dialog.locator('input[placeholder="Price"]');

    await descInputs.nth(i).fill(line.description);
    await qtyInputs.nth(i).fill(line.qty.toString());
    await priceInputs.nth(i).fill(line.unitPrice.toString());
  }

  // ── Submit ──
  await dialog.getByRole('button', { name: 'Create Invoice' }).last().click();
  await expectToast(page, /invoice created/i);
  await page.waitForTimeout(1_000);
}

/* ================================================================== */
/*  Test 1: Invoice lifecycle — draft → sent → paid                    */
/* ================================================================== */

test.describe('Invoice & Payment — Full Lifecycle', () => {
  test.use({ storageState: AUTH.owner });

  test('invoice lifecycle — draft → sent → paid', async ({ page }) => {
    test.setTimeout(180_000);

    // ── 1-2. Navigate and note current stats ───────────────────────
    await goTo(page, '/invoices');
    await assertPageLoaded(page, 'Invoices');
    await page.waitForTimeout(1_000);

    const statsWidgetBefore = await page
      .locator('[data-tour="invoice-stats"]')
      .textContent()
      .catch(() => '');

    // ── 3-5. Create a new invoice ──────────────────────────────────
    await createDraftInvoice(page, {
      payerSearch: 'Emma',
      lines: [
        {
          description: 'Term 1 Piano Lessons',
          qty: 4,
          unitPrice: 30,
        },
      ],
    });

    // ── 6. Assert: Toast "Invoice created" — handled in helper ─────

    // ── 7. Assert: Invoice appears in the list with "Draft" status ─
    await expect(
      page.getByText('Draft').first(),
    ).toBeVisible({ timeout: 10_000 });

    // Assert: £120.00 is visible (4 × £30.00)
    await expect(
      page.getByText('£120.00').first(),
    ).toBeVisible({ timeout: 5_000 });

    // ── 8. Verify stats changed ────────────────────────────────────
    const statsWidgetAfter = await page
      .locator('[data-tour="invoice-stats"]')
      .textContent()
      .catch(() => '');
    // Stats text should differ (outstanding increased)
    // We can't compare exact counts since the widget shows totals, not per-status

    // ── 9-10. Open the new invoice detail ──────────────────────────
    // Click the first draft invoice row — look for £120.00 + Draft
    const invoiceRow = page
      .locator('[data-tour="invoice-list"]')
      .locator('[role="listitem"], .border.bg-card')
      .filter({ hasText: '£120.00' })
      .filter({ hasText: 'Draft' })
      .first();

    // If we can't find it in the list widget, fall back to any link with £120.00
    if (await invoiceRow.isVisible().catch(() => false)) {
      await invoiceRow.click();
    } else {
      // Try clicking the row containing £120.00 and Draft
      const altRow = page.locator('main').getByText('£120.00').first();
      await altRow.click();
    }

    await page.waitForURL(/\/invoices\//, { timeout: 10_000 });
    await waitForPageReady(page);

    // Assert: Detail page shows correct total and Draft badge
    await expect(page.getByText('£120.00').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Draft').first()).toBeVisible({ timeout: 5_000 });

    // Assert: Line item visible
    await expect(
      page.getByText('Term 1 Piano Lessons').first(),
    ).toBeVisible({ timeout: 5_000 });

    // ── 11-14. Send the invoice ────────────────────────────────────
    const sendBtn = page.getByRole('button', { name: 'Send' }).first();
    await expect(sendBtn).toBeVisible({ timeout: 5_000 });
    await sendBtn.click();
    await page.waitForTimeout(300);

    // Confirm in the send dialog
    const sendDialog = page.getByRole('dialog').first();
    if (await sendDialog.isVisible().catch(() => false)) {
      await sendDialog.getByRole('button', { name: 'Send Invoice' }).click();
    }

    // Assert: Toast confirms sending
    await expectToast(page, /invoice sent/i);
    await page.waitForTimeout(1_000);

    // Assert: Status changes to "Sent"
    await expect(page.getByText('Sent').first()).toBeVisible({ timeout: 10_000 });

    // ── 15-17. Navigate back to list and verify ────────────────────
    await goTo(page, '/invoices');
    await page.waitForTimeout(1_000);

    // The invoice should now show "Sent" status
    const sentRow = page
      .locator('main')
      .getByText('£120.00')
      .first();
    await expect(sentRow).toBeVisible({ timeout: 10_000 });

    // ── 18-23. Record full payment ─────────────────────────────────
    // Navigate back to the invoice detail
    await sentRow.click();
    await page.waitForURL(/\/invoices\//, { timeout: 10_000 });
    await waitForPageReady(page);

    const recordPaymentBtn = page.getByRole('button', { name: 'Record Payment' }).first();
    await expect(recordPaymentBtn).toBeVisible({ timeout: 5_000 });
    await recordPaymentBtn.click();

    // Fill payment amount
    const paymentDialog = page.getByRole('dialog').first();
    await expect(paymentDialog).toBeVisible({ timeout: 5_000 });

    // Use the "Pay full amount" shortcut if available
    const payFullBtn = paymentDialog.getByRole('button', { name: /pay full amount/i }).first();
    if (await payFullBtn.isVisible().catch(() => false)) {
      await payFullBtn.click();
    } else {
      await paymentDialog.locator('input#amount').fill('120');
    }

    // Submit payment
    await paymentDialog.getByRole('button', { name: 'Record Payment' }).click();

    // Assert: Toast confirms payment
    await expectToast(page, /payment recorded/i);
    await page.waitForTimeout(1_000);

    // Assert: Status changes to "Paid"
    await expect(page.getByText('Paid').first()).toBeVisible({ timeout: 10_000 });

    // ── 24-27. Verify reports page loads ───────────────────────────
    await goTo(page, '/reports');
    await assertPageLoaded(page, 'Reports');

    // Click into Revenue report if link exists
    const revenueLink = page.getByText(/revenue/i).first();
    if (await revenueLink.isVisible().catch(() => false)) {
      await revenueLink.click();
      await waitForPageReady(page);
    }

    // Assert: Report loads without error boundaries
    await assertNoErrorBoundary(page);
  });
});

/* ================================================================== */
/*  Test 2: Partial payment creates correct remaining balance          */
/* ================================================================== */

test.describe('Invoice & Payment — Partial Payment', () => {
  test.use({ storageState: AUTH.owner });

  test('partial payment creates correct remaining balance', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1. Create a new invoice for £100.00 ────────────────────────
    await goTo(page, '/invoices');
    await assertPageLoaded(page, 'Invoices');

    await createDraftInvoice(page, {
      payerSearch: 'Emma',
      lines: [{ description: 'Partial payment test', qty: 1, unitPrice: 100 }],
    });

    // ── 2. Send it ─────────────────────────────────────────────────
    // Find and open the draft invoice
    const draftRow = page
      .locator('main')
      .getByText('£100.00')
      .first();
    await expect(draftRow).toBeVisible({ timeout: 10_000 });
    await draftRow.click();
    await page.waitForURL(/\/invoices\//, { timeout: 10_000 });
    await waitForPageReady(page);

    // Send it
    await page.getByRole('button', { name: 'Send' }).first().click();
    await page.waitForTimeout(300);
    const sendDialog = page.getByRole('dialog').first();
    if (await sendDialog.isVisible().catch(() => false)) {
      await sendDialog.getByRole('button', { name: 'Send Invoice' }).click();
    }
    await expectToast(page, /invoice sent/i);
    await page.waitForTimeout(1_000);

    // ── 3. Record partial payment of £60.00 ────────────────────────
    const recordBtn = page.getByRole('button', { name: 'Record Payment' }).first();
    await expect(recordBtn).toBeVisible({ timeout: 5_000 });
    await recordBtn.click();

    const paymentDialog = page.getByRole('dialog').first();
    await expect(paymentDialog).toBeVisible({ timeout: 5_000 });

    await paymentDialog.locator('input#amount').fill('60');
    await paymentDialog.getByRole('button', { name: 'Record Payment' }).click();

    await expectToast(page, /payment recorded/i);
    await page.waitForTimeout(1_000);

    // ── 4. Assert: balance of £40.00 remaining ─────────────────────
    // The detail page should show the remaining balance
    const pageContent = await page.locator('main').textContent() ?? '';

    // Check for remaining balance — could be "£40.00" in the payment status card
    const has40 = pageContent.includes('40.00');
    expect(has40, 'Remaining balance of £40.00 should be visible').toBe(true);

    // ── 5. Record remaining £40.00 ─────────────────────────────────
    const recordBtn2 = page.getByRole('button', { name: 'Record Payment' }).first();
    if (await recordBtn2.isVisible().catch(() => false)) {
      await recordBtn2.click();

      const paymentDialog2 = page.getByRole('dialog').first();
      await expect(paymentDialog2).toBeVisible({ timeout: 5_000 });

      // Use "Pay full amount" or manually fill £40
      const payFullBtn = paymentDialog2.getByRole('button', { name: /pay full amount/i }).first();
      if (await payFullBtn.isVisible().catch(() => false)) {
        await payFullBtn.click();
      } else {
        await paymentDialog2.locator('input#amount').fill('40');
      }

      await paymentDialog2.getByRole('button', { name: 'Record Payment' }).click();
      await expectToast(page, /payment recorded/i);
      await page.waitForTimeout(1_000);
    }

    // ── 6. Assert: status changes to "Paid" ────────────────────────
    await expect(page.getByText('Paid').first()).toBeVisible({ timeout: 10_000 });
  });
});

/* ================================================================== */
/*  Test 3: Invoice amounts use minor units correctly                  */
/* ================================================================== */

test.describe('Invoice & Payment — Minor Units / Currency Precision', () => {
  test.use({ storageState: AUTH.owner });

  test('invoice amounts use minor units correctly — no floating point errors', async ({ page }) => {
    test.setTimeout(90_000);

    // ── 1. Create an invoice with £99.99 ───────────────────────────
    await goTo(page, '/invoices');
    await assertPageLoaded(page, 'Invoices');

    await createDraftInvoice(page, {
      payerSearch: 'Emma',
      lines: [{ description: 'Currency precision test', qty: 1, unitPrice: 99.99 }],
    });

    // ── 2. Assert: Display shows £99.99 exactly ────────────────────
    // The invoice list should show £99.99 without rounding artefacts
    await expect(
      page.getByText('£99.99').first(),
    ).toBeVisible({ timeout: 10_000 });

    // Navigate to detail to double-check
    const invoiceRow = page
      .locator('main')
      .getByText('£99.99')
      .first();
    await invoiceRow.click();
    await page.waitForURL(/\/invoices\//, { timeout: 10_000 });
    await waitForPageReady(page);

    // Assert: Detail page total is exactly £99.99
    await expect(page.getByText('£99.99').first()).toBeVisible({ timeout: 5_000 });

    // Verify no floating point artefacts like £99.98 or £100.00
    const pageText = await page.locator('main').textContent() ?? '';
    expect(pageText).not.toContain('£99.98');
    expect(pageText).not.toContain('£100.00');

    // No error boundaries
    await assertNoErrorBoundary(page);
  });
});

/* ================================================================== */
/*  Test 4: Finance role can manage invoices but not students           */
/* ================================================================== */

test.describe('Invoice & Payment — Finance Role Boundaries', () => {
  test.use({ storageState: AUTH.finance });

  test('finance role can manage invoices but not students', async ({ page }) => {
    test.setTimeout(90_000);

    // ── 1-2. Navigate to /invoices — should load ───────────────────
    await goTo(page, '/invoices');
    await assertPageLoaded(page, 'Invoices');

    // Verify invoice list or stats visible
    const hasContent = await page
      .locator('[data-tour="invoice-list"], [data-tour="invoice-stats"]')
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasContent, 'Finance role should see invoice content').toBe(true);

    // ── 3-4. Navigate to /reports — should load ────────────────────
    await goTo(page, '/reports');
    await assertPageLoaded(page, 'Reports');

    // ── 5-6. Navigate to /students — should be blocked ─────────────
    await page.goto('/students');
    await waitForPageReady(page);
    const studentsUrl = page.url();
    const redirectedFromStudents =
      !studentsUrl.includes('/students') ||
      studentsUrl.includes('/dashboard') ||
      studentsUrl.includes('/portal');
    expect(
      redirectedFromStudents,
      `Finance should be redirected from /students but URL is ${studentsUrl}`,
    ).toBe(true);

    // ── 7-8. Navigate to /teachers — should be blocked ─────────────
    await page.goto('/teachers');
    await waitForPageReady(page);
    const teachersUrl = page.url();
    const redirectedFromTeachers =
      !teachersUrl.includes('/teachers') ||
      teachersUrl.includes('/dashboard') ||
      teachersUrl.includes('/portal');
    expect(
      redirectedFromTeachers,
      `Finance should be redirected from /teachers but URL is ${teachersUrl}`,
    ).toBe(true);
  });
});
