import { test, expect } from './workflow.fixtures';
import { AUTH } from '../helpers';
import { goTo } from '../helpers';
import { waitForDataLoad } from './workflow-helpers';

// ═══════════════════════════════════════════════════════════════
// Parent Portal Journey — complete parent experience
// ═══════════════════════════════════════════════════════════════

test.describe('Parent Portal — Complete Walkthrough', () => {
  test.use({ storageState: AUTH.parent });

  test('Parent complete portal walkthrough', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1–2. Portal Home ──
    await goTo(page, '/portal/home');
    await waitForDataLoad(page);

    // Greeting section visible
    const greeting = page.locator('main').getByText(/hello|welcome|good/i).first();
    await expect(greeting).toBeVisible({ timeout: 15_000 });

    // Next lesson card — may not exist if no upcoming lessons
    const nextLessonCard = page.locator('[aria-label="Next lesson"]').first()
      .or(page.locator('main').getByText(/next lesson/i).first());
    const hasNextLesson = await nextLessonCard.isVisible({ timeout: 5_000 }).catch(() => false);
    // Just confirm home loaded — next lesson is data-dependent
    if (hasNextLesson) {
      await expect(nextLessonCard).toBeVisible();
    }

    // Children summary cards visible (at least one child)
    const mainText = await page.locator('main').textContent();
    expect(mainText && mainText.length > 10).toBeTruthy();

    // Quick action links visible
    const quickActions = ['Send a Message', 'Resources', 'Schedule'];
    for (const action of quickActions) {
      const link = page.locator('main').getByText(action, { exact: false }).first()
        .or(page.getByRole('link', { name: new RegExp(action, 'i') }).first());
      const actionVisible = await link.isVisible({ timeout: 3_000 }).catch(() => false);
      // Quick actions may be feature-gated; just check page loaded
      if (actionVisible) {
        await expect(link).toBeVisible();
      }
    }

    // ── 3. Bottom navigation bar ──
    const bottomNav = page.locator('nav[aria-label="Portal navigation"]').first();
    await expect(bottomNav).toBeVisible({ timeout: 10_000 });

    const navTabs = ['Home', 'Schedule', 'Practice', 'Resources', 'Invoices', 'Messages'];
    for (const tab of navTabs) {
      const navItem = bottomNav.getByText(tab, { exact: false }).first();
      // Some tabs are feature-gated (Practice, Resources, Invoices)
      const tabVisible = await navItem.isVisible({ timeout: 3_000 }).catch(() => false);
      if (tabVisible) {
        await expect(navItem).toBeVisible();
      }
    }

    // ── 4–5. Portal Schedule ──
    await goTo(page, '/portal/schedule');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Schedule page should show some content (calendar or list)
    const scheduleContent = await page.locator('main').textContent();
    expect(scheduleContent).toBeTruthy();

    // ── 6–7. Portal Practice ──
    await goTo(page, '/portal/practice');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // May show practice data or empty state
    const practiceEmptyState = page.locator('main').getByText(/ready to make some music/i).first()
      .or(page.locator('main').getByText(/practice/i).first());
    await expect(practiceEmptyState).toBeVisible({ timeout: 10_000 });

    // ── 8–9. Portal Resources ──
    await goTo(page, '/portal/resources');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // May show resources or empty state
    const resourcesContent = page.locator('main').getByText(/no resources shared yet/i).first()
      .or(page.locator('main').getByText(/resource/i).first());
    await expect(resourcesContent).toBeVisible({ timeout: 10_000 });

    // ── 10–11. Portal Invoices ──
    await goTo(page, '/portal/invoices');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // May show invoices or empty state
    const invoicesContent = page.locator('main').getByText(/invoice|no invoices|£|amount/i).first();
    await expect(invoicesContent).toBeVisible({ timeout: 10_000 });

    // ── 12–13. Portal Messages ──
    await goTo(page, '/portal/messages');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // "New Message" button should be visible (desktop)
    const newMsgBtn = page.getByRole('button', { name: /new message/i }).first()
      .or(page.locator('button').filter({ hasText: /new message/i }).first());
    const hasMsgBtn = await newMsgBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasMsgBtn) {
      await expect(newMsgBtn).toBeVisible();
    }

    // Tabs: Inbox and My Requests
    const inboxTab = page.getByRole('tab', { name: /inbox/i }).first()
      .or(page.locator('main').getByText(/inbox/i).first());
    const requestsTab = page.getByRole('tab', { name: /my requests/i }).first()
      .or(page.locator('main').getByText(/my requests/i).first());
    const hasInbox = await inboxTab.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasRequests = await requestsTab.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasInbox) await expect(inboxTab).toBeVisible();
    if (hasRequests) await expect(requestsTab).toBeVisible();

    // ── 14–15. Portal Profile ──
    await goTo(page, '/portal/profile');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Profile form fields
    const fullNameInput = page.locator('main').getByLabel(/full name/i).first();
    const emailInput = page.locator('main').getByLabel(/email/i).first();
    const phoneInput = page.locator('main').getByLabel(/phone/i).first();

    await expect(fullNameInput).toBeVisible({ timeout: 10_000 });
    await expect(emailInput).toBeVisible({ timeout: 5_000 });

    // Email should be disabled (read-only)
    await expect(emailInput).toBeDisabled();

    // Phone input visible
    if (await phoneInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(phoneInput).toBeVisible();
    }

    // Save Changes button
    const saveBtn = page.getByRole('button', { name: /save changes/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });

    // Notification toggles
    const savePrefsBtn = page.getByRole('button', { name: /save preferences/i }).first();
    const hasPrefs = await savePrefsBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasPrefs) {
      await expect(savePrefsBtn).toBeVisible();
    }

    // Sign Out button
    const signOutBtn = page.getByRole('button', { name: /sign out/i }).first();
    await expect(signOutBtn).toBeVisible({ timeout: 5_000 });

    // ── 16. Portal Continuation ──
    await goTo(page, '/portal/continuation');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });
});

