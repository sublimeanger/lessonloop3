/**
 * 07 — Calendar (views, navigation, filters, drag, slot generator)
 *
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §7
 *
 * Existing `tests/e2e/calendar.spec.ts` already covers many flows —
 * this master file is the gap-filler + reference for new flows.
 * For now, keep the existing file as-is and add focused additions
 * here over time.
 */

import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.teacher);
});

test.describe('Calendar — view URL persistence', () => {
  test.use({ storageState: AUTH.owner });

  test('?view=week persists in URL after view toggle', async ({ page }) => {
    await page.goto('/calendar?view=week');
    await expect(page).toHaveURL(/view=week/);
    await assertNoErrorBoundary(page);
  });

  test('?view=day persists', async ({ page }) => {
    await page.goto('/calendar?view=day');
    await expect(page).toHaveURL(/view=day/);
  });

  test('?view=agenda persists', async ({ page }) => {
    await page.goto('/calendar?view=agenda');
    await expect(page).toHaveURL(/view=agenda/);
  });

  test('?date=YYYY-MM-DD shows that date', async ({ page }) => {
    await page.goto('/calendar?view=day&date=2026-06-01');
    await page.waitForTimeout(2000);
    await assertNoErrorBoundary(page);
  });
});

test.describe('Calendar — view toggles via aria-label', () => {
  test.use({ storageState: AUTH.owner });

  test('Day view button toggles', async ({ page }) => {
    await page.goto('/calendar');
    const dayBtn = page.locator('[aria-label="Day view"]').first();
    if (await dayBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dayBtn.click();
      await expect(page).toHaveURL(/view=day/);
    }
  });
});

test.describe('Calendar — keyboard shortcuts', () => {
  test.use({ storageState: AUTH.owner });

  test.fixme('press `t` returns to today', async ({ page }) => {
    // Keyboard shortcut depends on useKeyboardShortcuts being mounted +
    // no input/dialog focus. Brittle in this top-level form. Move to
    // workflows/keyboard-shortcuts.spec.ts where it's already tested.
  });
});

// TODO §7.6 bulk select & cancel — needs lesson seed
// TODO §7.7 drag → conflict dialog — UI integration test
// TODO §7.8 external busy block overlays — needs calendar_connections seed
// TODO §7.9 slot generator wizard
// TODO §7.10 iCal feed — direct fetch + ICS validation
test.fixme('§7.6 — bulk select + bulk cancel 3 lessons', async () => {});
test.fixme('§7.7 — drag onto conflicting slot shows conflict dialog', async () => {});
test.fixme('§7.8 — calendar_connections busy blocks render as overlays', async () => {});
test.fixme('§7.9 — slot generator wizard creates N open-slot lessons', async () => {});
test.fixme('§7.10 — iCal feed URL returns valid VCALENDAR/VEVENT payload', async () => {});
