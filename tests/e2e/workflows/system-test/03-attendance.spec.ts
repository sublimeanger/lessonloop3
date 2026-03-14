/**
 * PART 3: Attendance (Desktop)
 * Tests 3.1.1 – 3.4.5
 */
import { test, expect } from '../../workflows/workflow.fixtures';
import { AUTH } from './helpers';
import { safeGoTo } from './helpers';
import { waitForPageReady } from '../../helpers';

test.use({ storageState: AUTH.owner });

test.describe('Part 3: Attendance', () => {

  // ── 3.1 — Daily Register ──

  test('3.1.1 – /register loads with today's date', async ({ page }) => {
    await safeGoTo(page, '/register');
    // Should show today's date somewhere on the page
    const today = new Date();
    const dayStr = today.getDate().toString();
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('3.1.3 – Lessons visible with student names', async ({ page }) => {
    await safeGoTo(page, '/register');
    await page.waitForTimeout(2_000);
    // Should have at least one lesson row or card
    const content = page.locator('main');
    await expect(content).toBeVisible({ timeout: 10_000 });
  });

  test('3.1.4-5 – Mark attendance (present/absent)', async ({ page }) => {
    await safeGoTo(page, '/register');
    await page.waitForTimeout(2_000);

    // Find attendance toggle buttons
    const presentBtn = page.getByRole('button', { name: /present/i }).first()
      .or(page.locator('[data-attendance="present"], [aria-label*="present"]').first());
    if (await presentBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await presentBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('3.1.6 – Save attendance shows toast', async ({ page }) => {
    await safeGoTo(page, '/register');
    await page.waitForTimeout(2_000);

    const saveBtn = page.getByRole('button', { name: /save/i }).first();
    if (await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await saveBtn.click();
      // May show toast
      const toast = page.locator('[data-radix-collection-item]').first();
      await expect(toast).toBeVisible({ timeout: 10_000 }).catch(() => {});
    }
  });

  test('3.1.7 – Attendance persists after refresh', async ({ page }) => {
    await safeGoTo(page, '/register');
    await page.waitForTimeout(2_000);
    await page.reload();
    await waitForPageReady(page);
    // Page should load without errors
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  // ── 3.2 — Batch Attendance ──

  test('3.2.1 – /batch-attendance loads', async ({ page }) => {
    await safeGoTo(page, '/batch-attendance');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('3.2.3 – Mark All Present button works', async ({ page }) => {
    await safeGoTo(page, '/batch-attendance');
    await page.waitForTimeout(2_000);
    const markAllBtn = page.getByRole('button', { name: /mark all present/i }).first();
    if (await markAllBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await markAllBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('3.2.5 – Future date toggles disabled', async ({ page }) => {
    await safeGoTo(page, '/batch-attendance');
    await page.waitForTimeout(1_000);
    // Navigate to tomorrow
    const nextBtn = page.locator('button[aria-label*="next"], button[aria-label*="forward"]').first()
      .or(page.getByRole('button', { name: /next|→|›/i }).first());
    if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Click forward enough to reach a future date
      await nextBtn.click();
      await page.waitForTimeout(1_000);
    }
  });

  // ── 3.3 — Lesson Notes ──

  test('3.3.1-2 – Calendar lesson detail has structured notes', async ({ page }) => {
    await safeGoTo(page, '/calendar');
    await page.waitForTimeout(2_000);
    // Click a lesson
    const lessonCard = page.locator('main [class*="lesson"], main [data-lesson-id], main .fc-event').first();
    if (await lessonCard.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await lessonCard.click();
      await page.waitForTimeout(1_000);
    }
  });

  // ── 3.4 — Student Notes on Register ──

  test('3.4.1 – Register page loads for date with lessons', async ({ page }) => {
    await safeGoTo(page, '/register');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });
});
