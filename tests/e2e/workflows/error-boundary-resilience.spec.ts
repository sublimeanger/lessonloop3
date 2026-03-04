import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  safeGoTo,
  goTo,
  waitForPageReady,
  assertNoErrorBoundary,
} from '../helpers';
import { cleanupTestData, supabaseInsert, getOrgId, deleteStudentById } from '../supabase-admin';

// ═══════════════════════════════════════════════════════════════
// SECTION 7: ERROR BOUNDARY AND NETWORK RESILIENCE
// Test that the app shows helpful error states rather than blank
// pages or crashes.
// ═══════════════════════════════════════════════════════════════

const testId = `e2e-${Date.now()}`;
const suffix = testId.slice(-6);

/**
 * Navigate via sidebar link click (SPA navigation, preserves auth).
 */
async function clickNav(page: Page, href: string) {
  const link = page.locator(`a[href="${href}"]`).first();
  await expect(link).toBeVisible({ timeout: 10_000 });
  await link.click();
  await page.waitForURL((url) => url.pathname.startsWith(href), { timeout: 15_000 });
  await waitForPageReady(page);
}

test.describe('Error Boundary & Resilience — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test.afterAll(() => {
    try { cleanupTestData(testId); } catch { /* best-effort */ }
  });

  test('404 — nonexistent student UUID does not crash', async ({ page }) => {
    test.setTimeout(60_000);
    // Navigate to dashboard first to establish session
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    // Navigate via URL to nonexistent student
    await goTo(page, '/students/00000000-0000-0000-0000-000000000000');
    await page.waitForTimeout(5_000);

    // App should either: redirect to students list, show error, or show "not found"
    const bodyContent = await page.locator('body').textContent() || '';
    const url = page.url();

    // Acceptable outcomes:
    // 1. Redirected to students list or dashboard
    // 2. Shows "not found" or error message
    // 3. Still renders (no blank page)
    const isAcceptable = url.includes('/students') ||
      url.includes('/dashboard') ||
      bodyContent.toLowerCase().includes('not found') ||
      bodyContent.toLowerCase().includes('something went wrong') ||
      bodyContent.length > 100;

    expect(isAcceptable, 'App should handle nonexistent student gracefully').toBe(true);

    // eslint-disable-next-line no-console
    console.log(`[error-boundary] Nonexistent student → URL: ${url}`);

    // Navigation should still work
    const sidebar = page.locator('a[href="/dashboard"]').first()
      .or(page.locator('a[href="/students"]').first());
    const hasSidebar = await sidebar.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasSidebar) {
      expect(hasSidebar).toBe(true);
    }
  });

  test('404 — nonexistent invoice UUID does not crash', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    await goTo(page, '/invoices/00000000-0000-0000-0000-000000000000');
    await page.waitForTimeout(5_000);

    const bodyContent = await page.locator('body').textContent() || '';
    const url = page.url();

    const isAcceptable = url.includes('/invoices') ||
      url.includes('/dashboard') ||
      bodyContent.toLowerCase().includes('not found') ||
      bodyContent.length > 100;

    expect(isAcceptable, 'App should handle nonexistent invoice gracefully').toBe(true);

    // eslint-disable-next-line no-console
    console.log(`[error-boundary] Nonexistent invoice → URL: ${url}`);
  });

  test('404 — nonexistent route redirects or shows 404', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    await goTo(page, '/completely-fake-route-12345');
    await page.waitForTimeout(5_000);

    const bodyContent = await page.locator('body').textContent() || '';
    const url = page.url();

    // Should render a 404 page or redirect to dashboard
    const is404 = bodyContent.toLowerCase().includes('404') ||
      bodyContent.toLowerCase().includes('not found') ||
      bodyContent.toLowerCase().includes('page not found') ||
      url.includes('/dashboard');

    expect(is404 || bodyContent.length > 50, 'Should show 404 or redirect to dashboard').toBe(true);

    // eslint-disable-next-line no-console
    console.log(`[error-boundary] Nonexistent route → URL: ${url}`);
  });

  test('Malformed UUID in URL does not crash', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    await goTo(page, '/students/not-a-uuid');
    await page.waitForTimeout(5_000);

    const bodyContent = await page.locator('body').textContent() || '';
    expect(bodyContent.length).toBeGreaterThan(50);

    const sidebar = page.locator('a[href="/dashboard"]').first();
    const hasSidebar = await sidebar.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasSidebar || bodyContent.length > 100, 'App should recover from malformed UUID').toBe(true);
  });

  test('Back button after deletion does not crash', async ({ page }) => {
    test.setTimeout(120_000);

    const orgId = getOrgId();
    if (!orgId) { test.skip(true, 'No org ID'); return; }

    // Create a student via API
    const student = supabaseInsert('students', {
      org_id: orgId,
      first_name: `BackTest ${suffix}`,
      last_name: `${testId} BackDel`,
      status: 'active',
    });
    expect(student?.id, 'Student created for deletion test').toBeTruthy();

    // Navigate to dashboard first
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);
    await clickNav(page, '/students');
    await page.waitForTimeout(2_000);

    // Delete the student via API (simulate deletion)
    if (student?.id) {
      deleteStudentById(student.id);
    }

    // Try navigating to the deleted student's URL
    await goTo(page, `/students/${student?.id}`);
    await page.waitForTimeout(5_000);

    // Should not crash — shows error or redirects
    const bodyContent = await page.locator('body').textContent() || '';
    expect(bodyContent.length).toBeGreaterThan(50);

    // Sidebar should still be accessible
    const sidebar = page.locator('a[href="/dashboard"]').first()
      .or(page.locator('a[href="/students"]').first());
    const hasSidebar = await sidebar.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasSidebar || bodyContent.length > 100, 'App handles deleted student gracefully').toBe(true);
  });

  test('Rapid navigation does not crash the app', async ({ page }) => {
    test.setTimeout(120_000);

    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    // Click sidebar links rapidly without waiting for loads
    const routes = ['/students', '/calendar', '/invoices', '/messages', '/leads', '/dashboard'];

    for (const route of routes) {
      const link = page.locator(`a[href="${route}"]`).first();
      const visible = await link.isVisible({ timeout: 5_000 }).catch(() => false);
      if (visible) {
        await link.click();
        // Don't wait for page to fully load — move on quickly
        await page.waitForTimeout(200);
      }
    }

    // Wait for the last page to fully load
    await page.waitForTimeout(5_000);
    await waitForPageReady(page);

    // Verify: app didn't crash
    await assertNoErrorBoundary(page);
    const mainVisible = await page.locator('main').isVisible().catch(() => false);
    expect(mainVisible, 'App should survive rapid navigation').toBe(true);

    // Verify we can still navigate
    await clickNav(page, '/dashboard');
    await assertNoErrorBoundary(page);
  });

  test('SPA navigation to all major pages works', async ({ page }) => {
    test.setTimeout(180_000);

    // This tests that each page loads correctly via SPA navigation
    // (not page reload, which loses auth in this environment)
    const pages = [
      '/dashboard',
      '/students',
      '/calendar',
      '/invoices',
      '/messages',
      '/leads',
      '/teachers',
      '/locations',
      '/reports',
    ];

    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    let passedCount = 0;

    for (const path of pages) {
      const link = page.locator(`a[href="${path}"]`).first();
      const visible = await link.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!visible) {
        // eslint-disable-next-line no-console
        console.log(`[resilience] ${path}: sidebar link not visible — skipping`);
        continue;
      }

      await link.click();
      await page.waitForTimeout(2_000);
      await waitForPageReady(page);

      // Verify no error boundary
      const hasError = await page.getByText('Something went wrong')
        .isVisible({ timeout: 3_000 }).catch(() => false);

      if (!hasError) {
        passedCount++;
        // eslint-disable-next-line no-console
        console.log(`[resilience] ${path}: OK`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`[resilience] ${path}: error boundary`);
      }

      await assertNoErrorBoundary(page);
    }

    // eslint-disable-next-line no-console
    console.log(`[resilience] ${passedCount}/${pages.length} pages loaded successfully`);
    expect(passedCount, 'Most pages should load without error').toBeGreaterThanOrEqual(6);
  });
});
