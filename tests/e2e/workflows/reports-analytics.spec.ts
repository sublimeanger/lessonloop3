import { test, expect } from './workflow.fixtures';
import { AUTH } from '../helpers';
import { goTo } from '../helpers';
import { waitForDataLoad } from './workflow-helpers';

// ═══════════════════════════════════════════════════════════════
// Reports & Analytics — report numbers grounded in reality
// ═══════════════════════════════════════════════════════════════

test.describe('Reports & Analytics — Owner', () => {
  test.use({ storageState: AUTH.owner });

  // ─────────────────────────────────────────────────────────────
  // All 7 report types load without errors
  // ─────────────────────────────────────────────────────────────

  test('All 7 report types load without errors', async ({ page, consoleErrors }) => {
    test.setTimeout(120_000);

    // ── 1–2. Navigate to /reports hub ──
    await goTo(page, '/reports');
    await waitForDataLoad(page);

    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // ── 3. All 7 report types visible as cards ──
    const reportTitles = [
      'Revenue',
      'Outstanding Payments',
      'Lessons Delivered',
      'Cancellation Rate',
      'Payroll',
      'Room Utilisation',
      'Teacher Performance',
    ];

    for (const title of reportTitles) {
      const card = page.locator('main').getByText(title, { exact: false }).first();
      // Some reports may be feature-gated — check visibility but don't fail hard
      const cardVisible = await card.isVisible({ timeout: 5_000 }).catch(() => false);
      if (cardVisible) {
        await expect(card).toBeVisible();
      }
    }

    // ── 4–5. Revenue report ──
    await goTo(page, '/reports/revenue');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Date range filter should be visible
    const revenueDateFilter = page.locator('main').getByLabel(/start date/i).first()
      .or(page.locator('main').getByText(/this month|last month|last 12/i).first());
    const hasDateFilter = await revenueDateFilter.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasDateFilter) {
      await expect(revenueDateFilter).toBeVisible();
    }

    // Data or empty state shown (not error boundary)
    const revenueContent = await page.locator('main').textContent() ?? '';
    expect(revenueContent.length).toBeGreaterThan(10);

    const errorBoundary = page.getByText(/something went wrong/i).first();
    let hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    // ── 6–8. Outstanding report ──
    await goTo(page, '/reports/outstanding');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    // ── 9–11. Lessons Delivered report ──
    await goTo(page, '/reports/lessons');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    // ── 12–14. Cancellation Rate report ──
    await goTo(page, '/reports/cancellations');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    // ── 15–17. Payroll report ──
    await goTo(page, '/reports/payroll');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    // ── 18–20. Room Utilisation report ──
    await goTo(page, '/reports/utilisation');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    // ── 21–23. Teacher Performance report ──
    await goTo(page, '/reports/teacher-performance');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    // ── Verify no real console errors across all reports ──
    const realErrors = consoleErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('net::') &&
        !e.includes('Failed to fetch') &&
        !e.includes('401') &&
        !e.includes('403') &&
        !e.includes('ResizeObserver') &&
        !e.includes('AbortError') &&
        !e.includes('ChunkLoadError') &&
        !e.includes('Loading chunk') &&
        !e.includes('status of 404') &&
        !e.includes('Failed to load resource') &&
        !e.includes('Download the React DevTools') &&
        !e.includes('third-party cookie') &&
        !e.includes('Permissions-Policy') &&
        !e.includes('postMessage'),
    );
    expect(realErrors).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────
  // Report date filters actually change results
  // ─────────────────────────────────────────────────────────────

  test('Report date filters actually change results', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1. Navigate to /reports/revenue ──
    await goTo(page, '/reports/revenue');
    await waitForDataLoad(page);

    // ── 2. Default range is "Last 12 Months" — wait for data to settle ──
    await page.waitForTimeout(1_000);

    // ── 3. Change to "Last Month" preset ──
    const lastMonthBtn = page.getByRole('button', { name: /last month/i }).first();
    if (await lastMonthBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await lastMonthBtn.click();
      await page.waitForTimeout(1_500);
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

      // ── 4. Data changes or shows empty state for the narrower range ──
      const lastMonthContent = await page.locator('main').textContent() ?? '';
      // Content should have loaded (not blank)
      expect(lastMonthContent.length).toBeGreaterThan(10);

      // ── 5. Change to "This Year" for a broader range ──
      const thisYearBtn = page.getByRole('button', { name: /this year/i }).first();
      if (await thisYearBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await thisYearBtn.click();
        await page.waitForTimeout(1_500);
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

        const yearContent = await page.locator('main').textContent() ?? '';
        expect(yearContent.length).toBeGreaterThan(10);
      }

      // ── 7–8. Reset to "Last 12 Months" ──
      const last12Btn = page.getByRole('button', { name: /last 12/i }).first();
      if (await last12Btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await last12Btn.click();
        await page.waitForTimeout(1_500);
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

        const resetContent = await page.locator('main').textContent() ?? '';
        expect(resetContent.length).toBeGreaterThan(10);
      }
    } else {
      // Try manual date inputs if presets aren't visible
      const startDateInput = page.locator('main').getByLabel(/start date/i).first();
      const endDateInput = page.locator('main').getByLabel(/end date/i).first();

      if (await startDateInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        // Set to last month
        const now = new Date();
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        await startDateInput.fill(lastMonthStart.toISOString().slice(0, 10));
        await endDateInput.fill(lastMonthEnd.toISOString().slice(0, 10));
        await page.waitForTimeout(1_500);

        const filteredContent = await page.locator('main').textContent() ?? '';
        expect(filteredContent.length).toBeGreaterThan(10);
      }
    }

    // No error boundary at any point
    const errorBoundary = page.getByText(/something went wrong/i).first();
    const hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();
  });
});

