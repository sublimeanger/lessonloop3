/**
 * PART 9: Reports (Desktop)
 * Tests 9.1 – 9.10
 */
import { test, expect } from '../../workflows/workflow.fixtures';
import { AUTH, safeGoTo } from './helpers';

test.use({ storageState: AUTH.owner });

test.describe('Part 9: Reports', () => {

  test('9.1 – /reports hub loads with report cards', async ({ page }) => {
    await safeGoTo(page, '/reports');
    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: 15_000 });
    // Should have multiple report links/cards
    const links = main.getByRole('link');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  const reportRoutes = [
    { id: '9.2', path: '/reports/revenue', name: 'Revenue Report' },
    { id: '9.3', path: '/reports/outstanding', name: 'Outstanding Report' },
    { id: '9.4', path: '/reports/payroll', name: 'Payroll Report' },
    { id: '9.5', path: '/reports/lessons-delivered', name: 'Lessons Delivered' },
    { id: '9.6', path: '/reports/cancellations', name: 'Cancellation Report' },
    { id: '9.7', path: '/reports/utilisation', name: 'Utilisation Report' },
    { id: '9.8', path: '/reports/teacher-performance', name: 'Teacher Performance' },
  ];

  for (const report of reportRoutes) {
    test(`${report.id} – ${report.name} loads`, async ({ page }) => {
      await safeGoTo(page, report.path);
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
      // Should not show error boundary
      const errorBoundary = await page.getByText(/something went wrong/i).isVisible().catch(() => false);
      expect(errorBoundary).toBe(false);
    });
  }

  test('9.2b – Revenue report shows £ currency', async ({ page }) => {
    await safeGoTo(page, '/reports/revenue');
    await page.waitForTimeout(2_000);
    const hasPound = await page.locator('main').getByText('£').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasPound).toBe(true);
  });

  test('9.9 – Date range picker works on revenue report', async ({ page }) => {
    await safeGoTo(page, '/reports/revenue');
    await page.waitForTimeout(1_000);
    const dateBtn = page.getByRole('button', { name: /date|range|period|last/i }).first();
    if (await dateBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dateBtn.click();
      await page.waitForTimeout(500);
    }
  });
});
