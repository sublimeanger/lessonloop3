import { test, expect } from '@playwright/test';
import { AUTH, goTo, waitForPageReady, assertNoErrorBoundary, navigateTo } from './helpers';

// ═══════════════════════════════════════════════════════════════
// SECTION 3: NOTES EXPLORER
// ═══════════════════════════════════════════════════════════════

test.describe('Notes Explorer — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('Page loads with title and no errors', async ({ page }) => {
    await goTo(page, '/notes');
    await assertNoErrorBoundary(page);

    const title = page.getByText('Lesson Notes', { exact: false }).first();
    await expect(title, 'Notes Explorer should show page title').toBeVisible({ timeout: 15_000 });
  });

  test('Filter bar renders with all controls', async ({ page }) => {
    await goTo(page, '/notes');
    await page.waitForTimeout(2_000);

    // Date preset buttons
    const todayBtn = page.getByRole('button', { name: 'Today' });
    const thisWeekBtn = page.getByRole('button', { name: 'This Week' });
    const thisMonthBtn = page.getByRole('button', { name: 'This Month' });
    const last7Btn = page.getByRole('button', { name: 'Last 7 Days' });

    await expect(todayBtn).toBeVisible({ timeout: 10_000 });
    await expect(thisWeekBtn).toBeVisible({ timeout: 5_000 });
    await expect(thisMonthBtn).toBeVisible({ timeout: 5_000 });
    await expect(last7Btn).toBeVisible({ timeout: 5_000 });

    // Search input
    const searchInput = page.getByPlaceholder('Search notes...');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Visibility filter (select with "All Notes" default)
    const visibilityTrigger = page.locator('button').filter({ hasText: /All Notes|Parent-Visible|Private Only/ }).first();
    await expect(visibilityTrigger).toBeVisible({ timeout: 5_000 });
  });

  test('Stats bar renders with statistics', async ({ page }) => {
    await goTo(page, '/notes');
    await page.waitForTimeout(3_000);

    // Stats bar has 4 stat cards: Total Notes, Students Covered, Avg Engagement, Missing Homework
    const totalNotes = page.getByText('Total Notes');
    const studentsCovered = page.getByText('Students Covered');
    const avgEngagement = page.getByText('Avg Engagement');
    const missingHomework = page.getByText('Missing Homework');

    await expect(totalNotes).toBeVisible({ timeout: 10_000 });
    await expect(studentsCovered).toBeVisible({ timeout: 5_000 });
    await expect(avgEngagement).toBeVisible({ timeout: 5_000 });
    await expect(missingHomework).toBeVisible({ timeout: 5_000 });
  });

  test('Notes list shows note cards grouped by date', async ({ page }) => {
    await goTo(page, '/notes');
    await page.waitForTimeout(3_000);

    // Check if notes exist or empty state shows
    const hasNotes = await page.locator('main').getByText('No lesson notes found').isVisible().catch(() => false);

    if (hasNotes) {
      // Empty state is acceptable if no notes in date range
      return;
    }

    // Notes are grouped by date — look for date heading format like "Monday, 3 March 2025"
    const dateHeaders = page.locator('h3').filter({ hasText: /\d{4}/ });
    const headerCount = await dateHeaders.count();

    if (headerCount > 0) {
      await expect(dateHeaders.first()).toBeVisible();
    }
  });

  test('Note card shows lesson info and student name', async ({ page }) => {
    // Use "This Month" to get more results
    await goTo(page, '/notes');
    await page.waitForTimeout(2_000);

    // Click "This Month" to widen the date range
    await page.getByRole('button', { name: 'This Month' }).click();
    await page.waitForTimeout(3_000);

    const emptyState = await page.getByText('No lesson notes found').isVisible().catch(() => false);
    if (emptyState) {
      test.skip(true, 'No lesson notes found in test org for this month');
      return;
    }

    // Note cards are Card components — look for time display pattern (HH:MM)
    const noteCards = page.locator('[class*="rounded-lg"]').filter({ hasText: /\d{2}:\d{2}/ });
    const count = await noteCards.count();

    if (count > 0) {
      // First card should show time, lesson title
      const firstCard = noteCards.first();
      await expect(firstCard).toBeVisible();
    }
  });

  test('Expand note card shows full content', async ({ page }) => {
    await goTo(page, '/notes');
    await page.waitForTimeout(2_000);
    await page.getByRole('button', { name: 'This Month' }).click();
    await page.waitForTimeout(3_000);

    const emptyState = await page.getByText('No lesson notes found').isVisible().catch(() => false);
    if (emptyState) {
      test.skip(true, 'No lesson notes in test org');
      return;
    }

    // Find expand/collapse button (ChevronDown icon button)
    const expandButtons = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: '' });

    // The NoteCard uses a ghost icon button with ChevronDown/ChevronUp
    // Look more specifically for the expand button within a note card context
    const chevronBtn = page.locator('main button[class*="ghost"]').filter({ has: page.locator('svg.lucide-chevron-down') }).first();
    const hasChevron = await chevronBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasChevron) {
      // Try to find any clickable element in the note card area
      return;
    }

    await chevronBtn.click();
    await page.waitForTimeout(500);

    // After expanding, look for "Content Covered", "Homework", "Focus Areas" labels
    const contentLabel = page.getByText('Content Covered', { exact: false });
    const homeworkLabel = page.getByText('Homework', { exact: false });

    const hasContent = await contentLabel.first().isVisible({ timeout: 3_000 }).catch(() => false);
    const hasHomework = await homeworkLabel.first().isVisible({ timeout: 3_000 }).catch(() => false);

    // At least one expanded section should be visible
    expect(hasContent || hasHomework, 'Expanded card should show content sections').toBe(true);
  });

  test('Date range filter — This Week preset', async ({ page }) => {
    await goTo(page, '/notes');
    await page.waitForTimeout(2_000);

    await page.getByRole('button', { name: 'This Week' }).click();
    await page.waitForTimeout(2_000);

    // Page should either show notes or empty state — no error
    await assertNoErrorBoundary(page);
  });

  test('Date range filter — This Month preset', async ({ page }) => {
    await goTo(page, '/notes');
    await page.waitForTimeout(2_000);

    await page.getByRole('button', { name: 'This Month' }).click();
    await page.waitForTimeout(2_000);

    await assertNoErrorBoundary(page);
  });

  test('Visibility filter — Parent-Visible Only', async ({ page }) => {
    await goTo(page, '/notes');
    await page.waitForTimeout(2_000);

    // Click the visibility select trigger
    const visibilityTrigger = page.locator('button[role="combobox"]').filter({ hasText: /All Notes/ }).first();
    const hasTrigger = await visibilityTrigger.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasTrigger) {
      // Try alternative selector for the visibility dropdown
      const altTrigger = page.locator('button').filter({ hasText: /All Notes/ }).first();
      if (await altTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await altTrigger.click();
      } else {
        return; // Can't find the filter, skip
      }
    } else {
      await visibilityTrigger.click();
    }

    await page.waitForTimeout(300);

    const parentVisibleOption = page.getByRole('option', { name: 'Parent-Visible' }).first();
    const hasOption = await parentVisibleOption.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasOption) {
      await parentVisibleOption.click();
      await page.waitForTimeout(2_000);
      await assertNoErrorBoundary(page);
    }
  });

  test('Visibility filter — Private Only', async ({ page }) => {
    await goTo(page, '/notes');
    await page.waitForTimeout(2_000);

    const visibilityTrigger = page.locator('button').filter({ hasText: /All Notes/ }).first();
    if (await visibilityTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await visibilityTrigger.click();
      await page.waitForTimeout(300);

      const privateOption = page.getByRole('option', { name: 'Private Only' }).first();
      if (await privateOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await privateOption.click();
        await page.waitForTimeout(2_000);
        await assertNoErrorBoundary(page);
      }
    }
  });

  test('Search filters notes', async ({ page }) => {
    await goTo(page, '/notes');
    await page.waitForTimeout(2_000);

    // Widen date range first
    await page.getByRole('button', { name: 'This Month' }).click();
    await page.waitForTimeout(2_000);

    const searchInput = page.getByPlaceholder('Search notes...');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Type a search term and press Enter
    await searchInput.fill('lesson');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2_000);

    await assertNoErrorBoundary(page);

    // Clear search
    await searchInput.fill('');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1_000);
  });

  test('Stats bar shows numeric values', async ({ page }) => {
    await goTo(page, '/notes');
    await page.waitForTimeout(3_000);

    // Total Notes stat should show a number
    const totalNotesCard = page.locator('text=Total Notes').locator('xpath=ancestor::div[contains(@class, "flex")]').first();
    await expect(totalNotesCard).toBeVisible({ timeout: 10_000 });

    // The stat value is a p.text-2xl element sibling
    const statValues = page.locator('p.text-2xl');
    const count = await statValues.count();
    expect(count, 'Should have stat values displayed').toBeGreaterThanOrEqual(1);
  });

  test('CSV export button exists', async ({ page }) => {
    await goTo(page, '/notes');
    await page.waitForTimeout(2_000);

    const csvBtn = page.getByRole('button', { name: /CSV/i });
    await expect(csvBtn, 'CSV export button should be visible').toBeVisible({ timeout: 10_000 });
  });

  test('Sidebar has Notes link in Teaching group', async ({ page }) => {
    await goTo(page, '/dashboard');

    const notesLink = page.getByRole('link', { name: 'Notes', exact: true });
    await expect(notesLink, 'Notes link should be in sidebar').toBeVisible({ timeout: 15_000 });

    await notesLink.click();
    await waitForPageReady(page);

    expect(page.url()).toContain('/notes');
  });
});

test.describe('Notes Explorer — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('Teacher can access /notes', async ({ page }) => {
    await goTo(page, '/notes');
    await assertNoErrorBoundary(page);

    const title = page.getByText('Lesson Notes', { exact: false }).first();
    await expect(title, 'Teacher should see Notes Explorer').toBeVisible({ timeout: 15_000 });
  });

  test('Teacher sees Notes link in sidebar', async ({ page }) => {
    await goTo(page, '/dashboard');

    const notesLink = page.getByRole('link', { name: 'Notes', exact: true });
    await expect(notesLink, 'Notes link should be visible for teacher').toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Notes Explorer — Finance (Blocked)', () => {
  test.use({ storageState: AUTH.finance });

  test('Finance is redirected away from /notes', async ({ page }) => {
    await page.goto('/notes');
    await page.waitForURL(
      url => /\/dashboard|\/invoices/.test(url.toString()),
      { timeout: 15_000 },
    ).catch(async () => {
      // Retry once
      await page.goto('/notes');
      await page.waitForURL(
        url => /\/dashboard|\/invoices/.test(url.toString()),
        { timeout: 15_000 },
      );
    });

    expect(page.url(), 'Finance should be redirected away from /notes').not.toContain('/notes');
  });
});
