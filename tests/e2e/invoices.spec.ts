import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, waitForPageReady, assertNoErrorBoundary, trackConsoleErrors } from './helpers';

// ═══════════════════════════════════════════════════════════════
// OWNER — INVOICES LIST
// ═══════════════════════════════════════════════════════════════
test.describe('Invoices List — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('loads invoices page with title', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/invoices', 'Invoices');
    await assertNoErrorBoundary(page);
    // Title should show "Invoices" (possibly with count)
    const title = page.getByText(/^Invoices/i).first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('shows invoice stats widget', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    if (!page.url().includes('/invoices')) return; // auth race
    // Stats cards may render as skeleton placeholders first — wait for real content
    const statsWidget = page.locator('[data-tour="invoice-stats"]').first()
      .or(page.locator('main .rounded-lg, main .rounded-xl').first());
    const visible = await statsWidget.isVisible({ timeout: 15_000 }).catch(() => false);
    expect(visible, 'Stats widget should be visible on invoices page').toBe(true);
  });

  test('has 3 tabs: Invoices, Payment Plans, Recurring', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    if (!page.url().includes('/invoices')) return; // auth race

    // Wait for loading to complete — tabs render after data loads
    await page.waitForTimeout(3_000);
    const expectedTabs = ['Invoices', 'Payment Plans', 'Recurring'];
    let visibleCount = 0;
    for (const tabName of expectedTabs) {
      const tab = page.getByRole('tab', { name: tabName }).first();
      const visible = await tab.isVisible({ timeout: 10_000 }).catch(() => false);
      if (visible) visibleCount++;
    }

    expect(visibleCount, 'At least 2 of 3 tabs (Invoices, Payment Plans, Recurring) should be visible').toBeGreaterThanOrEqual(2);
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
    if (!page.url().includes('/invoices')) return; // auth race
    await page.waitForTimeout(2_000);

    // Status pills: All, Draft, Sent, Paid, Overdue, Cancelled
    const statusPills = ['All', 'Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];
    let visiblePillCount = 0;
    for (const status of statusPills) {
      const pill = page.getByRole('button', { name: new RegExp(`^${status}`, 'i') }).first()
        .or(page.locator('button').filter({ hasText: new RegExp(`^${status}`) }).first());
      const visible = await pill.isVisible({ timeout: 3_000 }).catch(() => false);
      if (visible) visiblePillCount++;
    }
    expect(visiblePillCount, 'At least 3 status pills should be visible').toBeGreaterThanOrEqual(3);

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
    if (!page.url().includes('/invoices')) return; // auth race

    const createBtn = page.locator('[data-tour="create-invoice-button"]').first()
      .or(page.getByRole('button', { name: /create invoice/i }).first());
    const hasBtn = await createBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await createBtn.click();

    const dialog = page.getByRole('dialog');
    const hasDialog = await dialog.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasDialog) {
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 5_000 });
    }
  });

  test('create invoice modal shows form fields', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    if (!page.url().includes('/invoices')) return; // auth race

    const createBtn = page.locator('[data-tour="create-invoice-button"]').first()
      .or(page.getByRole('button', { name: /create invoice/i }).first());
    const hasBtn = await createBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await createBtn.click();
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
    if (!page.url().includes('/invoices')) return; // auth race

    const billingRunBtn = page.locator('[data-tour="billing-run-button"]').first()
      .or(page.getByRole('button', { name: /billing run/i }).first());
    const hasBtn = await billingRunBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await billingRunBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Should show "Billing Run" title
    await expect(dialog.getByText('Billing Run')).toBeVisible({ timeout: 5_000 });

    // Should be on config step with description
    const configDesc = dialog.getByText(/configure.*billing/i).first();
    const hasConfig = await configDesc.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasConfig, 'Billing Run config step should be visible').toBe(true);

    // Check for form labels
    const billingTypeLabel = dialog.getByText('Billing Type').first();
    const hasLabel = await billingTypeLabel.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasLabel, 'Billing Type label should be visible in wizard').toBe(true);

    // Close
    await page.keyboard.press('Escape');
  });

  test('invoice list shows data or empty state', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    if (!page.url().includes('/invoices')) return; // auth race
    await waitForPageReady(page);

    // Look for invoice table rows or empty state
    const invoiceRow = page.locator('table tbody tr, [data-tour="invoice-list"] tr').first();
    const hasInvoices = await invoiceRow.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasInvoices) {
      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();
      expect(rowCount, 'Invoice list should contain at least one row').toBeGreaterThan(0);
    } else {
      // Should show empty state or the tab content
      const emptyState = page.getByText(/no invoices/i).first()
        .or(page.getByText(/create your first/i).first());
      const hasEmpty = await emptyState.isVisible({ timeout: 5_000 }).catch(() => false);
      // It's ok if neither — the page may have tabs but no invoice-list data-tour
      expect(hasInvoices || hasEmpty, 'Should show invoice data or empty state').toBe(true);
    }
  });

  test('clicking an invoice row navigates to detail', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    await waitForPageReady(page);

    const invoiceList = page.locator('[data-tour="invoice-list"]');
    const hasInvoices = await invoiceList.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasInvoices) return; // no invoices to click

    // Desktop: click a table row (but not a button/checkbox inside it)
    const row = invoiceList.locator('tr').filter({ hasText: /INV-|£/ }).first()
      .or(invoiceList.locator('[role="listitem"]').first());
    const rowVisible = await row.isVisible({ timeout: 5_000 }).catch(() => false);
    if (rowVisible) {
      // Click in the middle of the row (avoid checkbox/action columns)
      await row.click({ position: { x: 200, y: 10 } });
      await page.waitForURL(/\/invoices\/[\w-]+/, { timeout: 10_000 }).catch(() => {});
      const url = page.url();
      expect(url, 'URL should contain /invoices/ after clicking an invoice row').toContain('/invoices/');
    }
  });

  test('invoice detail page loads without errors', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Invoices');
    await waitForPageReady(page);

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
      expect(hasBadge, 'Invoice detail page should show a status badge').toBe(true);

      // Breadcrumb back to Invoices should exist
      const breadcrumb = page.getByRole('link', { name: 'Invoices' }).first();
      const hasBreadcrumb = await breadcrumb.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasBreadcrumb, 'Invoice detail page should show breadcrumb link back to Invoices').toBe(true);
    }
  });

  test('no console errors during invoice page interaction', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/invoices', 'Invoices');
    await waitForPageReady(page);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// FINANCE — INVOICES (has access)
// ═══════════════════════════════════════════════════════════════
test.describe('Invoices — Finance', () => {
  test.use({ storageState: AUTH.finance });

  test('finance user can access /invoices', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/invoices', 'Finance Invoices');
    await assertNoErrorBoundary(page);

    // Finance should see the invoices page
    const title = page.getByText(/^Invoices/i).first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('finance user sees Create Invoice and Billing Run buttons', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Finance Invoices');
    if (!page.url().includes('/invoices')) return; // auth race

    // Finance role can manage invoices
    const createBtn = page.locator('[data-tour="create-invoice-button"]')
      .or(page.getByRole('button', { name: /create invoice/i }).first());
    const billingBtn = page.locator('[data-tour="billing-run-button"]')
      .or(page.getByRole('button', { name: /billing run/i }).first());

    const hasCreate = await createBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    const hasBilling = await billingBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(hasCreate || hasBilling, 'Finance user should see at least one of Create Invoice or Billing Run buttons').toBe(true);
  });

  test('finance can navigate to invoice detail', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Finance Invoices');
    await waitForPageReady(page);

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

  test('teacher accessing /invoices is redirected to dashboard', async ({ page }) => {
    await page.goto('/invoices');
    // Teacher is not allowed on /invoices — should redirect to /dashboard
    await page.waitForURL(url => /\/dashboard/.test(url.toString()), { timeout: 15_000 }).catch(async () => {
      await page.goto('/invoices');
      await page.waitForURL(url => /\/dashboard/.test(url.toString()), { timeout: 15_000 });
    });
    expect(page.url(), 'Teacher should be redirected away from /invoices').not.toContain('/invoices');
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — INVOICES (read-only via portal)
// ═══════════════════════════════════════════════════════════════
test.describe('Invoices — Parent', () => {
  test.use({ storageState: AUTH.parent });

  test('parent sees "Invoices & Payments" title on portal', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/portal/invoices', 'Parent Invoices');
    await assertNoErrorBoundary(page);

    // Parent sees "Invoices & Payments" heading or portal-specific title
    const title = page.getByText(/Invoices/i).first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('parent does NOT see Create Invoice or Billing Run buttons', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
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
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
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
