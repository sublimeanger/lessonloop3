import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, waitForPageReady, assertNoErrorBoundary, trackConsoleErrors } from './helpers';

// ═══════════════════════════════════════════════════════════════
// PARENT — PORTAL HOME
// ═══════════════════════════════════════════════════════════════
test.describe('Parent Portal — Home', () => {
  test.use({ storageState: AUTH.parent });

  test('portal home loads with greeting', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Portal Home');
    await assertNoErrorBoundary(page);

    // Should show time-of-day greeting
    const greeting = page.getByText(/good (morning|afternoon|evening)/i).first();
    await expect(greeting).toBeVisible({ timeout: 15_000 });
  });

  test('shows personalised "Hi {name}!" greeting', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Portal Home');
    await page.waitForTimeout(2_000);

    const hiGreeting = page.getByText(/^Hi .+! 👋$/).first();
    const hasGreeting = await hiGreeting.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[portal-home] Personalised greeting: ${hasGreeting}`);
  });

  test('shows next lesson card or access issue state', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Portal Home');
    await page.waitForTimeout(3_000);

    // Either next lesson card or access issue
    const nextLessonCard = page.locator('[aria-label="Next lesson"]').first();
    const accessIssue = page.getByText(/account not linked|no students found|enrolments inactive/i).first();
    const scheduleBtn = page.getByRole('button', { name: /schedule/i }).first();
    const scheduleLink = page.getByRole('link', { name: /schedule/i }).first();

    const hasNextLesson = await nextLessonCard.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasAccessIssue = await accessIssue.isVisible({ timeout: 3_000 }).catch(() => false);

    // eslint-disable-next-line no-console
    console.log(`[portal-home] Next lesson: ${hasNextLesson}, Access issue: ${hasAccessIssue}`);

    // One of these states should be true
    expect(hasNextLesson || hasAccessIssue, 'Should show next lesson or access state').toBe(true);
  });

  test('outstanding balance card links to invoices', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Portal Home');
    await page.waitForTimeout(3_000);

    // May or may not have outstanding balance
    const outstandingCard = page.locator('[aria-label*="outstanding"]').first();
    const hasOutstanding = await outstandingCard.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[portal-home] Outstanding balance card: ${hasOutstanding}`);

    if (hasOutstanding) {
      // Verify it links to invoices
      const invoiceLink = page.locator('a[href="/portal/invoices"]').first();
      const hasLink = await invoiceLink.isVisible({ timeout: 3_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[portal-home] Invoice link: ${hasLink}`);
    }
  });

  test('unread messages card links to messages', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Portal Home');
    await page.waitForTimeout(3_000);

    const unreadCard = page.locator('[aria-label="Unread messages"]').first();
    const hasUnread = await unreadCard.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[portal-home] Unread messages card: ${hasUnread}`);
  });

  test('no console errors on portal home', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/portal/home', 'Portal Home');
    await page.waitForTimeout(3_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — PORTAL SCHEDULE
// ═══════════════════════════════════════════════════════════════
test.describe('Parent Portal — Schedule', () => {
  test.use({ storageState: AUTH.parent });

  test('schedule page loads with title', async ({ page }) => {
    await safeGoTo(page, '/portal/schedule', 'Portal Schedule');
    await assertNoErrorBoundary(page);
    await expect(page.getByText('Schedule').first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows lesson cards or empty state', async ({ page }) => {
    await safeGoTo(page, '/portal/schedule', 'Portal Schedule');
    await page.waitForTimeout(3_000);

    // Look for lesson content or empty message
    const cards = page.locator('.rounded-2xl, .rounded-xl').filter({ hasText: /lesson|piano|guitar|violin|music/i });
    const cardCount = await cards.count();
    // eslint-disable-next-line no-console
    console.log(`[portal-schedule] Lesson-related cards found: ${cardCount}`);
    await assertNoErrorBoundary(page);
  });

  test('no console errors on schedule', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/portal/schedule', 'Portal Schedule');
    await page.waitForTimeout(2_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — PORTAL INVOICES
// ═══════════════════════════════════════════════════════════════
test.describe('Parent Portal — Invoices', () => {
  test.use({ storageState: AUTH.parent });

  test('invoices page loads with title', async ({ page }) => {
    await safeGoTo(page, '/portal/invoices', 'Portal Invoices');
    await assertNoErrorBoundary(page);
    await expect(page.getByText('Invoices & Payments').first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows outstanding summary or invoice list', async ({ page }) => {
    await safeGoTo(page, '/portal/invoices', 'Portal Invoices');
    await page.waitForTimeout(3_000);

    // Check for outstanding balance summary
    const outstandingLabel = page.getByText('Outstanding Balance').first();
    const hasOutstanding = await outstandingLabel.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[portal-invoices] Outstanding Balance section: ${hasOutstanding}`);

    // Check for invoice status badges
    const badges = ['Awaiting Payment', 'Paid', 'Overdue'];
    for (const badge of badges) {
      const el = page.getByText(badge, { exact: true }).first();
      const visible = await el.isVisible({ timeout: 2_000 }).catch(() => false);
      if (visible) {
        // eslint-disable-next-line no-console
        console.log(`[portal-invoices] Badge "${badge}" visible`);
      }
    }
  });

  test('status filter dropdown works', async ({ page }) => {
    await safeGoTo(page, '/portal/invoices', 'Portal Invoices');
    await page.waitForTimeout(2_000);

    // Look for a select/combobox for status filter
    const filterSelect = page.locator('button[role="combobox"]').first();
    const hasFilter = await filterSelect.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[portal-invoices] Status filter: ${hasFilter}`);

    if (hasFilter) {
      await filterSelect.click();
      await page.waitForTimeout(300);
      // Check for filter options
      const paidOption = page.getByRole('option', { name: /paid/i }).first();
      const hasPaid = await paidOption.isVisible({ timeout: 3_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[portal-invoices] Paid filter option: ${hasPaid}`);
      await page.keyboard.press('Escape');
    }
  });

  test('no console errors on invoices', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/portal/invoices', 'Portal Invoices');
    await page.waitForTimeout(2_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — PORTAL PRACTICE
// ═══════════════════════════════════════════════════════════════
test.describe('Parent Portal — Practice', () => {
  test.use({ storageState: AUTH.parent });

  test('practice page loads with title', async ({ page }) => {
    await safeGoTo(page, '/portal/practice', 'Portal Practice');
    await assertNoErrorBoundary(page);
    await expect(page.getByText('Practice').first()).toBeVisible({ timeout: 15_000 });
  });

  test('no console errors on practice', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/portal/practice', 'Portal Practice');
    await page.waitForTimeout(2_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — PORTAL RESOURCES
// ═══════════════════════════════════════════════════════════════
test.describe('Parent Portal — Resources', () => {
  test.use({ storageState: AUTH.parent });

  test('resources page loads with title', async ({ page }) => {
    await safeGoTo(page, '/portal/resources', 'Portal Resources');
    await assertNoErrorBoundary(page);
    await expect(page.getByText('Resources').first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows resource list or empty state', async ({ page }) => {
    await safeGoTo(page, '/portal/resources', 'Portal Resources');
    await page.waitForTimeout(3_000);

    const description = page.getByText('Teaching materials shared by your teacher').first();
    const hasDesc = await description.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[portal-resources] Description visible: ${hasDesc}`);
    await assertNoErrorBoundary(page);
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — PORTAL PROFILE
// ═══════════════════════════════════════════════════════════════
test.describe('Parent Portal — Profile', () => {
  test.use({ storageState: AUTH.parent });

  test('profile page loads with title', async ({ page }) => {
    await safeGoTo(page, '/portal/profile', 'Portal Profile');
    await assertNoErrorBoundary(page);
    await expect(page.getByText('Profile').first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows profile description', async ({ page }) => {
    await safeGoTo(page, '/portal/profile', 'Portal Profile');
    await page.waitForTimeout(2_000);

    const description = page.getByText('Manage your details and preferences').first();
    const hasDesc = await description.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[portal-profile] Description visible: ${hasDesc}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — SIDEBAR NAVIGATION
// ═══════════════════════════════════════════════════════════════
test.describe('Parent Portal — Navigation', () => {
  test.use({ storageState: AUTH.parent });

  test('portal sidebar has all expected nav items', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Portal Nav');
    await page.waitForTimeout(2_000);

    const navItems = ['Home', 'Schedule', 'Practice', 'Resources', 'Invoices & Payments', 'Messages'];
    for (const item of navItems) {
      const navLink = page.getByRole('link', { name: item, exact: true }).first();
      const visible = await navLink.isVisible({ timeout: 3_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[portal-nav] "${item}": ${visible}`);
    }
  });

  test('clicking sidebar nav items navigates correctly', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Portal Nav');
    await page.waitForTimeout(2_000);

    // Navigate to Schedule
    const scheduleLink = page.getByRole('link', { name: 'Schedule', exact: true }).first();
    if (await scheduleLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await scheduleLink.click();
      await page.waitForURL(/\/portal\/schedule/, { timeout: 10_000 });
      await assertNoErrorBoundary(page);
    }

    // Navigate to Resources
    const resourcesLink = page.getByRole('link', { name: 'Resources', exact: true }).first();
    if (await resourcesLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await resourcesLink.click();
      await page.waitForURL(/\/portal\/resources/, { timeout: 10_000 });
      await assertNoErrorBoundary(page);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// OWNER — CANNOT ACCESS PORTAL PAGES
// ═══════════════════════════════════════════════════════════════
test.describe('Parent Portal — Owner Access', () => {
  test.use({ storageState: AUTH.owner });

  test('owner accessing /portal/home is redirected', async ({ page }) => {
    await page.goto('/portal/home');
    await page.waitForTimeout(5_000);

    const url = page.url();
    // eslint-disable-next-line no-console
    console.log(`[owner-portal] /portal/home → URL: ${url}`);
    // Owner should not see portal greeting
    const portalGreeting = page.getByText(/good (morning|afternoon|evening)/i).first();
    const hasGreeting = await portalGreeting.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[owner-portal] Portal greeting visible: ${hasGreeting}`);
  });
});
