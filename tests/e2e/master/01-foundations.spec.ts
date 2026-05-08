/**
 * 01 — Foundations
 *
 * Sanity-checks that the test environment is wired up correctly.
 * If this file fails, every other master spec will fail. Always
 * run this first.
 *
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §1
 */

import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH } from '../helpers';
import { getOrgId, supabaseSelect } from '../supabase-admin';

test.beforeAll(() => {
  // Refresh all auth tokens (cheap when fresh, essential when stale)
  for (const role of ['owner', 'admin', 'teacher', 'finance', 'parent', 'parent2'] as const) {
    refreshStorageStateIfStale(AUTH[role]);
  }
});

test.describe('Foundations', () => {
  test('environment variables are set', async () => {
    expect(process.env.E2E_BASE_URL, 'E2E_BASE_URL').toBeTruthy();
    expect(process.env.E2E_SUPABASE_URL, 'E2E_SUPABASE_URL').toBeTruthy();
    expect(process.env.E2E_SUPABASE_ANON_KEY, 'E2E_SUPABASE_ANON_KEY').toBeTruthy();
    expect(process.env.E2E_OWNER_EMAIL, 'E2E_OWNER_EMAIL').toBeTruthy();
    expect(process.env.E2E_PARENT_EMAIL, 'E2E_PARENT_EMAIL').toBeTruthy();
  });

  test('storage state files exist for every role', async () => {
    const fs = await import('fs');
    for (const role of ['owner', 'admin', 'teacher', 'finance', 'parent', 'parent2'] as const) {
      expect(fs.existsSync(AUTH[role]), `${role}.json should exist`).toBe(true);
    }
  });

  test('Supabase admin helpers can resolve test org', async () => {
    const orgId = getOrgId();
    expect(orgId, 'getOrgId() should return the e2e org').toMatch(/^[0-9a-f-]{36}$/);
  });

  test('SQL select via supabase-admin works', async () => {
    const orgId = getOrgId();
    const orgs = supabaseSelect('organisations', `id=eq.${orgId}&select=name,subscription_plan,currency_code`);
    expect(orgs.length).toBe(1);
    expect(orgs[0].name).toBe('E2E Test Academy');
  });

  test.use({ storageState: AUTH.owner });

  test('owner storage state lets us reach /dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });
});
