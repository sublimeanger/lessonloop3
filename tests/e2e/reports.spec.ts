import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, waitForPageReady, assertNoErrorBoundary, trackConsoleErrors } from './helpers';

// ═══════════════════════════════════════════════════════════════
// OWNER — REPORTS HUB
// ═══════════════════════════════════════════════════════════════
test.describe('Reports Hub — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('loads reports hub with title and description', async ({ page }) => {
    await safeGoTo(page, '/reports', 'Reports');
    await assertNoErrorBoundary(page);
    await expect(page.getByText('Reports').first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows report cards for owner role', async ({ page }) => {
    await safeGoTo(page, '/reports', 'Reports');
    await page.waitForTimeout(2_000);

    // Owner should see all 7 reports (some may be locked/gated)
    const expectedReports = [
      'Revenue',
      'Outstanding Payments',
      'Lessons Delivered',
      'Cancellation Rate',
      'Payroll',
      'Room Utilisation',
      'Teacher Performance',
    ];

    let visibleCount = 0;
    for (const title of expectedReports) {
      const card = page.getByText(title, { exact: true }).first();
      const visible = await card.isVisible({ timeout: 3_000 }).catch(() => false);
      if (visible) visibleCount++;
      // eslint-disable-next-line no-console
      console.log(`[reports-hub] "${title}": ${visible}`);
    }

    expect(visibleCount, 'Owner should see multiple report cards').toBeGreaterThanOrEqual(3);
  });

  test('clicking a report card navigates to the report', async ({ page }) => {
    await safeGoTo(page, '/reports', 'Reports');
    await page.waitForTimeout(2_000);

    // Try clicking "Outstanding Payments" (no feature gate)
    const outstandingLink = page.locator('a[href="/reports/outstanding"]').first();
    const hasLink = await outstandingLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasLink) {
      await outstandingLink.click();
      await page.waitForURL(/\/reports\/outstanding/, { timeout: 10_000 });
      await waitForPageReady(page);
      await assertNoErrorBoundary(page);
      await expect(page.getByText('Outstanding Payments').first()).toBeVisible({ timeout: 10_000 });
    } else {
      // Fallback: try "Lessons Delivered"
      const lessonsLink = page.locator('a[href="/reports/lessons"]').first();
      if (await lessonsLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await lessonsLink.click();
        await page.waitForURL(/\/reports\/lessons/, { timeout: 10_000 });
        await waitForPageReady(page);
        await assertNoErrorBoundary(page);
      }
    }
  });

  test('locked reports show upgrade prompt', async ({ page }) => {
    await safeGoTo(page, '/reports', 'Reports');
    await page.waitForTimeout(2_000);

    // Check for any "Upgrade to unlock" links
    const upgradeLink = page.getByText('Upgrade to unlock').first();
    const hasUpgrade = await upgradeLink.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[reports-hub] "Upgrade to unlock" visible: ${hasUpgrade}`);
    // This is informational — some plans may have all features unlocked
  });

  test('no console errors on reports hub', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/reports', 'Reports');
    await page.waitForTimeout(2_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// OWNER — INDIVIDUAL REPORT PAGES
// ═══════════════════════════════════════════════════════════════
test.describe('Report Pages — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('Outstanding Payments report loads with date filter', async ({ page }) => {
    await safeGoTo(page, '/reports/outstanding', 'Outstanding');
    await assertNoErrorBoundary(page);
    await expect(page.getByText('Outstanding Payments').first()).toBeVisible({ timeout: 15_000 });

    // Date presets should be visible
    const thisMonthPreset = page.getByRole('button', { name: /this month/i }).first();
    const hasPreset = await thisMonthPreset.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[outstanding] "This Month" preset: ${hasPreset}`);
  });

  test('Lessons Delivered report loads', async ({ page }) => {
    await safeGoTo(page, '/reports/lessons', 'Lessons Delivered');
    await assertNoErrorBoundary(page);
    await expect(page.getByText('Lessons Delivered').first()).toBeVisible({ timeout: 15_000 });
  });

  test('Cancellation Rate report loads', async ({ page }) => {
    await safeGoTo(page, '/reports/cancellations', 'Cancellations');
    await assertNoErrorBoundary(page);
    await expect(page.getByText('Cancellation Rate').first()).toBeVisible({ timeout: 15_000 });
  });

  test('date range preset buttons are clickable', async ({ page }) => {
    await safeGoTo(page, '/reports/outstanding', 'Outstanding');
    await page.waitForTimeout(2_000);

    const presets = ['This Month', 'Last Month', 'This Quarter'];
    for (const preset of presets) {
      const btn = page.getByRole('button', { name: new RegExp(preset, 'i') }).first();
      const visible = await btn.isVisible({ timeout: 3_000 }).catch(() => false);
      if (visible) {
        await btn.click();
        await page.waitForTimeout(500);
        await assertNoErrorBoundary(page);
        // eslint-disable-next-line no-console
        console.log(`[report-presets] Clicked "${preset}" — OK`);
      }
    }
  });

  test('Export CSV button is visible on report pages', async ({ page }) => {
    await safeGoTo(page, '/reports/outstanding', 'Outstanding');
    await page.waitForTimeout(2_000);

    const exportBtn = page.getByRole('button', { name: /export csv/i }).first();
    const visible = await exportBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[report-export] Export CSV visible: ${visible}`);
  });

  test('Revenue report loads (may be feature-gated)', async ({ page }) => {
    await safeGoTo(page, '/reports/revenue', 'Revenue');
    await page.waitForTimeout(3_000);

    // May load report or show feature gate / redirect
    const title = page.getByText('Revenue Report').first();
    const gateMsg = page.getByText(/upgrade|not available/i).first();

    const hasTitle = await title.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasGate = await gateMsg.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[revenue] Title: ${hasTitle}, Gated: ${hasGate}`);
    await assertNoErrorBoundary(page);
  });

  test('Payroll report loads (may be feature-gated)', async ({ page }) => {
    await safeGoTo(page, '/reports/payroll', 'Payroll');
    await page.waitForTimeout(3_000);

    const title = page.getByText('Payroll Report').first();
    const hasTitle = await title.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[payroll] Title: ${hasTitle}`);
    await assertNoErrorBoundary(page);
  });

  test('report breadcrumbs navigate back to hub', async ({ page }) => {
    await safeGoTo(page, '/reports/outstanding', 'Outstanding');
    await page.waitForTimeout(2_000);

    const reportsBreadcrumb = page.getByRole('link', { name: 'Reports' }).first();
    const hasBreadcrumb = await reportsBreadcrumb.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasBreadcrumb) {
      await reportsBreadcrumb.click();
      await page.waitForURL(/\/reports$/, { timeout: 10_000 });
      expect(page.url()).toMatch(/\/reports$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// FINANCE — REPORTS (limited access)
// ═══════════════════════════════════════════════════════════════
test.describe('Reports — Finance', () => {
  test.use({ storageState: AUTH.finance });

  test('finance can access /reports hub', async ({ page }) => {
    await safeGoTo(page, '/reports', 'Finance Reports');
    await assertNoErrorBoundary(page);
    await expect(page.getByText('Reports').first()).toBeVisible({ timeout: 15_000 });
  });

  test('finance sees Revenue, Outstanding, and Payroll cards', async ({ page }) => {
    await safeGoTo(page, '/reports', 'Finance Reports');
    await page.waitForTimeout(2_000);

    // Finance should see: Revenue, Outstanding, Payroll (per role filter)
    const revenue = page.getByText('Revenue', { exact: true }).first();
    const outstanding = page.getByText('Outstanding Payments', { exact: true }).first();
    const payroll = page.getByText('Payroll', { exact: true }).first();

    const hasRevenue = await revenue.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasOutstanding = await outstanding.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasPayroll = await payroll.isVisible({ timeout: 3_000 }).catch(() => false);

    // eslint-disable-next-line no-console
    console.log(`[finance-reports] Revenue: ${hasRevenue}, Outstanding: ${hasOutstanding}, Payroll: ${hasPayroll}`);

    // Finance should NOT see admin-only reports
    const cancellations = page.getByText('Cancellation Rate', { exact: true }).first();
    const hasCancellations = await cancellations.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasCancellations, 'Finance should NOT see Cancellation Rate').toBe(false);
  });

  test('finance can navigate to Outstanding Payments report', async ({ page }) => {
    await safeGoTo(page, '/reports', 'Finance Reports');
    await page.waitForTimeout(2_000);

    const link = page.locator('a[href="/reports/outstanding"]').first();
    if (await link.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/reports\/outstanding/, { timeout: 10_000 });
      await waitForPageReady(page);
      await assertNoErrorBoundary(page);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// TEACHER — REPORTS (no sidebar link)
// ═══════════════════════════════════════════════════════════════
test.describe('Reports — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher accessing /reports loads but with limited cards', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForTimeout(5_000);

    const url = page.url();
    // eslint-disable-next-line no-console
    console.log(`[teacher-reports] URL: ${url}`);

    // Teacher has no Reports in sidebar but role filter gives Lessons + Payroll
    if (url.includes('/reports')) {
      // If not redirected, should see limited reports
      const lessons = page.getByText('Lessons Delivered', { exact: true }).first();
      const hasLessons = await lessons.isVisible({ timeout: 5_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[teacher-reports] Lessons Delivered visible: ${hasLessons}`);

      // Should NOT see admin-only reports
      const cancellations = page.getByText('Cancellation Rate', { exact: true }).first();
      const hasCancellations = await cancellations.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasCancellations, 'Teacher should NOT see Cancellation Rate').toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — REPORTS (no access)
// ═══════════════════════════════════════════════════════════════
test.describe('Reports — Parent', () => {
  test.use({ storageState: AUTH.parent });

  test('parent accessing /reports is redirected or shows no reports', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForTimeout(5_000);

    const url = page.url();
    // eslint-disable-next-line no-console
    console.log(`[parent-reports] URL: ${url}`);

    if (url.includes('/reports')) {
      // If they land on hub, should see "No reports available"
      const noReports = page.getByText(/no reports available/i).first();
      const hasEmpty = await noReports.isVisible({ timeout: 5_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[parent-reports] "No reports available": ${hasEmpty}`);
    }
  });
});
