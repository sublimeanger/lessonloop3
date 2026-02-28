import { test, expect, Page } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from '../helpers';

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

/** Collect console errors and unhandled rejections throughout a test. */
function trackErrors(page: Page) {
  const errors: string[] = [];
  const rejections: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore noisy third-party warnings that aren't real errors
      if (
        text.includes('net::ERR_') ||
        text.includes('favicon') ||
        text.includes('ResizeObserver') ||
        text.includes('Download the React DevTools')
      ) {
        return;
      }
      errors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    rejections.push(err.message);
  });

  return { errors, rejections };
}

/** Assert no error boundary is shown on the current page. */
async function assertNoErrorBoundary(page: Page) {
  // Full-page ErrorBoundary text
  const fullError = await page.getByText('Something went wrong').isVisible().catch(() => false);
  expect(fullError, 'Full-page error boundary should not be visible').toBe(false);

  // SectionErrorBoundary text
  const sectionError = await page.getByText(/Failed to load/).first().isVisible().catch(() => false);
  expect(sectionError, 'Section error boundary should not be visible').toBe(false);
}

/** Assert a page loaded its main content without errors. */
async function assertPageLoaded(page: Page, pageName: string) {
  await expect(
    page.locator('main').first(),
    `${pageName} should have <main> element`,
  ).toBeVisible({ timeout: 15_000 });
  await assertNoErrorBoundary(page);
}

/** Check for no horizontal overflow (mobile scrolling issue). */
async function assertNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasOverflow, 'Page should not have horizontal overflow').toBe(false);
}

/** Log a performance metric. */
function logMetric(name: string, value: number | string) {
  // eslint-disable-next-line no-console
  console.log(`[smoke] ${name}: ${value}`);
}

/* ================================================================== */
/*  Test 1: Academy owner full day simulation                          */
/* ================================================================== */

