import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Reports Hub — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('reports page loads with report cards', async ({ page }) => {
    await goTo(page, '/reports');
    await expect(page.getByText(/revenue/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('all 7 report types shown', async ({ page }) => {
    await goTo(page, '/reports');
    const reports = ['Revenue', 'Outstanding Payments', 'Lessons Delivered', 'Cancellation Rate', 'Payroll', 'Room Utilisation', 'Teacher Performance'];
    for (const report of reports) {
      await expect(page.getByText(report).first()).toBeVisible();
    }
  });

  test('can navigate to revenue report', async ({ page }) => {
    await goTo(page, '/reports');
    await page.getByText('Revenue').first().click();
    await expect(page).toHaveURL(/\/reports\/revenue/, { timeout: 5_000 });
    await waitForPageReady(page);
  });

  test('can navigate to outstanding report', async ({ page }) => {
    await goTo(page, '/reports');
    await page.getByText('Outstanding Payments').first().click();
    await expect(page).toHaveURL(/\/reports\/outstanding/, { timeout: 5_000 });
  });

  test('can navigate to lessons delivered report', async ({ page }) => {
    await goTo(page, '/reports');
    await page.getByText('Lessons Delivered').first().click();
    await expect(page).toHaveURL(/\/reports\/lessons/, { timeout: 5_000 });
  });

  test('can navigate to payroll report', async ({ page }) => {
    await goTo(page, '/reports');
    await page.getByText('Payroll').first().click();
    await expect(page).toHaveURL(/\/reports\/payroll/, { timeout: 5_000 });
  });

  test('cancellation report accessible', async ({ page }) => {
    await goTo(page, '/reports/cancellations');
    await waitForPageReady(page);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('utilisation report accessible', async ({ page }) => {
    await goTo(page, '/reports/utilisation');
    await waitForPageReady(page);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('teacher performance report accessible', async ({ page }) => {
    await goTo(page, '/reports/teacher-performance');
    await waitForPageReady(page);
    await expect(page.locator('main').first()).toBeVisible();
  });
});

test.describe('Reports — Finance', () => {
  test.use({ storageState: AUTH.finance });

  test('can access revenue report', async ({ page }) => {
    await goTo(page, '/reports/revenue');
    await waitForPageReady(page);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('can access payroll report', async ({ page }) => {
    await goTo(page, '/reports/payroll');
    await waitForPageReady(page);
    await expect(page.locator('main').first()).toBeVisible();
  });
});
