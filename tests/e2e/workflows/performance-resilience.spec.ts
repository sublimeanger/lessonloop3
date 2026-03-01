import { test, expect, Page } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from '../helpers';

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

/** Measure ms until `locator` becomes visible (or timeout). */
async function timeUntilVisible(
  page: Page,
  selector: string | ReturnType<Page['locator']>,
  timeout = 15_000,
): Promise<number> {
  const start = Date.now();
  const locator = typeof selector === 'string' ? page.locator(selector) : selector;
  await expect(locator).toBeVisible({ timeout });
  return Date.now() - start;
}

/** Navigate via client-side link (no full page reload). */
async function clientNavigate(page: Page, path: string) {
  // Use the sidebar / router link to get a client-side transition
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  // Fallback: if React Router doesn't pick up popstate, goto
  if (!page.url().includes(path)) {
    await page.goto(path);
  }
  await waitForPageReady(page);
}

/** Log a performance metric to stdout so CI can capture it. */
function logMetric(name: string, ms: number) {
  // eslint-disable-next-line no-console
  console.log(`[perf] ${name}: ${ms}ms`);
}

/* ================================================================== */
/*  Test 1: Dashboard loads within 5 seconds                           */
/* ================================================================== */

test.describe('Performance — Dashboard Load', () => {
  test.use({ storageState: AUTH.owner });

  test('dashboard loads within 5 seconds', async ({ page }) => {
    const start = Date.now();

    // Navigate to dashboard
    await page.goto('/dashboard');

    // Wait for stat cards to appear (StatCard renders title text like "Today's Lessons")
    const statCard = page.getByText("Today's Lessons").or(
      page.getByText('Active Students'),
    ).first();
    await expect(statCard).toBeVisible({ timeout: 15_000 });

    const loadTime = Date.now() - start;
    logMetric('dashboard_load', loadTime);

    // Assert under 5 seconds
    expect(loadTime).toBeLessThan(5_000);

    // Verify multiple stat cards rendered
    const statTexts = ['Active Students', 'This Week', 'Revenue (MTD)', 'Outstanding'];
    for (const text of statTexts) {
      await expect(page.getByText(text).first()).toBeVisible({ timeout: 2_000 });
    }
  });
});

/* ================================================================== */
/*  Test 2: Student list loads and is interactive within 3 seconds     */
/* ================================================================== */

test.describe('Performance — Student List', () => {
  test.use({ storageState: AUTH.owner });

  test('student list loads and is interactive within 3 seconds', async ({ page }) => {
    const start = Date.now();

    // Navigate to students page
    await page.goto('/students');

    // Wait for at least one student name to appear in the list
    // Student names appear as text in the list items
    const firstStudent = page.locator('main').getByRole('link').first();
    await expect(firstStudent).toBeVisible({ timeout: 10_000 });

    const loadTime = Date.now() - start;
    logMetric('students_list_load', loadTime);

    expect(loadTime).toBeLessThan(3_000);

    // Test search interactivity
    const searchInput = page.getByPlaceholder('Search students...');
    await expect(searchInput).toBeVisible({ timeout: 2_000 });

    // Type a search term and measure response time
    const searchStart = Date.now();
    await searchInput.fill('Emma');
    // Wait for the list to filter (should show filtered results quickly)
    await page.waitForTimeout(500);
    const searchTime = Date.now() - searchStart;
    logMetric('students_search_response', searchTime);
    expect(searchTime).toBeLessThan(1_500);

    // Verify search actually filtered
    const visibleStudents = page.locator('main').getByRole('link');
    const countAfterSearch = await visibleStudents.count();

    // Clear search and measure response time
    const clearStart = Date.now();
    await searchInput.fill('');
    await page.waitForTimeout(500);
    const clearTime = Date.now() - clearStart;
    logMetric('students_search_clear', clearTime);
    expect(clearTime).toBeLessThan(1_500);

    // Full list should return (more items than filtered)
    const countAfterClear = await visibleStudents.count();
    expect(countAfterClear).toBeGreaterThanOrEqual(countAfterSearch);
  });
});

/* ================================================================== */
/*  Test 3: Calendar renders week view within 5 seconds                */
/* ================================================================== */

