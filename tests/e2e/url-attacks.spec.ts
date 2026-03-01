import { test, expect } from '@playwright/test';
import { AUTH } from './helpers';

test.describe('Parent URL attacks', () => {
  test.use({ storageState: AUTH.parent });

  const attacks = [
    '/dashboard', '/students', '/students/fake-uuid-12345',
    '/teachers', '/invoices', '/invoices/fake-uuid-12345',
    '/settings', '/calendar', '/reports', '/reports/revenue',
    '/reports/payroll', '/locations', '/register',
    '/batch-attendance', '/leads', '/leads/fake-uuid',
    '/waitlist', '/make-ups', '/continuation',
    '/students/import', '/resources', '/practice',
  ];

  for (const route of attacks) {
    test(`blocked from ${route}`, async ({ page }) => {
      await page.goto(route);
      // Parent should be redirected to portal
      await page.waitForURL(
        url => /\/portal\/home/.test(url.toString()),
        { timeout: 20_000 },
      ).catch(async () => {
        // Retry once — auth session may need warming
        await page.goto(route);
        await page.waitForURL(
          url => /\/portal\/home/.test(url.toString()),
          { timeout: 20_000 },
        );
      });
    });
  }
});

test.describe('Teacher URL attacks', () => {
  test.use({ storageState: AUTH.teacher });

  const attacks = [
    '/teachers', '/locations', '/invoices', '/invoices/fake-uuid',
    '/leads', '/leads/fake-uuid', '/waitlist', '/make-ups',
    '/continuation', '/students/import',
  ];

  for (const route of attacks) {
    test(`blocked from ${route}`, async ({ page }) => {
      await page.goto(route);
      // Teacher should be redirected to dashboard
      await page.waitForURL(
        url => /\/dashboard/.test(url.toString()),
        { timeout: 20_000 },
      ).catch(async () => {
        await page.goto(route);
        await page.waitForURL(
          url => /\/dashboard/.test(url.toString()),
          { timeout: 20_000 },
        );
      });
    });
  }
});

test.describe('Finance URL attacks', () => {
  test.use({ storageState: AUTH.finance });

  const attacks = [
    '/calendar', '/students', '/students/fake-uuid',
    '/register', '/batch-attendance', '/teachers',
    '/locations', '/practice', '/resources',
    '/leads', '/leads/fake-uuid', '/waitlist',
    '/make-ups', '/continuation', '/students/import',
  ];

  for (const route of attacks) {
    test(`blocked from ${route}`, async ({ page }) => {
      await page.goto(route);
      // Finance should be redirected to dashboard
      await page.waitForURL(
        url => /\/dashboard/.test(url.toString()),
        { timeout: 20_000 },
      ).catch(async () => {
        await page.goto(route);
        await page.waitForURL(
          url => /\/dashboard/.test(url.toString()),
          { timeout: 20_000 },
        );
      });
    });
  }
});