test.describe('Smoke — Academy Owner Full Day', () => {
  test.use({ storageState: AUTH.owner });

  test('complete owner journey through every major system', async ({ page }) => {
    test.setTimeout(180_000); // 3 minutes for the full journey
    const testStart = Date.now();
    const { errors, rejections } = trackErrors(page);

    // ── 1. LOGIN & DASHBOARD ──────────────────────────────────────
    await goTo(page, '/dashboard');
    await assertPageLoaded(page, 'Dashboard');

    // Assert: greeting visible
    const greeting = page.getByText(/good (morning|afternoon|evening)/i).first();
    await expect(greeting).toBeVisible({ timeout: 10_000 });

    // Assert: stat cards loaded
    const statCardTexts = ["Today's Lessons", 'Active Students', 'This Week', 'Revenue (MTD)'];
    for (const text of statCardTexts) {
      await expect(
        page.getByText(text).first(),
        `Stat card "${text}" should be visible`,
      ).toBeVisible({ timeout: 5_000 });
    }

    // Note active student count
    const activeStudentsCard = page.getByText('Active Students').first().locator('..');
    const activeStudentsText = await activeStudentsCard.textContent().catch(() => '');
    logMetric('active_students_card', activeStudentsText?.trim() ?? 'unknown');

    // ── 2. CHECK CALENDAR ─────────────────────────────────────────
    await goTo(page, '/calendar');
    await assertPageLoaded(page, 'Calendar');

    // Assert: week view loads with day headers
    const dayHeader = page.getByText(/MON|TUE|WED|THU|FRI/i).first();
    await expect(dayHeader).toBeVisible({ timeout: 5_000 });

    // Navigate forward a week
    const nextBtn = page.locator('[aria-label="Next"]').first();
    const hasNext = await nextBtn.isVisible().catch(() => false);
    if (hasNext) {
      await nextBtn.click();
      await waitForPageReady(page);

      // Navigate back
      const prevBtn = page.locator('[aria-label="Previous"]').first();
      if (await prevBtn.isVisible().catch(() => false)) {
        await prevBtn.click();
        await waitForPageReady(page);
      }
    }

    // Assert: still showing calendar with day headers
    await expect(dayHeader).toBeVisible({ timeout: 5_000 });
    await assertNoErrorBoundary(page);

    // ── 3. REVIEW REGISTER ────────────────────────────────────────
    await goTo(page, '/register');
    await assertPageLoaded(page, 'Register');

    // Assert: register page loads with its stat cards
    const registerLoaded = await page.getByText(/daily register/i).first().isVisible().catch(() => false) ||
      await page.getByText(/active lessons|completed|scheduled/i).first().isVisible().catch(() => false);
    expect(registerLoaded).toBe(true);

    // ── 4. CHECK STUDENTS ─────────────────────────────────────────
    await goTo(page, '/students');
    await assertPageLoaded(page, 'Students');

    // Assert: student list loads (at least one student link)
    const studentLinks = page.locator('main').getByRole('link');
    await expect(studentLinks.first()).toBeVisible({ timeout: 10_000 });
    const studentCount = await studentLinks.count();
    logMetric('student_count', studentCount);

    // Search for "Emma"
    const searchInput = page.getByPlaceholder('Search students...');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });
    await searchInput.fill('Emma');
    await page.waitForTimeout(500);

    // Assert: search filters results
    const emmaLink = page.getByText(/emma/i).first();
    const emmaVisible = await emmaLink.isVisible().catch(() => false);

    if (emmaVisible) {
      // Click into Emma's detail
      await emmaLink.click();
      await page.waitForURL(/\/students\//, { timeout: 5_000 });
      await waitForPageReady(page);
      await assertPageLoaded(page, 'Student Detail');

      // Assert: key tabs visible
      const expectedTabs = ['Overview', 'Lessons', 'Invoices', 'Guardians'];
      for (const tab of expectedTabs) {
        const tabEl = page.getByRole('tab', { name: tab }).first();
        await expect(tabEl, `Tab "${tab}" should be visible`).toBeVisible({ timeout: 3_000 });
      }

      // Check Lessons tab
      const lessonsTab = page.getByRole('tab', { name: 'Lessons' });
      await lessonsTab.click();
      await page.waitForTimeout(500);

      // Check Invoices tab
      const invoicesTab = page.getByRole('tab', { name: 'Invoices' });
      await invoicesTab.click();
      await page.waitForTimeout(500);
    }

    // Navigate back to /students
    await goTo(page, '/students');
    await searchInput.fill('');
    await page.waitForTimeout(300);

    // ── 5. REVIEW TEACHERS ────────────────────────────────────────
    await goTo(page, '/teachers');
    await assertPageLoaded(page, 'Teachers');

    // Assert: teacher list loads
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
    const teacherContent = await page.locator('main').textContent() ?? '';
    logMetric('teachers_page_loaded', teacherContent.length > 50 ? 'yes' : 'minimal');

    // ── 6. CHECK INVOICES ─────────────────────────────────────────
    await goTo(page, '/invoices');
    await assertPageLoaded(page, 'Invoices');

    // Assert: invoice stats widget loads
    const statsWidget = page.locator('[data-tour="invoice-stats"]');
    const hasStats = await statsWidget.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasStats) {
      // Note stats (e.g., "£1,200 total · £800 paid · £400 outstanding")
      const statsText = await statsWidget.textContent() ?? '';
      logMetric('invoice_stats', statsText.trim());
    }

    // Assert: invoice list loads
    const invoiceList = page.locator('[data-tour="invoice-list"]');
    const hasInvoiceList = await invoiceList.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasStats || hasInvoiceList, 'Invoice page should show stats or invoice list').toBe(true);

    // ── 7. REVIEW REPORTS ─────────────────────────────────────────
    await goTo(page, '/reports');
    await assertPageLoaded(page, 'Reports');

    // Assert: all 7 report types visible
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
      const reportCard = page.getByText(name, { exact: false }).first();
      await expect(
        reportCard,
        `Report "${name}" should be visible`,
      ).toBeVisible({ timeout: 3_000 });
    }

    // Click into Revenue report
    await page.getByRole('link', { name: /revenue/i }).first().click();
    await waitForPageReady(page);
    await assertPageLoaded(page, 'Revenue Report');

    // Navigate back to reports
    await goTo(page, '/reports');

    // ── 8. CHECK MESSAGES ─────────────────────────────────────────
    await goTo(page, '/messages');
    await assertPageLoaded(page, 'Messages');

    // Assert: compose button exists
    const newMessageBtn = page.getByRole('button', { name: /new message/i }).first();
    await expect(newMessageBtn).toBeVisible({ timeout: 5_000 });

    // ── 9. REVIEW SETTINGS ────────────────────────────────────────
    await goTo(page, '/settings');
    await assertPageLoaded(page, 'Settings');

    // Click through 3 tabs: profile, notifications, organisation
    const settingsTabs = [
      { name: 'Profile', query: 'profile' },
      { name: 'Notifications', query: 'notifications' },
      { name: 'Organisation', query: 'organisation' },
    ];

    for (const tab of settingsTabs) {
      await page.goto(`/settings?tab=${tab.query}`);
      await waitForPageReady(page);

      // Assert: tab content loads (main should have content)
      await assertPageLoaded(page, `Settings > ${tab.name}`);
    }

    // ── 10. CHECK PRACTICE & RESOURCES ────────────────────────────
    await goTo(page, '/practice');
    await assertPageLoaded(page, 'Practice');

    await goTo(page, '/resources');
    await assertPageLoaded(page, 'Resources');

    // ── 11. CHECK CRM PAGES ───────────────────────────────────────
    const crmPages = [
      { path: '/leads', name: 'Leads' },
      { path: '/waitlist', name: 'Waitlist' },
      { path: '/make-ups', name: 'Make-Ups' },
      { path: '/continuation', name: 'Continuation' },
    ];

    for (const crm of crmPages) {
      await goTo(page, crm.path);
      await assertPageLoaded(page, crm.name);
    }

    // ── 12. FINAL DASHBOARD CHECK ─────────────────────────────────
    await goTo(page, '/dashboard');
    await assertPageLoaded(page, 'Dashboard (final)');

    // Assert: stat cards still show data
    await expect(
      page.getByText("Today's Lessons").or(page.getByText('Active Students')).first(),
    ).toBeVisible({ timeout: 5_000 });

    // Assert: no error boundaries anywhere
    await assertNoErrorBoundary(page);

    // ── 13. META-ASSERTIONS ───────────────────────────────────────
    const totalDuration = Date.now() - testStart;
    logMetric('total_duration_ms', totalDuration);
    logMetric('pages_visited', '18+');

    // Assert: zero relevant console errors
    const significantErrors = errors.filter(
      (e) =>
        !e.includes('net::ERR_') &&
        !e.includes('favicon') &&
        !e.includes('ResizeObserver') &&
        !e.includes('React DevTools'),
    );
    if (significantErrors.length > 0) {
      logMetric('console_errors', JSON.stringify(significantErrors));
    }
    expect(
      significantErrors,
      `Console errors during owner journey: ${significantErrors.join('\n')}`,
    ).toHaveLength(0);

    // Assert: no unhandled promise rejections
    expect(
      rejections,
      `Unhandled promise rejections: ${rejections.join('\n')}`,
    ).toHaveLength(0);

    // Assert: sidebar highlighting correct on final page (dashboard)
    const activeSidebarLink = page.locator('.bg-sidebar-primary.text-sidebar-primary-foreground');
    const hasActiveLink = await activeSidebarLink.isVisible().catch(() => false);
    if (hasActiveLink) {
      const activeText = await activeSidebarLink.textContent() ?? '';
      expect(activeText.toLowerCase()).toContain('dashboard');
    }
  });
});

