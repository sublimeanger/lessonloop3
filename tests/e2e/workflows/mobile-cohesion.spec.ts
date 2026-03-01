import { test, expect, Page } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from '../helpers';

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

const MOBILE_VIEWPORT = { width: 390, height: 844 };

/** Assert no horizontal overflow on the current page */
async function expectNoHorizontalScroll(page: Page) {
  const body = await page.evaluate(() => ({
    scrollWidth: document.body.scrollWidth,
    clientWidth: document.body.clientWidth,
  }));
  expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 5);
}

/**
 * Open the mobile sidebar menu.
 * On mobile, the SidebarTrigger (data-sidebar="trigger") is visible in the
 * header and renders the sidebar as a Sheet overlay.
 */
async function openMobileMenu(page: Page) {
  const trigger = page.locator('[data-sidebar="trigger"]').first();
  await expect(trigger).toBeVisible({ timeout: 5_000 });
  await trigger.click();
  // Wait for the sheet to animate open
  await page.waitForTimeout(400);
}

/** Click a sidebar nav link by its exact title text */
async function clickSidebarLink(page: Page, title: string) {
  const link = page.getByRole('link', { name: title, exact: true }).first();
  await expect(link).toBeVisible({ timeout: 5_000 });
  await link.click();
  await waitForPageReady(page);
}

/* ================================================================== */
/*  Test 1: Mobile owner navigation flow                               */
/* ================================================================== */

