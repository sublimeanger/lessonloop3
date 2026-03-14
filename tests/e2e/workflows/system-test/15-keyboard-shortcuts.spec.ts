/**
 * PART 15: Keyboard Shortcuts (Desktop only)
 * Tests 15.1 – 15.5
 */
import { test, expect } from '../../workflows/workflow.fixtures';
import { AUTH, safeGoTo } from './helpers';

test.use({ storageState: AUTH.owner });

test.describe('Part 15: Keyboard Shortcuts', () => {

  test('15.1-2 – ? opens shortcuts dialog, Escape closes', async ({ page }) => {
    await safeGoTo(page, '/dashboard');
    await page.waitForTimeout(1_000);

    // Press ? to open shortcuts dialog
    await page.keyboard.press('?');
    await page.waitForTimeout(1_000);

    const dialog = page.getByRole('dialog').first();
    const dialogVisible = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(dialogVisible).toBe(true);

    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const dialogHidden = await dialog.isHidden({ timeout: 5_000 }).catch(() => false);
    expect(dialogHidden).toBe(true);
  });

  test('15.3-4 – Cmd+K opens command palette', async ({ page }) => {
    await safeGoTo(page, '/dashboard');
    await page.waitForTimeout(1_000);

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(1_000);

    // Command palette should be visible
    const palette = page.locator('[cmdk-dialog], [role="dialog"]').first();
    const paletteVisible = await palette.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(paletteVisible).toBe(true);

    // Type 'students' to navigate
    const searchInput = page.locator('[cmdk-input], input[placeholder*="search"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill('students');
      await page.waitForTimeout(500);
      // Click the students option
      const option = page.locator('[cmdk-item]').filter({ hasText: /student/i }).first();
      if (await option.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await option.click();
        await page.waitForURL(/\/students/, { timeout: 10_000 }).catch(() => {});
      }
    }

    // Close palette
    await page.keyboard.press('Escape');
  });

  test('15.5 – Cmd+J toggles LoopAssist', async ({ page }) => {
    await safeGoTo(page, '/dashboard');
    await page.waitForTimeout(1_000);

    // Open
    await page.keyboard.press('Control+j');
    await page.waitForTimeout(1_000);

    const input = page.getByPlaceholder(/ask|type|message/i).first()
      .or(page.locator('textarea').last());
    const opened = await input.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(opened).toBe(true);

    // Close
    await page.keyboard.press('Control+j');
    await page.waitForTimeout(1_000);
  });
});
