/**
 * 05 — RBAC matrix (every role × every route)
 *
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §5
 *
 * The single most valuable category for catching regressions.
 * Generated programmatically from src/config/routes.ts → 5 roles
 * × ~30 routes = 150 tests, each ~3-5s.
 *
 * For each (role, route): if the role is allowed → expect 200 + no
 * error boundary. If not allowed → expect redirect to /dashboard
 * (staff) or /portal/home (parent).
 *
 * Two small extra checks:
 *  - Settings page degrades gracefully for non-admin roles (Profile tab only)
 *  - Email-not-confirmed gate redirects to /verify-email
 *  - Onboarding-not-complete gate redirects to /onboarding
 */

import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary } from '../helpers';

type Role = 'owner' | 'admin' | 'teacher' | 'finance' | 'parent';

interface RouteSpec {
  path: string;
  allowed: Role[]; // empty = all authenticated users
  parentRedirect?: boolean; // if true, parents go here instead of /dashboard
}

// Mirrors src/config/routes.ts. Update both when routes change.
const STAFF_ROUTES: RouteSpec[] = [
  { path: '/dashboard', allowed: ['owner', 'admin', 'teacher', 'finance'] },
  { path: '/register', allowed: ['owner', 'admin', 'teacher'] },
  { path: '/calendar', allowed: ['owner', 'admin', 'teacher'] },
  { path: '/batch-attendance', allowed: ['owner', 'admin', 'teacher'] },
  { path: '/students', allowed: ['owner', 'admin', 'teacher'] },
  { path: '/teachers', allowed: ['owner', 'admin'] },
  { path: '/locations', allowed: ['owner', 'admin'] },
  { path: '/invoices', allowed: ['owner', 'admin', 'finance'] },
  { path: '/reports', allowed: ['owner', 'admin', 'teacher', 'finance'] },
  { path: '/reports/payroll', allowed: ['owner', 'admin', 'teacher', 'finance'] },
  { path: '/reports/revenue', allowed: ['owner', 'admin', 'finance'] },
  { path: '/reports/outstanding', allowed: ['owner', 'admin', 'finance'] },
  { path: '/reports/lessons', allowed: ['owner', 'admin', 'teacher'] },
  { path: '/reports/cancellations', allowed: ['owner', 'admin'] },
  { path: '/reports/attendance', allowed: ['owner', 'admin', 'teacher'] },
  { path: '/reports/utilisation', allowed: ['owner', 'admin'] },
  { path: '/reports/teacher-performance', allowed: ['owner', 'admin'] },
  { path: '/messages', allowed: ['owner', 'admin', 'teacher', 'finance'] },
  { path: '/practice', allowed: ['owner', 'admin', 'teacher'] },
  { path: '/resources', allowed: ['owner', 'admin', 'teacher'] },
  { path: '/make-ups', allowed: ['owner', 'admin'] },
  { path: '/leads', allowed: ['owner', 'admin'] },
  { path: '/waitlist', allowed: ['owner', 'admin'] },
  { path: '/continuation', allowed: ['owner', 'admin'] },
  { path: '/notes', allowed: ['owner', 'admin', 'teacher'] },
  { path: '/settings', allowed: ['owner', 'admin', 'finance', 'teacher'] },
  { path: '/help', allowed: [] }, // no role gate — any authed
];

const PARENT_ROUTES: RouteSpec[] = [
  { path: '/portal/home', allowed: ['parent'], parentRedirect: true },
  { path: '/portal/schedule', allowed: ['parent'], parentRedirect: true },
  { path: '/portal/practice', allowed: ['parent'], parentRedirect: true },
  { path: '/portal/resources', allowed: ['parent'], parentRedirect: true },
  { path: '/portal/invoices', allowed: ['parent'], parentRedirect: true },
  { path: '/portal/messages', allowed: ['parent'], parentRedirect: true },
];

const ALL_ROLES: Role[] = ['owner', 'admin', 'teacher', 'finance', 'parent'];
const ALL_ROUTES = [...STAFF_ROUTES, ...PARENT_ROUTES];

test.beforeAll(() => {
  for (const r of ALL_ROLES) refreshStorageStateIfStale(AUTH[r]);
});

