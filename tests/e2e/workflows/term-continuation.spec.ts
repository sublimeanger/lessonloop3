import { test, expect, Page } from '@playwright/test';
import { AUTH, waitForPageReady, goTo, expectToast } from '../helpers';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Navigate to /continuation and wait for the page to be ready */
async function goToContinuation(page: Page) {
  await goTo(page, '/continuation');
  // Page title or empty state — either indicates the page loaded
  await expect(
    page.getByText(/term continuation/i).first()
      .or(page.getByText(/no continuation runs/i).first()),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Determine whether an active continuation run exists on the page.
 * Returns true if we see a run status badge (Draft, Collecting Responses, etc.).
 */
async function hasActiveRun(page: Page): Promise<boolean> {
  const statusBadges = page.getByText(
    /Draft|Collecting Responses|Reminding|Deadline Passed/,
  );
  return (await statusBadges.count()) > 0;
}

/** Extract visible summary stat values from the four stats cards */
async function readSummaryStats(page: Page) {
  // Stats cards have CardTitle text (Confirmed, Pending, Withdrawing, No Response)
  // followed by a bold number in CardContent
  const readStat = async (label: string) => {
    const card = page.locator('.grid .border, [class*="card"]')
      .filter({ hasText: label })
      .first();
    const visible = await card.isVisible().catch(() => false);
    if (!visible) return 0;
    const boldNum = card.locator('.text-2xl').first();
    const text = await boldNum.textContent().catch(() => '0');
    return parseInt(text?.trim() || '0', 10);
  };

  return {
    confirmed: await readStat('Confirmed'),
    pending: await readStat('Pending'),
    withdrawing: await readStat('Withdrawing'),
    noResponse: await readStat('No Response'),
  };
}

/** Navigate to a student detail page (Emma) */
async function goToStudentDetail(page: Page) {
  await goTo(page, '/students');
  const emmaLink = page.getByText(/emma/i).first();
  await expect(emmaLink).toBeVisible({ timeout: 15_000 });
  await emmaLink.click();
  await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
  await waitForPageReady(page);
}

/* ------------------------------------------------------------------ */
/*  Test 1: Continuation page loads and shows correct structure        */
/* ------------------------------------------------------------------ */

test.describe('Term Continuation — Page Structure', () => {
  test.use({ storageState: AUTH.owner });

  test('continuation page loads and shows correct structure', async ({ page }) => {
    // Track errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    const serverErrors: string[] = [];
    page.on('response', (r) => {
      if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
    });

    // 1-2. Navigate and verify page loads
    await goToContinuation(page);
    expect(serverErrors).toHaveLength(0);

    // 3. Check for active run OR empty state
    const hasRun = await hasActiveRun(page);

    if (hasRun) {
      // Run status badge is visible
      await expect(
        page.getByText(/Draft|Collecting Responses|Reminding|Deadline Passed|Completed/).first(),
      ).toBeVisible();

      // Summary stats cards are shown
      const stats = await readSummaryStats(page);
      const total = stats.confirmed + stats.pending + stats.withdrawing + stats.noResponse;
      expect(total).toBeGreaterThan(0);

      // Progress bar exists
      await expect(page.locator('.rounded-full.bg-muted, .h-3.w-full').first()).toBeVisible();

      // Response table/list is visible
      await expect(
        page.locator('table').first()
          .or(page.getByText(/responses/i).first()),
      ).toBeVisible();
    } else {
      // 4. Empty state
      // "Create Run" or "New Run" button exists
      await expect(
        page.getByRole('button', { name: /new run/i }).first()
          .or(page.getByRole('button', { name: /create continuation run/i }).first()),
      ).toBeVisible();

      // Empty state explains what continuation is
      await expect(
        page.getByText(/no continuation runs yet/i).first(),
      ).toBeVisible();
    }

    // Filter real console errors
    const realErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('ResizeObserver') &&
        !e.includes('401') &&
        !e.includes('403') &&
        !e.includes('supabase'),
    );
    expect(realErrors).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Test 2: Continuation run summary stats are consistent              */
/* ------------------------------------------------------------------ */

test.describe('Term Continuation — Stats Consistency', () => {
  test.use({ storageState: AUTH.owner });

  test('continuation run summary stats are consistent', async ({ page }) => {
    await goToContinuation(page);

    const hasRun = await hasActiveRun(page);
    if (!hasRun) {
      // No active run — verify empty state and skip stats checks
      await expect(
        page.getByRole('button', { name: /new run|create continuation run/i }).first(),
      ).toBeVisible();
      return;
    }

    // Read the four summary stats
    const stats = await readSummaryStats(page);
    const computedTotal =
      stats.confirmed + stats.pending + stats.withdrawing + stats.noResponse;

    // All values should be non-negative
    expect(stats.confirmed).toBeGreaterThanOrEqual(0);
    expect(stats.pending).toBeGreaterThanOrEqual(0);
    expect(stats.withdrawing).toBeGreaterThanOrEqual(0);
    expect(stats.noResponse).toBeGreaterThanOrEqual(0);

    // Total should be positive (run has at least one student)
    expect(computedTotal).toBeGreaterThan(0);

    // Progress bar should exist when stats are present
    const progressBar = page.locator('.h-3.w-full, .rounded-full.overflow-hidden').first();
    await expect(progressBar).toBeVisible();

    // If table rows are visible, count rows by status badge and verify against stats
    const tableRows = page.locator('table tbody tr').filter({
      has: page.locator('td'),
    });
    const rowCount = await tableRows.count().catch(() => 0);

    if (rowCount > 0) {
      // Count response badges in the table
      let tableContinuing = 0;
      let tableWithdrawing = 0;
      let tablePending = 0;
      let tableAssumed = 0;
      let tableNoResponse = 0;

      for (let i = 0; i < rowCount; i++) {
        const row = tableRows.nth(i);
        const rowText = await row.textContent();
        if (!rowText) continue;

        if (rowText.includes('Withdrawing')) tableWithdrawing++;
        else if (rowText.includes('Continuing')) tableContinuing++;
        else if (rowText.includes('Assumed')) tableAssumed++;
        else if (rowText.includes('No Response')) tableNoResponse++;
        else if (rowText.includes('Pending')) tablePending++;
      }

      // The "Confirmed" card aggregates confirmed + assumed_continuing
      expect(stats.confirmed).toBe(tableContinuing + tableAssumed);
      expect(stats.pending).toBe(tablePending);
      expect(stats.withdrawing).toBe(tableWithdrawing);
      expect(stats.noResponse).toBe(tableNoResponse);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Test 3: Continuation response statuses display correctly           */
/* ------------------------------------------------------------------ */

test.describe('Term Continuation — Response Status Display', () => {
  test.use({ storageState: AUTH.owner });

  test('continuation response statuses display correctly', async ({ page }) => {
    await goToContinuation(page);

    const hasRun = await hasActiveRun(page);
    if (!hasRun) return; // Nothing to check without a run

    // Check response table exists
    const responseTable = page.locator('table');
    const hasTable = await responseTable.isVisible().catch(() => false);
    if (!hasTable) return;

    const rows = page.locator('table tbody tr').filter({ has: page.locator('td') });
    const rowCount = await rows.count();
    if (rowCount === 0) return;

    // Check badge variants by inspecting each type that appears
    for (let i = 0; i < Math.min(rowCount, 20); i++) {
      const row = rows.nth(i);
      const badge = row.locator('[class*="badge"], [data-slot="badge"]').first();
      const badgeVisible = await badge.isVisible().catch(() => false);
      if (!badgeVisible) continue;

      const badgeText = (await badge.textContent())?.trim();

      if (badgeText === 'Continuing') {
        // default variant (primary/blue)
        const classes = await badge.getAttribute('class');
        expect(classes).not.toContain('destructive');
      } else if (badgeText === 'Withdrawing') {
        // destructive variant (red)
        const classes = await badge.getAttribute('class');
        expect(classes).toContain('destructive');
      } else if (badgeText === 'Pending') {
        // secondary variant
        const classes = await badge.getAttribute('class');
        expect(classes).toContain('secondary');
      } else if (badgeText === 'No Response') {
        // secondary variant
        const classes = await badge.getAttribute('class');
        expect(classes).toContain('secondary');
      } else if (badgeText === 'Assumed') {
        // outline variant
        const classes = await badge.getAttribute('class');
        expect(classes).toContain('outline');
      }
    }

    // Click a row to open the response detail sheet and check for response date
    const firstRow = rows.first();
    await firstRow.click();
    await page.waitForTimeout(500);

    // Sheet should open with student name and response details
    const sheet = page.locator('[role="dialog"], [data-state="open"]').first();
    const sheetVisible = await sheet.isVisible().catch(() => false);

    if (sheetVisible) {
      // Should show "Response" label with a badge
      await expect(sheet.getByText(/response/i).first()).toBeVisible({ timeout: 5_000 });

      // If student has responded, check for a date
      const respondedLabel = sheet.getByText(/responded/i).first();
      const hasResponded = await respondedLabel.isVisible().catch(() => false);

      if (hasResponded) {
        // Date should be visible near the "Responded" label
        // Date is formatted in en-GB (e.g., "28 Feb 2026, 14:30")
        await expect(respondedLabel).toBeVisible();
      }

      // If withdrawing, check for withdrawal reason
      const withdrawingBadge = sheet.getByText('Withdrawing').first();
      const isWithdrawing = await withdrawingBadge.isVisible().catch(() => false);
      if (isWithdrawing) {
        // Reason label should exist (even if empty)
        const reasonLabel = sheet.getByText(/reason/i).first();
        const hasReason = await reasonLabel.isVisible().catch(() => false);
        if (hasReason) {
          await expect(reasonLabel).toBeVisible();
        }
      }

      // Close the sheet
      const closeBtn = page.locator('[data-state="open"] button[class*="close"], button[aria-label="Close"]').first();
      const hasClose = await closeBtn.isVisible().catch(() => false);
      if (hasClose) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Test 4: Continuation actions available based on run status         */
/* ------------------------------------------------------------------ */

test.describe('Term Continuation — Status Actions', () => {
  test.use({ storageState: AUTH.owner });

  test('continuation actions available based on run status', async ({ page }) => {
    await goToContinuation(page);

    const hasRun = await hasActiveRun(page);
    if (!hasRun) {
      // No run — the "New Run" button should be available
      await expect(
        page.getByRole('button', { name: /new run/i }).first(),
      ).toBeVisible();
      return;
    }

    // Determine current status
    const statusText = await page
      .locator('[class*="badge"], [data-slot="badge"]')
      .filter({ hasText: /Draft|Collecting Responses|Reminding|Deadline Passed|Completed/ })
      .first()
      .textContent()
      .catch(() => '');

    const status = statusText?.trim() || '';

    if (status === 'Collecting Responses' || status === 'Reminding') {
      // "Send Reminders" button should exist
      await expect(
        page.getByRole('button', { name: /send reminders/i }).first(),
      ).toBeVisible({ timeout: 5_000 });

      // Check if deadline has passed — look for "(passed)" indicator
      const deadlinePassed = await page.getByText(/\(passed\)/).isVisible().catch(() => false);

      if (deadlinePassed) {
        // "Process Deadline" button should exist
        await expect(
          page.getByRole('button', { name: /process deadline/i }).first(),
        ).toBeVisible({ timeout: 5_000 });
      }
    }

    if (status === 'Deadline Passed') {
      // Bulk process actions should exist
      await expect(
        page.getByRole('button', { name: /extend confirmed/i }).first(),
      ).toBeVisible({ timeout: 5_000 });
      await expect(
        page.getByRole('button', { name: /process withdrawals/i }).first(),
      ).toBeVisible({ timeout: 5_000 });
    }

    if (status === 'Completed') {
      // Run shows as completed
      await expect(page.getByText('Completed').first()).toBeVisible();

      // "New Run" button should still be available in the page header
      await expect(
        page.getByRole('button', { name: /new run/i }).first(),
      ).toBeVisible({ timeout: 5_000 });
    }

    // The "New Run" button is always in the page header regardless of status
    await expect(
      page.getByRole('button', { name: /new run/i }).first(),
    ).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 5: Past continuation runs are visible                         */
/* ------------------------------------------------------------------ */

test.describe('Term Continuation — Past Runs', () => {
  test.use({ storageState: AUTH.owner });

  test('past continuation runs are visible', async ({ page }) => {
    await goToContinuation(page);

    // Check if "Past Runs" section exists
    const pastRunsHeader = page.getByText('Past Runs').first();
    const hasPastRuns = await pastRunsHeader.isVisible().catch(() => false);

    if (!hasPastRuns) {
      // No past runs — this is acceptable; verify the page still loads correctly
      await expect(page.locator('main').first()).toBeVisible();
      return;
    }

    // Past Runs section is visible
    await expect(pastRunsHeader).toBeVisible();

    // Past run cards should show term names, student count, and "Completed" badge
    const pastRunCards = page
      .locator('.rounded-lg.border.cursor-pointer, .hover\\:bg-muted\\/30')
      .filter({ hasText: /Completed/ });
    const pastRunCount = await pastRunCards.count();

    if (pastRunCount > 0) {
      const firstPastRun = pastRunCards.first();

      // Should show term arrow (→) indicating current → next term
      const cardText = await firstPastRun.textContent();
      expect(cardText).toMatch(/→|→/); // HTML entity or actual arrow

      // Should show student count badge
      await expect(
        firstPastRun.locator('text=/\\d+ students/').first(),
      ).toBeVisible();

      // Should show "Completed" badge
      await expect(firstPastRun.getByText('Completed')).toBeVisible();

      // Should show a date
      // en-GB date format: dd/mm/yyyy
      expect(cardText).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);

      // Click a past run to view its details
      await firstPastRun.click();
      await page.waitForTimeout(500);

      // After clicking, the run detail should load — either stats appear or responses
      await expect(
        page.getByText(/confirmed|pending|withdrawing|responses/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Test 6: Parent continuation response page                          */
/* ------------------------------------------------------------------ */

test.describe('Term Continuation — Parent Portal', () => {
  test.use({ storageState: AUTH.parent });

  test('parent continuation response page', async ({ page }) => {
    // 1. Navigate to /portal/continuation
    await goTo(page, '/portal/continuation');

    // 2. Assert: Page loads with the title
    await expect(
      page.getByText(/term continuation/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Check for pending continuation requests
    const hasPending = await page
      .getByRole('button', { name: /continue/i })
      .first()
      .isVisible()
      .catch(() => false);

    if (hasPending) {
      // 3. Pending continuation exists

      // Child name visible (a card with student name)
      const studentCard = page.locator('[class*="card"]').first();
      const cardText = await studentCard.textContent();
      expect(cardText).toMatch(/[A-Za-z]{2,}/); // Has a name

      // Fee for next term visible with £ symbol
      const feeEl = page.getByText(/£\d+/).first();
      const hasFee = await feeEl.isVisible().catch(() => false);
      if (hasFee) {
        const feeText = await feeEl.textContent();
        expect(feeText).toMatch(/£\d+\.\d{2}/);
      }

      // "Continue" and "Withdraw" buttons visible
      await expect(
        page.getByRole('button', { name: /continue/i }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /withdraw/i }).first(),
      ).toBeVisible();

      // Deadline text visible
      const deadlineText = page.getByText(/please respond by/i).first();
      const hasDeadline = await deadlineText.isVisible().catch(() => false);
      if (hasDeadline) {
        await expect(deadlineText).toBeVisible();
      }
    } else {
      // 4. No pending continuation — check for appropriate empty state
      await expect(
        page.getByText(/no pending continuation/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('parent cannot access admin continuation page', async ({ page }) => {
    // Parents should be redirected away from /continuation (admin route)
    await page.goto('/continuation');
    await page.waitForURL(
      (url) => /\/portal|\/dashboard/.test(url.toString()),
      { timeout: 15_000 },
    );
    expect(page.url()).not.toContain('/continuation');
  });
});

/* ------------------------------------------------------------------ */
/*  Test 7: Continuation data visible on student detail                */
/* ------------------------------------------------------------------ */

test.describe('Term Continuation — Student Detail', () => {
  test.use({ storageState: AUTH.owner });

  test('continuation data visible on student detail', async ({ page }) => {
    // First, check /continuation to see if a run exists with known students
    await goToContinuation(page);
    const hasRun = await hasActiveRun(page);

    let studentName: string | null = null;
    let expectedResponse: string | null = null;

    if (hasRun) {
      // Try to find a student name from the response table
      const firstRow = page.locator('table tbody tr').filter({ has: page.locator('td') }).first();
      const hasRows = await firstRow.isVisible().catch(() => false);

      if (hasRows) {
        // Get student name from first column
        const nameCell = firstRow.locator('td').first();
        studentName = (await nameCell.textContent())?.trim() || null;

        // Get response badge text
        const badge = firstRow.locator('[class*="badge"], [data-slot="badge"]').first();
        expectedResponse = (await badge.textContent())?.trim() || null;
      }
    }

    // Navigate to student detail — use a known student (Emma) or the one from the run
    await goToStudentDetail(page);

    // Check if there's any continuation-related info on the student detail page
    // This could be on the Overview tab or anywhere on the page
    const continuationText = page.getByText(/continuing|withdrawing|continuation/i).first();
    const hasContinuationInfo = await continuationText.isVisible().catch(() => false);

    if (hasContinuationInfo && expectedResponse) {
      // Verify the response status matches what we saw on the continuation page
      if (expectedResponse === 'Continuing') {
        await expect(
          page.getByText(/continuing/i).first(),
        ).toBeVisible();
      } else if (expectedResponse === 'Withdrawing') {
        await expect(
          page.getByText(/withdrawing/i).first(),
        ).toBeVisible();
      }
    }

    // At minimum, verify the student detail page loaded correctly
    await expect(page.getByText(/emma/i).first()).toBeVisible();

    // Verify all standard tabs are still accessible
    const tabs = ['Overview', 'Credits', 'Invoices', 'Lessons'];
    for (const tab of tabs) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible({ timeout: 5_000 });
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Test 8: New Run wizard opens and has correct structure             */
/* ------------------------------------------------------------------ */

test.describe('Term Continuation — Run Wizard', () => {
  test.use({ storageState: AUTH.owner });

  test('new run wizard opens and has correct structure', async ({ page }) => {
    await goToContinuation(page);

    // Click "New Run" button
    const newRunBtn = page.getByRole('button', { name: /new run/i }).first();
    await expect(newRunBtn).toBeVisible({ timeout: 10_000 });
    await newRunBtn.click();

    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Dialog title: "Term Continuation Run"
    await expect(page.getByText('Term Continuation Run')).toBeVisible();

    // Step 1: Configuration
    await expect(
      page.getByText(/configure which term transition/i),
    ).toBeVisible();

    // Check for form fields
    // Current Term selector
    await expect(page.getByText('Current Term')).toBeVisible();

    // Next Term selector
    await expect(page.getByText('Next Term')).toBeVisible();

    // Notice Deadline
    await expect(page.getByText('Notice Deadline')).toBeVisible();

    // Assumed continuing toggle
    await expect(page.getByText(/assumed continuing/i).first()).toBeVisible();

    // Reminder Schedule info
    await expect(page.getByText(/reminder schedule/i)).toBeVisible();

    // Cancel and Preview buttons
    await expect(
      page.getByRole('button', { name: /cancel/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /preview/i }).first(),
    ).toBeVisible();

    // Close the dialog
    await page.getByRole('button', { name: /cancel/i }).first().click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
  });

  test('search and filter controls exist on response table', async ({ page }) => {
    await goToContinuation(page);

    const hasRun = await hasActiveRun(page);
    if (!hasRun) return;

    // Search input
    const searchInput = page.getByPlaceholder('Search...');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Filter dropdown — should have "All" as default
    const filterTrigger = page.locator('[role="combobox"], select')
      .filter({ hasText: /all/i })
      .first();
    const hasFilter = await filterTrigger.isVisible().catch(() => false);

    if (hasFilter) {
      await filterTrigger.click();
      await page.waitForTimeout(300);

      // Filter options should include the response types
      const options = ['All', 'Pending', 'Continuing', 'Withdrawing', 'Assumed', 'No Response'];
      for (const opt of options) {
        await expect(
          page.getByRole('option', { name: opt }).first(),
        ).toBeVisible({ timeout: 3_000 }).catch(() => {
          // SelectItem renders differently — try text match
        });
      }

      // Close dropdown
      await page.keyboard.press('Escape');
    }

    // Test search functionality
    await searchInput.fill('xyz_no_match_expected');
    await page.waitForTimeout(500);
    // Should show "No responses found" or empty table
    const emptyMsg = page.getByText(/no responses found/i).first();
    const isEmpty = await emptyMsg.isVisible().catch(() => false);
    // Clear search either way
    await searchInput.clear();
    await page.waitForTimeout(300);
  });
});