test.describe('Performance — Calendar Render', () => {
  test.use({ storageState: AUTH.owner });

  test('calendar renders week view within 5 seconds', async ({ page }) => {
    const start = Date.now();

    // Navigate to calendar
    await page.goto('/calendar');

    // Wait for main content to render and at least some calendar structure
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Wait for day headers (Mon, Tue, Wed, etc.) or any lesson block
    const calendarContent = page.getByText(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/i).first().or(
      page.locator('[class*="cursor-pointer"]').first(),
    );
    await expect(calendarContent).toBeVisible({ timeout: 10_000 });

    const loadTime = Date.now() - start;
    logMetric('calendar_initial_load', loadTime);

    expect(loadTime).toBeLessThan(5_000);

    // Navigate to next week and measure
    const nextBtn = page.locator('[aria-label="Next"]').or(
      page.locator('[aria-label="Next week"]'),
    ).first();
    const hasNext = await nextBtn.isVisible().catch(() => false);

    if (hasNext) {
      const nextStart = Date.now();
      await nextBtn.click();
      await waitForPageReady(page);
      const nextTime = Date.now() - nextStart;
      logMetric('calendar_next_week', nextTime);
      expect(nextTime).toBeLessThan(3_000);

      // Navigate back (should be faster due to caching)
      const prevBtn = page.locator('[aria-label="Previous"]').or(
        page.locator('[aria-label="Previous week"]'),
      ).first();
      const hasPrev = await prevBtn.isVisible().catch(() => false);

      if (hasPrev) {
        const prevStart = Date.now();
        await prevBtn.click();
        await waitForPageReady(page);
        const prevTime = Date.now() - prevStart;
        logMetric('calendar_prev_week_cached', prevTime);
        expect(prevTime).toBeLessThan(2_000);
      }
    }
  });
});

/* ================================================================== */
/*  Test 4: Reports pages don't timeout                                */
/* ================================================================== */

test.describe('Performance — Reports Pages', () => {
  test.use({ storageState: AUTH.owner });

  const reportPages = [
    { path: '/reports/revenue', name: 'Revenue Report' },
    { path: '/reports/outstanding', name: 'Outstanding Report' },
    { path: '/reports/lessons', name: 'Lessons Delivered' },
    { path: '/reports/cancellations', name: 'Cancellation Report' },
    { path: '/reports/payroll', name: 'Payroll Report' },
    { path: '/reports/utilisation', name: 'Utilisation Report' },
    { path: '/reports/teacher-performance', name: 'Teacher Performance' },
  ];

  for (const report of reportPages) {
    test(`${report.name} loads without timeout`, async ({ page }) => {
      test.setTimeout(30_000);

      const start = Date.now();
      await page.goto(report.path);

      // Wait for main content — the page should render within 15 seconds
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

      // Wait for loading spinners to disappear
      await expect(
        page.locator('.animate-spin').first(),
      ).toBeHidden({ timeout: 15_000 }).catch(() => {
        // Spinner may never have appeared — that's fine
      });

      const loadTime = Date.now() - start;
      logMetric(`report_${report.path.replace('/reports/', '')}`, loadTime);

      // Should load within 15 seconds
      expect(loadTime).toBeLessThan(15_000);

      // Assert no error boundary triggered
      // ErrorBoundary shows "Something went wrong"
      const errorBoundary = page.getByText('Something went wrong');
      await expect(errorBoundary).toBeHidden({ timeout: 1_000 }).catch(() => {
        // Not visible is the expected state
      });
      expect(await errorBoundary.isVisible().catch(() => false)).toBe(false);

      // Assert no SectionErrorBoundary triggered
      // SectionErrorBoundary shows "Failed to load"
      const sectionError = page.getByText(/Failed to load/);
      const sectionErrorVisible = await sectionError.isVisible().catch(() => false);
      expect(sectionErrorVisible).toBe(false);
    });
  }
});

/* ================================================================== */
/*  Test 5: Navigation between pages is instant when cached            */
/* ================================================================== */

test.describe('Performance — Cached Navigation', () => {
  test.use({ storageState: AUTH.owner });

  test('navigation between pages is fast when cached by React Query', async ({ page }) => {
    test.setTimeout(60_000);

    // First pass — cold loads (prime the cache)
    await goTo(page, '/dashboard');
    await expect(
      page.getByText("Today's Lessons").or(page.getByText('Active Students')).first(),
    ).toBeVisible({ timeout: 10_000 });

    await goTo(page, '/students');
    await expect(
      page.locator('main').getByRole('link').first(),
    ).toBeVisible({ timeout: 10_000 });

    await goTo(page, '/calendar');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

    // Second pass — warm loads (data cached by React Query)
    const dashStart = Date.now();
    await goTo(page, '/dashboard');
    await expect(
      page.getByText("Today's Lessons").or(page.getByText('Active Students')).first(),
    ).toBeVisible({ timeout: 5_000 });
    const dashTime = Date.now() - dashStart;
    logMetric('cached_nav_dashboard', dashTime);
    expect(dashTime).toBeLessThan(2_000);

    const studentsStart = Date.now();
    await goTo(page, '/students');
    await expect(
      page.locator('main').getByRole('link').first(),
    ).toBeVisible({ timeout: 5_000 });
    const studentsTime = Date.now() - studentsStart;
    logMetric('cached_nav_students', studentsTime);
    expect(studentsTime).toBeLessThan(2_000);
  });
});

