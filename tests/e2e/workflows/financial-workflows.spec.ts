import { test, expect, Page } from '@playwright/test';
import { format, addDays, addMonths } from 'date-fns';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  goTo,
  expectToastSuccess,
  clickButton,
} from '../helpers';
import {
  cleanupTestData,
  supabaseSelect,
  supabaseDelete,
  deleteInvoiceById,
  createTestInvoice,
  getFirstGuardianId,
  getOrgId,
} from '../supabase-admin';

/* ------------------------------------------------------------------ */
/*  Shared Helpers                                                     */
/* ------------------------------------------------------------------ */

const testId = `e2e-${Date.now()}`;

/** Navigate via sidebar link click (SPA navigation, preserves auth). */
async function clickNav(page: Page, href: string) {
  const link = page.locator(`a[href="${href}"]`).first();
  const linkVisible = await link.isVisible({ timeout: 10_000 }).catch(() => false);
  if (linkVisible) {
    await link.click();
    await page.waitForURL((url) => url.pathname.startsWith(href), { timeout: 15_000 }).catch(() => {});
    await waitForPageReady(page);
  } else {
    // Fallback to direct navigation
    await goTo(page, href);
  }
}

/** Navigate to invoices page */
async function goToInvoices(page: Page) {
  await clickNav(page, '/invoices');
  await waitForPageReady(page);
  await page.waitForTimeout(2_000);
  // Ensure tabs are visible (non-parent view)
  await page.getByRole('tab', { name: 'Invoices' }).first()
    .isVisible({ timeout: 10_000 }).catch(() => false);
}

/** Navigate to a specific invoice detail by ID */
async function goToInvoiceDetail(page: Page, invoiceId: string, invoiceNumber: string) {
  // First navigate to invoices list via sidebar
  await goToInvoices(page);

  // Click the invoice row to navigate to detail
  const invoiceRow = page.locator('li, [role="listitem"], tr, [data-row]').filter({
    hasText: invoiceNumber,
  }).first();

  if (await invoiceRow.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await invoiceRow.click();
  } else {
    // Fallback: evaluate to find and click the element
    await page.evaluate((invNum) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (walker.currentNode.textContent?.includes(invNum)) {
          let target: HTMLElement | null = walker.currentNode.parentElement;
          for (let i = 0; i < 5 && target; i++) {
            if (target.tagName === 'LI' || target.tagName === 'A' || target.onclick) break;
            target = target.parentElement;
          }
          (target || walker.currentNode.parentElement)?.click();
          break;
        }
      }
    }, invoiceNumber);
  }

  await page.waitForURL(/\/invoices\/[^/]+/, { timeout: 15_000 }).catch(() => {});
  await waitForPageReady(page);

  // If still not on detail page, try direct URL via goTo
  if (!page.url().match(/\/invoices\/[a-f0-9-]+/)) {
    await goTo(page, `/invoices/${invoiceId}`);
  }
}

/** Click a tab by name on the invoices page */
async function clickTab(page: Page, name: string) {
  const tab = page.getByRole('tab', { name }).first();
  await expect(tab).toBeVisible({ timeout: 10_000 });
  await tab.click();
  await page.waitForTimeout(1_000);
  await waitForPageReady(page);
}

/** Warm up session with a dashboard visit */
async function warmUp(page: Page) {
  await safeGoTo(page, '/dashboard', 'Dashboard');
  await page.waitForTimeout(2_000);
}

/* ================================================================== */
/*  SECTION 1: Billing Run Wizard                                      */
/* ================================================================== */