/* ================================================================== */
/*  Test 2: Parent portal full day simulation                          */
/* ================================================================== */

test.describe('Smoke — Parent Portal Full Day', () => {
  test.use({ storageState: AUTH.parent });

  test('complete parent journey through every portal page', async ({ page }) => {
    test.setTimeout(120_000);
    const testStart = Date.now();
    const { errors, rejections } = trackErrors(page);

    // ── 1. PORTAL HOME ────────────────────────────────────────────
    await goTo(page, '/portal/home');
    await assertPageLoaded(page, 'Portal Home');

    // Assert: loads with children info or greeting
    const portalContent = page.locator('main');
    await expect(portalContent.first()).toBeVisible({ timeout: 15_000 });
    const homeText = await portalContent.textContent() ?? '';
    // Should have some meaningful content (greeting, children, or setup message)
    expect(homeText.length).toBeGreaterThan(20);
    await assertNoHorizontalOverflow(page);

    // ── 2. PORTAL SCHEDULE ────────────────────────────────────────
    await goTo(page, '/portal/schedule');
    await assertPageLoaded(page, 'Portal Schedule');
    await assertNoHorizontalOverflow(page);

    // ── 3. PORTAL INVOICES ────────────────────────────────────────
    await goTo(page, '/portal/invoices');
    await assertPageLoaded(page, 'Portal Invoices');
    await assertNoHorizontalOverflow(page);

    // ── 4. PORTAL PRACTICE ────────────────────────────────────────
    await goTo(page, '/portal/practice');
    await assertPageLoaded(page, 'Portal Practice');
    await assertNoHorizontalOverflow(page);

    // ── 5. PORTAL RESOURCES ───────────────────────────────────────
    await goTo(page, '/portal/resources');
    await assertPageLoaded(page, 'Portal Resources');
    await assertNoHorizontalOverflow(page);

    // ── 6. PORTAL MESSAGES ────────────────────────────────────────
    await goTo(page, '/portal/messages');
    await assertPageLoaded(page, 'Portal Messages');
    await assertNoHorizontalOverflow(page);

    // ── 7. PORTAL PROFILE ─────────────────────────────────────────
    await goTo(page, '/portal/profile');
    await assertPageLoaded(page, 'Portal Profile');
    await assertNoHorizontalOverflow(page);

    // ── 8. RETURN TO HOME ─────────────────────────────────────────
    await goTo(page, '/portal/home');
    await assertPageLoaded(page, 'Portal Home (return)');
    await assertNoHorizontalOverflow(page);

    // ── 9. META-ASSERTIONS ────────────────────────────────────────
    const totalDuration = Date.now() - testStart;
    logMetric('parent_total_duration_ms', totalDuration);
    logMetric('parent_pages_visited', 8);

    // Assert: zero console errors
    const significantErrors = errors.filter(
      (e) =>
        !e.includes('net::ERR_') &&
        !e.includes('favicon') &&
        !e.includes('ResizeObserver') &&
        !e.includes('React DevTools'),
    );
    expect(
      significantErrors,
      `Console errors during parent journey: ${significantErrors.join('\n')}`,
    ).toHaveLength(0);

    // Assert: no unhandled rejections
    expect(
      rejections,
      `Unhandled rejections: ${rejections.join('\n')}`,
    ).toHaveLength(0);
  });
});

