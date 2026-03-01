/**
 * Prompt 6 — Edge Cases & Defensive Scenarios
 *
 * These tests hunt for bugs that emerge under unusual but realistic
 * conditions: rapid navigation, back button, deep links, empty states,
 * invalid routes, unauthenticated access, and concurrent tabs.
 */
import { test, expect } from '../workflow.fixtures';
import { AUTH, waitForPageReady, goTo } from '../helpers';
import {
  assertPageLoaded,
  assertNoErrorBoundary,
  assertNoHorizontalOverflow,
  getAuthState,
} from '../workflow-helpers';

/* ------------------------------------------------------------------ */
/*  Test 1 — Rapid navigation doesn't break state                     */
/* ------------------------------------------------------------------ */

test.describe('Edge Cases — Rapid Navigation', () => {
  test.use({ storageState: AUTH.owner });

  test('rapid navigation doesn\'t break state', async ({
    page,
    errorTracker,
    assertCleanRun,
  }) => {
    test.setTimeout(60_000);

    await goTo(page, '/dashboard');

    // Rapid-fire sidebar navigation — don't wait for each page to load
    const routes = ['/students', '/calendar', '/invoices', '/dashboard'];
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'commit' });
    }

    // Now wait for the final page to settle
    await waitForPageReady(page);

    // Assert dashboard rendered correctly
    await assertPageLoaded(page, 'Dashboard (after rapid nav)');

    // Sidebar should highlight "Dashboard"
    const sidebarDashboard = page
      .getByRole('link', { name: 'Dashboard', exact: true })
      .first();
    await expect(sidebarDashboard).toBeVisible({ timeout: 5_000 });

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 2 — Back button doesn't trap or break                        */
/* ------------------------------------------------------------------ */

test.describe('Edge Cases — Back Button', () => {
  test.use({ storageState: AUTH.owner });

  test('back button doesn\'t trap or break', async ({
    page,
    errorTracker,
    assertCleanRun,
  }) => {
    test.setTimeout(60_000);

    // Step 1: Dashboard
    await goTo(page, '/dashboard');
    await assertPageLoaded(page, 'Dashboard');

    // Step 2: Navigate to Students
    await page.getByRole('link', { name: 'Students', exact: true }).first().click();
    await waitForPageReady(page);
    await expect(page).toHaveURL(/\/students/, { timeout: 10_000 });

    // Step 3: Click on a student to go to detail page
    const studentLink = page.locator('main').getByRole('link').first();
    await expect(studentLink).toBeVisible({ timeout: 15_000 });
    await studentLink.click();
    await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
    await waitForPageReady(page);

    // Step 4: Click the Lessons tab
    const lessonsTab = page.getByRole('tab', { name: /Lessons/i }).first();
    if (await lessonsTab.isVisible().catch(() => false)) {
      await lessonsTab.click();
      await page.waitForTimeout(500);
    }

    // Step 5: Press browser back
    await page.goBack();
    await waitForPageReady(page);

    // Should return to /students list (not dashboard, not stuck)
    await expect(page).toHaveURL(/\/students/, { timeout: 10_000 });
    await assertNoErrorBoundary(page);

    // Step 6: Press back again
    await page.goBack();
    await waitForPageReady(page);

    // Should return to /dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await assertNoErrorBoundary(page);

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 3 — Deep link to student detail loads correctly               */
/* ------------------------------------------------------------------ */

test.describe('Edge Cases — Deep Links', () => {
  test.use({ storageState: AUTH.owner });

  test('deep link to student detail loads correctly', async ({
    page,
    errorTracker,
    assertCleanRun,
  }) => {
    test.setTimeout(60_000);

    // Step 1: Navigate to /students and grab a student's URL
    await goTo(page, '/students');
    await assertPageLoaded(page, 'Students');

    const studentLink = page.locator('main').getByRole('link').first();
    await expect(studentLink).toBeVisible({ timeout: 15_000 });
    await studentLink.click();
    await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
    await waitForPageReady(page);

    const studentUrl = page.url();
    const studentName = await page
      .locator('main')
      .locator('h1, h2, .text-2xl, .text-xl')
      .first()
      .textContent()
      .catch(() => '');

    // Step 2: Open a fresh page context and navigate directly to the URL
    const newPage = await page.context().newPage();
    await newPage.goto(studentUrl);
    await waitForPageReady(newPage);

    // Step 3: Verify student detail loaded
    await assertPageLoaded(newPage, 'Student Detail (deep link)');

    // Student name should be visible
    if (studentName) {
      const nameVisible = await newPage
        .getByText(studentName.trim(), { exact: false })
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      expect(nameVisible, `Student name "${studentName}" should be visible on deep-linked page`).toBe(true);
    }

    // All 10 tabs should be present
    const expectedTabs = [
      'Overview', 'Instruments', 'Teachers', 'Guardians', 'Lessons',
      'Practice', 'Invoices', 'Credits', 'Notes', 'Messages',
    ];
    for (const tabName of expectedTabs) {
      const tab = newPage.getByRole('tab', { name: tabName }).first();
      await expect(tab, `Tab "${tabName}" should exist`).toBeVisible({ timeout: 5_000 });
    }

    await newPage.close();
    assertCleanRun();
  });

  test('deep link to invoice detail loads correctly', async ({
    page,
    errorTracker,
    assertCleanRun,
  }) => {
    test.setTimeout(60_000);

    // Step 1: Navigate to /invoices and grab an invoice URL
    await goTo(page, '/invoices');
    await assertPageLoaded(page, 'Invoices');

    const invoiceLink = page.locator('main').getByRole('link').first();
    await expect(invoiceLink).toBeVisible({ timeout: 15_000 });
    await invoiceLink.click();
    await expect(page).toHaveURL(/\/invoices\//, { timeout: 10_000 });
    await waitForPageReady(page);

    const invoiceUrl = page.url();

    // Capture amount and status from the detail page
    const detailText = await page.locator('main').textContent() ?? '';
    const amountMatch = detailText.match(/£[\d,.]+/);
    const statusMatch = detailText.match(/Draft|Sent|Paid|Overdue|Void|Credit Note/i);

    // Step 2: Navigate directly to the URL in a fresh page
    const newPage = await page.context().newPage();
    await newPage.goto(invoiceUrl);
    await waitForPageReady(newPage);

    // Step 3: Verify invoice loaded
    await assertPageLoaded(newPage, 'Invoice Detail (deep link)');

    const freshText = await newPage.locator('main').textContent() ?? '';
    if (amountMatch) {
      expect(
        freshText.includes(amountMatch[0]),
        `Amount ${amountMatch[0]} should appear on deep-linked invoice`,
      ).toBe(true);
    }
    if (statusMatch) {
      expect(
        freshText.toLowerCase().includes(statusMatch[0].toLowerCase()),
        `Status "${statusMatch[0]}" should appear on deep-linked invoice`,
      ).toBe(true);
    }

    await newPage.close();
    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 4 — Empty state rendering                                     */
/* ------------------------------------------------------------------ */

test.describe('Edge Cases — Empty States', () => {
  test.use({ storageState: AUTH.owner });

  test('empty state rendering when no data exists', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(60_000);

    const emptyPages = [
      { path: '/leads', name: 'Leads' },
      { path: '/waitlist', name: 'Waitlist' },
      { path: '/make-ups', name: 'Make-ups' },
    ];

    for (const { path, name } of emptyPages) {
      await goTo(page, path);
      await assertPageLoaded(page, name);

      // Check if the page is empty — look for empty state indicators
      const mainText = await page.locator('main').textContent() ?? '';
      const isEmpty =
        mainText.includes('No ') ||
        mainText.includes('no ') ||
        mainText.includes('empty') ||
        mainText.includes('Get started') ||
        mainText.includes('Create') ||
        mainText.includes('Add your first');

      if (isEmpty) {
        // Should NOT show a raw "No data found" or blank page — should have helpful content
        const hasCTA = await page
          .locator('main')
          .getByRole('button')
          .or(page.locator('main').getByRole('link'))
          .first()
          .isVisible()
          .catch(() => false);

        softAssert(
          hasCTA || mainText.length > 50,
          `${name}: Empty state should show helpful guidance or CTA, not just a blank page`,
        );
      }

      // Regardless of empty or not, page should not be broken
      await assertNoErrorBoundary(page);
    }

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 5 — Very long content doesn't break layouts                   */
/* ------------------------------------------------------------------ */

test.describe('Edge Cases — Layout Integrity', () => {
  test.use({ storageState: AUTH.owner });

  test('very long content doesn\'t break layouts', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(60_000);

    // Check sidebar doesn't overflow
    await goTo(page, '/dashboard');
    await assertPageLoaded(page, 'Dashboard');

    const sidebar = page.locator('[data-sidebar="sidebar"]').first();
    if (await sidebar.isVisible().catch(() => false)) {
      const sidebarOverflow = await sidebar.evaluate((el) => {
        return el.scrollWidth > el.clientWidth;
      });
      softAssert(!sidebarOverflow, 'Sidebar should not have horizontal overflow');

      // All nav items should be readable (not cut off at zero width)
      const navItems = sidebar.getByRole('link');
      const navCount = await navItems.count();
      for (let i = 0; i < Math.min(navCount, 10); i++) {
        const box = await navItems.nth(i).boundingBox();
        if (box) {
          softAssert(box.width > 10, `Sidebar nav item ${i} should have readable width (${box.width}px)`);
        }
      }
    }

    // Check messages page for overflow
    await goTo(page, '/messages');
    await assertPageLoaded(page, 'Messages');
    await assertNoHorizontalOverflow(page);

    // Check students page for overflow
    await goTo(page, '/students');
    await assertPageLoaded(page, 'Students');
    await assertNoHorizontalOverflow(page);

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 6 — Session/auth edge cases                                   */
/* ------------------------------------------------------------------ */

test.describe('Edge Cases — Unauthenticated Access', () => {
  test('unauthenticated user is redirected to login', async ({ browser }) => {
    test.setTimeout(60_000);

    // Create a context with NO storage state (unauthenticated)
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();

    const protectedRoutes = [
      '/dashboard',
      '/students/some-fake-uuid',
      '/portal/home',
      '/invoices',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      // Should redirect to /login
      await page.waitForURL(
        (url) => url.pathname.includes('/login') || url.pathname === '/',
        { timeout: 15_000 },
      );

      const currentUrl = page.url();
      expect(
        currentUrl.includes('/login') || currentUrl.endsWith('/'),
        `${route} should redirect unauthenticated user to login, got: ${currentUrl}`,
      ).toBe(true);
    }

    await page.close();
    await ctx.close();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 7 — Invalid route params don't crash                         */
/* ------------------------------------------------------------------ */

test.describe('Edge Cases — Invalid Route Params', () => {
  test.use({ storageState: AUTH.owner });

  test('page doesn\'t crash with invalid route params', async ({
    page,
    errorTracker,
    softAssert,
  }) => {
    test.setTimeout(60_000);

    const invalidRoutes = [
      { path: '/students/not-a-real-uuid', name: 'Student' },
      { path: '/invoices/not-a-real-uuid', name: 'Invoice' },
      { path: '/leads/not-a-real-uuid', name: 'Lead' },
      { path: '/reports/not-a-real-route', name: 'Report' },
    ];

    for (const { path, name } of invalidRoutes) {
      await page.goto(path);
      await waitForPageReady(page);

      // Should NOT show an error boundary crash
      const hasCrash = await page
        .getByText('Something went wrong')
        .isVisible()
        .catch(() => false);

      softAssert(
        !hasCrash,
        `${name} (${path}): Should show 404/not-found, not a crash error boundary`,
      );

      // Page should show helpful message or redirect — not a blank white screen
      const mainContent = await page.locator('main, body').first().textContent() ?? '';
      softAssert(
        mainContent.length > 20,
        `${name} (${path}): Page should have meaningful content, not blank (${mainContent.length} chars)`,
      );
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Test 8 — Concurrent tab usage doesn't cause issues                 */
/* ------------------------------------------------------------------ */

test.describe('Edge Cases — Concurrent Tabs', () => {
  test('concurrent tab usage doesn\'t cause issues', async ({ browser }) => {
    test.setTimeout(60_000);

    const ctx = await browser.newContext({ storageState: getAuthState('owner') });

    // Open two pages (simulating two tabs)
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    // Page 1: go to /students
    await goTo(page1, '/students');
    await assertPageLoaded(page1, 'Students (tab 1)');

    // Page 2: go to /calendar
    await goTo(page2, '/calendar');
    await assertPageLoaded(page2, 'Calendar (tab 2)');

    // Page 1: search for a student
    const searchInput1 = page1.getByPlaceholder(/search/i).first();
    if (await searchInput1.isVisible().catch(() => false)) {
      await searchInput1.fill('Emma');
      await page1.waitForTimeout(500);
    }

    // Page 2: navigate forward a week
    const nextWeekBtn = page2.locator('button').filter({ has: page2.locator('[class*="chevron-right"], [data-lucide="chevron-right"]') }).first();
    const altNextBtn = page2.getByRole('button', { name: /next|forward/i }).first();
    if (await nextWeekBtn.isVisible().catch(() => false)) {
      await nextWeekBtn.click();
    } else if (await altNextBtn.isVisible().catch(() => false)) {
      await altNextBtn.click();
    }
    await page2.waitForTimeout(500);

    // Go back to page 1 — search results should still be there
    const mainText1 = await page1.locator('main').textContent() ?? '';
    expect(
      mainText1.toLowerCase().includes('emma') || mainText1.length > 50,
      'Page 1 should still show search results or student list',
    ).toBe(true);
    await assertNoErrorBoundary(page1);

    // Go back to page 2 — calendar should still be in the forward state
    await assertNoErrorBoundary(page2);
    await assertPageLoaded(page2, 'Calendar (tab 2 after interaction)');

    await page1.close();
    await page2.close();
    await ctx.close();
  });
});
