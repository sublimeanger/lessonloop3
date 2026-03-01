import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, safeGoTo } from './helpers';

/**
 * Navigate and verify the URL contains the expected route path.
 * Retries once after auth redirect settles.
 */
async function accessRoute(page: import('@playwright/test').Page, route: string) {
  await page.goto(route);
  await page.waitForLoadState('domcontentloaded');
  // Wait for auth to settle — session restore may redirect then correct
  await page.waitForTimeout(2000);
  if (!page.url().includes(route)) {
    // Auth redirect — retry once after session warms up
    await page.goto(route);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  }
  // Use a longer timeout for CI
  await expect(page).toHaveURL(new RegExp(route.replace(/\//g, '\\/')), { timeout: 20_000 });
}

/**
 * Verify that accessing a route redirects to expected destination.
 * More resilient than strict URL matching — accepts slow redirects.
 */
async function expectBlockedRoute(
  page: import('@playwright/test').Page,
  route: string,
  redirectPattern: RegExp,
) {
  await page.goto(route);
  await page.waitForURL(
    url => redirectPattern.test(url.toString()),
    { timeout: 20_000 },
  ).catch(async () => {
    // Retry once — auth session may not be warm
    await page.goto(route);
    await page.waitForURL(
      url => redirectPattern.test(url.toString()),
      { timeout: 20_000 },
    );
  });
}

// ═══════════════════════════════════════════════════════════════
// TEACHER — can access teaching routes, BLOCKED from admin routes
// ═══════════════════════════════════════════════════════════════
test.describe('Teacher RBAC', () => {
  test.use({ storageState: AUTH.teacher });

  const allowed = ['/dashboard', '/calendar', '/students', '/register', '/batch-attendance', '/practice', '/resources', '/messages', '/settings'];
  const blocked = ['/teachers', '/locations', '/invoices', '/leads', '/waitlist', '/make-ups', '/continuation'];

  for (const route of allowed) {
    test(`can access ${route}`, async ({ page }) => {
      await accessRoute(page, route);
    });
  }

  for (const route of blocked) {
    test(`BLOCKED from ${route}`, async ({ page }) => {
      await expectBlockedRoute(page, route, /\/dashboard/);
    });
  }

  test('BLOCKED from parent portal', async ({ page }) => {
    await expectBlockedRoute(page, '/portal/home', /\/dashboard/);
  });

  test('sidebar hides admin-only links', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Teacher Dashboard');
    for (const link of ['Teachers', 'Locations', 'Invoices', 'Leads']) {
      const visible = await page.getByRole('link', { name: link, exact: true }).first().isVisible().catch(() => false);
      expect(visible, `Admin link "${link}" should not be visible to teacher`).toBe(false);
    }
  });

  test('sidebar shows teacher links', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Teacher Dashboard');
    // Teacher sidebar may show "My Calendar"/"My Students" or "Calendar"/"Students"
    const dashLink = page.getByRole('link', { name: 'Dashboard', exact: true }).first();
    await expect(dashLink).toBeVisible({ timeout: 10_000 });
    // Check for teacher-specific or generic nav links
    const calendarLink = page.getByRole('link', { name: /calendar/i }).first();
    const studentsLink = page.getByRole('link', { name: /students/i }).first();
    await expect(calendarLink).toBeVisible({ timeout: 5_000 });
    await expect(studentsLink).toBeVisible({ timeout: 5_000 });
  });
});

// ═══════════════════════════════════════════════════════════════
// FINANCE — limited to billing & reports
// ═══════════════════════════════════════════════════════════════
test.describe('Finance RBAC', () => {
  test.use({ storageState: AUTH.finance });

  const allowed = ['/dashboard', '/invoices', '/reports', '/messages', '/settings'];
  const blocked = ['/calendar', '/students', '/register', '/batch-attendance', '/teachers', '/locations', '/practice', '/resources', '/leads', '/waitlist', '/make-ups', '/continuation'];

  for (const route of allowed) {
    test(`can access ${route}`, async ({ page }) => {
      await accessRoute(page, route);
    });
  }

  for (const route of blocked) {
    test(`BLOCKED from ${route}`, async ({ page }) => {
      await expectBlockedRoute(page, route, /\/dashboard/);
    });
  }

  test('sidebar shows only finance links', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Finance Dashboard');
    await expect(page.getByRole('link', { name: 'Invoices', exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Reports', exact: true }).first()).toBeVisible({ timeout: 10_000 });
    // Teacher/student links should be hidden
    const studentsVisible = await page.getByRole('link', { name: 'Students', exact: true }).first().isVisible().catch(() => false);
    const calendarVisible = await page.getByRole('link', { name: 'Calendar', exact: true }).first().isVisible().catch(() => false);
    expect(studentsVisible, 'Students link should be hidden for finance').toBe(false);
    expect(calendarVisible, 'Calendar link should be hidden for finance').toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — portal only, NO staff routes
// ═══════════════════════════════════════════════════════════════
test.describe('Parent RBAC', () => {
  test.use({ storageState: AUTH.parent });

  const portalRoutes = ['/portal/home', '/portal/schedule', '/portal/practice', '/portal/resources', '/portal/invoices', '/portal/messages', '/portal/profile'];
  const staffRoutes = ['/dashboard', '/calendar', '/students', '/teachers', '/invoices', '/settings', '/reports', '/locations', '/register', '/batch-attendance', '/leads', '/waitlist', '/make-ups', '/continuation', '/practice', '/resources', '/messages'];

  for (const route of portalRoutes) {
    test(`can access ${route}`, async ({ page }) => {
      await accessRoute(page, route);
    });
  }

  for (const route of staffRoutes) {
    test(`BLOCKED from ${route}`, async ({ page }) => {
      await expectBlockedRoute(page, route, /\/portal\/home/);
    });
  }

  test('already-authed parent redirected from /login to portal', async ({ page }) => {
    await page.goto('/login');
    await page.waitForURL(
      url => /\/portal/.test(url.toString()),
      { timeout: 20_000 },
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// ADMIN — same access as owner
// ═══════════════════════════════════════════════════════════════
test.describe('Admin RBAC', () => {
  test.use({ storageState: AUTH.admin });

  const allStaffRoutes = ['/dashboard', '/calendar', '/students', '/teachers', '/locations', '/invoices', '/reports', '/messages', '/settings', '/register', '/batch-attendance', '/practice', '/resources', '/leads', '/waitlist', '/make-ups', '/continuation'];

  for (const route of allStaffRoutes) {
    test(`can access ${route}`, async ({ page }) => {
      await accessRoute(page, route);
    });
  }
});
