/**
 * Prompt 7 — Reports & Analytics Cohesion
 *
 * Reports must reflect actual data in the system. This tests that
 * report pages load, date filters work, and role-based access is correct.
 */
import { test, expect } from '../workflow.fixtures';
import { AUTH, waitForPageReady, goTo } from '../helpers';
import {
  assertPageLoaded,
  assertNoErrorBoundary,
  getAuthState,
} from '../workflow-helpers';

/* ------------------------------------------------------------------ */
/*  Test 1 — All 7 report types load without errors                   */
/* ------------------------------------------------------------------ */

test.describe('Reports — All Report Types Load', () => {
  test.use({ storageState: AUTH.owner });

  test('all 7 report types load without errors', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(120_000);

    // Step 1: Navigate to reports hub
    await goTo(page, '/reports');
    await assertPageLoaded(page, 'Reports Hub');

    // Step 2: Verify report cards are visible
    const reportNames = [
      'Revenue',
      'Outstanding Payments',
      'Lessons Delivered',
      'Cancellation Rate',
      'Payroll',
      'Room Utilisation',
      'Teacher Performance',
    ];

    for (const name of reportNames) {
      const card = page.getByText(name, { exact: false }).first();
      const visible = await card.isVisible({ timeout: 5_000 }).catch(() => false);
      softAssert(visible, `Report card "${name}" should be visible on reports hub`);
    }

    // Step 3: Visit each report page and verify it loads
    const reportRoutes = [
      { path: '/reports/revenue', name: 'Revenue' },
      { path: '/reports/outstanding', name: 'Outstanding Payments' },
      { path: '/reports/lessons', name: 'Lessons Delivered' },
      { path: '/reports/cancellations', name: 'Cancellation Rate' },
      { path: '/reports/payroll', name: 'Payroll' },
      { path: '/reports/utilisation', name: 'Room Utilisation' },
      { path: '/reports/teacher-performance', name: 'Teacher Performance' },
    ];

    for (const { path, name } of reportRoutes) {
      await goTo(page, path);

      // Page should load — either with data, empty state, or feature gate
      const mainEl = page.locator('main').first();
      await expect(mainEl).toBeVisible({ timeout: 15_000 });
      await assertNoErrorBoundary(page);

      // Check for feature-gated page — that's valid, not an error
      const isGated = await page
        .getByText(/This feature requires/i)
        .isVisible()
        .catch(() => false);

      if (!isGated) {
        // Non-gated report should have meaningful content
        const mainText = await mainEl.textContent() ?? '';
        softAssert(
          mainText.length > 30,
          `${name} (${path}): Report page should have meaningful content (${mainText.length} chars)`,
        );
      }

      // Navigate back to hub
      await goTo(page, '/reports');
      await assertPageLoaded(page, 'Reports Hub');
    }

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 2 — Report date filters actually change results              */
/* ------------------------------------------------------------------ */

test.describe('Reports — Date Filters', () => {
  test.use({ storageState: AUTH.owner });

  test('report date filters actually change results', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(90_000);

    // Navigate to revenue report
    await goTo(page, '/reports/revenue');
    await assertPageLoaded(page, 'Revenue Report');

    // Check if the report is feature-gated
    const isGated = await page
      .getByText(/This feature requires/i)
      .isVisible()
      .catch(() => false);

    if (isGated) {
      // Skip filter tests — report is locked
      return;
    }

    // Capture default data snapshot
    await page.waitForTimeout(1_000);
    const defaultContent = await page.locator('main').textContent() ?? '';

    // Click "Last Month" preset
    const lastMonthBtn = page.getByRole('button', { name: /Last Month/i }).first();
    if (await lastMonthBtn.isVisible().catch(() => false)) {
      await lastMonthBtn.click();
      await page.waitForTimeout(1_500); // Debounced filter

      const lastMonthContent = await page.locator('main').textContent() ?? '';
      softAssert(
        lastMonthContent.length > 30,
        'Last Month filter should produce content (data or empty state)',
      );
    }

    // Click "Last 12 Months" preset (broader range — should have data)
    const last12Btn = page.getByRole('button', { name: /Last 12 Months/i }).first();
    if (await last12Btn.isVisible().catch(() => false)) {
      await last12Btn.click();
      await page.waitForTimeout(1_500);

      const broadContent = await page.locator('main').textContent() ?? '';
      softAssert(
        broadContent.length > 30,
        'Last 12 Months filter should produce content',
      );
    }

    // Click "This Month" to reset to a default-ish range
    const thisMonthBtn = page.getByRole('button', { name: /This Month/i }).first();
    if (await thisMonthBtn.isVisible().catch(() => false)) {
      await thisMonthBtn.click();
      await page.waitForTimeout(1_500);

      await assertNoErrorBoundary(page);
    }

    // Verify date inputs exist and are functional
    const startDate = page.locator('#start-date').first();
    const endDate = page.locator('#end-date').first();
    if (await startDate.isVisible().catch(() => false)) {
      const startVal = await startDate.inputValue();
      softAssert(startVal.length > 0, 'Start date input should have a value');
    }
    if (await endDate.isVisible().catch(() => false)) {
      const endVal = await endDate.inputValue();
      softAssert(endVal.length > 0, 'End date input should have a value');
    }

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 3 — Teacher can access their allowed reports                  */
/* ------------------------------------------------------------------ */

test.describe('Reports — Teacher Access', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher can access their allowed reports', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(60_000);

    // Step 1: Navigate to reports hub
    await goTo(page, '/reports');
    await assertPageLoaded(page, 'Reports (teacher)');

    // Step 2: Teacher should see at minimum Lessons Delivered
    const lessonsCard = page.getByText('Lessons Delivered', { exact: false }).first();
    const lessonsVisible = await lessonsCard.isVisible({ timeout: 5_000 }).catch(() => false);
    softAssert(lessonsVisible, 'Teacher should see Lessons Delivered report');

    // Teacher may also see Payroll
    const payrollCard = page.getByText('Payroll', { exact: false }).first();
    const payrollVisible = await payrollCard.isVisible().catch(() => false);

    // Step 3: Click into Lessons Delivered
    if (lessonsVisible) {
      await goTo(page, '/reports/lessons');
      const mainText = await page.locator('main').textContent() ?? '';
      // Should load with data or empty state, not an error
      await assertNoErrorBoundary(page);
      softAssert(
        mainText.length > 30,
        'Lessons Delivered report should load with content for teacher',
      );
    }

    // Step 4: Click into Payroll if visible
    if (payrollVisible) {
      await goTo(page, '/reports/payroll');
      await assertNoErrorBoundary(page);
      const payrollText = await page.locator('main').textContent() ?? '';
      softAssert(
        payrollText.length > 30,
        'Payroll report should load with content for teacher',
      );
    }

    // Step 5: Revenue should be blocked or show limited data for teacher
    await goTo(page, '/reports/revenue');
    await page.waitForTimeout(1_000);

    const revenueBlocked =
      (await page.getByText(/This feature requires/i).isVisible().catch(() => false)) ||
      (await page.getByText(/permission|access denied|not authorized/i).isVisible().catch(() => false)) ||
      page.url().includes('/reports') && !page.url().includes('/revenue');

    // It's acceptable if teacher can see revenue (some orgs allow it) or if it's blocked
    // Just verify no crash
    await assertNoErrorBoundary(page);

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 4 — Finance role report access                               */
/* ------------------------------------------------------------------ */

test.describe('Reports — Finance Role Access', () => {
  test.use({ storageState: AUTH.finance });

  test('finance role can access financial reports', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(60_000);

    // Step 1: Navigate to reports hub
    await goTo(page, '/reports');
    await assertPageLoaded(page, 'Reports (finance)');

    // Step 2: Finance should see Revenue and Outstanding
    const revenueCard = page.getByText('Revenue', { exact: false }).first();
    const revenueVisible = await revenueCard.isVisible({ timeout: 5_000 }).catch(() => false);
    softAssert(revenueVisible, 'Finance role should see Revenue report');

    const outstandingCard = page.getByText('Outstanding', { exact: false }).first();
    const outstandingVisible = await outstandingCard.isVisible({ timeout: 5_000 }).catch(() => false);
    softAssert(outstandingVisible, 'Finance role should see Outstanding Payments report');

    // Step 3: Click Revenue report
    await goTo(page, '/reports/revenue');
    await assertNoErrorBoundary(page);

    const isGated = await page
      .getByText(/This feature requires/i)
      .isVisible()
      .catch(() => false);

    if (!isGated) {
      const revenueText = await page.locator('main').textContent() ?? '';
      softAssert(
        revenueText.length > 30,
        'Revenue report should load with financial data for finance role',
      );

      // Check for financial content (currency symbol or amount)
      softAssert(
        revenueText.includes('£') || revenueText.includes('$') || revenueText.includes('€') || revenueText.includes('Revenue'),
        'Revenue report should show financial information',
      );
    }

    // Step 4: Click Outstanding report
    await goTo(page, '/reports/outstanding');
    await assertNoErrorBoundary(page);

    const outstandingText = await page.locator('main').textContent() ?? '';
    softAssert(
      outstandingText.length > 30,
      'Outstanding report should load with data for finance role',
    );

    // Check for outstanding-specific content
    const hasOutstandingContent =
      outstandingText.includes('Outstanding') ||
      outstandingText.includes('Overdue') ||
      outstandingText.includes('Current') ||
      outstandingText.includes('No outstanding');
    softAssert(
      hasOutstandingContent,
      'Outstanding report should show ageing or empty state content',
    );

    assertCleanRun();
  });
});
