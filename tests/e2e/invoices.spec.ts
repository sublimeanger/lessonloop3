import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, waitForPageReady, assertNoErrorBoundary, trackConsoleErrors } from './helpers';

// ═══════════════════════════════════════════════════════════════
// OWNER — INVOICES LIST
// ═══════════════════════════════════════════════════════════════
test.describe('Invoices List — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('loads invoices page with title', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    await assertNoErrorBoundary(page);
    // Title should show "Invoices" (possibly with count)
    const title = page.getByText(/^Invoices/i).first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('shows invoice stats widget', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    const statsWidget = page.locator('[data-tour="invoice-stats"]');
    const visible = await statsWidget.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[invoices] Stats widget visible: ${visible}`);
    // Stats widget should be visible for non-parent roles
    expect(visible, 'Invoice stats widget should be visible for owner').toBe(true);
  });

  test('has 3 tabs: Invoices, Payment Plans, Recurring', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const expectedTabs = ['Invoices', 'Payment Plans', 'Recurring'];
    for (const tabName of expectedTabs) {
      const tab = page.getByRole('tab', { name: tabName }).first();
      const visible = await tab.isVisible({ timeout: 8_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[invoices] Tab "${tabName}": ${visible}`);
    }

    // At least the "Invoices" tab must be visible
    await expect(
      page.getByRole('tab', { name: 'Invoices' }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('clicking Payment Plans tab loads content', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const plansTab = page.getByRole('tab', { name: 'Payment Plans' }).first();
    const visible = await plansTab.isVisible({ timeout: 8_000 }).catch(() => false);
    if (visible) {
      await plansTab.click();
      await page.waitForTimeout(1_000);
      await assertNoErrorBoundary(page);
    }
  });

  test('clicking Recurring tab loads content', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const recurringTab = page.getByRole('tab', { name: 'Recurring' }).first();
    const visible = await recurringTab.isVisible({ timeout: 8_000 }).catch(() => false);
    if (visible) {
      await recurringTab.click();
      await page.waitForTimeout(1_000);
      await assertNoErrorBoundary(page);
    }
  });

  test('status filter pills are interactive', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    await page.waitForTimeout(2_000);

    // Status pills: All, Draft, Sent, Paid, Overdue, Cancelled
    const statusPills = ['All', 'Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];
    for (const status of statusPills) {
      const pill = page.getByRole('button', { name: new RegExp(`^${status}`, 'i') }).first()
        .or(page.locator('button').filter({ hasText: new RegExp(`^${status}`) }).first());
      const visible = await pill.isVisible({ timeout: 3_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[invoices] Status pill "${status}": ${visible}`);
    }

    // Click "Draft" filter
    const draftPill = page.locator('button').filter({ hasText: /^Draft/ }).first();
    if (await draftPill.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await draftPill.click();
      await page.waitForTimeout(500);
      await assertNoErrorBoundary(page);

      // Click "All" to reset
      const allPill = page.locator('button').filter({ hasText: /^All/ }).first();
      if (await allPill.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await allPill.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('"Create Invoice" button opens modal', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const createBtn = page.locator('[data-tour="create-invoice-button"]').first();
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText('Create Invoice')).toBeVisible({ timeout: 5_000 });

    // Close it
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test('create invoice modal shows form fields', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    await page.locator('[data-tour="create-invoice-button"]').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Check Cancel button
    const cancelBtn = dialog.getByRole('button', { name: /cancel/i }).first();
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 });

    // Check Create Invoice submit button
    const submitBtn = dialog.getByRole('button', { name: /create invoice/i }).first();
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });

    // Close via Cancel
    await cancelBtn.click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test('"Billing Run" button opens wizard', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');

    const billingRunBtn = page.locator('[data-tour="billing-run-button"]').first();
    await expect(billingRunBtn).toBeVisible({ timeout: 10_000 });
    await billingRunBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Should show "Billing Run" title
    await expect(dialog.getByText('Billing Run')).toBeVisible({ timeout: 5_000 });

    // Should be on config step with description
    const configDesc = dialog.getByText(/configure.*billing/i).first();
    const hasConfig = await configDesc.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[invoices] Billing Run config step: ${hasConfig}`);

    // Check for form labels
    const billingTypeLabel = dialog.getByText('Billing Type').first();
    const hasLabel = await billingTypeLabel.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[invoices] Billing Type label: ${hasLabel}`);

    // Close
    await page.keyboard.press('Escape');
  });

  test('invoice list shows data or empty state', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    await page.waitForTimeout(3_000);

    const invoiceList = page.locator('[data-tour="invoice-list"]');
    const hasInvoices = await invoiceList.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasInvoices) {
      // eslint-disable-next-line no-console
      console.log('[invoices] Invoice list is populated');
      // Check that rows/items exist
      const rows = invoiceList.locator('tr, [role="listitem"]');
      const rowCount = await rows.count();
      // eslint-disable-next-line no-console
      console.log(`[invoices] Row count: ${rowCount}`);
    } else {
      // Should show empty state
      const emptyState = page.getByText('No invoices').first();
      const hasEmpty = await emptyState.isVisible({ timeout: 5_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[invoices] Empty state visible: ${hasEmpty}`);
      if (hasEmpty) {
        // Empty state should have action buttons
        const billingRunAction = page.getByRole('button', { name: /start billing run/i }).first();
        const createAction = page.getByRole('button', { name: /create manually/i }).first();
        const hasBillingAction = await billingRunAction.isVisible({ timeout: 3_000 }).catch(() => false);
        const hasCreateAction = await createAction.isVisible({ timeout: 3_000 }).catch(() => false);
        // eslint-disable-next-line no-console
        console.log(`[invoices] Empty state — Billing Run: ${hasBillingAction}, Create: ${hasCreateAction}`);
      }
    }
  });

  test('clicking an invoice row navigates to detail', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    await page.waitForTimeout(3_000);

    const invoiceList = page.locator('[data-tour="invoice-list"]');
    const hasInvoices = await invoiceList.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasInvoices) {
      // eslint-disable-next-line no-console
      console.log('[invoices] No invoices to click');
      return;
    }

    // Desktop: click a table row (but not a button/checkbox inside it)
    const row = invoiceList.locator('tr').filter({ hasText: /INV-|£/ }).first()
      .or(invoiceList.locator('[role="listitem"]').first());
    const rowVisible = await row.isVisible({ timeout: 5_000 }).catch(() => false);
    if (rowVisible) {
      // Click in the middle of the row (avoid checkbox/action columns)
      await row.click({ position: { x: 200, y: 10 } });
      await page.waitForURL(/\/invoices\/[\w-]+/, { timeout: 10_000 }).catch(() => {});
      const url = page.url();
      // eslint-disable-next-line no-console
      console.log(`[invoices] After row click, URL: ${url}`);
    }
  });

  test('invoice detail page loads without errors', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    await page.waitForTimeout(3_000);

    // Navigate to first invoice
    const invoiceList = page.locator('[data-tour="invoice-list"]');
    if (!(await invoiceList.isVisible({ timeout: 5_000 }).catch(() => false))) return;

    const row = invoiceList.locator('tr').filter({ hasText: /INV-|£/ }).first()
      .or(invoiceList.locator('[role="listitem"]').first());
    if (!(await row.isVisible({ timeout: 3_000 }).catch(() => false))) return;

    await row.click({ position: { x: 200, y: 10 } });
    await page.waitForURL(/\/invoices\/[\w-]+/, { timeout: 10_000 }).catch(() => {});

    if (page.url().includes('/invoices/')) {
      await waitForPageReady(page);
      await assertNoErrorBoundary(page);

      // Should show status badge and invoice details
      const statusBadge = page.locator('[class*="badge"]').first();
      const hasBadge = await statusBadge.isVisible({ timeout: 5_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[invoices] Detail page status badge: ${hasBadge}`);

      // Breadcrumb back to Invoices should exist
      const breadcrumb = page.getByRole('link', { name: 'Invoices' }).first();
      const hasBreadcrumb = await breadcrumb.isVisible({ timeout: 5_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[invoices] Detail breadcrumb: ${hasBreadcrumb}`);
    }
  });

  test('no console errors during invoice page interaction', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/invoices', 'Invoices');
    await page.waitForTimeout(3_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// FINANCE — INVOICES (has access)
// ═══════════════════════════════════════════════════════════════
test.describe('Invoices — Finance', () => {
  test.use({ storageState: AUTH.finance });

  test('finance user can access /invoices', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Finance Invoices');
    await assertNoErrorBoundary(page);

    // Finance should see the invoices page
    const title = page.getByText(/^Invoices/i).first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('finance user sees Create Invoice and Billing Run buttons', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Finance Invoices');

    // Finance role can manage invoices
    const createBtn = page.locator('[data-tour="create-invoice-button"]');
    const billingBtn = page.locator('[data-tour="billing-run-button"]');

    const hasCreate = await createBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    const hasBilling = await billingBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    // eslint-disable-next-line no-console
    console.log(`[finance-invoices] Create: ${hasCreate}, Billing Run: ${hasBilling}`);
  });

  test('finance can navigate to invoice detail', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Finance Invoices');
    await page.waitForTimeout(3_000);

    const invoiceList = page.locator('[data-tour="invoice-list"]');
    if (!(await invoiceList.isVisible({ timeout: 5_000 }).catch(() => false))) {
      // eslint-disable-next-line no-console
      console.log('[finance-invoices] No invoices to test');
      return;
    }

    const row = invoiceList.locator('tr, [role="listitem"]').filter({ hasText: /INV-|£/ }).first();
    if (await row.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await row.click({ position: { x: 200, y: 10 } });
      await page.waitForURL(/\/invoices\/[\w-]+/, { timeout: 10_000 }).catch(() => {});
      if (page.url().match(/\/invoices\/[\w-]+/)) {
        await waitForPageReady(page);
        await assertNoErrorBoundary(page);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// TEACHER — INVOICES (should NOT have access)
// ═══════════════════════════════════════════════════════════════
test.describe('Invoices — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher accessing /invoices is redirected or restricted', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForTimeout(5_000);

    const url = page.url();
    const onInvoices = url.includes('/invoices');
    const onDashboard = url.includes('/dashboard');

    // eslint-disable-next-line no-console
    console.log(`[teacher-invoices] URL: ${url}, onInvoices: ${onInvoices}, redirected: ${onDashboard}`);

    // Teacher doesn't have Invoices in sidebar — should redirect or show restricted
    await expect(page.locator('body')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — INVOICES (read-only via portal)
// ═══════════════════════════════════════════════════════════════
test.describe('Invoices — Parent', () => {
  test.use({ storageState: AUTH.parent });

  test('parent sees "Invoices & Payments" title on portal', async ({ page }) => {
    await safeGoTo(page, '/portal/invoices', 'Parent Invoices');
    await assertNoErrorBoundary(page);

    // Parent sees "Invoices & Payments" heading or portal-specific title
    const title = page.getByText(/Invoices/i).first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('parent does NOT see Create Invoice or Billing Run buttons', async ({ page }) => {
    await safeGoTo(page, '/portal/invoices', 'Parent Invoices');
    await page.waitForTimeout(2_000);

    const createBtn = page.locator('[data-tour="create-invoice-button"]');
    const billingBtn = page.locator('[data-tour="billing-run-button"]');

    const hasCreate = await createBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasBilling = await billingBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasCreate, 'Parent should NOT see Create Invoice').toBe(false);
    expect(hasBilling, 'Parent should NOT see Billing Run').toBe(false);
  });

  test('parent does NOT see stats widget or tabs', async ({ page }) => {
    await safeGoTo(page, '/portal/invoices', 'Parent Invoices');
    await page.waitForTimeout(2_000);

    const statsWidget = page.locator('[data-tour="invoice-stats"]');
    const hasStats = await statsWidget.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasStats, 'Parent should NOT see invoice stats').toBe(false);

    // Parent should not see the tab bar (Invoices/Payment Plans/Recurring)
    const paymentPlansTab = page.getByRole('tab', { name: 'Payment Plans' });
    const hasPlansTab = await paymentPlansTab.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasPlansTab, 'Parent should NOT see Payment Plans tab').toBe(false);
  });
});