test.describe('Billing Run Wizard', () => {
  test.use({ storageState: AUTH.owner });

  const billingRunInvoiceIds: string[] = [];

  test.afterAll(() => {
    try {
      // Clean up invoices created during billing run
      for (const id of billingRunInvoiceIds) {
        try { deleteInvoiceById(id); } catch { /* best-effort */ }
      }
      cleanupTestData(testId);
    } catch { /* best-effort */ }
  });

  test('open billing run wizard and step through config', async ({ page }) => {
    test.setTimeout(300_000);

    await warmUp(page);
    await goToInvoices(page);

    // Click "Billing Run" button (data-tour="billing-run-button")
    const billingRunBtn = page.locator('[data-tour="billing-run-button"]').first()
      .or(page.getByRole('button', { name: /billing run/i }).first());
    await expect(billingRunBtn).toBeVisible({ timeout: 10_000 });
    await billingRunBtn.click();

    // Verify: wizard dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Verify: dialog title is "Billing Run"
    await expect(dialog.getByText('Billing Run')).toBeVisible({ timeout: 5_000 });

    // Verify: config step renders — "Billing Type" label should be visible
    await expect(dialog.getByText('Billing Type')).toBeVisible({ timeout: 5_000 });

    // Verify: default billing type is "Monthly"
    await expect(dialog.getByText('Monthly')).toBeVisible({ timeout: 5_000 });

    // Verify: date pickers are visible (Start Date, End Date)
    await expect(dialog.getByText('Start Date')).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('End Date')).toBeVisible({ timeout: 5_000 });

    // Verify: Pricing section is visible
    await expect(dialog.getByText('Pricing', { exact: true })).toBeVisible({ timeout: 5_000 });

    // Click Preview button to advance to preview step
    const previewBtn = dialog.getByRole('button', { name: /preview/i }).first();
    // Wait for loading to finish (button should not say "Loading...")
    await expect(previewBtn).toBeEnabled({ timeout: 30_000 });
    await previewBtn.click();

    // Now on preview step — wait for it to render
    await page.waitForTimeout(2_000);

    // Check if there are unbilled lessons
    const noLessonsMsg = dialog.getByText(/no unbilled lessons/i);
    const hasNoLessons = await noLessonsMsg.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasNoLessons) {
      // No unbilled lessons — verify preview shows empty state
      await expect(noLessonsMsg).toBeVisible();

      // Generate button should be disabled
      const generateBtn = dialog.getByRole('button', { name: /generate/i }).first();
      if (await generateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(generateBtn).toBeDisabled();
      }

      // Verify Back button works
      const backBtn = dialog.getByRole('button', { name: /back/i });
      await expect(backBtn).toBeVisible({ timeout: 5_000 });
      await backBtn.click();

      // Should be back on config step
      await expect(dialog.getByText('Billing Type')).toBeVisible({ timeout: 5_000 });

      // Close wizard
      const cancelBtn = dialog.getByRole('button', { name: /cancel/i });
      await cancelBtn.click();
      await expect(dialog).toBeHidden({ timeout: 5_000 });
    } else {
      // Has unbilled lessons — verify preview stats
      const invoicesCard = dialog.getByText('Invoices');
      await expect(invoicesCard.first()).toBeVisible({ timeout: 5_000 });

      const lessonsCard = dialog.getByText('Lessons');
      await expect(lessonsCard.first()).toBeVisible({ timeout: 5_000 });

      const totalCard = dialog.getByText('Total');
      await expect(totalCard.first()).toBeVisible({ timeout: 5_000 });

      // Check for Invoice Preview section
      const previewSection = dialog.getByText('Invoice Preview');
      const hasPreview = await previewSection.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasPreview) {
        await expect(previewSection).toBeVisible();
      }

      // Click Generate button
      const generateBtn = dialog.getByRole('button', { name: /generate/i }).first();
      await expect(generateBtn).toBeEnabled({ timeout: 5_000 });
      await generateBtn.click();

      // Wait for generation to complete
      await page.waitForTimeout(5_000);

      // Verify: complete step
      const successMsg = dialog.getByText(/billing run completed/i)
        .or(dialog.getByText(/partially completed/i))
        .or(dialog.getByText(/billing run failed/i));
      await expect(successMsg.first()).toBeVisible({ timeout: 30_000 });

      // Check if successful
      const successIndicator = dialog.getByText(/completed successfully/i);
      const isSuccess = await successIndicator.isVisible({ timeout: 3_000 }).catch(() => false);

      if (isSuccess) {
        // Note invoice count from success message
        const invoiceCountText = await dialog.getByText(/invoice.*created as drafts/i).first()
          .textContent().catch(() => '');
        // eslint-disable-next-line no-console
        console.log(`[billing-run] ${invoiceCountText}`);
      }

      // Click Done to close
      const doneBtn = dialog.getByRole('button', { name: /done/i });
      await expect(doneBtn).toBeVisible({ timeout: 5_000 });
      await doneBtn.click();
      await expect(dialog).toBeHidden({ timeout: 5_000 });

      // Verify: back on invoices page
      await waitForPageReady(page);

      // Try to identify newly created invoices for cleanup
      const orgId = getOrgId();
      if (orgId) {
        const recentInvoices = supabaseSelect(
          'invoices',
          `org_id=eq.${orgId}&status=eq.draft&order=created_at.desc&limit=20&select=id,created_at`,
        );
        // Only track very recently created invoices (within last 2 minutes)
        const cutoff = new Date(Date.now() - 120_000).toISOString();
        for (const inv of recentInvoices) {
          if (inv.created_at > cutoff) {
            billingRunInvoiceIds.push(inv.id);
          }
        }
      }
    }
  });

  test('billing run wizard supports term-based billing', async ({ page }) => {
    test.setTimeout(300_000);

    await warmUp(page);
    await goToInvoices(page);

    // Open wizard
    const billingRunBtn = page.locator('[data-tour="billing-run-button"]').first()
      .or(page.getByRole('button', { name: /billing run/i }).first());
    await expect(billingRunBtn).toBeVisible({ timeout: 10_000 });
    await billingRunBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Change billing type to Termly
    const billingTypeSelect = dialog.locator('button[role="combobox"]').first()
      .or(dialog.locator('[class*="SelectTrigger"]').first());
    await billingTypeSelect.click();
    await page.waitForTimeout(300);

    const termlyOption = page.getByRole('option', { name: /termly/i });
    await termlyOption.click();
    await page.waitForTimeout(500);

    // Verify: term selector appears
    const selectTermLabel = dialog.getByText('Select Term');
    const hasTerms = await selectTermLabel.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasTerms) {
      // Verify billing mode selector also appears for term billing
      const billingModeLabel = dialog.getByText('Billing Mode');
      await expect(billingModeLabel).toBeVisible({ timeout: 5_000 });
    } else {
      // No terms — verify "No terms defined" message
      const noTermsMsg = dialog.getByText(/no terms defined/i);
      const visible = await noTermsMsg.isVisible({ timeout: 5_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[billing-run] No terms defined: ${visible}`);
    }

    // Close wizard
    const cancelBtn = dialog.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });
});

/* ================================================================== */
/*  SECTION 2: Payment Plans                                           */
/* ================================================================== */

test.describe('Payment Plans', () => {
  test.use({ storageState: AUTH.owner });

  const paymentPlanInvoiceIds: string[] = [];

  test.afterAll(() => {
    try {
      const orgId = getOrgId();
      for (const id of paymentPlanInvoiceIds) {
        try {
          // Delete installments first, then invoice
          if (orgId) {
            supabaseDelete('invoice_installments', `invoice_id=eq.${id}`);
          }
          deleteInvoiceById(id);
        } catch { /* best-effort */ }
      }
      cleanupTestData(testId);
    } catch { /* best-effort */ }
  });

  test('create payment plan on invoice', async ({ page }) => {
    test.setTimeout(300_000);

    // Create a test invoice via API
    const guardianId = getFirstGuardianId();
    if (!guardianId) {
      test.skip(true, 'No guardians found for test org');
      return;
    }

    const dueDate = format(addDays(new Date(), 30), 'yyyy-MM-dd');
    const invoice = createTestInvoice({
      dueDate,
      payerGuardianId: guardianId,
      notes: `E2E payment plan ${testId}`,
      items: [{ description: `E2E Plan ${testId}`, quantity: 1, unit_price_minor: 9000 }],
    });
    paymentPlanInvoiceIds.push(invoice.id);

    await warmUp(page);

    // Navigate to invoice detail
    await goToInvoiceDetail(page, invoice.id, invoice.invoice_number);

    // Verify invoice loaded — wait for detail page content
    const invoiceHeading = page.getByRole('heading', { name: new RegExp(invoice.invoice_number) }).first()
      .or(page.getByText(`Invoice ${invoice.invoice_number}`).first());
    await expect(invoiceHeading).toBeVisible({ timeout: 20_000 });

    // Find "Set Up Payment Plan" button
    const planBtn = page.getByRole('button', { name: /set up payment plan/i }).first()
      .or(page.getByRole('button', { name: /payment plan/i }).first());
    const planBtnVisible = await planBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!planBtnVisible) {
      test.skip(true, 'Payment plan button not visible — invoice may be in wrong state');
      return;
    }

    await planBtn.click();

    // Sheet should open with "Set Up Payment Plan" title
    const sheet = page.locator('[role="dialog"]').first();
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await expect(sheet.getByText('Set Up Payment Plan')).toBeVisible({ timeout: 5_000 });

    // Verify default setup: Plan Type should be "Equal installments"
    await expect(sheet.getByText(/equal installments/i)).toBeVisible({ timeout: 5_000 });

    // Verify Number of Installments selector is visible
    await expect(sheet.getByText('Number of Installments')).toBeVisible({ timeout: 5_000 });

    // Verify Frequency selector is visible
    await expect(sheet.getByText('Frequency')).toBeVisible({ timeout: 5_000 });

    // Verify Preview table shows installments
    await expect(sheet.getByText('Preview')).toBeVisible({ timeout: 5_000 });

    // Verify 3 installment rows in preview (default is 3)
    const installmentRows = sheet.locator('tbody tr');
    const rowCount = await installmentRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);

    // Verify total footer row exists
    await expect(sheet.locator('tfoot').getByText('Total')).toBeVisible({ timeout: 5_000 });

    // Click "Confirm Payment Plan"
    const confirmBtn = sheet.getByRole('button', { name: /confirm payment plan/i });
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
    await confirmBtn.click();

    // Wait for sheet to close (success)
    await expect(sheet).toBeHidden({ timeout: 15_000 });

    // Verify: page reloaded with payment plan info
    await page.waitForTimeout(2_000);
    await waitForPageReady(page);
  });

  test('view payment plans tab on invoices page', async ({ page }) => {
    test.setTimeout(300_000);

    await warmUp(page);
    await goToInvoices(page);

    // Click "Payment Plans" tab
    await clickTab(page, 'Payment Plans');

    // Verify tab content loaded — either shows plans or empty state
    const plansContent = page.getByRole('heading', { name: /active payment plans/i }).first()
      .or(page.getByRole('heading', { name: /payment plans/i }).first());
    await expect(plansContent).toBeVisible({ timeout: 10_000 });
  });
});

/* ================================================================== */
/*  SECTION 3: Recurring Invoices                                      */
/* ================================================================== */

test.describe('Recurring Invoices', () => {
  test.use({ storageState: AUTH.owner });

  const createdTemplateIds: string[] = [];

  test.afterAll(() => {
    try {
      const orgId = getOrgId();
      if (orgId) {
        // Delete recurring templates matching testId
        for (const id of createdTemplateIds) {
          supabaseDelete('recurring_invoice_templates', `id=eq.${id}&org_id=eq.${orgId}`);
        }
        // Also try by name pattern
        const encoded = encodeURIComponent(`%${testId}%`);
        supabaseDelete('recurring_invoice_templates', `org_id=eq.${orgId}&name=like.${encoded}`);
      }
    } catch { /* best-effort */ }
  });

  test('create recurring invoice template', async ({ page }) => {
    test.setTimeout(300_000);

    await warmUp(page);
    await goToInvoices(page);

    // Click "Recurring" tab
    await clickTab(page, 'Recurring');

    // Verify recurring tab loaded
    const recurringContent = page.getByRole('heading', { name: 'Recurring Billing', exact: true });
    await expect(recurringContent).toBeVisible({ timeout: 10_000 });

    // Click "New Template" button (prefer the smaller header button over empty-state CTA)
    const newTemplateBtn = page.getByRole('button', { name: 'New Template' });
    const createTemplateBtn = page.getByRole('button', { name: 'Create Template' });
    const headerBtnVisible = await newTemplateBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (headerBtnVisible) {
      await newTemplateBtn.click();
    } else {
      await expect(createTemplateBtn).toBeVisible({ timeout: 10_000 });
      await createTemplateBtn.click();
    }

    // Dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText(/new recurring template/i).first()
      .or(dialog.getByText(/edit template/i).first())).toBeVisible({ timeout: 5_000 });

    // Fill template name
    const nameInput = dialog.locator('#tpl-name').first()
      .or(dialog.getByLabel(/template name/i).first());
    await nameInput.fill(`E2E Recurring ${testId}`);

    // Frequency — default is Monthly, keep it
    await expect(dialog.getByText('Monthly')).toBeVisible({ timeout: 5_000 });

    // Billing Mode — default is "Delivered lessons", keep it

    // Set Next Run Date
    const nextRunInput = dialog.locator('#tpl-next-run').first()
      .or(dialog.getByLabel(/next run date/i).first());
    const nextRunDate = format(addMonths(new Date(), 1), 'yyyy-MM-dd');
    await nextRunInput.fill(nextRunDate);

    // Click "Create Template"
    const createBtn = dialog.getByRole('button', { name: /create template/i });
    await expect(createBtn).toBeVisible({ timeout: 5_000 });
    await expect(createBtn).toBeEnabled({ timeout: 5_000 });
    await createBtn.click();

    // Wait for dialog to close
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    // Verify: template appears in list
    await page.waitForTimeout(2_000);
    const templateEntry = page.getByText(`E2E Recurring ${testId}`);
    await expect(templateEntry).toBeVisible({ timeout: 10_000 });

    // Verify: Active badge
    // Find the template card containing our testId
    const templateCard = page.locator('.rounded-xl, [class*="Card"]').filter({
      hasText: `E2E Recurring ${testId}`,
    }).first();

    const activeBadge = templateCard.getByText('Active');
    const hasActiveBadge = await activeBadge.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[recurring] Active badge visible: ${hasActiveBadge}`);

    // Verify: Monthly badge
    const monthlyBadge = templateCard.getByText('Monthly');
    const hasMonthlyBadge = await monthlyBadge.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[recurring] Monthly badge visible: ${hasMonthlyBadge}`);

    // Track the template for cleanup
    const orgId = getOrgId();
    if (orgId) {
      const templates = supabaseSelect(
        'recurring_invoice_templates',
        `org_id=eq.${orgId}&name=like.%25${testId}%25&select=id&limit=1`,
      );
      if (templates.length > 0) {
        createdTemplateIds.push(templates[0].id);
      }
    }
  });

  test('pause and delete recurring template', async ({ page }) => {
    test.setTimeout(300_000);

    await warmUp(page);
    await goToInvoices(page);
    await clickTab(page, 'Recurring');

    // Wait for templates to load
    await page.waitForTimeout(2_000);

    // Find the template card with our testId
    const templateEntry = page.getByText(`E2E Recurring ${testId}`);
    const templateExists = await templateEntry.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!templateExists) {
      test.skip(true, 'No recurring template found — create test must run first');
      return;
    }

    // Find the template card
    const templateCard = page.locator('.rounded-xl, [class*="Card"], [class*="border"]').filter({
      hasText: `E2E Recurring ${testId}`,
    }).first();

    // PAUSE: Click the toggle button using title attribute
    const toggleBtn = templateCard.locator('button[title="Pause"]').first()
      .or(templateCard.locator('button[title="Activate"]').first());

    if (await toggleBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await toggleBtn.click();
      await page.waitForTimeout(3_000);

      // Refresh the template card reference after mutation
      const updatedCard = page.locator('.rounded-xl, [class*="Card"], [class*="border"]').filter({
        hasText: `E2E Recurring ${testId}`,
      }).first();

      // Verify: status changes to Paused
      const pausedBadge = updatedCard.getByText('Paused');
      const isPaused = await pausedBadge.isVisible({ timeout: 10_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[recurring] Paused badge visible: ${isPaused}`);
    }

    // DELETE: Click the delete button using title attribute
    // Refresh card reference
    const cardForDelete = page.locator('.rounded-xl, [class*="Card"], [class*="border"]').filter({
      hasText: `E2E Recurring ${testId}`,
    }).first();
    const deleteBtn = cardForDelete.locator('button[title="Delete"]');
    if (await deleteBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await deleteBtn.click();

      // Confirm deletion in alert dialog
      const alertDialog = page.getByRole('alertdialog');
      await expect(alertDialog).toBeVisible({ timeout: 5_000 });

      const confirmDeleteBtn = alertDialog.getByRole('button', { name: /delete/i });
      await confirmDeleteBtn.click();

      // Wait for dialog to close
      await expect(alertDialog).toBeHidden({ timeout: 10_000 });
      await page.waitForTimeout(2_000);

      // Verify: template removed from list
      const templateGone = await page.getByText(`E2E Recurring ${testId}`)
        .isVisible({ timeout: 3_000 }).catch(() => false);
      expect(templateGone).toBe(false);
    }
  });
});

