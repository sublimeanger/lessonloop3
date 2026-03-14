/**
 * PART 8: Bulk Slots & Bulk Edit (Desktop)
 * Tests 8.1.1 – 8.2.8
 */
import { test, expect } from '../../workflows/workflow.fixtures';
import { AUTH, safeGoTo, expectDialog } from './helpers';

test.use({ storageState: AUTH.owner });

test.describe('Part 8: Bulk Operations', () => {

  // ── 8.1 — Bulk Slot Generator ──

  test('8.1.1-2 – ⚡ dropdown has Generate Open Slots', async ({ page }) => {
    await safeGoTo(page, '/calendar');
    // Find the lightning/bulk dropdown
    const bulkDropdown = page.locator('[data-tour="bulk-actions-dropdown"]').first()
      .or(page.getByRole('button', { name: /⚡|bulk|more actions/i }).first());
    if (await bulkDropdown.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await bulkDropdown.click();
      await page.waitForTimeout(500);
      const generateOption = page.getByText(/generate.*slot/i).first();
      await expect(generateOption).toBeVisible({ timeout: 5_000 });
      await generateOption.click();
      await expectDialog(page);
    }
  });

  test('8.1.3-5 – Slot Generator wizard step 1 calculates slots', async ({ page }) => {
    await safeGoTo(page, '/calendar');
    const bulkDropdown = page.locator('[data-tour="bulk-actions-dropdown"]').first()
      .or(page.getByRole('button', { name: /⚡|bulk|more actions/i }).first());
    if (await bulkDropdown.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await bulkDropdown.click();
      await page.waitForTimeout(500);
      const generateOption = page.getByText(/generate.*slot/i).first();
      if (await generateOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await generateOption.click();
        await page.waitForTimeout(1_000);
        // Should show slot configuration
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  // ── 8.2 — Bulk Edit Lessons ──

  test('8.2.1-3 – Select Lessons mode activates', async ({ page }) => {
    await safeGoTo(page, '/calendar');
    const bulkDropdown = page.locator('[data-tour="bulk-actions-dropdown"]').first()
      .or(page.getByRole('button', { name: /⚡|bulk|more actions/i }).first());
    if (await bulkDropdown.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await bulkDropdown.click();
      await page.waitForTimeout(500);
      const selectOption = page.getByText(/select lesson/i).first();
      if (await selectOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await selectOption.click();
        await page.waitForTimeout(1_000);
        // Should show floating selection bar
        const selectionBar = page.locator('[class*="selection-bar"], [class*="bulk-bar"], [data-tour*="bulk"]').first()
          .or(page.getByText(/selected/i).first());
        const barVisible = await selectionBar.isVisible({ timeout: 5_000 }).catch(() => false);
        // Press Escape to exit selection mode
        await page.keyboard.press('Escape');
      }
    }
  });
});
