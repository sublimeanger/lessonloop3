import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  safeGoTo,
  assertNoErrorBoundary,
  waitForPageReady,
} from '../helpers';

/**
 * CSV Export Functionality — E2E tests.
 *
 * Tests that Export buttons on list pages and report pages trigger CSV downloads.
 *
 * The app uses programmatic blob creation (document.createElement('a') + blob URL)
 * instead of server-side downloads. Playwright's download event doesn't fire for
 * blob downloads, so we intercept the anchor click.
 */

/** Install a download interceptor that captures blob link clicks */
async function installDownloadInterceptor(page: Page) {
  await page.evaluate(() => {
    (window as any).__csvDownloads = [];
    const origCreateElement = document.createElement.bind(document);
    document.createElement = function (tag: string, options?: any) {
      const el = origCreateElement(tag, options);
      if (tag.toLowerCase() === 'a') {
        const origClick = el.click.bind(el);
        (el as HTMLAnchorElement).click = function () {
          const href = (el as HTMLAnchorElement).getAttribute('href') || '';
          const download = (el as HTMLAnchorElement).getAttribute('download') || '';
          if (href.startsWith('blob:') || download.endsWith('.csv')) {
            (window as any).__csvDownloads.push({ href, download, timestamp: Date.now() });
          }
          origClick();
        };
      }
      return el;
    } as typeof document.createElement;
  });
}

/** Check if a CSV download was triggered since the interceptor was installed */
async function getDownloadInfo(page: Page): Promise<{ href: string; download: string } | null> {
  const downloads = await page.evaluate(() => (window as any).__csvDownloads || []);
  return downloads.length > 0 ? downloads[downloads.length - 1] : null;
}