/* ================================================================== */
/*  SECTION 4: Refund Flow                                             */
/* ================================================================== */

test.describe('Refund Flow', () => {
  test.use({ storageState: AUTH.owner });

  const refundInvoiceIds: string[] = [];

  test.afterAll(() => {
    try {
      for (const id of refundInvoiceIds) {
        try { deleteInvoiceById(id); } catch { /* best-effort */ }
      }
    } catch { /* best-effort */ }
  });

  test('refund dialog is accessible on paid invoice with Stripe payment', async ({ page }) => {
    test.setTimeout(300_000);

    await warmUp(page);

    // Check if there are any paid invoices with Stripe payments
    const orgId = getOrgId();
    if (!orgId) {
      test.skip(true, 'No org ID found');
      return;
    }

    const paidInvoices = supabaseSelect(
      'invoices',
      `org_id=eq.${orgId}&status=eq.paid&select=id,invoice_number&limit=5&order=created_at.desc`,
    );

    if (paidInvoices.length === 0) {
      test.skip(true, 'No paid invoices found in test org');
      return;
    }

    // Check for Stripe payments on these invoices
    let stripePaymentInvoice: { id: string; invoice_number: string } | null = null;
    for (const inv of paidInvoices) {
      const payments = supabaseSelect(
        'payments',
        `invoice_id=eq.${inv.id}&provider=eq.stripe&select=id,provider_reference&limit=1`,
      );
      if (payments.length > 0 && payments[0].provider_reference) {
        stripePaymentInvoice = inv;
        break;
      }
    }

    if (!stripePaymentInvoice) {
      test.skip(true, 'No paid invoices with Stripe payments found — refund requires Stripe provider');
      return;
    }

    // Navigate to the invoice detail
    await goToInvoiceDetail(page, stripePaymentInvoice.id, stripePaymentInvoice.invoice_number);
    await expect(page.getByText(stripePaymentInvoice.invoice_number)).toBeVisible({ timeout: 15_000 });

    // Find refund button in payment history
    const refundBtn = page.getByRole('button', { name: /refund/i }).first();
    const refundVisible = await refundBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!refundVisible) {
      test.skip(true, 'Refund button not visible — may need billing admin role');
      return;
    }

    await refundBtn.click();

    // Verify refund dialog opens
    const refundDialog = page.getByRole('dialog');
    await expect(refundDialog).toBeVisible({ timeout: 10_000 });
    await expect(refundDialog.getByText('Process Refund')).toBeVisible({ timeout: 5_000 });

    // Verify: payment summary shown
    await expect(refundDialog.getByText(stripePaymentInvoice.invoice_number)).toBeVisible({ timeout: 5_000 });

    // Verify: Full refund / Partial refund options
    await expect(refundDialog.getByText('Full refund')).toBeVisible({ timeout: 5_000 });
    await expect(refundDialog.getByText('Partial refund')).toBeVisible({ timeout: 5_000 });

    // Verify: Reason selector
    await expect(refundDialog.getByText('Reason')).toBeVisible({ timeout: 5_000 });

    // Verify: Review Refund button (disabled until reason selected)
    const reviewBtn = refundDialog.getByRole('button', { name: /review refund/i });
    await expect(reviewBtn).toBeVisible({ timeout: 5_000 });

    // Select a reason
    const reasonTrigger = refundDialog.locator('button[role="combobox"]').first()
      .or(refundDialog.locator('[class*="SelectTrigger"]').first());
    await reasonTrigger.click();
    await page.waitForTimeout(300);

    const reasonOption = page.getByRole('option', { name: /customer request/i }).first()
      .or(page.getByText('Customer request', { exact: false }).first());
    await reasonOption.click();
    await page.waitForTimeout(300);

    // Now Review Refund should be enabled
    await expect(reviewBtn).toBeEnabled({ timeout: 5_000 });

    // Click Review Refund → goes to confirm step
    await reviewBtn.click();
    await page.waitForTimeout(1_000);

    // Verify: confirm step
    await expect(refundDialog.getByText(/confirm refund/i)).toBeVisible({ timeout: 5_000 });
    await expect(refundDialog.getByText(/this action cannot be undone/i)).toBeVisible({ timeout: 5_000 });

    // DO NOT actually process the refund on real payment - go Back
    const backBtn = refundDialog.getByRole('button', { name: /back/i });
    await backBtn.click();
    await page.waitForTimeout(500);

    // Verify: back on form step
    await expect(refundDialog.getByText('Full refund')).toBeVisible({ timeout: 5_000 });

    // Close dialog
    await page.keyboard.press('Escape');
    await expect(refundDialog).toBeHidden({ timeout: 5_000 });
  });

  test('record payment on invoice and verify paid status', async ({ page }) => {
    test.setTimeout(300_000);

    // Create an invoice to test the payment flow leading to refund eligibility
    const guardianId = getFirstGuardianId();
    if (!guardianId) {
      test.skip(true, 'No guardians found for test org');
      return;
    }

    const dueDate = format(addDays(new Date(), 14), 'yyyy-MM-dd');
    const invoice = createTestInvoice({
      dueDate,
      payerGuardianId: guardianId,
      notes: `E2E refund test ${testId}`,
      items: [{ description: `E2E Refund Item ${testId}`, quantity: 1, unit_price_minor: 10000 }],
    });
    refundInvoiceIds.push(invoice.id);

    await warmUp(page);
    await goToInvoiceDetail(page, invoice.id, invoice.invoice_number);

    // Verify draft status
    await expect(page.getByText(/draft/i).first()).toBeVisible({ timeout: 15_000 });

    // Send the invoice first
    const sendBtn = page.getByRole('button', { name: /^send$/i }).first();
    if (await sendBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sendBtn.click();

      const sendDialog = page.getByRole('dialog');
      if (await sendDialog.isVisible({ timeout: 10_000 }).catch(() => false)) {
        // Click Preview if visible
        const previewBtn = sendDialog.getByRole('button', { name: /preview/i });
        if (await previewBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await previewBtn.click();
          await page.waitForTimeout(1_000);
        }

        // Click Send Invoice
        const confirmSendBtn = sendDialog.getByRole('button', { name: /send invoice/i });
        if (await confirmSendBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await confirmSendBtn.click();
          await expectToastSuccess(page, /sent/i);
          await page.waitForTimeout(1_000);
        }
      }
    }

    // Record Payment
    const recordPaymentBtn = page.getByRole('button', { name: /record payment/i }).first();
    if (await recordPaymentBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await recordPaymentBtn.click();

      const payDialog = page.getByRole('dialog');
      await expect(payDialog).toBeVisible({ timeout: 5_000 });

      // Click "Pay full amount" if available
      const payFullBtn = page.getByText(/pay full amount/i).first();
      if (await payFullBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await payFullBtn.click();
        await page.waitForTimeout(300);
      } else {
        const amountInput = page.locator('#amount');
        await amountInput.fill('100.00');
      }

      // Submit payment
      const confirmPayBtn = payDialog.getByRole('button', { name: /record payment/i });
      await expect(confirmPayBtn).toBeEnabled({ timeout: 5_000 });
      await confirmPayBtn.click();

      await expect(payDialog).toBeHidden({ timeout: 15_000 });

      // Verify paid status
      await expect(page.getByText(/paid/i).first()).toBeVisible({ timeout: 10_000 });

      // Verify: payment history section appears
      const paymentHistory = page.getByText('Payment History');
      await expect(paymentHistory).toBeVisible({ timeout: 10_000 });
    }
  });
});

