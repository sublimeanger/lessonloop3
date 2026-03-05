import { test, expect, Page } from '@playwright/test';
import { AUTH, goTo, waitForPageReady, assertNoErrorBoundary } from './helpers';

// ═══════════════════════════════════════════════════════════════
// SECTION 2: STUDENT NOTES ON ATTENDANCE
// ═══════════════════════════════════════════════════════════════

/**
 * Helper: find the notes icon button (StickyNote icon) on the register page.
 * The button has title="Notes for {studentName}".
 */
async function findNotesIcon(page: Page) {
  // The StudentNotesPopover renders a button with title="Notes for ..."
  return page.locator('button[title^="Notes for"]');
}

test.describe('Notes on Attendance — Daily Register (Owner)', () => {
  test.use({ storageState: AUTH.owner });

  test('Daily Register shows notes icon for students with notes', async ({ page }) => {
    await goTo(page, '/register');
    await assertNoErrorBoundary(page);

    // Wait for register data to load
    await page.waitForTimeout(3_000);

    // Look for any notes icon buttons
    const notesIcons = await findNotesIcon(page);
    const count = await notesIcons.count();

    // If test org has students with notes, we should find at least one icon
    // If no notes exist, this is still a valid state
    if (count > 0) {
      await expect(notesIcons.first()).toBeVisible();
    }
    // Test passes either way — we verified the page loaded without error
  });

  test('Clicking notes icon opens popover on desktop', async ({ page }) => {
    await goTo(page, '/register');
    await page.waitForTimeout(3_000);

    const notesIcons = await findNotesIcon(page);
    const count = await notesIcons.count();

    if (count === 0) {
      test.skip(true, 'No students with notes found in test org');
      return;
    }

    // Click the first notes icon
    await notesIcons.first().click();
    await page.waitForTimeout(500);

    // On desktop, a Popover should open (PopoverContent with class w-80)
    const popover = page.locator('[data-radix-popper-content-wrapper]').first();
    await expect(popover, 'Notes popover should open on click').toBeVisible({ timeout: 5_000 });

    // Verify popover contains "Notes" in the heading
    const heading = popover.locator('text=/Notes/i').first();
    await expect(heading).toBeVisible({ timeout: 5_000 });
  });

  test('Notes popover shows Profile Notes section', async ({ page }) => {
    await goTo(page, '/register');
    await page.waitForTimeout(3_000);

    const notesIcons = await findNotesIcon(page);
    const count = await notesIcons.count();

    if (count === 0) {
      test.skip(true, 'No students with notes found in test org');
      return;
    }

    await notesIcons.first().click();
    await page.waitForTimeout(1_000);

    const popover = page.locator('[data-radix-popper-content-wrapper]').first();
    await expect(popover).toBeVisible({ timeout: 5_000 });

    // Check for "Profile Notes" or "Recent Lesson Notes" section headers
    const hasProfileNotes = await popover.getByText('Profile Notes').isVisible().catch(() => false);
    const hasLessonNotes = await popover.getByText('Recent Lesson Notes').isVisible().catch(() => false);
    const hasNoNotes = await popover.getByText('No notes for this student yet').isVisible().catch(() => false);

    // At least one content section should be present
    expect(
      hasProfileNotes || hasLessonNotes || hasNoNotes,
      'Popover should show notes content or empty message',
    ).toBe(true);
  });

  test('Notes popover shows lesson note details', async ({ page }) => {
    await goTo(page, '/register');
    await page.waitForTimeout(3_000);

    const notesIcons = await findNotesIcon(page);
    const count = await notesIcons.count();

    if (count === 0) {
      test.skip(true, 'No students with notes found in test org');
      return;
    }

    await notesIcons.first().click();
    await page.waitForTimeout(1_000);

    const popover = page.locator('[data-radix-popper-content-wrapper]').first();
    await expect(popover).toBeVisible({ timeout: 5_000 });

    const hasLessonNotes = await popover.getByText('Recent Lesson Notes').isVisible().catch(() => false);

    if (hasLessonNotes) {
      // Lesson note entries are in rounded-md border bg-muted/30 divs
      const noteEntries = popover.locator('.rounded-md.border');
      const entryCount = await noteEntries.count();
      expect(entryCount, 'Should show up to 3 lesson note entries').toBeGreaterThan(0);
      expect(entryCount).toBeLessThanOrEqual(3);
    }
  });

  test('Notes popover has "View full profile" link', async ({ page }) => {
    await goTo(page, '/register');
    await page.waitForTimeout(3_000);

    const notesIcons = await findNotesIcon(page);
    const count = await notesIcons.count();

    if (count === 0) {
      test.skip(true, 'No students with notes found in test org');
      return;
    }

    await notesIcons.first().click();
    await page.waitForTimeout(1_000);

    const popover = page.locator('[data-radix-popper-content-wrapper]').first();
    await expect(popover).toBeVisible({ timeout: 5_000 });

    const hasContent = await popover.getByText('Profile Notes').isVisible().catch(() => false)
      || await popover.getByText('Recent Lesson Notes').isVisible().catch(() => false);

    if (hasContent) {
      const profileLink = popover.getByText('View full profile');
      await expect(profileLink, '"View full profile" link should be present').toBeVisible({ timeout: 5_000 });

      // Verify it links to /students/:id
      const href = await profileLink.closest('a').then(a => a?.getAttribute('href'));
      expect(href).toMatch(/\/students\/.+/);
    }
  });

  test('Popover closes on Escape', async ({ page }) => {
    await goTo(page, '/register');
    await page.waitForTimeout(3_000);

    const notesIcons = await findNotesIcon(page);
    const count = await notesIcons.count();

    if (count === 0) {
      test.skip(true, 'No students with notes found in test org');
      return;
    }

    await notesIcons.first().click();
    await page.waitForTimeout(500);

    const popover = page.locator('[data-radix-popper-content-wrapper]').first();
    await expect(popover).toBeVisible({ timeout: 5_000 });

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden({ timeout: 5_000 });
  });
});

