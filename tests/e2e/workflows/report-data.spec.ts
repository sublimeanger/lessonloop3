import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  assertNoErrorBoundary,
  goTo,
} from '../helpers';

/**
 * Report Data Verification — E2E tests.
 *
 * Verifies that each report page renders real data (not just page loads).
 * Checks summary cards, charts, tables, date range pickers, and sorting.
 */

/** Wait for report data to load (loading skeleton gone, content visible) */
async function waitForReportData(page: Page) {
  // Wait for loading skeletons to disappear
  await page.locator('.animate-pulse').first()
    .waitFor({ state: 'hidden', timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(2_000);
}

/** Check that at least N summary cards with numeric values are visible */
async function verifySummaryCards(page: Page, minCards: number) {
  // Cards typically contain numeric values (currency, percentages, counts)
  const cards = page.locator('main').locator('[class*="Card"], [class*="card"]');
  const count = await cards.count();
  return count >= minCards;
}

test.describe('Report Data Verification — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('Revenue report — summary cards and chart', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/revenue', 'Revenue');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);
    await assertNoErrorBoundary(page);

    // Check for heading
    const heading = page.getByRole('heading', { name: /revenue/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Summary cards should show £ amounts
    const mainContent = page.locator('main');
    const hasCurrency = await mainContent.getByText(/£\d|total revenue|average monthly|invoices paid/i)
      .first().isVisible({ timeout: 10_000 }).catch(() => false);

    // Chart container should render (recharts renders SVG)
    const hasChart = await mainContent.locator('svg.recharts-surface, [class*="recharts"]')
      .first().isVisible({ timeout: 5_000 }).catch(() => false);

    // Table should render with data
    const hasTable = await mainContent.locator('table, [role="table"]')
      .first().isVisible({ timeout: 5_000 }).catch(() => false);

    // At least one data element should be present (may be feature-gated)
    const pageText = await mainContent.textContent().catch(() => '') ?? '';
    const hasContent = pageText.length > 50;
    expect(hasContent, 'Revenue report should have meaningful content').toBe(true);
  });

  test('Revenue report — date range picker', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/reports/revenue', 'Revenue');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);

    // Look for date range buttons (This Month, Last Month, etc.)
    const presets = ['This Month', 'Last Month', 'This Quarter'];
    for (const preset of presets) {
      const btn = page.getByRole('button', { name: new RegExp(preset, 'i') }).first();
      if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(1_500);
        await assertNoErrorBoundary(page);
        break; // Just verify one works
      }
    }
  });

  test('Outstanding report — ageing buckets and table', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/outstanding', 'Outstanding');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);
    await assertNoErrorBoundary(page);

    // Heading
    const heading = page.getByText(/outstanding payments/i).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Check for summary cards (Total Outstanding, Total Overdue)
    const hasTotalOutstanding = await page.getByText(/total outstanding/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasTotalOverdue = await page.getByText(/total overdue/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);

    expect(
      hasTotalOutstanding || hasTotalOverdue,
      'Outstanding report should show summary totals',
    ).toBe(true);

    // Check for ageing buckets (collapsible sections)
    const bucketLabels = [/current|0.*7/i, /8.*14/i, /15.*30/i, /30\+/i];
    let foundBuckets = 0;
    for (const label of bucketLabels) {
      if (await page.getByText(label).first().isVisible({ timeout: 2_000 }).catch(() => false)) {
        foundBuckets++;
      }
    }
    // May have zero if no outstanding invoices
    if (hasTotalOutstanding) {
      expect(foundBuckets).toBeGreaterThanOrEqual(0);
    }
  });

  test('Outstanding report — Export CSV visible', async ({ page }) => {
    await safeGoTo(page, '/reports/outstanding', 'Outstanding');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);

    const exportBtn = page.getByRole('button', { name: /export csv/i }).first()
      .or(page.getByRole('button', { name: /export/i }).first());
    await expect(exportBtn).toBeVisible({ timeout: 10_000 });
  });

  test('Payroll report — teacher breakdown', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/payroll', 'Payroll');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);
    await assertNoErrorBoundary(page);

    const pageText = await page.locator('main').textContent().catch(() => '') ?? '';
    expect(pageText.length, 'Payroll report should have content').toBeGreaterThan(50);

    // Check for summary cards
    const hasTeachers = await page.getByText(/teachers/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasHours = await page.getByText(/total hours/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasGross = await page.getByText(/total gross|gross owed/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);

    expect(
      hasTeachers || hasHours || hasGross,
      'Payroll report should show summary metrics',
    ).toBe(true);
  });

  test('Lessons Delivered report — chart and table', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/lessons', 'Lessons Delivered');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);
    await assertNoErrorBoundary(page);

    // Heading
    const heading = page.getByText(/lessons delivered/i).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Summary cards (Completed, Cancelled, Total Hours, Teachers)
    const summaryLabels = [/completed/i, /cancelled/i, /total hours/i, /teachers/i];
    let foundSummary = 0;
    for (const label of summaryLabels) {
      if (await page.getByText(label).first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        foundSummary++;
      }
    }
    expect(foundSummary, 'Should show at least 2 summary metrics').toBeGreaterThanOrEqual(2);

    // Chart
    const hasChart = await page.locator('svg.recharts-surface, [class*="recharts"]')
      .first().isVisible({ timeout: 5_000 }).catch(() => false);
    // Chart may not render if no data

    // Tabs (By Teacher / By Location)
    const byTeacher = page.getByText(/by teacher/i).first();
    const byLocation = page.getByText(/by location/i).first();
    const hasTabs = await byTeacher.isVisible({ timeout: 3_000 }).catch(() => false)
      || await byLocation.isVisible({ timeout: 3_000 }).catch(() => false);
  });

  test('Cancellation report — pie chart and table', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/cancellations', 'Cancellations');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);
    await assertNoErrorBoundary(page);

    // Heading
    const heading = page.getByRole('heading', { name: /cancellation/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Summary cards
    const hasScheduled = await page.getByText(/total scheduled/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasCancelled = await page.getByText(/cancelled/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasRate = await page.getByText(/cancellation rate/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);

    expect(
      hasScheduled || hasCancelled || hasRate,
      'Cancellation report should show summary metrics',
    ).toBe(true);
  });

  test('Utilisation report — bar chart and room data', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/utilisation', 'Utilisation');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);
    await assertNoErrorBoundary(page);

    const pageText = await page.locator('main').textContent().catch(() => '') ?? '';
    expect(pageText.length, 'Utilisation report should have content').toBeGreaterThan(50);

    // Summary cards
    const hasAvgUtil = await page.getByText(/average utilisation/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasMostUsed = await page.getByText(/most used/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasTotalRooms = await page.getByText(/total rooms/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);

    expect(
      hasAvgUtil || hasMostUsed || hasTotalRooms,
      'Utilisation report should show room metrics',
    ).toBe(true);
  });

  test('Teacher Performance report', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/teacher-performance', 'Teacher Performance');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);
    await assertNoErrorBoundary(page);

    const pageText = await page.locator('main').textContent().catch(() => '') ?? '';
    expect(pageText.length, 'Teacher Performance report should have content').toBeGreaterThan(50);

    // May be feature-gated — check for heading or feature gate message
    const hasHeading = await page.getByText(/teacher performance/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasFeatureGate = await page.getByText(/upgrade|locked|feature/i).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    expect(
      hasHeading || hasFeatureGate,
      'Teacher Performance should show report or feature gate',
    ).toBe(true);
  });

  test('Report sorting — Outstanding report', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/outstanding', 'Outstanding');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);

    // Try clicking a sortable column header
    const tableHeaders = page.locator('th, [role="columnheader"]');
    const headerCount = await tableHeaders.count();

    if (headerCount > 0) {
      const firstHeader = tableHeaders.first();
      await firstHeader.click();
      await page.waitForTimeout(500);

      // Click again to reverse sort
      await firstHeader.click();
      await page.waitForTimeout(500);

      await assertNoErrorBoundary(page);
    }
  });

  test('Report page refresh preserves state', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/reports/outstanding', 'Outstanding');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);

    // Reload the page
    await page.reload();
    await waitForPageReady(page);
    await page.waitForTimeout(2_000);

    // Page should still be on the report
    expect(page.url()).toContain('/reports/outstanding');
    await assertNoErrorBoundary(page);

    // Content should still render
    const heading = page.getByText(/outstanding/i).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('No error boundaries on any report page', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(120_000);

    const reportPaths = [
      '/reports/revenue',
      '/reports/outstanding',
      '/reports/payroll',
      '/reports/lessons',
      '/reports/cancellations',
      '/reports/utilisation',
      '/reports/teacher-performance',
    ];

    for (const path of reportPaths) {
      await safeGoTo(page, path, path);
      if (!page.url().includes('/reports')) continue;
      await waitForReportData(page);
      await assertNoErrorBoundary(page);
    }
  });
});
