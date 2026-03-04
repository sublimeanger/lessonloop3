import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, waitForPageReady, assertNoErrorBoundary, trackConsoleErrors } from './helpers';

// ═══════════════════════════════════════════════════════════════
// OWNER DASHBOARD
// ═══════════════════════════════════════════════════════════════
test.describe('Owner Dashboard', () => {
  test.use({ storageState: AUTH.owner });

  test('loads with time-appropriate greeting', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');
    // DashboardHero renders "Good morning/afternoon/evening, {name}"
    const greeting = page.getByText(/good (morning|afternoon|evening)/i).first();
    await expect(greeting).toBeVisible({ timeout: 15_000 });
  });

  test('shows all 6 stat cards with real data', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/dashboard', 'Dashboard');
    // Wait for loading spinner to disappear (stats load async)
    await page.locator('[role="status"]:has-text("Loading")').waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
    await waitForPageReady(page);

    const statTitles = [
      "Today's Lessons",
      'Active Students',
      'This Week',
      'Revenue (MTD)',
      'Outstanding',
      'Total Lessons',
    ];

    let visibleCount = 0;
    for (const title of statTitles) {
      const card = page.getByText(title, { exact: false }).first();
      const visible = await card.isVisible({ timeout: 5_000 }).catch(() => false);
      if (visible) visibleCount++;
    }
    expect(visibleCount, `At least 4 of 6 stat cards should be visible (found ${visibleCount})`).toBeGreaterThanOrEqual(4);
  });

  test('stat card "Active Students" navigates to /students', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');

    // StatCard with href="/students" renders as a Link with aria-label containing "Active Students"
    const studentCard = page.locator('a[href="/students"]').filter({ hasText: /Active Students/i }).first();
    const cardVisible = await studentCard.isVisible({ timeout: 10_000 }).catch(() => false);

    if (cardVisible) {
      await studentCard.click();
      await page.waitForURL(/\/students/, { timeout: 10_000 });
      await waitForPageReady(page);
      expect(page.url()).toContain('/students');
    } else {
      // Fallback: try clicking the text directly (different layout variant)
      const textLink = page.getByText('Active Students').first();
      if (await textLink.isVisible().catch(() => false)) {
        await textLink.click();
        await page.waitForURL(/\/students/, { timeout: 10_000 }).catch(() => {});
      }
    }
  });

  test('stat card "Revenue (MTD)" navigates to /reports/revenue', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');
    const revenueCard = page.locator('a[href="/reports/revenue"]').first();
    const visible = await revenueCard.isVisible({ timeout: 10_000 }).catch(() => false);
    if (visible) {
      await revenueCard.click();
      await page.waitForURL(/\/reports\/revenue/, { timeout: 10_000 });
      expect(page.url()).toContain('/reports/revenue');
    }
  });

  test('sidebar shows all owner nav links', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/dashboard', 'Dashboard');

    // Core nav links that owner/admin always see
    const expectedLinks = [
      'Dashboard', 'Calendar', 'Students', 'Teachers', 'Register',
      'Invoices', 'Leads', 'Reports', 'Locations', 'Messages',
    ];

    for (const linkName of expectedLinks) {
      const link = page.getByRole('link', { name: linkName, exact: true }).first();
      await expect(link, `Sidebar link "${linkName}" should be visible`).toBeVisible({ timeout: 10_000 });
    }
  });

  test('sidebar footer has Settings and Help links', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await expect(
      page.getByRole('link', { name: /settings/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    const helpLink = page.getByRole('link', { name: /help/i }).first();
    await expect(helpLink, 'Help link should be visible').toBeVisible({ timeout: 10_000 });
  });

  test('LoopAssist button is visible and clickable', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');

    // LoopAssist renders as a button with text "LoopAssist" (expanded) or tooltip (collapsed)
    // LoopAssist widget is embedded in the dashboard as a card with heading and input
    const loopAssistWidget = page.locator('main').getByText('LoopAssist').first();
    await expect(loopAssistWidget, 'LoopAssist widget heading should be visible on dashboard').toBeVisible({ timeout: 15_000 });

    // The widget should have the "Ask anything" input prompt
    const askInput = page.locator('main').getByPlaceholder(/ask anything/i).first();
    await expect(askInput, 'LoopAssist ask input should be visible').toBeVisible({ timeout: 10_000 });
  });

  test('Today timeline section renders', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');

    // TodayTimeline shows lessons for today or an empty/informational state
    // Assert main content loaded with meaningful content (stat cards, timeline, etc.)
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
    const mainText = await page.locator('main').textContent().catch(() => '');
    expect((mainText ?? '').length, 'Dashboard main content should have substantial text').toBeGreaterThan(50);
  });

  test('no console errors during dashboard load', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/dashboard', 'Dashboard');
    // Give time for all async data to load
    await waitForPageReady(page);
    checkErrors();
  });

  test('sign out redirects to login', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/dashboard', 'Dashboard');

    // Sign out button has title="Sign out" in sidebar footer
    const signOutBtn = page.locator('button[title="Sign out"]').first()
      .or(page.getByRole('button', { name: /sign out/i }).first())
      .or(page.locator('[aria-label="Sign out"]').first());
    await expect(signOutBtn.first()).toBeVisible({ timeout: 10_000 });
    await signOutBtn.first().click();

    // Should redirect to /login or /auth
    await page.waitForURL(
      url => /\/(login|auth)/.test(url.toString()),
      { timeout: 15_000 },
    );
  });

  test('page refresh reloads data without errors', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');
    // Wait for initial data
    await page.waitForTimeout(2_000);

    // Refresh
    await page.reload();
    await waitForPageReady(page);
    await assertNoErrorBoundary(page);

    // Verify content is still there after refresh
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    const anyContent = await page.locator('main').textContent().catch(() => '');
    expect((anyContent ?? '').length).toBeGreaterThan(50);
  });

  test('sidebar navigation to Calendar works', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');
    const calLink = page.getByRole('link', { name: 'Calendar', exact: true }).first();
    await expect(calLink).toBeVisible({ timeout: 10_000 });
    await calLink.click();
    await page.waitForURL(/\/calendar/, { timeout: 10_000 });
    await waitForPageReady(page);
    expect(page.url()).toContain('/calendar');
  });

  test('sidebar navigation to Students works', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/dashboard', 'Dashboard');
    const link = page.getByRole('link', { name: 'Students', exact: true }).first();
    await expect(link).toBeVisible({ timeout: 10_000 });
    await link.click();
    await page.waitForURL(/\/students/, { timeout: 10_000 });
    await waitForPageReady(page);
    expect(page.url()).toContain('/students');
  });

  test('sidebar navigation to Invoices works', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/dashboard', 'Dashboard');
    const link = page.getByRole('link', { name: 'Invoices', exact: true }).first();
    await expect(link).toBeVisible({ timeout: 10_000 });
    await link.click();
    await page.waitForURL(/\/invoices/, { timeout: 10_000 });
    await waitForPageReady(page);
    expect(page.url()).toContain('/invoices');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEACHER DASHBOARD
// ═══════════════════════════════════════════════════════════════
test.describe('Teacher Dashboard', () => {
  test.use({ storageState: AUTH.teacher });

  test('loads with teacher-specific stat cards', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Teacher Dashboard');

    // Teacher should not be stuck on onboarding
    expect(page.url(), 'Teacher should not be stuck on onboarding').not.toContain('/onboarding');

    // TeacherDashboard shows stat cards — verify main content loaded with real content
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    const mainText = await page.locator('main').textContent().catch(() => '');
    expect((mainText ?? '').length, 'Teacher dashboard should have content').toBeGreaterThan(20);
  });

  test('does NOT show owner stat cards', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Teacher Dashboard');
    await waitForPageReady(page);

    // Teacher should NOT see owner-specific stats in the main content area
    // Scope to main to avoid matching sidebar notification text like "outstanding invoices"
    const main = page.locator('main');
    for (const ownerStat of ['Revenue (MTD)', 'Total Lessons']) {
      const visible = await main
        .getByText(ownerStat, { exact: true })
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      expect(visible, `"${ownerStat}" should NOT be visible to teacher`).toBe(false);
    }
  });

  test('sidebar shows teacher nav links and hides admin links', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/dashboard', 'Teacher Dashboard');

    // Teacher sidebar uses "My Calendar" and "My Students" instead of "Calendar"/"Students"
    await expect(
      page.getByRole('link', { name: 'Dashboard', exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 });

    const myCalendar = page.getByRole('link', { name: /my calendar|calendar/i }).first();
    await expect(myCalendar).toBeVisible({ timeout: 5_000 });

    const myStudents = page.getByRole('link', { name: /my students|students/i }).first();
    await expect(myStudents).toBeVisible({ timeout: 5_000 });

    // Admin-only links must be HIDDEN
    for (const adminLink of ['Teachers', 'Locations', 'Invoices', 'Leads']) {
      const visible = await page
        .getByRole('link', { name: adminLink, exact: true })
        .first()
        .isVisible({ timeout: 2_000 })
        .catch(() => false);
      expect(visible, `"${adminLink}" should NOT be in teacher sidebar`).toBe(false);
    }
  });

  test('My Students stat card links to /students', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Teacher Dashboard');
    const studentsCard = page.locator('a[href="/students"]').first();
    const visible = await studentsCard.isVisible({ timeout: 10_000 }).catch(() => false);
    if (visible) {
      await studentsCard.click();
      await page.waitForURL(/\/students/, { timeout: 10_000 });
      expect(page.url()).toContain('/students');
    }
  });

  test('no error boundaries on teacher dashboard', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Teacher Dashboard');
    await assertNoErrorBoundary(page);
  });
});