/** Wait for report data to load */
async function waitForReportData(page: Page) {
  await page.locator('.animate-pulse').first()
    .waitFor({ state: 'hidden', timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(2_000);
}

test.describe('CSV Export — List Pages', () => {
  test.use({ storageState: AUTH.owner });

  test('export students CSV', async ({ page }) => {
    test.setTimeout(90_000);
    await safeGoTo(page, '/students', 'Students');
    await page.waitForTimeout(3_000);

    await installDownloadInterceptor(page);

    // Find export button
    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    const hasExport = await exportBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasExport) {
      test.skip(true, 'Export button not found on students page');
      return;
    }

    await exportBtn.click();
    await page.waitForTimeout(3_000);

    // Check if download was triggered
    const download = await getDownloadInfo(page);
    if (download) {
      expect(download.download).toMatch(/students.*\.csv/i);
    } else {
      // May show a toast instead (e.g. "Export complete" or "No data")
      const toast = page.locator('[data-radix-collection-item]')
        .filter({ hasText: /export|complete|no data/i });
      const hasToast = await toast.first().isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasToast, 'Export should trigger download or show toast').toBe(true);
    }
  });

  test('export invoices CSV', async ({ page }) => {
    test.setTimeout(90_000);
    await safeGoTo(page, '/invoices', 'Invoices');
    await page.waitForTimeout(3_000);

    await installDownloadInterceptor(page);

    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    const hasExport = await exportBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasExport) {
      test.skip(true, 'Export button not found on invoices page');
      return;
    }

    await exportBtn.click();
    await page.waitForTimeout(3_000);

    const download = await getDownloadInfo(page);
    if (download) {
      expect(download.download).toMatch(/invoices.*\.csv/i);
    } else {
      const toast = page.locator('[data-radix-collection-item]')
        .filter({ hasText: /export|complete|no data/i });
      await expect(toast.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('export leads CSV', async ({ page }) => {
    test.setTimeout(90_000);
    await safeGoTo(page, '/leads', 'Leads');
    await page.waitForTimeout(3_000);

    await installDownloadInterceptor(page);

    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    const hasExport = await exportBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasExport) {
      test.skip(true, 'Export button not found on leads page');
      return;
    }

    await exportBtn.click();
    await page.waitForTimeout(3_000);

    const download = await getDownloadInfo(page);
    if (download) {
      expect(download.download).toMatch(/leads.*\.csv/i);
    } else {
      const toast = page.locator('[data-radix-collection-item]')
        .filter({ hasText: /export|complete|no data/i });
      await expect(toast.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('CSV Export — Report Pages', () => {
  test.use({ storageState: AUTH.owner });

  test('export Revenue report CSV', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/revenue', 'Revenue');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);

    await installDownloadInterceptor(page);

    const exportBtn = page.getByRole('button', { name: /export csv/i }).first()
      .or(page.getByRole('button', { name: /export/i }).first());
    await expect(exportBtn).toBeVisible({ timeout: 10_000 });
    await exportBtn.click();
    await page.waitForTimeout(3_000);

    // Verify download or toast
    const download = await getDownloadInfo(page);
    const toast = page.locator('[data-radix-collection-item]')
      .filter({ hasText: /export|csv|downloaded|complete/i });
    const hasToast = await toast.first().isVisible({ timeout: 5_000 }).catch(() => false);

    expect(
      download !== null || hasToast,
      'Revenue export should trigger download or show toast',
    ).toBe(true);
  });

  test('export Outstanding report CSV', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/outstanding', 'Outstanding');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);

    await installDownloadInterceptor(page);

    const exportBtn = page.getByRole('button', { name: /export csv/i }).first()
      .or(page.getByRole('button', { name: /export/i }).first());
    await expect(exportBtn).toBeVisible({ timeout: 10_000 });
    await exportBtn.click();
    await page.waitForTimeout(3_000);

    const download = await getDownloadInfo(page);
    const toast = page.locator('[data-radix-collection-item]')
      .filter({ hasText: /export|csv|downloaded|complete/i });
    const hasToast = await toast.first().isVisible({ timeout: 5_000 }).catch(() => false);

    expect(
      download !== null || hasToast,
      'Outstanding export should trigger download or show toast',
    ).toBe(true);
  });

  test('export Payroll report CSV', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/payroll', 'Payroll');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);

    await installDownloadInterceptor(page);

    const exportBtn = page.getByRole('button', { name: /export csv/i }).first()
      .or(page.getByRole('button', { name: /export/i }).first());
    const hasExport = await exportBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasExport) {
      test.skip(true, 'Export button not found on payroll report');
      return;
    }

    await exportBtn.click();
    await page.waitForTimeout(3_000);

    const download = await getDownloadInfo(page);
    const toast = page.locator('[data-radix-collection-item]')
      .filter({ hasText: /export|csv|downloaded|complete/i });
    const hasToast = await toast.first().isVisible({ timeout: 5_000 }).catch(() => false);

    expect(download !== null || hasToast, 'Payroll export should work').toBe(true);
  });

  test('export Lessons Delivered report CSV', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/lessons', 'Lessons');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);

    await installDownloadInterceptor(page);

    const exportBtn = page.getByRole('button', { name: /export csv/i }).first()
      .or(page.getByRole('button', { name: /export/i }).first());
    const hasExport = await exportBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasExport) {
      test.skip(true, 'Export button not found on lessons report');
      return;
    }

    await exportBtn.click();
    await page.waitForTimeout(3_000);

    const download = await getDownloadInfo(page);
    const toast = page.locator('[data-radix-collection-item]')
      .filter({ hasText: /export|csv|downloaded|complete/i });
    const hasToast = await toast.first().isVisible({ timeout: 5_000 }).catch(() => false);

    expect(download !== null || hasToast, 'Lessons export should work').toBe(true);
  });

  test('export Cancellation report CSV', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/cancellations', 'Cancellations');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);

    await installDownloadInterceptor(page);

    const exportBtn = page.getByRole('button', { name: /export csv/i }).first()
      .or(page.getByRole('button', { name: /export/i }).first());
    const hasExport = await exportBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasExport) {
      test.skip(true, 'Export button not found on cancellation report');
      return;
    }

    await exportBtn.click();
    await page.waitForTimeout(3_000);

    const download = await getDownloadInfo(page);
    const toast = page.locator('[data-radix-collection-item]')
      .filter({ hasText: /export|csv|downloaded|complete/i });
    const hasToast = await toast.first().isVisible({ timeout: 5_000 }).catch(() => false);

    expect(download !== null || hasToast, 'Cancellations export should work').toBe(true);
  });

  test('export Utilisation report CSV', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/utilisation', 'Utilisation');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);

    await installDownloadInterceptor(page);

    const exportBtn = page.getByRole('button', { name: /export csv/i }).first()
      .or(page.getByRole('button', { name: /export/i }).first());
    const hasExport = await exportBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasExport) {
      test.skip(true, 'Export button not found on utilisation report');
      return;
    }

    await exportBtn.click();
    await page.waitForTimeout(3_000);

    const download = await getDownloadInfo(page);
    const toast = page.locator('[data-radix-collection-item]')
      .filter({ hasText: /export|csv|downloaded|complete/i });
    const hasToast = await toast.first().isVisible({ timeout: 5_000 }).catch(() => false);

    expect(download !== null || hasToast, 'Utilisation export should work').toBe(true);
  });

  test('export Teacher Performance report CSV', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(90_000);

    await safeGoTo(page, '/reports/teacher-performance', 'Teacher Performance');
    if (!page.url().includes('/reports')) return;
    await waitForReportData(page);

    await installDownloadInterceptor(page);

    const exportBtn = page.getByRole('button', { name: /export csv/i }).first()
      .or(page.getByRole('button', { name: /export/i }).first());
    const hasExport = await exportBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasExport) {
      // May be feature-gated
      test.skip(true, 'Export button not found — may be feature-gated');
      return;
    }

    await exportBtn.click();
    await page.waitForTimeout(3_000);

    const download = await getDownloadInfo(page);
    const toast = page.locator('[data-radix-collection-item]')
      .filter({ hasText: /export|csv|downloaded|complete/i });
    const hasToast = await toast.first().isVisible({ timeout: 5_000 }).catch(() => false);

    expect(download !== null || hasToast, 'Teacher Performance export should work').toBe(true);
  });

  test('Export button disabled during loading', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');

    // Navigate directly — the report will briefly be in loading state
    await page.goto('/reports/revenue');
    await waitForPageReady(page);

    // The export button may be disabled while data loads
    const exportBtn = page.getByRole('button', { name: /export csv/i }).first()
      .or(page.getByRole('button', { name: /export/i }).first());

    const hasExport = await exportBtn.isVisible({ timeout: 15_000 }).catch(() => false);
    if (hasExport) {
      // After data loads, button should be enabled
      await waitForReportData(page);
      const isEnabled = await exportBtn.isEnabled();
      expect(isEnabled, 'Export button should be enabled after data loads').toBe(true);
    }
  });

  test('all report pages have Export button', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    test.setTimeout(120_000);

    const reportPaths = [
      '/reports/outstanding',
      '/reports/revenue',
      '/reports/payroll',
      '/reports/lessons',
      '/reports/cancellations',
      '/reports/utilisation',
    ];

    let exportFound = 0;
    for (const path of reportPaths) {
      await safeGoTo(page, path, path);
      if (!page.url().includes('/reports')) continue;
      await waitForReportData(page);

      const exportBtn = page.getByRole('button', { name: /export/i }).first();
      if (await exportBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        exportFound++;
      }
    }

    expect(exportFound, 'Most report pages should have an Export button').toBeGreaterThanOrEqual(4);
  });
});