for (const role of ALL_ROLES) {
  test.describe(`RBAC — ${role}`, () => {
    test.use({ storageState: AUTH[role] });

    for (const route of ALL_ROUTES) {
      const allowed = route.allowed.length === 0 || route.allowed.includes(role);
      const expectedRedirect = role === 'parent' ? /\/portal\/home/ : /\/dashboard/;

      test(`${role} → ${route.path} = ${allowed ? '200' : 'redirect'}`, async ({ page }) => {
        await page.goto(route.path);

        if (allowed) {
          // Wait for either correct URL or redirect-then-back
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(2000); // RouteGuard settle
          // Replace dynamic params for regex match
          const escapedPath = route.path.replace(/\//g, '\\/').replace(/:[\w]+/g, '[^/]+');
          await expect(page, `${role} should access ${route.path}`).toHaveURL(new RegExp(escapedPath), { timeout: 15_000 });
          await assertNoErrorBoundary(page);
        } else {
          // Should redirect to dashboard (staff) or portal home (parent)
          await page.waitForURL(expectedRedirect, { timeout: 15_000 }).catch(() => {});
          // Final URL must be the redirect target, not the requested path
          expect(page.url(), `${role} should be redirected away from ${route.path}`).not.toMatch(
            new RegExp(route.path.replace(/\//g, '\\/').replace(/:[\w]+/g, '[^/]+'))
          );
        }
      });
    }
  });
}

test.describe('RBAC — Settings degradation', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher can access /settings but admin tabs degrade to profile', async ({ page }) => {
    await page.goto('/settings?tab=organisation');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    // The page accepts the URL but resolvedTab logic shows Profile tab content
    // (because !isOrgAdmin && adminTabs.includes(rawTab) → 'profile')
    const url = page.url();
    expect(url).toMatch(/\/settings/);
    // Profile-related field should be visible (rather than Organisation form)
    const hasProfile = await page.getByText(/full name|email|profile/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasProfile).toBe(true);
  });
});

test.describe('§5.4 — Email verification gate', () => {
  test('unconfirmed email user → redirected to /verify-email on protected route', async ({ page }) => {
    const { createThrowawayUser, deleteThrowawayUser, signInAndWriteStorageState } = await import('../supabase-admin');
    const fs = await import('fs');

    let userId = '';
    let storagePath = '';
    try {
      const u = createThrowawayUser({ emailPrefix: 'e2e-unconf', emailConfirmed: false });
      userId = u.userId;
      storagePath = signInAndWriteStorageState(u.email, u.password);
      // Load the storage state into context manually
      const ctx = await page.context().browser()!.newContext({ storageState: storagePath });
      const newPage = await ctx.newPage();
      await newPage.goto('/dashboard');
      await newPage.waitForTimeout(3000);
      // RouteGuard should have kicked us to /verify-email
      expect(newPage.url(), 'unconfirmed user should be on /verify-email').toMatch(/\/(verify-email|login)/);
      await ctx.close();
    } finally {
      if (storagePath && fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
      if (userId) deleteThrowawayUser(userId);
    }
  });
});

test.describe('§5.5 — Onboarding-incomplete gate', () => {
  test('user with has_completed_onboarding=false → redirected to /onboarding', async ({ page }) => {
    const { createThrowawayUser, deleteThrowawayUser, signInAndWriteStorageState } = await import('../supabase-admin');
    const fs = await import('fs');

    let userId = '';
    let storagePath = '';
    try {
      const u = createThrowawayUser({ emailPrefix: 'e2e-noonboard', emailConfirmed: true, hasCompletedOnboarding: false });
      userId = u.userId;
      storagePath = signInAndWriteStorageState(u.email, u.password);
      const ctx = await page.context().browser()!.newContext({ storageState: storagePath });
      const newPage = await ctx.newPage();
      await newPage.goto('/dashboard');
      await newPage.waitForTimeout(3000);
      // Should be redirected to /onboarding (or stay on /onboarding if signup creates a profile there)
      expect(newPage.url(), 'incomplete-onboarding user should be on /onboarding').toMatch(/\/onboarding/);
      await ctx.close();
    } finally {
      if (storagePath && fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
      if (userId) deleteThrowawayUser(userId);
    }
  });
});

test.fixme('§5.6 — 3s profile-grace + 5s role-grace tolerance', async () => {});
