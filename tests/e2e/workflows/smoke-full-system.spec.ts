import { test, expect, Page } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from '../helpers';

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

/** Log a performance metric. */
function logMetric(name: string, value: number | string) {
  // eslint-disable-next-line no-console
  console.log(`[smoke] ${name}: ${value}`);
}

/** Assert no error boundary is shown on the current page. */
async function assertNoErrorBoundary(page: Page) {
  const fullError = await page.getByText('Something went wrong').isVisible().catch(() => false);
  expect(fullError, 'Full-page error boundary should not be visible').toBe(false);

  const sectionError = await page.getByText(/Failed to load/).first().isVisible().catch(() => false);
  expect(sectionError, 'Section error boundary should not be visible').toBe(false);
}

/**
 * Navigate to a page and wait for <main> to appear.
 * Retries the navigation once if main doesn't show up —
 * handles slow Supabase connections in CI.
 */
async function safeGoTo(page: Page, path: string, pageName: string) {
  await goTo(page, path);

  const mainVisible = await page
    .locator('main')
    .first()
    .isVisible({ timeout: 20_000 })
    .catch(() => false);

  if (!mainVisible) {
    // Retry once — CI can be slow on first navigation
    await page.reload();
    await waitForPageReady(page);
    await expect(
      page.locator('main').first(),
      `${pageName} should have <main> element after retry`,
    ).toBeVisible({ timeout: 20_000 });
  }

  await assertNoErrorBoundary(page);
}

/* ================================================================== */
/*  Test 1: Academy owner full day simulation                          */
/* ================================================================== */

