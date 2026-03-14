/**
 * PART 14: Mobile Responsiveness (390px viewport)
 * Tests 14.1.1 – 14.2.3
 */
import { test, expect } from '../../workflows/workflow.fixtures';
import { AUTH, safeGoTo, assertNoHorizontalOverflow } from './helpers';

test.use({
  storageState: AUTH.owner,
  viewport: { width: 390, height: 844 },
});

test.describe('Part 14: Mobile Responsiveness', () => {

  const mobilePages = [
    { id: '14.1.1', path: '/dashboard', name: 'Dashboard' },
    { id: '14.1.3', path: '/calendar', name: 'Calendar' },
    { id: '14.1.5', path: '/students', name: 'Students' },
    { id: '14.1.7', path: '/register', name: 'Register' },
    { id: '14.1.8', path: '/invoices', name: 'Invoices' },
    { id: '14.1.9', path: '/messages', name: 'Messages' },
    { id: '14.1.10', path: '/notes', name: 'Notes Explorer' },
  ];

  for (const p of mobilePages) {
    test(`${p.id} – ${p.name} renders at 390px`, async ({ page }) => {
      await safeGoTo(page, p.path);
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
      const error = await page.getByText(/something went wrong/i).isVisible().catch(() => false);
      expect(error, `Error on ${p.path}`).toBe(false);
    });
  }

  test('14.1.2 – Bottom nav visible on mobile', async ({ page }) => {
    await safeGoTo(page, '/dashboard');
    const bottomNav = page.locator('[class*="bottom-nav"], nav[class*="mobile"]').first()
      .or(page.locator('nav').last());
    await expect(bottomNav).toBeVisible({ timeout: 10_000 });
  });

  test('14.1.14 – No horizontal overflow on any staff page', async ({ page }) => {
    for (const p of mobilePages) {
      await safeGoTo(page, p.path);
      await assertNoHorizontalOverflow(page);
    }
  });

  // ── 14.2 — Page Refresh ──

  test('14.2.1 – F5 refresh preserves auth', async ({ page }) => {
    await safeGoTo(page, '/students');
    await page.reload();
    await page.waitForTimeout(3_000);
    // Should NOT redirect to login
    expect(page.url()).not.toMatch(/\/login/);
  });

  test('14.2.3 – /students/fake-uuid shows error state, not crash', async ({ page }) => {
    await page.goto('/students/00000000-0000-0000-0000-000000000000');
    await page.waitForTimeout(3_000);
    // Should show error or redirect, not blank crash
    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 15_000 });
  });
});
