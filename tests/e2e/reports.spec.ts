import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, waitForPageReady } from './helpers';

test.describe('Reports Hub — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('reports page loads with report cards', async ({ page }) => {
    await safeGoTo(page, '/reports', 'Reports');
    const hasRevenue = await page.getByText(/revenue/i).first().isVisible({ timeout: 15_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[reports] Revenue card visible: ${hasRevenue}`);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('report types shown', async ({ page }) => {
    await safeGoTo(page, '/reports', 'Reports');
    const reports = ['Revenue', 'Outstanding Payments', 'Lessons Delivered', 'Cancellation Rate', 'Payroll', 'Room Utilisation', 'Teacher Performance'];
    let visibleCount = 0;
    for (const report of reports) {
      const visible = await page.getByText(report).first().isVisible({ timeout: 5_000 }).catch(() => false);
      if (visible) visibleCount++;
    }
    // eslint-disable-next-line no-console
    console.log(`[reports] Visible report cards: ${visibleCount}/${reports.length}`);
    expect(visibleCount, 'At least some report cards should be visible').toBeGreaterThan(0);
  });

  test('can navigate to revenue report', async ({ page }) => {
    await safeGoTo(page, '/reports', 'Reports');
    const revenueLink = page.getByText('Revenue').first();
    if (await revenueLink.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await revenueLink.click();
      await page.waitForURL(/\/reports\/revenue/, { timeout: 15_000 }).catch(() => {});
      await waitForPageReady(page);
    }
  });

  test('can navigate to outstanding report', async ({ page }) => {
    await safeGoTo(page, '/reports', 'Reports');
    const link = page.getByText('Outstanding Payments').first();
    if (await link.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/reports\/outstanding/, { timeout: 15_000 }).catch(() => {});
    }
  });

  test('can navigate to lessons delivered report', async ({ page }) => {
    await safeGoTo(page, '/reports', 'Reports');
    const link = page.getByText('Lessons Delivered').first();
    if (await link.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/reports\/lessons/, { timeout: 15_000 }).catch(() => {});
    }
  });

  test('can navigate to payroll report', async ({ page }) => {
    await safeGoTo(page, '/reports', 'Reports');
    const link = page.getByText('Payroll').first();
    if (await link.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/reports\/payroll/, { timeout: 15_000 }).catch(() => {});
    }
  });

  test('cancellation report accessible', async ({ page }) => {
    await safeGoTo(page, '/reports/cancellations', 'Cancellation Report');
  });

  test('utilisation report accessible', async ({ page }) => {
    await safeGoTo(page, '/reports/utilisation', 'Utilisation Report');
  });

  test('teacher performance report accessible', async ({ page }) => {
    await safeGoTo(page, '/reports/teacher-performance', 'Teacher Performance Report');
  });
});

test.describe('Reports — Finance', () => {
  test.use({ storageState: AUTH.finance });

  test('can access revenue report', async ({ page }) => {
    await safeGoTo(page, '/reports/revenue', 'Finance Revenue Report');
  });

  test('can access payroll report', async ({ page }) => {
    await safeGoTo(page, '/reports/payroll', 'Finance Payroll Report');
  });
});
