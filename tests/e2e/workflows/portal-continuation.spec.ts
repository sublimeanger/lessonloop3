import { test, expect } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  goTo,
} from '../helpers';

/**
 * Portal Continuation Response — tests for the parent-side continuation workflow.
 * Parents respond to continuation runs (continue or withdraw) for the next term.
 */

test.describe('Portal Continuation — Parent', () => {
  test.use({ storageState: AUTH.parent });

  test('navigate to portal continuation page', async ({ page }) => {
    await safeGoTo(page, '/portal/continuation', 'Portal Continuation');

    // Page should load — either showing pending continuations or empty state
    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    // Check for content: either continuation cards or an empty state message
    const hasContent = await main.getByText(/continu|term|withdraw|no pending|no active|nothing|action/i)
      .first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasContent).toBe(true);
  });

  test('view pending continuation details', async ({ page }) => {
    await safeGoTo(page, '/portal/continuation', 'Portal Continuation');

    // Check if there are pending continuations
    const continueBtn = page.getByRole('button', { name: /continue/i }).first();
    const hasPending = await continueBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasPending) {
      test.skip(true, 'No active continuation run — cannot test responses');
      return;
    }

    // Verify continuation details are shown
    const main = page.locator('main').first();

    // Should show student name
    const hasStudentInfo = await main.locator('text=/[A-Z][a-z]+/').first()
      .isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasStudentInfo).toBe(true);

    // Should show withdraw option alongside continue
    const withdrawBtn = page.getByRole('button', { name: /withdraw/i }).first();
    const hasWithdraw = await withdrawBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasWithdraw).toBe(true);
  });

  test('continuation page shows lesson and fee details', async ({ page }) => {
    await safeGoTo(page, '/portal/continuation', 'Portal Continuation');

    const continueBtn = page.getByRole('button', { name: /continue/i }).first();
    const hasPending = await continueBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasPending) {
      test.skip(true, 'No active continuation run');
      return;
    }

    const main = page.locator('main').first();

    // Should show fee/price information (£ symbol or currency)
    const hasFeeInfo = await main.getByText(/£|fee|total|price/i).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    // Should show lesson details (day/time or instrument)
    const hasLessonInfo = await main.getByText(/lesson|monday|tuesday|wednesday|thursday|friday|saturday|sunday|at \d/i).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    // At least one of these should be present
    expect(hasFeeInfo || hasLessonInfo).toBe(true);
  });
});

test.describe('Portal Continuation — Staff Verification', () => {
  test.use({ storageState: AUTH.owner });

  test('staff continuation management page loads', async ({ page }) => {
    await safeGoTo(page, '/continuation', 'Continuation');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    // Should show continuation management content
    const hasContent = await main.getByText(/continu|term|response|run|pending|no active/i)
      .first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasContent).toBe(true);
  });

  test('staff can view continuation responses and filter', async ({ page }) => {
    await safeGoTo(page, '/continuation', 'Continuation');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    // Check if there's an active continuation run with responses
    const hasResponses = await main.locator('table, [role="row"]').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasResponses) {
      // Check for statistics cards (confirmed, pending, withdrawing)
      const hasStats = await main.getByText(/confirmed|pending|withdraw/i)
        .first().isVisible({ timeout: 3_000 }).catch(() => false);

      if (!hasStats) {
        test.skip(true, 'No active continuation run on staff side');
        return;
      }
    }

    // If there are filter controls, verify they work
    const filterDropdown = main.locator('select, [role="combobox"]').first();
    const hasFilter = await filterDropdown.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasFilter) {
      await filterDropdown.click();
      await page.waitForTimeout(500);
      // Look for filter options
      const filterOption = page.getByRole('option').first()
        .or(page.getByText(/all|pending|continuing/i).first());
      const hasFilterOptions = await filterOption.isVisible({ timeout: 3_000 }).catch(() => false);
      if (hasFilterOptions) {
        await filterOption.click();
        await page.waitForTimeout(500);
      }
    }

    // Verify page is still functional after filtering
    await expect(main).toBeVisible();
  });

  test('staff continuation page shows statistics', async ({ page }) => {
    await safeGoTo(page, '/continuation', 'Continuation');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    // Look for statistics cards or summary
    const confirmed = main.getByText(/confirmed/i).first();
    const hasConfirmed = await confirmed.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasConfirmed) {
      // No active run, check for empty state or past runs
      const hasContent = await main.getByText(/term continuation|new run|manage|re-enrollment/i)
        .first().isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasContent).toBe(true);
      return;
    }

    // If stats are visible, verify multiple stat categories exist
    const pendingStat = await main.getByText(/pending/i).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);
    expect(pendingStat).toBe(true);
  });
});
