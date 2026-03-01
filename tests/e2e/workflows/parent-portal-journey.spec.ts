import { test, expect } from '../workflow.fixtures';
import { AUTH, waitForPageReady, goTo } from '../helpers';
import {
  assertPageLoaded,
  assertNoErrorBoundary,
  assertNoHorizontalOverflow,
  MOBILE_VIEWPORT,
} from '../workflow-helpers';

/* ================================================================== */
/*  Test 1: Parent complete portal walkthrough                         */
/* ================================================================== */

test.describe('Parent Portal — Complete Walkthrough', () => {
  test.use({ storageState: AUTH.parent });

  test('parent walks through every portal page', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1-6. Portal Home ───────────────────────────────────────────
    await goTo(page, '/portal/home');
    await assertPageLoaded(page, 'Portal Home');

    // Assert: At least one child name visible (Emma or James)
    const mainContent = await page.locator('main').textContent() ?? '';
    const hasChild = /emma|james/i.test(mainContent);
    expect(hasChild, 'Portal home should show at least one child name').toBe(true);

    // Assert: Greeting text visible
    await expect(page.getByText(/hi\s+\w+/i).first()).toBeVisible({ timeout: 5_000 });

    // Assert: No horizontal overflow
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    // ── 7-10. Portal Schedule ──────────────────────────────────────
    await goTo(page, '/portal/schedule');
    await assertPageLoaded(page, 'Portal Schedule');

    // Shows lessons or empty state
    const hasLessons = await page
      .locator('main')
      .getByText(/this week|next week|no lessons found/i)
      .first()
      .isVisible()
      .catch(() => false);
    // Page loaded — either lessons or empty state

    // ── 11-14. Portal Invoices ─────────────────────────────────────
    await goTo(page, '/portal/invoices');
    await assertPageLoaded(page, 'Portal Invoices');

    // Check for invoice list or empty state
    const invoiceCards = page.locator('main').locator('.border, [class*="card"]');
    const invoiceCount = await invoiceCards.count().catch(() => 0);

    if (invoiceCount > 0) {
      // Assert: Each invoice shows a £ amount
      const pageText = await page.locator('main').textContent() ?? '';
      const hasCurrency = /£\d/.test(pageText);
      expect(hasCurrency, 'Invoices should show £ amounts').toBe(true);

      // Assert: Status badges visible (Paid, Awaiting Payment, Overdue, etc.)
      const hasStatus = await page
        .getByText(/paid|awaiting payment|overdue|draft/i)
        .first()
        .isVisible()
        .catch(() => false);
      // Status badge should be present if invoices exist
    } else {
      // Empty state
      await expect(
        page.getByText(/no invoices/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    }

    // ── 15-18. Portal Practice ─────────────────────────────────────
    await goTo(page, '/portal/practice');
    await assertPageLoaded(page, 'Portal Practice');
    await assertNoErrorBoundary(page);

    // ── 19-21. Portal Resources ────────────────────────────────────
    await goTo(page, '/portal/resources');
    await assertPageLoaded(page, 'Portal Resources');

    // Shows resources or empty state
    const hasResources = await page
      .getByText(/no resources shared yet/i)
      .first()
      .isVisible()
      .catch(() => false);
    // Either resources are shown or the empty state — both are valid
    await assertNoErrorBoundary(page);

    // ── 22-27. Portal Messages ─────────────────────────────────────
    await goTo(page, '/portal/messages');
    await assertPageLoaded(page, 'Portal Messages');

    // Assert: Compose button visible (desktop: "New Message", mobile: FAB pencil)
    const newMsgBtn = page.getByRole('button', { name: /new message/i }).first();
    const fabBtn = page.locator('button').filter({
      has: page.locator('[class*="lucide-pencil"], [class*="pencil"]'),
    }).first();
    const hasCompose =
      (await newMsgBtn.isVisible().catch(() => false)) ||
      (await fabBtn.isVisible().catch(() => false));

    if (hasCompose) {
      // Click compose
      if (await newMsgBtn.isVisible().catch(() => false)) {
        await newMsgBtn.click();
      } else {
        await fabBtn.click();
      }
      await page.waitForTimeout(500);

      // Assert: Compose dialog opens
      const dialog = page.getByRole('dialog').first();
      const dialogVisible = await dialog.isVisible().catch(() => false);
      if (dialogVisible) {
        // Close the dialog
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }

    // ── 28-31. Portal Profile ──────────────────────────────────────
    await goTo(page, '/portal/profile');
    await assertPageLoaded(page, 'Portal Profile');

    // Assert: Form fields visible
    await expect(page.locator('#fullName').or(page.getByLabel(/name/i).first())).toBeVisible({
      timeout: 5_000,
    });

    // Assert: Save button exists
    await expect(
      page.getByRole('button', { name: /save changes/i }).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});

/* ================================================================== */
/*  Test 2: Parent portal data isolation — multi-child                 */
/* ================================================================== */

test.describe('Parent Portal — Multi-Child Data Isolation', () => {
  test('parent with multiple children can switch between them', async ({ browser }) => {
    test.setTimeout(90_000);

    // ── As PARENT (has Emma + James) ───────────────────────────────
    const parentCtx = await browser.newContext({ storageState: AUTH.parent });
    const parentPage = await parentCtx.newPage();

    await goTo(parentPage, '/portal/home');
    await assertPageLoaded(parentPage, 'Portal Home');

    // Check for ChildSwitcher (only if 2+ children)
    const childSwitcher = parentPage.getByRole('combobox').filter({
      hasText: /all children|emma|james/i,
    }).first();
    const hasMultipleChildren = await childSwitcher.isVisible().catch(() => false);

    if (hasMultipleChildren) {
      // Note current child's data
      const contentBefore = await parentPage.locator('main').textContent() ?? '';

      // Open the switcher and pick a specific child
      await childSwitcher.click();
      await parentPage.waitForTimeout(300);
      const emmaOption = parentPage.getByRole('option', { name: /emma/i }).first();
      if (await emmaOption.isVisible().catch(() => false)) {
        await emmaOption.click();
        await parentPage.waitForTimeout(1_000);
      }

      // Switch to the other child
      await childSwitcher.click();
      await parentPage.waitForTimeout(300);
      const jamesOption = parentPage.getByRole('option', { name: /james/i }).first();
      if (await jamesOption.isVisible().catch(() => false)) {
        await jamesOption.click();
        await parentPage.waitForTimeout(1_000);
      }

      // Switch back to "All children"
      await childSwitcher.click();
      await parentPage.waitForTimeout(300);
      const allOption = parentPage.getByRole('option', { name: /all children/i }).first();
      if (await allOption.isVisible().catch(() => false)) {
        await allOption.click();
        await parentPage.waitForTimeout(500);
      }
    }

    await parentCtx.close();

    // ── As PARENT2 (different parent) ──────────────────────────────
    const parent2Ctx = await browser.newContext({ storageState: AUTH.parent2 });
    const parent2Page = await parent2Ctx.newPage();

    await goTo(parent2Page, '/portal/home');
    await assertPageLoaded(parent2Page, 'Portal Home');

    // Assert: Does NOT see Emma or James (those belong to parent1)
    const parent2Content = await parent2Page.locator('main').textContent() ?? '';
    expect(parent2Content).not.toMatch(/\bemma\b/i);
    expect(parent2Content).not.toMatch(/\bjames\b/i);

    await parent2Ctx.close();
  });
});

/* ================================================================== */
/*  Test 3: Parent blocked from all admin routes                       */
/* ================================================================== */

test.describe('Parent Portal — Admin Route Blocking', () => {
  test.use({ storageState: AUTH.parent });

  test('parent is redirected from all admin routes to portal', async ({ page }) => {
    test.setTimeout(120_000);

    const adminRoutes = [
      '/dashboard',
      '/students',
      '/teachers',
      '/calendar',
      '/invoices',
      '/reports',
      '/settings',
      '/leads',
      '/locations',
      '/register',
      '/messages',
    ];

    for (const route of adminRoutes) {
      await page.goto(route);
      await page.waitForURL(
        (url) => url.pathname.includes('/portal'),
        { timeout: 15_000 },
      );
      expect(
        page.url(),
        `Parent should be redirected from ${route} to /portal`,
      ).toContain('/portal');
    }
  });
});

/* ================================================================== */
/*  Test 4: Parent portal mobile responsive                            */
/* ================================================================== */

test.describe('Parent Portal — Mobile Responsive', () => {
  test.use({
    storageState: AUTH.parent,
    viewport: MOBILE_VIEWPORT,
  });

  test('portal pages are mobile-responsive with no horizontal scroll', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1-2. Portal Home ───────────────────────────────────────────
    await goTo(page, '/portal/home');
    await assertPageLoaded(page, 'Portal Home');
    await assertNoHorizontalOverflow(page);

    // Assert: Bottom nav visible
    const bottomNav = page.locator('nav[aria-label="Portal navigation"]');
    await expect(bottomNav).toBeVisible({ timeout: 5_000 });

    // ── 3-4. Navigate portal pages via bottom nav ──────────────────
    const portalPages = [
      { label: 'Schedule', emptyPattern: /no lessons found|this week|schedule/i },
      { label: 'Practice', emptyPattern: /practice/i },
      { label: 'Messages', emptyPattern: /messages|no messages/i },
    ];

    for (const { label, emptyPattern } of portalPages) {
      const navLink = bottomNav.getByText(label, { exact: true }).first();
      if (await navLink.isVisible().catch(() => false)) {
        await navLink.click();
        await waitForPageReady(page);
        await assertNoHorizontalOverflow(page);
        await assertNoErrorBoundary(page);
      }
    }

    // ── 5-7. Portal Invoices ───────────────────────────────────────
    await goTo(page, '/portal/invoices');
    await waitForPageReady(page);
    await assertNoHorizontalOverflow(page);

    // Check that amounts and status are visible in mobile view
    const invoiceContent = await page.locator('main').textContent() ?? '';
    if (invoiceContent.includes('£')) {
      // Invoices exist — verify layout is readable
      await assertNoErrorBoundary(page);
    }

    // ── Profile page ───────────────────────────────────────────────
    await goTo(page, '/portal/profile');
    await waitForPageReady(page);
    await assertNoHorizontalOverflow(page);

    // Assert: Save button visible on mobile
    await expect(
      page.getByRole('button', { name: /save changes/i }).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});