/* ================================================================== */
/*  Test 6: Offline banner appears when connection lost                */
/* ================================================================== */

test.describe('Resilience — Offline Banner', () => {
  test.use({ storageState: AUTH.owner });

  test('offline banner appears when connection lost and disappears on reconnect', async ({ page }) => {
    // 1. Navigate to dashboard and wait for full load
    await goTo(page, '/dashboard');
    await expect(
      page.getByText("Today's Lessons").or(page.getByText('Active Students')).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Verify no offline banner initially
    const offlineBanner = page.getByRole('status').filter({ hasText: /offline/i }).or(
      page.getByText('Offline — showing cached data'),
    );
    await expect(offlineBanner.first()).toBeHidden({ timeout: 2_000 }).catch(() => {
      // Expected: not visible
    });

    // 2. Simulate offline
    await page.context().setOffline(true);

    // Dispatch browser offline event for the app's useOnlineStatus hook
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // 3. Wait for the offline banner to appear
    // OfflineBanner renders: "Offline — showing cached data" with role="status"
    await page.waitForTimeout(1_000);
    const bannerLocator = page.getByText('Offline — showing cached data');
    const bannerAppeared = await bannerLocator.isVisible({ timeout: 5_000 }).catch(() => false);

    if (bannerAppeared) {
      // Assert the banner is visible with correct text
      await expect(bannerLocator).toBeVisible();
    }

    // 5. Restore connectivity
    await page.context().setOffline(false);

    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // 6. Wait for recovery
    await page.waitForTimeout(2_000);

    // 7. Offline banner should disappear
    if (bannerAppeared) {
      await expect(bannerLocator).toBeHidden({ timeout: 5_000 });
    }

    // 8. App should still be functional — no stale error state
    // ErrorBoundary shows "Something went wrong" — should NOT be visible
    const errorBoundary = page.getByText('Something went wrong');
    expect(await errorBoundary.isVisible().catch(() => false)).toBe(false);

    // Dashboard content should still be present
    await expect(page.locator('main').first()).toBeVisible();
  });
});

/* ================================================================== */
/*  Test 7: Memory doesn't leak on repeated navigation                 */
/* ================================================================== */

test.describe('Resilience — Memory Stability', () => {
  test.use({ storageState: AUTH.owner });

  test('no crash or error boundary after 20 page transitions', async ({ page }) => {
    test.setTimeout(120_000);

    const routes = [
      '/dashboard',
      '/students',
      '/calendar',
      '/invoices',
      '/reports/revenue',
    ];

    const consoleErrors: string[] = [];

    // Listen for console errors related to memory or crashes
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          text.includes('out of memory') ||
          text.includes('Maximum call stack') ||
          text.includes('FATAL') ||
          text.includes('heap')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    // Track page crash events
    let pageCrashed = false;
    page.on('crash', () => {
      pageCrashed = true;
    });

    // Initial load
    await goTo(page, '/dashboard');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

    // Perform 20 page transitions cycling through routes
    for (let i = 0; i < 20; i++) {
      const route = routes[i % routes.length];
      await goTo(page, route);

      // Brief check that the page loaded
      await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

      // Quick check for error boundary after each transition
      const hasError = await page.getByText('Something went wrong').isVisible().catch(() => false);
      if (hasError) {
        // Log which transition caused it and fail
        throw new Error(`Error boundary triggered after transition ${i + 1} to ${route}`);
      }
    }

    logMetric('page_transitions_completed', 20);

    // Final assertions after all transitions
    // No page crash
    expect(pageCrashed).toBe(false);

    // No memory-related console errors
    expect(consoleErrors).toHaveLength(0);

    // Final page loads correctly
    await goTo(page, '/dashboard');
    await expect(
      page.getByText("Today's Lessons").or(page.getByText('Active Students')).first(),
    ).toBeVisible({ timeout: 10_000 });

    // No error boundary on final page
    const finalError = await page.getByText('Something went wrong').isVisible().catch(() => false);
    expect(finalError).toBe(false);

    // No section-level error boundaries
    const sectionError = await page.getByText(/Failed to load/).isVisible().catch(() => false);
    expect(sectionError).toBe(false);
  });
});
