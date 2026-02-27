import { test, expect, Page } from '@playwright/test';
import { AUTH, waitForPageReady } from './helpers';

// ═══════════════════════════════════════════════════════════════
// TEACHER — can access teaching routes, BLOCKED from admin routes
// ═══════════════════════════════════════════════════════════════
test.describe('Teacher RBAC', () => {
  test.use({ storageState: AUTH.teacher });

  const allowed = ['/dashboard', '/calendar', '/students', '/register', '/batch-attendance', '/practice', '/resources', '/messages', '/settings', '/help'];
  const blocked = ['/teachers', '/locations', '/invoices', '/leads', '/waitlist', '/make-ups', '/continuation', '/students/import'];

  for (const route of allowed) {
    test(`can access ${route}`, async ({ page }) => {
      await page.goto(route);
      await waitForPageReady(page);
      await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
    });
  }

  for (const route of blocked) {
    test(`BLOCKED from ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(url => /\/dashboard/.test(url.toString()), { timeout: 10_000 });
    });
  }

  test('BLOCKED from parent portal', async ({ page }) => {
    await page.goto('/portal/home');
    await page.waitForURL(url => /\/dashboard/.test(url.toString()), { timeout: 10_000 });
  });

  test('sidebar hides admin-only links', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageReady(page);
    for (const link of ['Teachers', 'Locations', 'Invoices', 'Leads', 'Waiting List', 'Make-Ups', 'Continuation']) {
      await expect(page.getByRole('link', { name: link, exact: true }).first()).toBeHidden();
    }
  });

  test('sidebar shows teacher links', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageReady(page);
    for (const link of ['Dashboard', 'My Calendar', 'My Students', 'Register', 'Batch Attendance', 'Practice', 'Resources', 'Messages']) {
      await expect(page.getByRole('link', { name: link, exact: true }).first()).toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// FINANCE — limited to billing & reports
// ═══════════════════════════════════════════════════════════════
test.describe('Finance RBAC', () => {
  test.use({ storageState: AUTH.finance });

  const allowed = ['/dashboard', '/invoices', '/reports', '/messages', '/settings'];
  const blocked = ['/calendar', '/students', '/register', '/batch-attendance', '/teachers', '/locations', '/practice', '/resources', '/leads', '/waitlist', '/make-ups', '/continuation', '/students/import'];

  for (const route of allowed) {
    test(`can access ${route}`, async ({ page }) => {
      await page.goto(route);
      await waitForPageReady(page);
      await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
    });
  }

  for (const route of blocked) {
    test(`BLOCKED from ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(url => /\/dashboard/.test(url.toString()), { timeout: 10_000 });
    });
  }

  test('sidebar shows only finance links', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageReady(page);
    await expect(page.getByRole('link', { name: 'Invoices', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reports', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Students', exact: true }).first()).toBeHidden();
    await expect(page.getByRole('link', { name: 'Calendar', exact: true }).first()).toBeHidden();
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — portal only, NO staff routes
// ═══════════════════════════════════════════════════════════════
test.describe('Parent RBAC', () => {
  test.use({ storageState: AUTH.parent });

  const portalRoutes = ['/portal/home', '/portal/schedule', '/portal/practice', '/portal/resources', '/portal/invoices', '/portal/messages', '/portal/profile', '/portal/continuation'];
  const staffRoutes = ['/dashboard', '/calendar', '/students', '/teachers', '/invoices', '/settings', '/reports', '/locations', '/register', '/batch-attendance', '/leads', '/waitlist', '/make-ups', '/continuation', '/practice', '/resources', '/messages'];

  for (const route of portalRoutes) {
    test(`can access ${route}`, async ({ page }) => {
      await page.goto(route);
      await waitForPageReady(page);
      await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
    });
  }

  for (const route of staffRoutes) {
    test(`BLOCKED from ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(url => /\/portal\/home/.test(url.toString()), { timeout: 10_000 });
    });
  }

  test('already-authed parent redirected from /login to portal', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/portal\/home/, { timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════════
// ADMIN — same access as owner
// ═══════════════════════════════════════════════════════════════
test.describe('Admin RBAC', () => {
  test.use({ storageState: AUTH.admin });

  const allStaffRoutes = ['/dashboard', '/calendar', '/students', '/teachers', '/locations', '/invoices', '/reports', '/messages', '/settings', '/register', '/batch-attendance', '/practice', '/resources', '/leads', '/waitlist', '/make-ups', '/continuation', '/help'];

  for (const route of allStaffRoutes) {
    test(`can access ${route}`, async ({ page }) => {
      await page.goto(route);
      await waitForPageReady(page);
      await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
    });
  }
});
