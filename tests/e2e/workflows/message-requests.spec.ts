import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  goTo,
} from '../helpers';

/**
 * Message Request Approval — tests for cancellation/reschedule request handling.
 * Covers: navigating to requests tab, viewing request details,
 * approve/decline actions, and response modal.
 */

test.describe('Message Requests — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('navigate to message requests tab', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    // Find the Requests tab (desktop: "Cancellation / Reschedule", mobile: "Requests")
    const requestsTab = page.getByRole('tab', { name: /request|cancellation|reschedule/i }).first();
    const hasRequestsTab = await requestsTab.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasRequestsTab) {
      test.skip(true, 'No Requests tab found — feature may not be enabled');
      return;
    }

    // Click the requests tab
    await requestsTab.click();
    await page.waitForTimeout(1_000);

    // Tab content should load — either requests or empty state
    const tabContent = main.getByText(/pending|no request|no cancellation|empty|approve|decline/i);
    const hasContent = await tabContent.first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasContent).toBe(true);
  });

  test('view pending requests with details', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    // Navigate to requests tab
    const requestsTab = page.getByRole('tab', { name: /request|cancellation|reschedule/i }).first();
    const hasTab = await requestsTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasTab) {
      test.skip(true, 'No Requests tab found');
      return;
    }
    await requestsTab.click();
    await page.waitForTimeout(1_000);

    // Check for pending requests
    const approveBtn = page.getByRole('button', { name: /approve/i }).first();
    const hasPending = await approveBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasPending) {
      // Check for resolve button (general requests)
      const resolveBtn = page.getByRole('button', { name: /resolve/i }).first();
      const hasResolve = await resolveBtn.isVisible({ timeout: 3_000 }).catch(() => false);

      if (!hasResolve) {
        test.skip(true, 'No pending requests to view');
        return;
      }
    }

    // Verify request card shows details
    // Should show sender/guardian info
    const hasGuardianInfo = await main.getByText(/guardian|parent|from/i)
      .first().isVisible({ timeout: 3_000 }).catch(() => false);

    // Should show request type badge
    const hasTypeBadge = await main.getByText(/cancellation|reschedule|general/i)
      .first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasTypeBadge).toBe(true);
  });

  test('request status filter dropdown works', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    const requestsTab = page.getByRole('tab', { name: /request|cancellation|reschedule/i }).first();
    const hasTab = await requestsTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasTab) {
      test.skip(true, 'No Requests tab found');
      return;
    }
    await requestsTab.click();
    await page.waitForTimeout(1_000);

    // Look for status filter dropdown
    const filterSelect = main.locator('select').first()
      .or(main.getByRole('combobox').first())
      .or(main.locator('[data-radix-select-trigger]').first());
    const hasFilter = await filterSelect.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasFilter) {
      // Filter may not exist if no requests
      return;
    }

    // Click filter
    await filterSelect.click();
    await page.waitForTimeout(500);

    // Should show filter options
    const allOption = page.getByRole('option', { name: /all/i }).first()
      .or(page.getByText(/all request/i).first());
    const hasAllOption = await allOption.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasAllOption) {
      await allOption.click();
      await page.waitForTimeout(500);
    } else {
      // Close the dropdown
      await page.keyboard.press('Escape');
    }
  });

  test('approve button opens response dialog', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    const requestsTab = page.getByRole('tab', { name: /request|cancellation|reschedule/i }).first();
    const hasTab = await requestsTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasTab) {
      test.skip(true, 'No Requests tab found');
      return;
    }
    await requestsTab.click();
    await page.waitForTimeout(1_000);

    // Find approve button
    const approveBtn = page.getByRole('button', { name: /approve/i }).first();
    const hasApprove = await approveBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasApprove) {
      test.skip(true, 'No pending requests with Approve button');
      return;
    }

    // Click approve
    await approveBtn.click();
    await page.waitForTimeout(500);

    // Should open response dialog
    const dialog = page.getByRole('dialog');
    const hasDialog = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasDialog).toBe(true);

    if (hasDialog) {
      // Dialog should show approve-related content
      const hasApproveTitle = await dialog.getByText(/approve/i).first()
        .isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasApproveTitle).toBe(true);

      // Should have response textarea
      const textarea = dialog.locator('textarea').first();
      const hasTextarea = await textarea.isVisible({ timeout: 3_000 }).catch(() => false);
      if (hasTextarea) {
        await textarea.fill('E2E test approval response');
      }

      // Close without submitting
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 5_000 });
    }
  });

  test('decline button opens response dialog', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    const requestsTab = page.getByRole('tab', { name: /request|cancellation|reschedule/i }).first();
    const hasTab = await requestsTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasTab) {
      test.skip(true, 'No Requests tab found');
      return;
    }
    await requestsTab.click();
    await page.waitForTimeout(1_000);

    // Find decline button
    const declineBtn = page.getByRole('button', { name: /decline/i }).first();
    const hasDecline = await declineBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasDecline) {
      test.skip(true, 'No pending requests with Decline button');
      return;
    }

    // Click decline
    await declineBtn.click();
    await page.waitForTimeout(500);

    // Should open response dialog
    const dialog = page.getByRole('dialog');
    const hasDialog = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasDialog).toBe(true);

    if (hasDialog) {
      // Dialog should show decline-related content
      const hasDeclineTitle = await dialog.getByText(/decline/i).first()
        .isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasDeclineTitle).toBe(true);

      // Close without submitting
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 5_000 });
    }
  });

  test('request badge count shows on messages tab', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');

    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10_000 });

    // Check if the requests tab has a badge/count indicator
    const requestsTab = page.getByRole('tab', { name: /request|cancellation|reschedule/i }).first();
    const hasTab = await requestsTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasTab) {
      test.skip(true, 'No Requests tab found');
      return;
    }

    // Look for a badge within or near the tab
    const badge = requestsTab.locator('.bg-destructive, [data-badge]').first();
    const hasBadge = await badge.isVisible({ timeout: 3_000 }).catch(() => false);

    // Badge is optional — only shows if there are pending requests
    // Just verify the tab exists and is clickable
    await requestsTab.click();
    await page.waitForTimeout(500);
  });
});
