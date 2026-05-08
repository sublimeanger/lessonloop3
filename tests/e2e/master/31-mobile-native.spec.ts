/**
 * 31 — Mobile & native (Capacitor)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §31
 *
 * Run with `--project=mobile-safari` in playwright.config.ts.
 * For now these are scaffolds — the existing workflows/mobile-*.spec.ts
 * files cover the public side.
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, assertNoHorizontalOverflow, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.parent);
});

// Skip these on the master/desktop project; only run when project=mobile-safari.
// (Conditional skip needs `test.skip` *inside* a test, not top-level, to work
// reliably across Playwright versions. We use a beforeAll-style skipper.)
test.beforeEach(({ }, testInfo) => {
  if (testInfo.project.name !== 'mobile-safari') {
    test.skip(true, 'Mobile-only tests run with --project=mobile-safari');
  }
});

test.describe('Mobile staff', () => {
  test.use({ storageState: AUTH.owner });

  test('dashboard has no horizontal overflow', async ({ page }) => {
    await goTo(page, '/dashboard');
    await assertNoErrorBoundary(page);
    await assertNoHorizontalOverflow(page);
  });

  test('calendar defaults to day view on mobile (no stacked option)', async ({ page }) => {
    await goTo(page, '/calendar');
    await assertNoErrorBoundary(page);
    // Stacked view button should not be present
    const stacked = page.locator('[aria-label="Stacked view"]').first();
    const visible = await stacked.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(visible).toBe(false);
  });
});

test.describe('Mobile parent portal', () => {
  test.use({ storageState: AUTH.parent });

  test('portal home no horizontal overflow', async ({ page }) => {
    await goTo(page, '/portal/home');
    await assertNoErrorBoundary(page);
    await assertNoHorizontalOverflow(page);
  });
});

test.fixme('§31.3 — iOS keyboard does not cover input', async () => {});
test.fixme('§31.5 — Capacitor app foreground event invalidates queries', async () => {});
test.fixme('§31.6 — Android back button respects history', async () => {});
test.fixme('§31.7 — push notification with data:{path:...} navigates correctly', async () => {});