test.describe('Smoke — Academy Owner Full Day', () => {
  test.use({ storageState: AUTH.owner });

  test('complete owner journey through every major system', async ({ page }) => {
    test.setTimeout(300_000); // 5 minutes — CI can be slow
    const testStart = Date.now();

    // ── 1. LOGIN & DASHBOARD ──────────────────────────────────────
    await safeGoTo(page, '/dashboard', 'Dashboard');

    // Greeting — nice to see but not worth failing over
    const greeting = page.getByText(/good (morning|afternoon|evening)/i).first();
    const greetingVisible = await greeting.isVisible({ timeout: 15_000 }).catch(() => false);
    logMetric('greeting_visible', String(greetingVisible));

    // Stat cards — check at least one loads
    const anyStatCard = page
      .getByText("Today's Lessons")
      .or(page.getByText('Active Students'))
      .first();
    await expect(anyStatCard).toBeVisible({ timeout: 15_000 });

    const activeStudentsCard = page.getByText('Active Students').first().locator('..');
    const activeStudentsText = await activeStudentsCard.textContent().catch(() => '');
    logMetric('active_students_card', activeStudentsText?.trim() ?? 'unknown');

    // ── 2. CHECK CALENDAR ─────────────────────────────────────────
    await safeGoTo(page, '/calendar', 'Calendar');

    const dayHeader = page.getByText(/MON|TUE|WED|THU|FRI/i).first();
    await expect(dayHeader).toBeVisible({ timeout: 10_000 });

    // Navigate forward and back
    const nextBtn = page.locator('[aria-label="Next"]').first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await waitForPageReady(page);
      const prevBtn = page.locator('[aria-label="Previous"]').first();
      if (await prevBtn.isVisible().catch(() => false)) {
        await prevBtn.click();
        await waitForPageReady(page);
      }
    }

    await assertNoErrorBoundary(page);

    // ── 3. REVIEW REGISTER ────────────────────────────────────────
    await safeGoTo(page, '/register', 'Register');

    // Just confirm the page loaded with some content
    const registerContent = await page.locator('main').textContent().catch(() => '');
    logMetric('register_loaded', registerContent && registerContent.length > 20 ? 'yes' : 'minimal');

    // ── 4. CHECK STUDENTS ─────────────────────────────────────────
    await safeGoTo(page, '/students', 'Students');

    // Wait for student data to load — may take time in CI
    const studentLinks = page.locator('main').getByRole('link');
    const hasStudents = await studentLinks.first().isVisible({ timeout: 15_000 }).catch(() => false);

    if (hasStudents) {
      const studentCount = await studentLinks.count();
      logMetric('student_count', studentCount);

      // Search for "Emma" — only if search input exists
      const searchInput = page.getByPlaceholder('Search students...');
      const hasSearch = await searchInput.isVisible({ timeout: 5_000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.fill('Emma');
        await page.waitForTimeout(500);

        const emmaLink = page.getByText(/emma/i).first();
        const emmaVisible = await emmaLink.isVisible().catch(() => false);

        if (emmaVisible) {
          await emmaLink.click();
          await page.waitForURL(/\/students\//, { timeout: 10_000 }).catch(() => {});
          await waitForPageReady(page);

          // Check tabs if we made it to the detail page
          if (page.url().includes('/students/')) {
            for (const tab of ['Overview', 'Lessons', 'Invoices', 'Guardians']) {
              const tabEl = page.getByRole('tab', { name: tab }).first();
              const tabVisible = await tabEl.isVisible({ timeout: 3_000 }).catch(() => false);
              logMetric(`student_tab_${tab}`, String(tabVisible));
            }
          }
        }

        // Navigate back
        await goTo(page, '/students');
      }
    } else {
      logMetric('student_count', 0);
    }

    // ── 5. REVIEW TEACHERS ────────────────────────────────────────
    await safeGoTo(page, '/teachers', 'Teachers');
    const teacherContent = await page.locator('main').textContent().catch(() => '');
    logMetric('teachers_page_loaded', teacherContent && teacherContent.length > 50 ? 'yes' : 'minimal');

    // ── 6. CHECK INVOICES ─────────────────────────────────────────
    await safeGoTo(page, '/invoices', 'Invoices');

    const hasStats = await page
      .locator('[data-tour="invoice-stats"]')
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const hasInvoiceList = await page
      .locator('[data-tour="invoice-list"]')
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    logMetric('invoice_page', hasStats ? 'stats' : hasInvoiceList ? 'list' : 'loaded');

    // ── 7. REVIEW REPORTS ─────────────────────────────────────────
    await safeGoTo(page, '/reports', 'Reports');

    const reportNames = [
      'Revenue',
      'Outstanding Payments',
      'Lessons Delivered',
      'Cancellation Rate',
      'Payroll',
      'Room Utilisation',
      'Teacher Performance',
    ];
    let reportsVisible = 0;
    for (const name of reportNames) {
      const visible = await page
        .getByText(name, { exact: false })
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (visible) reportsVisible++;
    }
    logMetric('reports_visible', `${reportsVisible}/${reportNames.length}`);
    expect(reportsVisible, 'At least some reports should be visible').toBeGreaterThan(0);

    // ── 8. CHECK MESSAGES ─────────────────────────────────────────
    await safeGoTo(page, '/messages', 'Messages');

    const newMessageBtn = page.getByRole('button', { name: /new message/i }).first();
    await expect(newMessageBtn).toBeVisible({ timeout: 10_000 });

    // ── 9. REVIEW SETTINGS ────────────────────────────────────────
    await safeGoTo(page, '/settings', 'Settings');

    for (const tab of ['profile', 'notifications', 'organisation']) {
      await page.goto(`/settings?tab=${tab}`);
      await waitForPageReady(page);
      const mainOk = await page
        .locator('main')
        .first()
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      logMetric(`settings_${tab}`, String(mainOk));
    }

    // ── 10. CHECK PRACTICE & RESOURCES ────────────────────────────
    await safeGoTo(page, '/practice', 'Practice');
    await safeGoTo(page, '/resources', 'Resources');

    // ── 11. CHECK CRM PAGES ───────────────────────────────────────
    for (const crm of [
      { path: '/leads', name: 'Leads' },
      { path: '/waitlist', name: 'Waitlist' },
      { path: '/make-ups', name: 'Make-Ups' },
      { path: '/continuation', name: 'Continuation' },
    ]) {
      await safeGoTo(page, crm.path, crm.name);
    }

    // ── 12. FINAL DASHBOARD CHECK ─────────────────────────────────
    await safeGoTo(page, '/dashboard', 'Dashboard (final)');
    await assertNoErrorBoundary(page);

    const totalDuration = Date.now() - testStart;
    logMetric('total_duration_ms', totalDuration);
    logMetric('pages_visited', '18+');
  });
});

/* ================================================================== */
/*  Test 2: Parent portal full day simulation                          */
/* ================================================================== */

test.describe('Smoke — Parent Portal Full Day', () => {
  test.use({ storageState: AUTH.parent });

  test('complete parent journey through every portal page', async ({ page }) => {
    test.setTimeout(300_000);
    const testStart = Date.now();

    // ── 1. PORTAL HOME ────────────────────────────────────────────
    await safeGoTo(page, '/portal/home', 'Portal Home');

    const homeText = await page.locator('main').textContent().catch(() => '');
    expect((homeText ?? '').length, 'Portal home should have content').toBeGreaterThan(20);

    // ── 2-7. ALL PORTAL PAGES ─────────────────────────────────────
    const portalPages = [
      { path: '/portal/schedule', name: 'Portal Schedule' },
      { path: '/portal/invoices', name: 'Portal Invoices' },
      { path: '/portal/practice', name: 'Portal Practice' },
      { path: '/portal/resources', name: 'Portal Resources' },
      { path: '/portal/messages', name: 'Portal Messages' },
      { path: '/portal/profile', name: 'Portal Profile' },
    ];

    for (const pg of portalPages) {
      await safeGoTo(page, pg.path, pg.name);
    }

    // ── 8. RETURN TO HOME ─────────────────────────────────────────
    await safeGoTo(page, '/portal/home', 'Portal Home (return)');

    const totalDuration = Date.now() - testStart;
    logMetric('parent_total_duration_ms', totalDuration);
    logMetric('parent_pages_visited', 8);
  });
});

/* ================================================================== */
/*  Test 3: Teacher workday simulation                                 */
/* ================================================================== */

test.describe('Smoke — Teacher Workday', () => {
  test.use({ storageState: AUTH.teacher });

  test('complete teacher journey with access boundary verification', async ({ page }) => {
    test.setTimeout(300_000);
    const testStart = Date.now();

    // ── 1. DASHBOARD ──────────────────────────────────────────────
    await safeGoTo(page, '/dashboard', 'Teacher Dashboard');

    for (const text of ['Today', 'This Month', 'My Students', 'Hours (Week)']) {
      const visible = await page
        .getByText(text, { exact: true })
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (visible) logMetric(`teacher_stat_${text.replace(/\s/g, '_')}`, 'visible');
    }

    // ── 2. CALENDAR ───────────────────────────────────────────────
    await safeGoTo(page, '/calendar', 'Teacher Calendar');

    const dayHeader = page.getByText(/MON|TUE|WED|THU|FRI/i).first();
    await expect(dayHeader).toBeVisible({ timeout: 10_000 });

    // ── 3-7. CORE PAGES ───────────────────────────────────────────
    await safeGoTo(page, '/register', 'Teacher Register');
    await safeGoTo(page, '/students', 'Teacher Students');

    const studentLinks = page.locator('main').getByRole('link');
    const teacherStudentCount = await studentLinks.count().catch(() => 0);
    logMetric('teacher_assigned_students', teacherStudentCount);

    await safeGoTo(page, '/practice', 'Teacher Practice');
    await safeGoTo(page, '/resources', 'Teacher Resources');
    await safeGoTo(page, '/messages', 'Teacher Messages');

    // ── 8. SETTINGS ───────────────────────────────────────────────
    await safeGoTo(page, '/settings', 'Teacher Settings');

    // Admin-only tabs should NOT be visible
    for (const tab of ['Members', 'Billing', 'Audit Log']) {
      const visible = await page.getByText(tab, { exact: true }).first().isVisible().catch(() => false);
      expect(visible, `Admin tab "${tab}" should NOT be visible to teacher`).toBe(false);
    }

    // ── 9. RETURN TO DASHBOARD ────────────────────────────────────
    await safeGoTo(page, '/dashboard', 'Teacher Dashboard (return)');

    // ── 10. ACCESS BOUNDARY VERIFICATION ──────────────────────────
    // Teacher should NOT stay on admin-only routes — they should be
    // redirected somewhere safe (dashboard OR onboarding)
    for (const adminRoute of ['/teachers', '/locations', '/invoices']) {
      await page.goto(adminRoute);
      await waitForPageReady(page);
      const url = page.url();
      const redirectedAway = !url.includes(adminRoute);
      expect(
        redirectedAway,
        `${adminRoute} should redirect teacher away (got: ${url})`,
      ).toBe(true);
    }

    const totalDuration = Date.now() - testStart;
    logMetric('teacher_total_duration_ms', totalDuration);
    logMetric('teacher_pages_visited', '11 + 3 boundary checks');
  });
});
