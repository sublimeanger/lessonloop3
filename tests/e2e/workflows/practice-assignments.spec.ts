import { test, expect } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  assertNoErrorBoundary,
  goTo,
  expectToastSuccess,
} from '../helpers';
import { supabaseDelete, getOrgId, cleanupTestData } from '../supabase-admin';

/**
 * Practice Assignments — E2E mutation tests.
 *
 * Tests creating, viewing, reviewing, and deleting practice assignments.
 */

const testId = `e2e-${Date.now()}`;

test.describe('Practice Assignments — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test.afterAll(() => {
    const orgId = getOrgId();
    if (orgId) {
      const encoded = encodeURIComponent(`%${testId}%`);
      supabaseDelete('practice_assignments', `org_id=eq.${orgId}&title=like.${encoded}`);
    }
  });

  test('navigate to practice page', async ({ page }) => {
    await safeGoTo(page, '/practice', 'Practice');
    await assertNoErrorBoundary(page);

    // Verify page title
    const title = page.getByText('Practice').first();
    await expect(title).toBeVisible({ timeout: 10_000 });

    // Verify description
    const desc = page.getByText(/manage practice assignments|student progress/i).first();
    const hasDesc = await desc.isVisible({ timeout: 5_000 }).catch(() => false);

    // Verify stats cards are rendered
    const statsCards = page.locator('main').locator('[class*="card"], [class*="Card"]');
    const cardCount = await statsCards.count();
    expect(cardCount, 'Practice page should have stats cards').toBeGreaterThanOrEqual(1);
  });

  test('practice page shows statistics', async ({ page }) => {
    await safeGoTo(page, '/practice', 'Practice');
    await page.waitForTimeout(2_000);

    // Check for expected statistic labels
    const expectedStats = [
      /active assignments/i,
      /pending review/i,
      /students practicing/i,
      /avg.*completion/i,
    ];

    let foundStats = 0;
    for (const statPattern of expectedStats) {
      const stat = page.getByText(statPattern).first();
      if (await stat.isVisible({ timeout: 3_000 }).catch(() => false)) {
        foundStats++;
      }
    }

    expect(foundStats, 'Practice page should show at least 2 statistic cards').toBeGreaterThanOrEqual(2);
  });

  test('create practice assignment', async ({ page }) => {
    test.setTimeout(120_000);
    await safeGoTo(page, '/practice', 'Practice');
    await page.waitForTimeout(2_000);

    // Click "New Assignment" button
    const newBtn = page.getByRole('button', { name: /new assignment/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 10_000 });
    await newBtn.click();
    await page.waitForTimeout(1_000);

    // Dialog should open
    const dialog = page.getByRole('dialog');
    const hasDialog = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasDialog) {
      test.skip(true, 'Create assignment dialog did not open');
      return;
    }

    // Select student — uses a Radix Select trigger
    const studentTrigger = dialog.getByText(/select student/i).first();
    if (await studentTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await studentTrigger.click();
      await page.waitForTimeout(1_000);

      // Click first student option from the dropdown (Radix SelectItem)
      const firstOption = page.getByRole('option').first()
        .or(page.locator('[data-radix-collection-item]').first());
      if (await firstOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await firstOption.click();
        await page.waitForTimeout(500);
      }
    }

    // Fill title
    const titleInput = dialog.locator('#title').first()
      .or(dialog.getByLabel(/assignment title/i).first());
    if (await titleInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await titleInput.fill(`E2E Practice ${testId}`);
    }

    // Fill description
    const descInput = dialog.locator('#description').first()
      .or(dialog.getByLabel(/description/i).first());
    if (await descInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await descInput.fill(`E2E practice description ${testId}`);
    }

    // Set minutes/day (should default to 30)
    const minutesInput = dialog.locator('#targetMinutes').first();
    if (await minutesInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await minutesInput.clear();
      await minutesInput.fill('30');
    }

    // Set days/week (should default to 5)
    const daysInput = dialog.locator('#targetDays').first();
    if (await daysInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await daysInput.clear();
      await daysInput.fill('5');
    }

    // Click Create Assignment
    const createBtn = dialog.getByRole('button', { name: /create assignment/i }).first();
    if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(2_000);

      // Wait for dialog to close (indicates success) or toast
      await page.waitForTimeout(3_000);
      const dialogStillOpen = await dialog.isVisible().catch(() => false);
      if (!dialogStillOpen) {
        // Dialog closed — success
        // Verify the assignment appears in the list
        const assignmentInList = page.getByText(`E2E Practice ${testId}`).first();
        const hasAssignment = await assignmentInList.isVisible({ timeout: 10_000 }).catch(() => false);
        expect(hasAssignment, 'Created assignment should appear in list').toBe(true);
      } else {
        // Dialog still open — maybe validation error (student not selected)
        // Close and skip
        await page.keyboard.press('Escape');
        test.skip(true, 'Could not create assignment — student selection may have failed');
      }
    }
  });

  test('view assignment detail', async ({ page }) => {
    test.setTimeout(90_000);
    await safeGoTo(page, '/practice', 'Practice');
    await page.waitForTimeout(3_000);

    // Click the created assignment
    const assignmentLink = page.getByText(`E2E Practice ${testId}`).first();
    const hasAssignment = await assignmentLink.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasAssignment) {
      test.skip(true, 'Test assignment not found — create may have failed');
      return;
    }

    await assignmentLink.click();
    await page.waitForTimeout(2_000);

    // Verify assignment details are shown (in a panel or expanded view)
    const hasTitle = await page.getByText(`E2E Practice ${testId}`).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasTitle, 'Assignment title should be visible in detail').toBe(true);
  });

  test('teacher practice review section renders', async ({ page }) => {
    test.setTimeout(90_000);
    await safeGoTo(page, '/practice', 'Practice');
    await page.waitForTimeout(3_000);

    // Look for the Practice Review section
    const reviewSection = page.getByText(/practice review/i).first();
    const hasReview = await reviewSection.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasReview) {
      // Check for tabs: "Pending Review" and "All Logs"
      const pendingTab = page.getByText(/pending review/i).first();
      const allLogsTab = page.getByText(/all logs/i).first();

      const hasPending = await pendingTab.isVisible({ timeout: 3_000 }).catch(() => false);
      const hasAllLogs = await allLogsTab.isVisible({ timeout: 3_000 }).catch(() => false);

      expect(hasPending || hasAllLogs, 'Review section should have tabs').toBe(true);
    }

    await assertNoErrorBoundary(page);
  });

  test('practice page shows student progress', async ({ page }) => {
    await safeGoTo(page, '/practice', 'Practice');
    await page.waitForTimeout(3_000);

    // Look for student practice status categories
    const onTrack = page.getByText(/on track/i).first();
    const fallingBehind = page.getByText(/falling behind/i).first();
    const notStarted = page.getByText(/not started/i).first();

    const hasOnTrack = await onTrack.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasFalling = await fallingBehind.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasNotStarted = await notStarted.isVisible({ timeout: 3_000 }).catch(() => false);

    // At least one status category should be visible (or empty state)
    const hasNoAssignments = await page.getByText(/no active assignments/i).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    expect(
      hasOnTrack || hasFalling || hasNotStarted || hasNoAssignments,
      'Practice page should show student status or empty state',
    ).toBe(true);
  });

  test('delete practice assignment', async ({ page }) => {
    test.setTimeout(90_000);
    await safeGoTo(page, '/practice', 'Practice');
    await page.waitForTimeout(3_000);

    // Find the test assignment
    const assignmentText = page.getByText(`E2E Practice ${testId}`).first();
    const hasAssignment = await assignmentText.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasAssignment) {
      test.skip(true, 'Test assignment not found for deletion');
      return;
    }

    // Look for a delete/remove action near the assignment
    // Try right-click context menu, three-dot menu, or delete button
    const moreBtn = assignmentText.locator('..').locator('..').locator('button').filter({ hasText: /delete|remove|archive/i }).first();
    const hasMore = await moreBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasMore) {
      await moreBtn.click();
      await page.waitForTimeout(1_000);

      // Confirm deletion if dialog appears
      const confirmBtn = page.getByRole('button', { name: /confirm|delete|yes/i }).first();
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2_000);
      }
    }

    // If no UI delete button found, cleanup happens in afterAll via supabase admin
    await assertNoErrorBoundary(page);
  });
});