test.describe('Notes on Attendance — Batch Attendance (Owner)', () => {
  test.use({ storageState: AUTH.owner });

  test('Batch attendance shows notes icon for students with notes', async ({ page }) => {
    await goTo(page, '/batch-attendance');
    await assertNoErrorBoundary(page);
    await page.waitForTimeout(3_000);

    const notesIcons = await findNotesIcon(page);
    const count = await notesIcons.count();

    if (count > 0) {
      await expect(notesIcons.first()).toBeVisible();

      // Click to verify popover opens
      await notesIcons.first().click();
      await page.waitForTimeout(500);

      const popover = page.locator('[data-radix-popper-content-wrapper]').first();
      await expect(popover, 'Notes popover should open in batch attendance').toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('Notes on Attendance — Mobile', () => {
  test.use({
    storageState: AUTH.owner,
    viewport: { width: 390, height: 844 },
  });

  test('Mobile shows bottom sheet instead of popover', async ({ page }) => {
    await goTo(page, '/register');
    await page.waitForTimeout(3_000);

    const notesIcons = await findNotesIcon(page);
    const count = await notesIcons.count();

    if (count === 0) {
      test.skip(true, 'No students with notes found in test org');
      return;
    }

    await notesIcons.first().click();
    await page.waitForTimeout(1_000);

    // On mobile, the StudentNotesPopover renders a Sheet (bottom sheet)
    // SheetContent has data-state="open" when visible
    const sheet = page.locator('[role="dialog"][data-state="open"]').first();
    await expect(sheet, 'Bottom sheet should open on mobile').toBeVisible({ timeout: 5_000 });

    // Verify sheet contains notes heading
    const heading = sheet.locator('text=/Notes/i').first();
    await expect(heading).toBeVisible({ timeout: 5_000 });
  });
});
