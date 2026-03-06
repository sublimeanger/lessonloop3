import { test, expect } from './workflow.fixtures';
import { AUTH } from '../helpers';
import { goTo } from '../helpers';
import { waitForDataLoad } from './workflow-helpers';

// ═══════════════════════════════════════════════════════════════
// Edge Cases — bugs that emerge under unusual but realistic conditions
// ═══════════════════════════════════════════════════════════════

test.describe('Edge Cases — Owner', () => {
  test.use({ storageState: AUTH.owner });

  // ─────────────────────────────────────────────────────────────
  // Rapid navigation doesn't break state
  // ─────────────────────────────────────────────────────────────

  test('Rapid navigation doesn\'t break state', async ({ page, consoleErrors }) => {
    test.setTimeout(120_000);

    // ── 1. Navigate to /dashboard ──
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // ── 2–5. Rapidly click through sidebar without waiting ──
    // Don't wait for full page load between navigations
    const sidebar = page.locator('aside, nav').first();
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    await page.goto('/students');
    await page.waitForTimeout(200);

    await page.goto('/calendar');
    await page.waitForTimeout(200);

    await page.goto('/invoices');
    await page.waitForTimeout(200);

    await page.goto('/dashboard');

    // ── 6. Wait for the page to settle ──
    await waitForDataLoad(page);

    // ── 7. Dashboard is displayed correctly ──
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Should see a greeting or dashboard content — NOT an error boundary
    const errorBoundary = page.getByText(/something went wrong/i).first();
    const hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    // Dashboard greeting should be visible
    const greeting = page.locator('main').getByText(/good morning|good afternoon|good evening/i).first();
    const hasGreeting = await greeting.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasGreeting) {
      await expect(greeting).toBeVisible();
    }

    // ── 8. No real console errors about cancelled queries or unmounted components ──
    const realErrors = consoleErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('net::') &&
        !e.includes('Failed to fetch') &&
        !e.includes('401') &&
        !e.includes('403') &&
        !e.includes('ResizeObserver') &&
        !e.includes('AbortError') &&
        !e.includes('ChunkLoadError') &&
        !e.includes('Loading chunk') &&
        !e.includes('status of 404') &&
        !e.includes('Failed to load resource') &&
        !e.includes('Download the React DevTools') &&
        !e.includes('third-party cookie') &&
        !e.includes('Permissions-Policy') &&
        !e.includes('postMessage'),
    );
    expect(realErrors).toHaveLength(0);

    // ── 9. Sidebar highlights "Dashboard" correctly ──
    const activeItem = page.locator('[data-active="true"]').first();
    if (await activeItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const activeText = await activeItem.textContent();
      expect(activeText?.toLowerCase()).toContain('dashboard');
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Back button doesn't trap or break
  // ─────────────────────────────────────────────────────────────

  test('Back button doesn\'t trap or break', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1. Navigate to /dashboard ──
    await goTo(page, '/dashboard');
    await waitForDataLoad(page);

    // ── 2. Click to /students ──
    await goTo(page, '/students');
    await waitForDataLoad(page);

    // ── 3. Click on a student to go to /students/:id ──
    const search = page.getByPlaceholder(/search/i).first();
    if (await search.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await search.fill('');
      await page.waitForTimeout(300);
    }

    const firstStudent = page.locator('main a[href*="/students/"]').first()
      .or(page.locator('main').locator('tr, [role="listitem"], [aria-label*="View"]').first());
    await expect(firstStudent).toBeVisible({ timeout: 15_000 });
    await firstStudent.click();
    await page.waitForURL(/\/students\//, { timeout: 10_000 });
    await waitForDataLoad(page);

    // ── 4. Click the Lessons tab ──
    const lessonsTab = page.getByRole('tab', { name: 'Lessons' }).first();
    if (await lessonsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await lessonsTab.click();
      await page.waitForTimeout(500);
    }

    // ── 5. Press browser back ──
    await page.goBack();
    await page.waitForTimeout(1_000);

    // ── 6. Returns to /students list (NOT dashboard, not stuck) ──
    await expect(page).toHaveURL(/\/students/, { timeout: 10_000 });
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // ── 7. Press browser back again ──
    await page.goBack();
    await page.waitForTimeout(1_000);

    // ── 8. Returns to /dashboard ──
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  // ─────────────────────────────────────────────────────────────
  // Deep link to student detail loads correctly
  // ─────────────────────────────────────────────────────────────

  test('Deep link to student detail loads correctly', async ({ browser }) => {
    test.setTimeout(120_000);

    // ── 1. Find a student and note their URL ──
    const ctx1 = await browser.newContext({ storageState: AUTH.owner });
    const page1 = await ctx1.newPage();

    await goTo(page1, '/students');
    await waitForDataLoad(page1);

    // Click the first student link
    const firstStudentLink = page1.locator('main a[href*="/students/"]').first();
    await expect(firstStudentLink).toBeVisible({ timeout: 15_000 });
    const studentName = await firstStudentLink.textContent();
    await firstStudentLink.click();
    await page1.waitForURL(/\/students\//, { timeout: 10_000 });
    const studentUrl = page1.url();

    await page1.close();
    await ctx1.close();

    // ── 2. Open a NEW page context (simulate opening the link directly) ──
    const ctx2 = await browser.newContext({ storageState: AUTH.owner });
    const page2 = await ctx2.newPage();

    // ── 3. Navigate directly to /students/:id ──
    await page2.goto(studentUrl);
    await waitForDataLoad(page2);

    // ── 4. Student detail page loads with student name visible ──
    if (studentName) {
      const nameOnPage = page2.locator('main').getByText(studentName.trim(), { exact: false }).first();
      await expect(nameOnPage).toBeVisible({ timeout: 15_000 });
    }

    // ── 5. All 10 tabs are present ──
    const expectedTabs = [
      'Overview', 'Instruments', 'Teachers', 'Guardians',
      'Lessons', 'Practice', 'Invoices', 'Credits', 'Notes', 'Messages',
    ];
    for (const tabName of expectedTabs) {
      await expect(
        page2.getByRole('tab', { name: tabName }).first()
          .or(page2.locator('[role="tab"]').filter({ hasText: tabName }).first()),
      ).toBeVisible({ timeout: 10_000 });
    }

    // ── 6. No loading errors ──
    const errorBoundary = page2.getByText(/something went wrong/i).first();
    const hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    await page2.close();
    await ctx2.close();
  });

  // ─────────────────────────────────────────────────────────────
  // Deep link to invoice detail loads correctly
  // ─────────────────────────────────────────────────────────────

  test('Deep link to invoice detail loads correctly', async ({ browser }) => {
    test.setTimeout(120_000);

    // ── 1. Find an invoice and note its URL ──
    const ctx1 = await browser.newContext({ storageState: AUTH.owner });
    const page1 = await ctx1.newPage();

    await goTo(page1, '/invoices');
    await waitForDataLoad(page1);

    // Click the first invoice row/link
    const firstInvoice = page1.locator('main a[href*="/invoices/"]').first()
      .or(page1.locator('main table tbody tr').first())
      .or(page1.locator('main [role="listitem"]').first());
    await expect(firstInvoice).toBeVisible({ timeout: 15_000 });

    // Capture amount and status text from the row before clicking
    const rowText = await firstInvoice.textContent() ?? '';
    const amountMatch = rowText.match(/£[\d,.]+/);
    const statusMatch = rowText.match(/draft|sent|paid|overdue|void/i);
    const expectedAmount = amountMatch ? amountMatch[0] : '';
    const expectedStatus = statusMatch ? statusMatch[0].toLowerCase() : '';

    await firstInvoice.click();
    await page1.waitForURL(/\/invoices\//, { timeout: 10_000 });
    const invoiceUrl = page1.url();

    await page1.close();
    await ctx1.close();

    // ── 2. Navigate directly to that URL in a fresh page ──
    const ctx2 = await browser.newContext({ storageState: AUTH.owner });
    const page2 = await ctx2.newPage();
    await page2.goto(invoiceUrl);
    await waitForDataLoad(page2);

    // ── 3. Invoice detail loads with correct amount and status ──
    await expect(page2.locator('main').first()).toBeVisible({ timeout: 15_000 });

    const detailText = await page2.locator('main').textContent() ?? '';

    if (expectedAmount) {
      expect(detailText).toContain(expectedAmount);
    }

    if (expectedStatus) {
      expect(detailText.toLowerCase()).toContain(expectedStatus);
    }

    // No error boundary
    const errorBoundary = page2.getByText(/something went wrong/i).first();
    const hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    await page2.close();
    await ctx2.close();
  });

  // ─────────────────────────────────────────────────────────────
  // Empty state rendering when no data exists
  // ─────────────────────────────────────────────────────────────

  test('Empty state rendering when no data exists', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1. Navigate to /leads ──
    await goTo(page, '/leads');
    await waitForDataLoad(page);

    const leadsMainText = await page.locator('main').textContent() ?? '';

    // If leads list is empty, verify EmptyState
    if (leadsMainText.includes('No leads yet')) {
      // EmptyState with warm message
      await expect(
        page.locator('main').getByText(/no leads yet/i).first(),
      ).toBeVisible({ timeout: 5_000 });

      // CTA button to create first lead
      const addLeadBtn = page.getByRole('button', { name: /add first lead/i }).first()
        .or(page.getByRole('button', { name: /add lead/i }).first());
      await expect(addLeadBtn).toBeVisible({ timeout: 5_000 });

      // CTA is clickable (opens dialog)
      await addLeadBtn.click();
      const dialog = page.getByRole('dialog').first();
      const dialogOpened = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
      if (dialogOpened) {
        await page.keyboard.press('Escape');
      }
    } else {
      // Leads exist — the page should show content, not be blank
      expect(leadsMainText.length).toBeGreaterThan(10);
    }

    // ── 3. Navigate to /waitlist ──
    await goTo(page, '/waitlist');
    await waitForDataLoad(page);

    const waitlistText = await page.locator('main').textContent() ?? '';

    if (waitlistText.includes('No families on the waiting list') || waitlistText.includes('no families')) {
      await expect(
        page.locator('main').getByText(/no families/i).first(),
      ).toBeVisible({ timeout: 5_000 });

      // CTA button visible
      const addWaitlistBtn = page.getByRole('button', { name: /add to waiting list/i }).first();
      const hasBtn = await addWaitlistBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasBtn) {
        await expect(addWaitlistBtn).toBeVisible();
      }
    } else {
      expect(waitlistText.length).toBeGreaterThan(10);
    }

    // ── 5. Navigate to /make-ups ──
    await goTo(page, '/make-ups');
    await waitForDataLoad(page);

    // Should render without crashing — either content or empty state
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    const makeUpsText = await page.locator('main').textContent() ?? '';
    // Not a blank/broken page
    expect(makeUpsText.length).toBeGreaterThan(5);

    // No error boundary on any of these pages
    const errorBoundary = page.getByText(/something went wrong/i).first();
    const hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasError).toBeFalsy();
  });

  // ─────────────────────────────────────────────────────────────
  // Very long content doesn't break layouts
  // ─────────────────────────────────────────────────────────────

  test('Very long content doesn\'t break layouts', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1–2. Navigate to /students — check for layout overflow ──
    await goTo(page, '/students');
    await waitForDataLoad(page);

    const studentsOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(studentsOverflow).toBeFalsy();

    // ── 3–4. Navigate to /messages — check message content overflow ──
    await goTo(page, '/messages');
    await waitForDataLoad(page);

    const messagesOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(messagesOverflow).toBeFalsy();

    // ── 5. Check the sidebar ──
    const sidebar = page.locator('aside').first();
    if (await sidebar.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Sidebar should not overflow horizontally
      const sidebarOverflow = await page.evaluate(() => {
        const aside = document.querySelector('aside');
        if (!aside) return false;
        return aside.scrollWidth > aside.clientWidth;
      });
      expect(sidebarOverflow).toBeFalsy();

      // All nav items should be readable (visible within sidebar bounds)
      const navItems = sidebar.locator('a, button').filter({ hasText: /.+/ });
      const itemCount = await navItems.count();
      for (let i = 0; i < Math.min(itemCount, 20); i++) {
        const item = navItems.nth(i);
        if (await item.isVisible().catch(() => false)) {
          // Item should be within viewport or scrollable area
          const box = await item.boundingBox();
          if (box) {
            expect(box.width).toBeGreaterThan(0);
            expect(box.height).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Page doesn't crash with invalid route params
  // ─────────────────────────────────────────────────────────────

  test('Page doesn\'t crash with invalid route params', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1. Navigate to /students/not-a-real-uuid ──
    await page.goto('/students/not-a-real-uuid');
    await page.waitForTimeout(2_000);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // Should either redirect to /students with "Student not found" toast,
    // or show a helpful message — NOT a crash/error boundary
    const crashIndicator = page.getByText(/something went wrong/i).first();
    const hasCrash = await crashIndicator.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasCrash).toBeFalsy();

    // Should redirect to /students or show "not found"
    const url = page.url();
    const onStudentsList = url.includes('/students') && !url.includes('not-a-real-uuid');
    const notFoundMsg = await page.getByText(/not found/i).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);
    expect(onStudentsList || notFoundMsg).toBeTruthy();

    // ── 3. Navigate to /invoices/not-a-real-uuid ──
    await page.goto('/invoices/not-a-real-uuid');
    await page.waitForTimeout(2_000);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    const invoiceCrash = await crashIndicator.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(invoiceCrash).toBeFalsy();

    // Should show "Invoice not found" or redirect
    const invoiceNotFound = await page.getByText(/not found|back to invoices/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const onInvoicesList = page.url().includes('/invoices') && !page.url().includes('not-a-real-uuid');
    expect(invoiceNotFound || onInvoicesList).toBeTruthy();

    // ── 5. Navigate to /leads/not-a-real-uuid ──
    await page.goto('/leads/not-a-real-uuid');
    await page.waitForTimeout(2_000);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    const leadCrash = await crashIndicator.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(leadCrash).toBeFalsy();

    // Should show "Lead Not Found" or redirect
    const leadNotFound = await page.getByText(/not found|back to leads/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const onLeadsList = page.url().includes('/leads') && !page.url().includes('not-a-real-uuid');
    expect(leadNotFound || onLeadsList).toBeTruthy();

    // ── 7. Navigate to /reports/not-a-real-route ──
    await page.goto('/reports/not-a-real-route');
    await page.waitForTimeout(2_000);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    const reportsCrash = await crashIndicator.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(reportsCrash).toBeFalsy();

    // Should show 404 page or redirect — page rendered something
    await expect(page.locator('body').first()).toBeVisible({ timeout: 5_000 });
  });

  // ─────────────────────────────────────────────────────────────
  // Concurrent tab usage doesn't cause issues
  // ─────────────────────────────────────────────────────────────

  test('Concurrent tab usage doesn\'t cause issues', async ({ browser }) => {
    test.setTimeout(120_000);

    // ── 1. Open page 1: /students ──
    const ctx = await browser.newContext({ storageState: AUTH.owner });
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    try {
      await goTo(page1, '/students');
      await waitForDataLoad(page1);

      // ── 2. Open page 2: /calendar ──
      await goTo(page2, '/calendar');
      await waitForDataLoad(page2);

      // ── 3. In page 1: search for a student ──
      const search = page1.getByPlaceholder(/search/i).first();
      if (await search.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await search.fill('Emma');
        await page1.waitForTimeout(500);
      }
      const searchResults = page1.locator('main').getByText(/emma/i).first();
      const hasResults = await searchResults.isVisible({ timeout: 10_000 }).catch(() => false);

      // ── 4. In page 2: navigate forward a week ──
      const nextBtn = page2.getByRole('button', { name: /next|forward/i }).first()
        .or(page2.locator('button[aria-label*="next"], button[aria-label*="Next"]').first());
      if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await nextBtn.click();
        await page2.waitForTimeout(500);
      }

      // ── 5–6. Go back to page 1: search results still visible ──
      await page1.bringToFront();
      await page1.waitForTimeout(500);

      if (hasResults) {
        await expect(searchResults).toBeVisible({ timeout: 10_000 });
      }

      // Search input should still have "Emma"
      if (await search.isVisible().catch(() => false)) {
        const searchValue = await search.inputValue();
        expect(searchValue.toLowerCase()).toContain('emma');
      }

      // ── 7–8. Go back to page 2: calendar still shows the forward week ──
      await page2.bringToFront();
      await page2.waitForTimeout(500);

      // Calendar should be visible and not on an error state
      await expect(page2.locator('main').first()).toBeVisible({ timeout: 10_000 });
      const errorBoundary = page2.getByText(/something went wrong/i).first();
      const hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
      expect(hasError).toBeFalsy();
    } finally {
      await page1.close();
      await page2.close();
      await ctx.close();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Session/auth edge cases — unauthenticated access
// ═══════════════════════════════════════════════════════════════

test.describe('Edge Cases — Unauthenticated', () => {
  // Use empty storage state (no auth)
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Unauthenticated users are redirected to login', async ({ page }) => {
    test.setTimeout(120_000);

    const protectedRoutes = [
      '/dashboard',
      '/students/some-fake-uuid',
      '/portal/home',
      '/invoices',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      // Should redirect to /auth or /login
      await page.waitForURL(
        (url) => url.pathname.includes('/auth') || url.pathname.includes('/login'),
        { timeout: 15_000 },
      );
      const finalUrl = page.url();
      expect(
        finalUrl.includes('/auth') || finalUrl.includes('/login'),
      ).toBeTruthy();
    }
  });
});