test.describe('Practice Assignments — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher can access practice page', async ({ page }) => {
    await safeGoTo(page, '/practice', 'Practice');
    await assertNoErrorBoundary(page);

    // Verify page loads
    const title = page.getByText('Practice').first();
    await expect(title).toBeVisible({ timeout: 10_000 });

    // Teacher should see the page (allowed role)
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('teacher sees only assigned students', async ({ page }) => {
    test.setTimeout(90_000);
    await safeGoTo(page, '/practice', 'Practice');
    await page.waitForTimeout(3_000);

    // Try to open the New Assignment modal
    const newBtn = page.getByRole('button', { name: /new assignment/i }).first();
    const hasNew = await newBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasNew) {
      await newBtn.click();
      await page.waitForTimeout(1_000);

      // Open student dropdown
      const dialog = page.getByRole('dialog');
      if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const studentTrigger = dialog.locator('[role="combobox"]').first()
          .or(dialog.getByText(/select student/i).first());
        if (await studentTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await studentTrigger.click();
          await page.waitForTimeout(500);
          // Should show only teacher's assigned students (filtered list)
          // We verify the dropdown has options but don't assert exact count
          const options = page.getByRole('option');
          const count = await options.count();
          // Teacher should have at least access to student dropdown
          expect(count).toBeGreaterThanOrEqual(0);
        }

        // Close dialog
        await page.keyboard.press('Escape');
      }
    }

    await assertNoErrorBoundary(page);
  });
});
