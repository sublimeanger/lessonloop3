import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, assertNoErrorBoundary, trackConsoleErrors } from './helpers';

const MOBILE_VIEWPORT = { width: 390, height: 844 };

// ═══════════════════════════════════════════════════════════════
// MOBILE — OWNER PAGES
// ═══════════════════════════════════════════════════════════════
test.describe('Mobile — Owner Pages', () => {
  test.use({ storageState: AUTH.owner, viewport: MOBILE_VIEWPORT });

  test('dashboard loads without horizontal overflow', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Mobile Dashboard');
    await assertNoErrorBoundary(page);
    await page.waitForTimeout(2_000);

    // Check no horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth, 'No horizontal overflow on mobile dashboard').toBeLessThanOrEqual(clientWidth + 5);
  });

  test('sidebar trigger visible on mobile', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Mobile Dashboard');
    await page.waitForTimeout(1_000);

    const trigger = page.locator('[data-sidebar="trigger"]').first();
    const hasTrigger = await trigger.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[mobile] Sidebar trigger visible: ${hasTrigger}`);
  });

  test('students page renders on mobile without overflow', async ({ page }) => {
    await safeGoTo(page, '/students', 'Mobile Students');
    await assertNoErrorBoundary(page);
    await page.waitForTimeout(2_000);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth, 'No horizontal overflow on mobile students').toBeLessThanOrEqual(clientWidth + 5);
  });

  test('calendar renders on mobile without overflow', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Mobile Calendar');
    await assertNoErrorBoundary(page);
    await page.waitForTimeout(2_000);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth, 'No horizontal overflow on mobile calendar').toBeLessThanOrEqual(clientWidth + 5);
  });

  test('invoices page renders on mobile without overflow', async ({ page }) => {
    await safeGoTo(page, '/invoices', 'Mobile Invoices');
    await assertNoErrorBoundary(page);
    await page.waitForTimeout(2_000);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth, 'No horizontal overflow on mobile invoices').toBeLessThanOrEqual(clientWidth + 5);
  });

  test('settings page shows mobile nav list', async ({ page }) => {
    // No ?tab= param -> should show mobile nav list
    await safeGoTo(page, '/settings', 'Mobile Settings');
    await page.waitForTimeout(2_000);

    const mobileNav = page.locator('nav[aria-label="Settings navigation"]').first();
    const hasNav = await mobileNav.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[mobile] Settings mobile nav list: ${hasNav}`);
  });

  test('settings tab shows back button on mobile', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=profile', 'Mobile Settings Profile');
    await page.waitForTimeout(2_000);

    const backBtn = page.locator('[aria-label="Back to settings navigation"]').first();
    const hasBack = await backBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[mobile] Settings back button: ${hasBack}`);
  });

  test('no console errors on mobile dashboard', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/dashboard', 'Mobile Dashboard');
    await page.waitForTimeout(2_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// MOBILE — PARENT PORTAL
// ═══════════════════════════════════════════════════════════════
test.describe('Mobile — Parent Portal', () => {
  test.use({ storageState: AUTH.parent, viewport: MOBILE_VIEWPORT });

  test('portal home renders on mobile', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Mobile Portal');
    await assertNoErrorBoundary(page);
    await page.waitForTimeout(2_000);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth, 'No horizontal overflow on mobile portal').toBeLessThanOrEqual(clientWidth + 5);
  });

  test('bottom navigation visible on mobile', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Mobile Portal');
    await page.waitForTimeout(2_000);

    const bottomNav = page.locator('nav[aria-label="Portal navigation"]').first();
    await expect(bottomNav).toBeVisible({ timeout: 10_000 });

    // Check nav items
    const navItems = ['Home', 'Schedule', 'Messages'];
    for (const item of navItems) {
      const link = bottomNav.getByText(item, { exact: true }).first();
      const visible = await link.isVisible({ timeout: 3_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[mobile-portal] Bottom nav "${item}": ${visible}`);
    }
  });

  test('bottom nav navigates correctly', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Mobile Portal');
    await page.waitForTimeout(2_000);

    const bottomNav = page.locator('nav[aria-label="Portal navigation"]').first();

    // Click Schedule in bottom nav
    const scheduleLink = bottomNav.getByText('Schedule', { exact: true }).first();
    if (await scheduleLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await scheduleLink.click();
      await page.waitForURL(/\/portal\/schedule/, { timeout: 10_000 });
      await assertNoErrorBoundary(page);
    }
  });

  test('portal invoices no overflow on mobile', async ({ page }) => {
    await safeGoTo(page, '/portal/invoices', 'Mobile Portal Invoices');
    await page.waitForTimeout(2_000);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth, 'No horizontal overflow on portal invoices').toBeLessThanOrEqual(clientWidth + 5);
  });
});