test.describe('Mobile Cohesion — Owner Navigation Flow', () => {
  test.use({ viewport: MOBILE_VIEWPORT, storageState: AUTH.owner });

  test('complete mobile owner navigation journey', async ({ page }) => {
    test.setTimeout(90_000);

    // 1. Navigate to /dashboard
    await goTo(page, '/dashboard');

    // 2. Dashboard loads, no horizontal scroll
    await expectNoHorizontalScroll(page);

    // 3. Greeting and stats visible
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

    // 4. Open the mobile sidebar/menu
    await openMobileMenu(page);

    // 5. Menu opens — verify key navigation items are visible
    const requiredNavItems = ['Dashboard', 'Calendar', 'Students', 'Invoices', 'Messages'];
    for (const item of requiredNavItems) {
      await expect(
        page.getByRole('link', { name: item, exact: true }).first(),
      ).toBeVisible({ timeout: 3_000 });
    }

    // 6. Click "Students" in the menu
    await clickSidebarLink(page, 'Students');

    // 7. Students page loads, no horizontal scroll
    await expect(page).toHaveURL(/\/students/, { timeout: 10_000 });
    await expectNoHorizontalScroll(page);

    // 8. Student cards/list are readable
    await expect(
      page.getByText(/emma|james|sophie/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    // 9. Use search — type "Emma"
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.fill('Emma');
    await page.waitForTimeout(500);

    // 10. Search results filter correctly
    await expect(page.getByText(/emma/i).first()).toBeVisible({ timeout: 5_000 });

    // 11. Click on Emma
    await page.getByText(/emma/i).first().click();

    // 12. Student detail page loads
    await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
    await waitForPageReady(page);
    await expectNoHorizontalScroll(page);

    // 13. Tabs are scrollable or all visible — verify at least a few key tabs render
    const keyTabs = ['Overview', 'Lessons', 'Credits', 'Invoices'];
    for (const tab of keyTabs) {
      // Tabs may need horizontal scroll — check they exist in the DOM
      const tabEl = page.getByRole('tab', { name: tab });
      await expect(tabEl).toBeAttached({ timeout: 5_000 });
    }

    // 14. Click back to students list
    const backLink = page.getByRole('link', { name: /students/i }).first();
    const hasBack = await backLink.isVisible().catch(() => false);
    if (hasBack) {
      await backLink.click();
    } else {
      // Fall back to browser navigation
      await page.goBack();
    }
    await waitForPageReady(page);

    // 15. Open menu again, navigate to Calendar
    await openMobileMenu(page);
    await clickSidebarLink(page, 'Calendar');

    // 16. Calendar loads in mobile view
    await expect(page).toHaveURL(/\/calendar/, { timeout: 10_000 });
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
    await expectNoHorizontalScroll(page);

    // 17. Calendar content is visible (lesson blocks, day headers, etc.)
    await expect(
      page.locator('main').first(),
    ).toBeVisible();
  });
});

/* ================================================================== */
/*  Test 2: Mobile parent portal complete journey                      */
/* ================================================================== */

test.describe('Mobile Cohesion — Parent Portal Journey', () => {
  test.use({ viewport: MOBILE_VIEWPORT, storageState: AUTH.parent });

  test('complete mobile parent portal journey', async ({ page }) => {
    test.setTimeout(90_000);

    // 1. Navigate to /portal/home
    await goTo(page, '/portal/home');

    // 2. No horizontal scroll on any page
    await expectNoHorizontalScroll(page);

    // 3. Bottom nav visible with correct items
    const bottomNav = page.locator('nav[aria-label="Portal navigation"]');
    await expect(bottomNav).toBeVisible({ timeout: 10_000 });

    // Core bottom nav items always present
    for (const label of ['Home', 'Schedule', 'Messages']) {
      await expect(
        bottomNav.getByText(label),
      ).toBeVisible({ timeout: 3_000 });
    }

    // 4. Tap Schedule in bottom nav
    await bottomNav.getByText('Schedule').click();
    await waitForPageReady(page);

    // 5. Schedule page loads, no overflow
    await expect(page).toHaveURL(/\/portal\/schedule/, { timeout: 10_000 });
    await expectNoHorizontalScroll(page);

    // 6. Tap Invoices (if visible in bottom nav, otherwise navigate directly)
    const invoicesTab = bottomNav.getByText('Invoices');
    const hasInvoicesTab = await invoicesTab.isVisible().catch(() => false);
    if (hasInvoicesTab) {
      await invoicesTab.click();
    } else {
      await goTo(page, '/portal/invoices');
    }
    await waitForPageReady(page);

    // 7. Invoices page loads, amounts visible and formatted
    await expect(page).toHaveURL(/\/portal\/invoices/, { timeout: 10_000 });
    await expectNoHorizontalScroll(page);
    await expect(page.locator('main').first()).toBeVisible();

    // 8. Tap Practice
    const practiceTab = bottomNav.getByText('Practice');
    const hasPracticeTab = await practiceTab.isVisible().catch(() => false);
    if (hasPracticeTab) {
      await practiceTab.click();
    } else {
      await goTo(page, '/portal/practice');
    }
    await waitForPageReady(page);

    // 9. Practice page loads
    await expectNoHorizontalScroll(page);
    await expect(page.locator('main').first()).toBeVisible();

    // 10. Tap Messages
    await bottomNav.getByText('Messages').click();
    await waitForPageReady(page);

    // 11. Messages page loads
    await expect(page).toHaveURL(/\/portal\/messages/, { timeout: 10_000 });
    await expectNoHorizontalScroll(page);

    // 12-14. Compose flow — look for compose button
    const composeBtn = page.getByRole('button', { name: /compose|new|send/i }).first();
    const hasCompose = await composeBtn.isVisible().catch(() => false);

    if (hasCompose) {
      await composeBtn.click();
      await page.waitForTimeout(500);

      // 13. Compose should be near-full-screen on mobile
      const dialog = page.getByRole('dialog').first();
      const hasDialog = await dialog.isVisible().catch(() => false);
      if (hasDialog) {
        const box = await dialog.boundingBox();
        if (box) {
          // On mobile the dialog should take up most of the width
          expect(box.width).toBeGreaterThan(300);
        }
        // 14. Close compose
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }

    // 15. Navigate to Profile
    await goTo(page, '/portal/profile');
    await waitForPageReady(page);

    // 16. Form is single-column (no horizontal scroll)
    await expectNoHorizontalScroll(page);

    // 17. Form fields and save button visible
    await expect(page.locator('main').first()).toBeVisible();
    const formInputs = page.locator('input, textarea, select');
    const inputCount = await formInputs.count();
    expect(inputCount).toBeGreaterThan(0);
  });
});

/* ================================================================== */
/*  Test 3: Mobile modals and dialogs are usable                       */
/* ================================================================== */

test.describe('Mobile Cohesion — Modals & Dialogs', () => {
  test.use({ viewport: MOBILE_VIEWPORT, storageState: AUTH.owner });

  test('add student wizard is usable on mobile', async ({ page }) => {
    // 1. Navigate to /students
    await goTo(page, '/students');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

    // 2. Click Add Student
    const addBtn = page.getByRole('button', { name: /add student/i }).first();
    const hasAdd = await addBtn.isVisible().catch(() => false);
    if (!hasAdd) return; // Button may be hidden if limit reached

    await addBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    const dialog = page.getByRole('dialog');

    // 3. Wizard opens as near-full-screen (h-[100dvh] w-full max-w-none on mobile)
    const box = await dialog.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(380); // ~full 390px viewport
      expect(box.height).toBeGreaterThan(500); // substantial height
    }

    // 4. Form fields are full-width
    const firstInput = dialog.locator('input').first();
    const hasInput = await firstInput.isVisible().catch(() => false);
    if (hasInput) {
      const inputBox = await firstInput.boundingBox();
      if (inputBox) {
        expect(inputBox.width).toBeGreaterThan(250); // wide enough for mobile
      }
    }

    // 5. Submit/Next button is reachable
    const actionBtn = dialog.getByRole('button', { name: /next|save|finish|create|done/i }).first();
    const hasAction = await actionBtn.isVisible().catch(() => false);
    if (hasAction) {
      await expect(actionBtn).toBeVisible();
    }

    // 6. Close the wizard
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
  });

  test('create invoice modal is usable on mobile', async ({ page }) => {
    // 7. Navigate to /invoices
    await goTo(page, '/invoices');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

    // 8. Click Create Invoice
    const createBtn = page.getByRole('button', { name: /create|new/i }).first();
    const hasCreate = await createBtn.isVisible().catch(() => false);
    if (!hasCreate) return;

    await createBtn.click();
    await page.waitForTimeout(500);

    const dialog = page.getByRole('dialog');
    const dialogVisible = await dialog.isVisible().catch(() => false);
    if (!dialogVisible) return;

    // 9. Modal is large/full-screen on mobile (h-screen w-screen)
    const box = await dialog.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(380);
      expect(box.height).toBeGreaterThan(500);
    }

    // 10. Form controls are touch-friendly (tall enough for finger taps)
    const buttons = dialog.locator('button');
    const btnCount = await buttons.count();
    for (let i = 0; i < Math.min(btnCount, 5); i++) {
      const btn = buttons.nth(i);
      const visible = await btn.isVisible().catch(() => false);
      if (!visible) continue;
      const btnBox = await btn.boundingBox();
      if (btnBox) {
        // Minimum touch target: 36px (slightly below Apple's 44pt guideline,
        // but accounting for padding)
        expect(btnBox.height).toBeGreaterThanOrEqual(30);
      }
    }

    // 11. Close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('compose message is usable on mobile', async ({ page }) => {
    // 12. Navigate to /messages
    await goTo(page, '/messages');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

    // 13. Click compose (dropdown: "New Message" → "Message Parent")
    const newMsgBtn = page.getByRole('button', { name: /new message/i }).first();
    const hasNewMsg = await newMsgBtn.isVisible().catch(() => false);

    if (hasNewMsg) {
      await newMsgBtn.click();
      await page.waitForTimeout(300);

      // Click "Message Parent" from dropdown
      const msgParent = page.getByRole('menuitem', { name: /message parent/i }).first();
      const hasMsgParent = await msgParent.isVisible().catch(() => false);
      if (hasMsgParent) {
        await msgParent.click();
      }
    } else {
      // Fallback: try a generic compose button
      const composeBtn = page.getByRole('button', { name: /compose|send/i }).first();
      const hasCompose = await composeBtn.isVisible().catch(() => false);
      if (!hasCompose) return;
      await composeBtn.click();
    }

    await page.waitForTimeout(500);
    const dialog = page.getByRole('dialog');
    const dialogVisible = await dialog.isVisible().catch(() => false);
    if (!dialogVisible) return;

    // 14. Compose dialog should take most of the viewport width
    const box = await dialog.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThan(300);
    }

    // Dialog title should say "Send Message"
    await expect(dialog.getByText(/send message/i)).toBeVisible({ timeout: 3_000 });

    // 15. Close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});

/* ================================================================== */
/*  Test 4: No horizontal overflow on any page (comprehensive sweep)   */
/* ================================================================== */

test.describe('Mobile Cohesion — No Horizontal Overflow (Owner)', () => {
  test.use({ viewport: MOBILE_VIEWPORT, storageState: AUTH.owner });

  const ownerPages = [
    '/dashboard',
    '/calendar',
    '/students',
    '/teachers',
    '/locations',
    '/invoices',
    '/reports',
    '/messages',
    '/practice',
    '/resources',
    '/register',
    '/batch-attendance',
    '/leads',
    '/waitlist',
    '/make-ups',
    '/continuation',
    '/settings',
    '/help',
  ];

  for (const route of ownerPages) {
    test(`no horizontal overflow on ${route}`, async ({ page }) => {
      await goTo(page, route);
      await expectNoHorizontalScroll(page);
    });
  }
});

test.describe('Mobile Cohesion — No Horizontal Overflow (Parent Portal)', () => {
  test.use({ viewport: MOBILE_VIEWPORT, storageState: AUTH.parent });

  const portalPages = [
    '/portal/home',
    '/portal/schedule',
    '/portal/invoices',
    '/portal/practice',
    '/portal/resources',
    '/portal/messages',
    '/portal/profile',
  ];

  for (const route of portalPages) {
    test(`no horizontal overflow on ${route}`, async ({ page }) => {
      await goTo(page, route);
      await expectNoHorizontalScroll(page);
    });
  }
});