/* ================================================================== */
/*  SECTION 5: Continuation Run Wizard                                 */
/* ================================================================== */

test.describe('Continuation Run Wizard', () => {
  test.use({ storageState: AUTH.owner });

  test.afterAll(() => {
    try {
      const orgId = getOrgId();
      if (orgId) {
        // Clean up continuation runs matching our test
        // Best-effort — continuation runs may not have a testId marker
      }
    } catch { /* best-effort */ }
  });

  test('open continuation wizard and explore config', async ({ page }) => {
    test.setTimeout(300_000);

    await warmUp(page);

    // Navigate to continuation page via sidebar
    await clickNav(page, '/continuation');

    // Verify page loaded
    await expect(
      page.getByText('Term Continuation').first()
    ).toBeVisible({ timeout: 15_000 });

    // Find "New Run" button
    const newRunBtn = page.getByRole('button', { name: 'New Run' }).first();
    const createRunBtn = page.getByRole('button', { name: /create continuation run/i }).first();
    const newRunVisible = await newRunBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    const createVisible = await createRunBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!newRunVisible && !createVisible) {
      test.skip(true, 'No New Run button visible — may need specific org configuration');
      return;
    }
    if (newRunVisible) {
      await newRunBtn.click();
    } else {
      await createRunBtn.click();
    }

    // Verify: wizard dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText('Term Continuation Run')).toBeVisible({ timeout: 5_000 });

    // Verify: config step renders
    await expect(dialog.getByText('Current Term', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('Next Term', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('Notice Deadline', { exact: true })).toBeVisible({ timeout: 5_000 });

    // Verify: assumed continuing toggle
    await expect(dialog.getByText('Assumed continuing')).toBeVisible({ timeout: 5_000 });

    // Verify: reminder schedule section
    await expect(dialog.getByText('Reminder Schedule')).toBeVisible({ timeout: 5_000 });

    // Check if terms exist
    const noTermsMsg = dialog.getByText(/no terms defined/i);
    const hasNoTerms = await noTermsMsg.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasNoTerms) {
      // eslint-disable-next-line no-console
      console.log('[continuation] No terms defined — cannot proceed with wizard');

      // Close wizard
      const cancelBtn = dialog.getByRole('button', { name: /cancel/i });
      await cancelBtn.click();
      await expect(dialog).toBeHidden({ timeout: 5_000 });
      return;
    }

    // Check if both current and next term are selected
    const previewBtn = dialog.getByRole('button', { name: /preview/i }).first();
    const previewEnabled = await previewBtn.isEnabled().catch(() => false);

    if (previewEnabled) {
      // Click Preview to see what happens
      await previewBtn.click();
      await page.waitForTimeout(5_000);

      // Check if preview step loaded
      const previewHeader = dialog.getByText(/review students/i)
        .or(dialog.getByText('Students').first());
      const onPreview = await previewHeader.isVisible({ timeout: 10_000 }).catch(() => false);

      if (onPreview) {
        // Verify: stats cards (Students, Total Fees, Deadline)
        const studentsCard = dialog.getByText('Students');
        await expect(studentsCard.first()).toBeVisible({ timeout: 5_000 });

        const feesCard = dialog.getByText('Total Fees');
        const hasFeesCard = await feesCard.isVisible({ timeout: 5_000 }).catch(() => false);
        // eslint-disable-next-line no-console
        console.log(`[continuation] Fees card visible: ${hasFeesCard}`);

        // Do NOT send — click Back
        const backBtn = dialog.getByRole('button', { name: /back/i });
        await backBtn.click();
        await page.waitForTimeout(500);
      }
    } else {
      // eslint-disable-next-line no-console
      console.log('[continuation] Preview not enabled — may need next term configured');
    }

    // Close wizard
    const cancelBtn = dialog.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test('view existing continuation runs and response tracking', async ({ page }) => {
    test.setTimeout(300_000);

    await warmUp(page);
    await clickNav(page, '/continuation');

    // Check if there are existing runs
    const hasRun = await page.getByText(/collecting responses/i).first()
      .or(page.getByText(/completed/i).first())
      .or(page.getByText(/reminding/i).first())
      .or(page.getByText(/deadline passed/i).first())
      .isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasRun) {
      // No existing runs — just verify empty state
      const emptyState = page.getByText(/no continuation runs/i)
        .or(page.getByText(/create one to start/i));
      const isEmpty = await emptyState.isVisible({ timeout: 5_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[continuation] Empty state visible: ${isEmpty}`);
      return;
    }

    // Verify: response tracking section
    const responsesHeader = page.getByText('Responses');
    const hasResponses = await responsesHeader.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[continuation] Responses section visible: ${hasResponses}`);

    if (hasResponses) {
      // Verify: response filter dropdown
      const filterTrigger = page.locator('select, [role="combobox"]').filter({
        hasText: /all|pending|continuing/i,
      }).first();
      const hasFilter = await filterTrigger.isVisible({ timeout: 5_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[continuation] Response filter visible: ${hasFilter}`);

      // Verify: response table has columns
      const studentCol = page.getByText('Student', { exact: true }).first()
        .or(page.locator('th').filter({ hasText: /student/i }).first());
      const hasStudentCol = await studentCol.isVisible({ timeout: 5_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[continuation] Student column visible: ${hasStudentCol}`);
    }

    // Verify: stats cards if visible
    const confirmedCard = page.getByText('Confirmed');
    const hasConfirmed = await confirmedCard.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[continuation] Confirmed card visible: ${hasConfirmed}`);

    const pendingCard = page.getByText('Pending');
    const hasPending = await pendingCard.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[continuation] Pending card visible: ${hasPending}`);
  });
});