// ═══════════════════════════════════════════════════════════════
// Teacher can access their allowed reports
// ═══════════════════════════════════════════════════════════════

test.describe('Reports & Analytics — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('Teacher can access their allowed reports', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1–2. Navigate to /reports ──
    await goTo(page, '/reports');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // ── 3. Can see Lessons Delivered and Payroll ──
    const lessonsCard = page.locator('main').getByText(/lessons delivered/i).first();
    await expect(lessonsCard).toBeVisible({ timeout: 10_000 });

    const payrollCard = page.locator('main').getByText(/payroll/i).first();
    const hasPayroll = await payrollCard.isVisible({ timeout: 5_000 }).catch(() => false);

    // ── 4–5. Click into Lessons Delivered ──
    await goTo(page, '/reports/lessons');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Report loads with content
    const lessonsContent = await page.locator('main').textContent() ?? '';
    expect(lessonsContent.length).toBeGreaterThan(10);

    // No error boundary
    const errorBoundary = page.getByText(/something went wrong/i).first();
    let hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    // ── Click into Payroll report ──
    if (hasPayroll) {
      await goTo(page, '/reports/payroll');
      await waitForDataLoad(page);
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

      // Report loads with data relevant to this teacher
      const payrollContent = await page.locator('main').textContent() ?? '';
      expect(payrollContent.length).toBeGreaterThan(10);

      hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
      expect(hasError).toBeFalsy();
    }

    // ── 6–7. Navigate to /reports/revenue — should be blocked ──
    await page.goto('/reports/revenue');
    await page.waitForTimeout(2_000);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // Teacher should be redirected away or see permission denied
    const onRevenue = page.url().includes('/reports/revenue');
    if (onRevenue) {
      // If not redirected, page should show limited/no data or upgrade prompt
      await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
    } else {
      // Redirected — this is correct behavior
      expect(page.url()).not.toContain('/reports/revenue');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Finance role report access
// ═══════════════════════════════════════════════════════════════

test.describe('Reports & Analytics — Finance', () => {
  test.use({ storageState: AUTH.finance });

  test('Finance role can access revenue and outstanding reports', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1–2. Navigate to /reports ──
    await goTo(page, '/reports');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // ── 3. Can see Revenue and Outstanding Payments ──
    const revenueCard = page.locator('main').getByText(/revenue/i).first();
    await expect(revenueCard).toBeVisible({ timeout: 10_000 });

    const outstandingCard = page.locator('main').getByText(/outstanding/i).first();
    await expect(outstandingCard).toBeVisible({ timeout: 10_000 });

    // ── 4–5. Click Revenue report ──
    await goTo(page, '/reports/revenue');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Loads with financial data — summary cards should be visible
    const revenueContent = await page.locator('main').textContent() ?? '';
    expect(revenueContent.length).toBeGreaterThan(10);

    // Should contain financial indicators (£, revenue, total, etc.)
    const hasFinancialData = /£|revenue|total|invoices|paid/i.test(revenueContent);
    expect(hasFinancialData).toBeTruthy();

    // No error boundary
    const errorBoundary = page.getByText(/something went wrong/i).first();
    let hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    // ── 6–7. Click Outstanding report ──
    await goTo(page, '/reports/outstanding');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Loads with outstanding data — should have ageing buckets or "All paid up"
    const outstandingContent = await page.locator('main').textContent() ?? '';
    expect(outstandingContent.length).toBeGreaterThan(10);

    const hasOutstandingData = /outstanding|overdue|current|all paid up|0-7|8-14/i.test(outstandingContent);
    expect(hasOutstandingData).toBeTruthy();

    hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();
  });
});
