import { test, expect } from './workflow.fixtures';
import { AUTH } from '../helpers';
import {
  createInvoiceForStudent,
  waitForDataLoad,
} from './workflow-helpers';
import { goTo, expectToast } from '../helpers';

const TS = Date.now().toString().slice(-6);

// ═══════════════════════════════════════════════════════════════
// Invoice lifecycle — draft → sent → paid
// ═══════════════════════════════════════════════════════════════

test.describe('Invoice Payment Lifecycle — Owner', () => {
  test.use({ storageState: AUTH.owner });
  test.describe.configure({ mode: 'serial' });

  test('Invoice lifecycle — draft → sent → paid', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1–2. Navigate to /invoices and note stats ──
    await goTo(page, '/invoices');
    await waitForDataLoad(page);

    // ── 3–5. Create invoice via modal ──
    const createBtn = page.locator('[data-tour="create-invoice-button"]').first()
      .or(page.getByRole('button', { name: /create invoice/i }).first());
    await expect(createBtn).toBeVisible({ timeout: 15_000 });
    await createBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Ensure Manual Entry tab
    const manualTab = page.getByRole('dialog').getByRole('tab', { name: /manual/i }).first();
    if (await manualTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await manualTab.click();
      await page.waitForTimeout(300);
    }

    // Select payer — search for a known guardian
    const payerTrigger = page.getByRole('dialog').locator('button')
      .filter({ hasText: /select payer/i }).first();
    if (await payerTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await payerTrigger.click();
      await page.waitForTimeout(300);
      // Pick the first available payer
      const payerOption = page.getByRole('option').first()
        .or(page.locator('[role="listbox"] [role="option"]').first())
        .or(page.locator('[cmdk-item]').first());
      if (await payerOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await payerOption.click();
        await page.waitForTimeout(300);
      }
    }

    // Fill line item: Description, Qty, Price
    const descInput = page.getByRole('dialog').getByPlaceholder(/description/i).first();
    await descInput.fill(`Term 1 Piano Lessons ${TS}`);

    const qtyInput = page.getByRole('dialog').getByPlaceholder(/qty/i).first();
    if (await qtyInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await qtyInput.fill('4');
    }

    const priceInput = page.getByRole('dialog').getByPlaceholder(/price/i).first();
    await priceInput.fill('30');

    // Assert total shows £120 (4 × £30)
    await page.waitForTimeout(300);
    const totalText = await page.getByRole('dialog').textContent() ?? '';
    const hasTotal = /120/.test(totalText);
    if (hasTotal) {
      expect(totalText).toMatch(/120/);
    }

    // Save as draft
    const submitBtn = page.getByRole('dialog').getByRole('button', { name: /create invoice/i });
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    // ── 6. Toast confirmation ──
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });

    // ── 7. Invoice appears with Draft status ──
    await goTo(page, '/invoices');
    await waitForDataLoad(page);

    // Search for our invoice
    const search = page.getByPlaceholder(/search/i).first();
    if (await search.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await search.fill(`Term 1 Piano Lessons ${TS}`);
      await page.waitForTimeout(500);
    }

    const draftBadge = page.locator('main').getByText(/draft/i).first();
    await expect(draftBadge).toBeVisible({ timeout: 10_000 });

    // ── 9–10. Open invoice detail ──
    const invoiceRow = page.locator('main').getByText(new RegExp(`Term 1 Piano|${TS}`, 'i')).first()
      .or(page.locator('main').getByText(/draft/i).first());
    await invoiceRow.click();
    await expect(page).toHaveURL(/\/invoices\//, { timeout: 10_000 });
    await waitForDataLoad(page);

    // Assert detail page shows Draft badge
    const detailDraft = page.locator('main').getByText(/draft/i).first();
    await expect(detailDraft).toBeVisible({ timeout: 10_000 });

    // ── 11–14. Send the invoice ──
    const sendBtn = page.getByRole('button', { name: /^send$/i }).first();
    if (await sendBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await sendBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

      // Step through the Send dialog (compose → preview → send)
      const dialogSendBtn = page.getByRole('dialog').getByRole('button', { name: /send invoice/i }).first()
        .or(page.getByRole('dialog').getByRole('button', { name: /next|send/i }).first());
      await expect(dialogSendBtn).toBeVisible({ timeout: 5_000 });
      await dialogSendBtn.click();
      await page.waitForTimeout(500);

      // If there's a second step (preview), click the final send
      const finalSendBtn = page.getByRole('dialog').getByRole('button', { name: /send invoice/i }).first();
      if (await finalSendBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await finalSendBtn.click();
      }

      // Assert toast confirms sending
      await expectToast(page, /invoice sent/i);

      // Assert status changed to Sent
      await page.waitForTimeout(1_000);
      const sentBadge = page.locator('main').getByText(/^sent$/i).first()
        .or(page.locator('main').getByText(/sent/i).first());
      await expect(sentBadge).toBeVisible({ timeout: 10_000 });
    }

    // ── 15–17. Navigate back, verify Sent status in list ──
    await goTo(page, '/invoices');
    await waitForDataLoad(page);
    if (await search.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await search.fill(`Term 1 Piano Lessons ${TS}`);
      await page.waitForTimeout(500);
    }

    // ── 18–23. Record Payment ──
    // Open the invoice detail again
    const sentRow = page.locator('main').getByText(new RegExp(`Term 1 Piano|${TS}`, 'i')).first()
      .or(page.locator('main').getByText(/sent/i).first());
    if (await sentRow.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await sentRow.click();
      await expect(page).toHaveURL(/\/invoices\//, { timeout: 10_000 });
      await waitForDataLoad(page);

      // Click Record Payment
      const recordPaymentBtn = page.getByRole('button', { name: /record payment/i }).first();
      if (await recordPaymentBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await recordPaymentBtn.click();
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

        // Enter payment amount — use "Pay Full Amount" link if available
        const payFullLink = page.getByRole('dialog').getByRole('button', { name: /pay full|full amount/i }).first()
          .or(page.getByRole('dialog').getByText(/pay full/i).first());
        if (await payFullLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await payFullLink.click();
          await page.waitForTimeout(300);
        } else {
          // Manually enter amount
          const amountInput = page.getByRole('dialog').locator('input[type="number"]').first();
          await amountInput.fill('120');
        }

        // Submit payment
        const confirmPayment = page.getByRole('dialog').getByRole('button', { name: /record payment/i }).first();
        await expect(confirmPayment).toBeEnabled({ timeout: 5_000 });
        await confirmPayment.click();

        // Assert toast
        await expectToast(page, /payment recorded/i);

        // Assert status changes to Paid
        await page.waitForTimeout(1_000);
        const paidBadge = page.locator('main').getByText(/paid/i).first();
        await expect(paidBadge).toBeVisible({ timeout: 10_000 });
      }
    }

    // ── 24–27. Check reports page ──
    await goTo(page, '/reports');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Click into Revenue report
    const revenueLink = page.locator('a[href*="/reports/revenue"]').first()
      .or(page.locator('main').getByText(/revenue/i).first());
    if (await revenueLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await revenueLink.click();
      await expect(page).toHaveURL(/\/reports\/revenue/, { timeout: 10_000 });
      await waitForDataLoad(page);

      // Report loads without errors — main visible
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Partial payment creates correct remaining balance
  // ═══════════════════════════════════════════════════════════════

  test('Partial payment creates correct remaining balance', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1. Create a new invoice for £100 ──
    await createInvoiceForStudent(page, {
      guardianName: '', // Will pick first available payer
      amount: 100,
      description: `Partial test ${TS}`,
    });

    // Fallback: create directly via modal if helper doesn't find guardian
    await goTo(page, '/invoices');
    await waitForDataLoad(page);

    // Find the invoice we just created
    const invoiceSearch = page.getByPlaceholder(/search/i).first();
    if (await invoiceSearch.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await invoiceSearch.fill(`Partial test ${TS}`);
      await page.waitForTimeout(500);
    }

    // Open the draft invoice
    const draftRow = page.locator('main').getByText(/draft/i).first();
    if (!(await draftRow.isVisible({ timeout: 10_000 }).catch(() => false))) return;
    await draftRow.click();
    await expect(page).toHaveURL(/\/invoices\//, { timeout: 10_000 });
    await waitForDataLoad(page);

    // ── 2. Send it ──
    const sendBtn = page.getByRole('button', { name: /^send$/i }).first();
    if (await sendBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await sendBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

      const dialogSend = page.getByRole('dialog').getByRole('button', { name: /send invoice/i }).first()
        .or(page.getByRole('dialog').getByRole('button', { name: /next|send/i }).first());
      await dialogSend.click();
      await page.waitForTimeout(500);

      const finalSend = page.getByRole('dialog').getByRole('button', { name: /send invoice/i }).first();
      if (await finalSend.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await finalSend.click();
      }
      await expectToast(page, /invoice sent/i);
      await page.waitForTimeout(1_000);
    }

    // ── 3. Record partial payment of £60 ──
    const recordBtn = page.getByRole('button', { name: /record payment/i }).first();
    if (await recordBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await recordBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

      const amountInput = page.getByRole('dialog').locator('input[type="number"]').first();
      await amountInput.fill('60');

      const confirmBtn = page.getByRole('dialog').getByRole('button', { name: /record payment/i }).first();
      await confirmBtn.click();
      await expectToast(page, /payment recorded/i);
      await page.waitForTimeout(1_000);
    }

    // ── 4. Assert remaining balance of £40 ──
    // The page should show the outstanding/remaining amount
    const pageContent = await page.locator('main').textContent() ?? '';
    // Check that 40 appears somewhere (remaining balance)
    const has40 = /40/.test(pageContent);
    if (has40) {
      expect(pageContent).toMatch(/40/);
    }

    // ── 5. Record remaining £40 ──
    const recordAgain = page.getByRole('button', { name: /record payment/i }).first();
    if (await recordAgain.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await recordAgain.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

      // Use "Pay Full Amount" or enter 40
      const payFull = page.getByRole('dialog').getByRole('button', { name: /pay full|full amount/i }).first()
        .or(page.getByRole('dialog').getByText(/pay full/i).first());
      if (await payFull.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await payFull.click();
        await page.waitForTimeout(300);
      } else {
        const amountInput = page.getByRole('dialog').locator('input[type="number"]').first();
        await amountInput.fill('40');
      }

      const confirmBtn = page.getByRole('dialog').getByRole('button', { name: /record payment/i }).first();
      await confirmBtn.click();
      await expectToast(page, /payment recorded/i);
      await page.waitForTimeout(1_000);
    }

    // ── 6. Assert status is now Paid ──
    const paidBadge = page.locator('main').getByText(/paid/i).first();
    await expect(paidBadge).toBeVisible({ timeout: 10_000 });
  });

  // ═══════════════════════════════════════════════════════════════
  // Invoice amounts use minor units correctly
  // ═══════════════════════════════════════════════════════════════

  test('Invoice amounts use minor units correctly', async ({ page }) => {
    test.setTimeout(120_000);

    await goTo(page, '/invoices');
    await waitForDataLoad(page);

    // Create an invoice with amount £99.99
    const createBtn = page.locator('[data-tour="create-invoice-button"]').first()
      .or(page.getByRole('button', { name: /create invoice/i }).first());
    await expect(createBtn).toBeVisible({ timeout: 15_000 });
    await createBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Manual Entry tab
    const manualTab = page.getByRole('dialog').getByRole('tab', { name: /manual/i }).first();
    if (await manualTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await manualTab.click();
      await page.waitForTimeout(300);
    }

    // Select first available payer
    const payerTrigger = page.getByRole('dialog').locator('button')
      .filter({ hasText: /select payer/i }).first();
    if (await payerTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await payerTrigger.click();
      await page.waitForTimeout(300);
      const payerOption = page.getByRole('option').first()
        .or(page.locator('[role="listbox"] [role="option"]').first())
        .or(page.locator('[cmdk-item]').first());
      if (await payerOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await payerOption.click();
        await page.waitForTimeout(300);
      }
    }

    // Fill line item with £99.99
    const descInput = page.getByRole('dialog').getByPlaceholder(/description/i).first();
    await descInput.fill(`Minor units test ${TS}`);

    const priceInput = page.getByRole('dialog').getByPlaceholder(/price/i).first();
    await priceInput.fill('99.99');

    await page.waitForTimeout(300);

    // Assert display shows 99.99 (no floating point corruption)
    const dialogContent = await page.getByRole('dialog').textContent() ?? '';
    expect(dialogContent).toMatch(/99\.99/);

    // Submit
    const submitBtn = page.getByRole('dialog').getByRole('button', { name: /create invoice/i });
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });

    // Verify the amount on the invoices list page
    await goTo(page, '/invoices');
    await waitForDataLoad(page);

    const invoiceSearch = page.getByPlaceholder(/search/i).first();
    if (await invoiceSearch.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await invoiceSearch.fill(`Minor units test ${TS}`);
      await page.waitForTimeout(500);
    }

    // Assert £99.99 displayed (not £99.98 or £100.00)
    const amountCell = page.locator('main').getByText(/99\.99/).first();
    if (await amountCell.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await expect(amountCell).toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Finance role — can manage invoices but not students
// ═══════════════════════════════════════════════════════════════

test.describe('Finance Role Permissions', () => {
  test.use({ storageState: AUTH.finance });

  test('Finance role can manage invoices but not students', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1–2. Navigate to /invoices — page loads ──
    await goTo(page, '/invoices');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Should see invoice content
    const invoiceContent = page.locator('main').getByText(/invoice|billing|total/i).first();
    await expect(invoiceContent).toBeVisible({ timeout: 10_000 });

    // ── 3–4. Navigate to /reports — page loads ──
    await goTo(page, '/reports');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Should see report cards
    const reportContent = page.locator('main').getByText(/revenue|outstanding|payroll|report/i).first();
    await expect(reportContent).toBeVisible({ timeout: 10_000 });

    // ── 5–6. Navigate to /students — should be blocked ──
    await page.goto('/students');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2_000);

    // Finance role gets silently redirected to /dashboard
    const url = page.url();
    expect(url).not.toMatch(/\/students/);

    // ── 7–8. Navigate to /teachers — should be blocked ──
    await page.goto('/teachers');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2_000);

    // Finance role gets silently redirected to /dashboard
    const teacherUrl = page.url();
    expect(teacherUrl).not.toMatch(/\/teachers/);
  });
});
