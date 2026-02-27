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
      await page.waitForURL(url => /\/portal\/home/.test(url.toString()), { timeout: 10_000 });
    });
  }
});

test.describe('Teacher URL attacks', () => {
  test.use({ storageState: AUTH.teacher });

  const attacks = [
    '/teachers', '/locations', '/invoices', '/invoices/fake-uuid',
    '/leads', '/leads/fake-uuid', '/waitlist', '/make-ups',
    '/continuation', '/students/import',
    '/reports/revenue', '/reports/outstanding',
    '/reports/cancellations', '/reports/utilisation',
    '/reports/teacher-performance',
  ];

  for (const route of attacks) {
    test(`blocked from ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(url => /\/dashboard/.test(url.toString()), { timeout: 10_000 });
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
    '/reports/cancellations', '/reports/utilisation',
    '/reports/teacher-performance',
  ];

  for (const route of attacks) {
    test(`blocked from ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(url => /\/dashboard/.test(url.toString()), { timeout: 10_000 });
    });
  }
});