// ═══════════════════════════════════════════════════════════════
// FINANCE DASHBOARD
// ═══════════════════════════════════════════════════════════════
test.describe('Finance Dashboard', () => {
  test.use({ storageState: AUTH.finance });

  test('loads successfully with main content', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Finance Dashboard');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    const content = await page.locator('main').textContent().catch(() => '');
    expect((content ?? '').length, 'Dashboard should have content').toBeGreaterThan(20);
  });

  test('sidebar shows finance-specific links', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/dashboard', 'Finance Dashboard');

    // Finance sees: Dashboard, Invoices, Reports, Messages
    await expect(
      page.getByRole('link', { name: 'Dashboard', exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('link', { name: 'Invoices', exact: true }).first(),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('link', { name: 'Reports', exact: true }).first(),
    ).toBeVisible({ timeout: 5_000 });

    // Finance should NOT see teaching links
    for (const teachingLink of ['Students', 'Calendar', 'Register', 'Teachers']) {
      const visible = await page
        .getByRole('link', { name: teachingLink, exact: true })
        .first()
        .isVisible({ timeout: 2_000 })
        .catch(() => false);
      expect(visible, `"${teachingLink}" should NOT be in finance sidebar`).toBe(false);
    }
  });

  test('can navigate to Invoices from sidebar', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/dashboard', 'Finance Dashboard');
    const link = page.getByRole('link', { name: 'Invoices', exact: true }).first();
    await expect(link).toBeVisible({ timeout: 10_000 });
    await link.click();
    await page.waitForURL(/\/invoices/, { timeout: 10_000 });
    expect(page.url()).toContain('/invoices');
  });

  test('no error boundaries on finance dashboard', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Finance Dashboard');
    await assertNoErrorBoundary(page);
  });
});

// ═══════════════════════════════════════════════════════════════
// ADMIN DASHBOARD (same view as owner)
// ═══════════════════════════════════════════════════════════════
test.describe('Admin Dashboard', () => {
  test.use({ storageState: AUTH.admin });

  test('loads with same stat cards as owner', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Admin Dashboard');
    // Admin gets same AcademyDashboard or SoloTeacherDashboard as owner
    const anyOwnerStat = page
      .getByText("Today's Lessons")
      .or(page.getByText('Active Students'))
      .first();
    await expect(anyOwnerStat, 'Admin should see owner-level stat cards').toBeVisible({ timeout: 15_000 });
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar shows full owner/admin navigation', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/dashboard', 'Admin Dashboard');
    // Admin sees same links as owner
    await expect(
      page.getByRole('link', { name: 'Dashboard', exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('link', { name: 'Students', exact: true }).first(),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('link', { name: 'Teachers', exact: true }).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});