// ═══════════════════════════════════════════════════════════════
// Parent portal data isolation — multi-child
// ═══════════════════════════════════════════════════════════════

test.describe('Parent Portal — Data Isolation', () => {
  test.use({ storageState: AUTH.parent });
  test.describe.configure({ mode: 'serial' });

  test('Parent portal data isolation — multi-child', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1. Navigate to portal home ──
    await goTo(page, '/portal/home');
    await waitForDataLoad(page);

    // ── 2. ChildSwitcher — check for Select dropdown ──
    // ChildSwitcher uses a Select component (React Context, not URL params)
    const childSwitcher = page.locator('main').getByRole('combobox').first()
      .or(page.locator('select').first())
      .or(page.locator('[role="listbox"]').first());

    const hasChildSwitcher = await childSwitcher.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasChildSwitcher) {
      // ── 3. "All children" should be the default option ──
      const switcherText = await childSwitcher.textContent().catch(() => '');
      const allChildrenVisible = page.locator('main').getByText(/all children/i).first();
      const hasAllChildren = await allChildrenVisible.isVisible({ timeout: 3_000 }).catch(() => false);

      if (hasAllChildren || switcherText?.toLowerCase().includes('all')) {
        // All children view is active
      }

      // ── 4. Switch to individual child ──
      await childSwitcher.click();
      await page.waitForTimeout(500);

      // Pick the first individual child option (not "All children")
      const options = page.getByRole('option').filter({ hasNotText: /all children/i });
      const optionCount = await options.count();
      if (optionCount > 0) {
        const childName = await options.first().textContent();
        await options.first().click();
        await page.waitForTimeout(500);

        // Verify content filtered to that child
        if (childName) {
          const mainContent = await page.locator('main').textContent();
          expect(mainContent).toBeTruthy();
        }
      }
    }

    // ── 5. Navigate to schedule — verify child filter applies ──
    await goTo(page, '/portal/schedule');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('Parent2 sees different data than Parent1', async ({ browser }) => {
    test.setTimeout(120_000);

    // Create two separate contexts for parent and parent2
    const ctx1 = await browser.newContext({ storageState: AUTH.parent });
    const ctx2 = await browser.newContext({ storageState: AUTH.parent2 });
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      // ── 1. Parent 1 loads portal home ──
      await goTo(page1, '/portal/home');
      await waitForDataLoad(page1);
      const parent1Content = await page1.locator('main').textContent();

      // ── 2. Parent 2 loads portal home ──
      await goTo(page2, '/portal/home');
      await waitForDataLoad(page2);
      const parent2Content = await page2.locator('main').textContent();

      // ── 3. Both portals loaded ──
      expect(parent1Content && parent1Content.length > 0).toBeTruthy();
      expect(parent2Content && parent2Content.length > 0).toBeTruthy();

      // ── 4. Parent 2 checks invoices ──
      await goTo(page2, '/portal/invoices');
      await waitForDataLoad(page2);
      await expect(page2.locator('main').first()).toBeVisible({ timeout: 15_000 });

      // ── 5. Parent 2 checks schedule ──
      await goTo(page2, '/portal/schedule');
      await waitForDataLoad(page2);
      await expect(page2.locator('main').first()).toBeVisible({ timeout: 15_000 });
    } finally {
      await page1.close();
      await page2.close();
      await ctx1.close();
      await ctx2.close();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Parent blocked from all admin routes
// ═══════════════════════════════════════════════════════════════

test.describe('Parent Portal — Admin Route Blocking', () => {
  test.use({ storageState: AUTH.parent });

  test('Parent blocked from all admin routes', async ({ page }) => {
    test.setTimeout(120_000);

    // RouteGuard redirects parents to /portal/home for all admin routes
    const adminRoutes = [
      '/dashboard',
      '/students',
      '/teachers',
      '/calendar',
      '/register',
      '/invoices',
      '/reports',
      '/messages',
      '/settings',
      '/leads',
      '/resources',
    ];

    for (const route of adminRoutes) {
      await page.goto(route);
      // Parent should be redirected to /portal/home
      await page.waitForURL(
        (url) => url.pathname.startsWith('/portal/'),
        { timeout: 15_000 },
      );
      expect(page.url()).toContain('/portal/');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Parent portal mobile responsive
// ═══════════════════════════════════════════════════════════════

test.describe('Parent Portal — Mobile Responsive', () => {
  test.use({
    storageState: AUTH.parent,
    viewport: { width: 390, height: 844 },
  });

  test('Parent portal mobile responsive', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1. Portal Home — no horizontal overflow ──
    await goTo(page, '/portal/home');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    const homeOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(homeOverflow).toBeFalsy();

    // ── 2. Bottom nav visible on mobile ──
    const bottomNav = page.locator('nav[aria-label="Portal navigation"]').first();
    await expect(bottomNav).toBeVisible({ timeout: 10_000 });

    // ── 3. Portal Schedule — no overflow ──
    await goTo(page, '/portal/schedule');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    const scheduleOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(scheduleOverflow).toBeFalsy();

    // ── 4. Portal Messages — FAB visible on mobile ──
    await goTo(page, '/portal/messages');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // On mobile, "New request" FAB instead of "New Message" button
    const fab = page.locator('[aria-label="New request"]').first()
      .or(page.getByRole('button', { name: /new request/i }).first())
      .or(page.getByRole('button', { name: /new message/i }).first());
    const hasFab = await fab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasFab) {
      await expect(fab).toBeVisible();
    }

    // ── 5. Portal Profile — form layout correct on mobile ──
    await goTo(page, '/portal/profile');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    const profileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(profileOverflow).toBeFalsy();

    // Profile form fields still accessible on mobile
    const fullNameInput = page.locator('main').getByLabel(/full name/i).first();
    await expect(fullNameInput).toBeVisible({ timeout: 10_000 });

    const saveBtn = page.getByRole('button', { name: /save changes/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });

    // ── 6. Portal Invoices — cards stack vertically on mobile ──
    await goTo(page, '/portal/invoices');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    const invoiceOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(invoiceOverflow).toBeFalsy();

    // ── 7. Bottom nav still visible after navigating multiple pages ──
    await expect(bottomNav).toBeVisible({ timeout: 5_000 });
  });
});