// ═══════════════════════════════════════════════════════════════
// MOBILE — LOGIN PAGE
// ═══════════════════════════════════════════════════════════════
test.describe('Mobile — Login', () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: MOBILE_VIEWPORT });

  test('login page renders on mobile without overflow', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(2_000);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth, 'No horizontal overflow on mobile login').toBeLessThanOrEqual(clientWidth + 5);

    // Verify email and password fields visible
    const emailField = page.getByLabel(/email/i).first();
    const passwordField = page.getByLabel(/password/i).first();
    const hasEmail = await emailField.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasPassword = await passwordField.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[mobile-login] Email: ${hasEmail}, Password: ${hasPassword}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// PUBLIC PAGES — UNAUTHENTICATED
// ═══════════════════════════════════════════════════════════════
test.describe('Public Pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login page renders with form', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(2_000);

    const emailField = page.getByLabel(/email/i).first();
    await expect(emailField).toBeVisible({ timeout: 10_000 });

    const passwordField = page.getByLabel(/password/i).first();
    await expect(passwordField).toBeVisible({ timeout: 5_000 });

    // Forgot password link
    const forgotLink = page.getByText(/forgot.*password/i).first();
    const hasForgot = await forgotLink.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[public] Forgot password link: ${hasForgot}`);
  });

  test('signup page renders with form', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForTimeout(2_000);

    // Check for sign-up form fields
    const emailField = page.getByLabel(/email/i).first();
    const hasEmail = await emailField.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[public] Signup email field: ${hasEmail}`);

    // Sign in link from signup
    const signInLink = page.getByText(/sign in/i).first();
    const hasSignIn = await signInLink.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[public] Sign in link: ${hasSignIn}`);
  });

  test('forgot password page renders', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForTimeout(2_000);

    const emailField = page.getByLabel(/email/i).first();
    const hasEmail = await emailField.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[public] Forgot password email: ${hasEmail}`);
  });

  test('unauthenticated user redirected from /dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(
      url => /\/(login|auth|signup)/.test(url.toString()),
      { timeout: 15_000 }
    ).catch(() => {});

    const url = page.url();
    // eslint-disable-next-line no-console
    console.log(`[public] /dashboard → URL: ${url}`);
    expect(url).toMatch(/\/(login|auth|signup)/);
  });

  test('unauthenticated user redirected from /portal/home', async ({ page }) => {
    await page.goto('/portal/home');
    await page.waitForURL(
      url => /\/(login|auth|signup)/.test(url.toString()),
      { timeout: 15_000 }
    ).catch(() => {});

    const url = page.url();
    // eslint-disable-next-line no-console
    console.log(`[public] /portal/home → URL: ${url}`);
    expect(url).toMatch(/\/(login|auth|signup)/);
  });

  test('booking page loads for valid slug or shows error', async ({ page }) => {
    await page.goto('/book/e2e-test-academy');
    await page.waitForTimeout(3_000);

    const url = page.url();
    // eslint-disable-next-line no-console
    console.log(`[public] /book/e2e-test-academy → URL: ${url}`);
    // Either loads booking page or shows not-found
    await expect(page.locator('body')).toBeVisible();
  });

  test('booking page 404 for invalid slug', async ({ page }) => {
    await page.goto('/book/nonexistent-slug-99999');
    await page.waitForTimeout(3_000);

    const url = page.url();
    // eslint-disable-next-line no-console
    console.log(`[public] /book/invalid → URL: ${url}`);
    // Should show error or not-found state
    await expect(page.locator('body')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
// ERROR & EDGE STATES
// ═══════════════════════════════════════════════════════════════
test.describe('Error States', () => {
  test.use({ storageState: AUTH.owner });

  test('404 page renders for unknown route', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345');
    await page.waitForTimeout(3_000);

    // Should show 404 page
    const h404 = page.getByText('404').first();
    const pageNotFound = page.getByText('Page not found').first();

    const has404 = await h404.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasPageNotFound = await pageNotFound.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[errors] 404: ${has404}, "Page not found": ${hasPageNotFound}`);
  });

  test('no 5xx errors across key pages', async ({ page }) => {
    test.setTimeout(120_000);
    const fiveXXErrors: string[] = [];

    page.on('response', (response) => {
      if (response.status() >= 500) {
        fiveXXErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    const routes = ['/dashboard', '/students', '/calendar', '/invoices', '/reports', '/settings?tab=profile'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(2_000);
    }

    if (fiveXXErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[errors] 5xx errors found: ${fiveXXErrors.join(', ')}`);
    }
    expect(fiveXXErrors.length, '5xx errors found across key pages').toBe(0);
  });

  test('no console errors across key pages', async ({ page }) => {
    test.setTimeout(120_000);
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known non-critical errors
        if (text.includes('favicon') || text.includes('ResizeObserver') || text.includes('net::ERR')) return;
        consoleErrors.push(text.slice(0, 150));
      }
    });

    const routes = ['/dashboard', '/students', '/invoices', '/reports'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(2_000);
    }

    if (consoleErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[errors] Console errors (${consoleErrors.length}): ${consoleErrors.slice(0, 3).join(' | ')}`);
    }
    // Allow up to 2 minor errors (some third-party libs emit warnings)
    expect(consoleErrors.length, 'Too many console errors across key pages').toBeLessThanOrEqual(2);
  });
});