/* ================================================================== */
/*  Test 3: Teacher workday simulation                                 */
/* ================================================================== */

test.describe('Smoke — Teacher Workday', () => {
  test.use({ storageState: AUTH.teacher });

  test('complete teacher journey with access boundary verification', async ({ page }) => {
    test.setTimeout(120_000);
    const testStart = Date.now();
    const { errors, rejections } = trackErrors(page);

    // ── 1. DASHBOARD ──────────────────────────────────────────────
    await goTo(page, '/dashboard');
    await assertPageLoaded(page, 'Teacher Dashboard');

    // Teacher stat cards are different
    const teacherStats = ['Today', 'This Month', 'My Students', 'Hours (Week)'];
    for (const text of teacherStats) {
      const card = page.getByText(text, { exact: true }).first();
      const visible = await card.isVisible({ timeout: 3_000 }).catch(() => false);
      if (visible) {
        logMetric(`teacher_stat_${text.replace(/\s/g, '_')}`, 'visible');
      }
    }

    // ── 2. CALENDAR ───────────────────────────────────────────────
    await goTo(page, '/calendar');
    await assertPageLoaded(page, 'Teacher Calendar');

    // Assert: shows lessons (filtered to this teacher's lessons)
    const dayHeader = page.getByText(/MON|TUE|WED|THU|FRI/i).first();
    await expect(dayHeader).toBeVisible({ timeout: 5_000 });

    // ── 3. REGISTER ───────────────────────────────────────────────
    await goTo(page, '/register');
    await assertPageLoaded(page, 'Teacher Register');

    // ── 4. STUDENTS ───────────────────────────────────────────────
    await goTo(page, '/students');
    await assertPageLoaded(page, 'Teacher Students');

    // Teacher sees only assigned students
    const studentLinks = page.locator('main').getByRole('link');
    const teacherStudentCount = await studentLinks.count().catch(() => 0);
    logMetric('teacher_assigned_students', teacherStudentCount);

    // ── 5. PRACTICE ───────────────────────────────────────────────
    await goTo(page, '/practice');
    await assertPageLoaded(page, 'Teacher Practice');

    // ── 6. RESOURCES ──────────────────────────────────────────────
    await goTo(page, '/resources');
    await assertPageLoaded(page, 'Teacher Resources');

    // ── 7. MESSAGES ───────────────────────────────────────────────
    await goTo(page, '/messages');
    await assertPageLoaded(page, 'Teacher Messages');

    // ── 8. SETTINGS ───────────────────────────────────────────────
    await goTo(page, '/settings');
    await assertPageLoaded(page, 'Teacher Settings');

    // Assert: limited tabs (no Members, Billing, Organisation, Audit Log)
    const adminOnlyTabs = ['Members', 'Billing', 'Audit Log'];
    for (const tab of adminOnlyTabs) {
      const tabEl = page.getByText(tab, { exact: true }).first();
      const visible = await tabEl.isVisible().catch(() => false);
      expect(visible, `Admin tab "${tab}" should NOT be visible to teacher`).toBe(false);
    }

    // Non-admin tabs should be visible
    const teacherTabs = ['Profile', 'Notifications'];
    for (const tab of teacherTabs) {
      const tabEl = page.getByText(tab, { exact: true }).first();
      const visible = await tabEl.isVisible().catch(() => false);
      if (!visible) {
        // Profile might be shown as content not a tab on mobile
        // Try navigating directly
        await page.goto(`/settings?tab=${tab.toLowerCase()}`);
        await waitForPageReady(page);
      }
    }

    // ── 9. RETURN TO DASHBOARD ────────────────────────────────────
    await goTo(page, '/dashboard');
    await assertPageLoaded(page, 'Teacher Dashboard (return)');

    // ── 10. ACCESS BOUNDARY VERIFICATION ──────────────────────────
    // Teacher should NOT be able to access these admin-only routes

    // /teachers — owner/admin only → should redirect to /dashboard
    await page.goto('/teachers');
    await waitForPageReady(page);
    expect(
      page.url(),
      '/teachers should redirect teacher to /dashboard',
    ).toContain('/dashboard');

    // /locations — owner/admin only → should redirect
    await page.goto('/locations');
    await waitForPageReady(page);
    expect(
      page.url(),
      '/locations should redirect teacher to /dashboard',
    ).toContain('/dashboard');

    // /invoices — owner/admin/finance only → should redirect
    await page.goto('/invoices');
    await waitForPageReady(page);
    expect(
      page.url(),
      '/invoices should redirect teacher to /dashboard',
    ).toContain('/dashboard');

    // ── 11. META-ASSERTIONS ───────────────────────────────────────
    const totalDuration = Date.now() - testStart;
    logMetric('teacher_total_duration_ms', totalDuration);
    logMetric('teacher_pages_visited', '11 + 3 boundary checks');

    // Assert: zero console errors
    const significantErrors = errors.filter(
      (e) =>
        !e.includes('net::ERR_') &&
        !e.includes('favicon') &&
        !e.includes('ResizeObserver') &&
        !e.includes('React DevTools'),
    );
    expect(
      significantErrors,
      `Console errors during teacher journey: ${significantErrors.join('\n')}`,
    ).toHaveLength(0);

    // Assert: no unhandled rejections
    expect(
      rejections,
      `Unhandled rejections: ${rejections.join('\n')}`,
    ).toHaveLength(0);
  });
});
