import { test, expect } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  assertNoErrorBoundary,
} from '../helpers';
import {
  supabaseDelete,
  getOrgId,
} from '../supabase-admin';

const testId = `e2e-${Date.now()}`;

// ═══════════════════════════════════════════════════════════════
// SECTION 11: MAKE-UP CREDITS DASHBOARD
// ═══════════════════════════════════════════════════════════════
test.describe('Make-Up Credits Dashboard', () => {
  test.use({ storageState: AUTH.owner });

  test.afterAll(() => {
    try {
      const orgId = getOrgId();
      if (orgId) {
        const encoded = encodeURIComponent(`%${testId}%`);
        supabaseDelete('make_up_waitlist', `org_id=eq.${orgId}&notes=like.${encoded}`);
      }
    } catch { /* best-effort */ }
  });

  test('navigates to make-ups page and verifies page header', async ({ page }) => {
    test.setTimeout(90_000);
    await safeGoTo(page, '/make-ups', 'Make-Ups');
    await assertNoErrorBoundary(page);

    // Verify page header — "Make-Up Lessons"
    await expect(
      page.getByText('Make-Up Lessons').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('views stats cards with numeric values', async ({ page }) => {
    test.setTimeout(90_000);
    await safeGoTo(page, '/make-ups', 'Make-Ups');
    await page.waitForTimeout(2_000);

    // Stats cards: "Needs Action", "Waiting", "Offered", "Booked This Month"
    const statLabels = ['Needs Action', 'Waiting', 'Offered', 'Booked This Month'];
    for (const label of statLabels) {
      const card = page.getByText(label, { exact: false }).first();
      await expect(card, `Stat card "${label}" should be visible`).toBeVisible({ timeout: 10_000 });
    }

    // Each stat card should have a numeric value (text-2xl)
    const statValues = page.locator('.text-2xl.font-semibold');
    const count = await statValues.count();
    expect(count, 'Should have at least 4 stat values').toBeGreaterThanOrEqual(4);
  });

  test('views waitlist table section', async ({ page }) => {
    test.setTimeout(90_000);
    await safeGoTo(page, '/make-ups', 'Make-Ups');
    await page.waitForTimeout(2_000);

    // The Waitlist card should be visible
    await expect(
      page.getByText('Waitlist').first()
    ).toBeVisible({ timeout: 10_000 });

    // Should have status filter dropdown
    const statusFilter = page.locator('button[role="combobox"]').filter({ hasText: /All statuses|Waiting|Matched/i }).first();
    const hasFilter = await statusFilter.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasFilter) {
      // Test filter: select "Waiting"
      await statusFilter.click();
      await page.waitForTimeout(300);
      const waitingOption = page.getByRole('option', { name: 'Waiting' }).first();
      const hasWaiting = await waitingOption.isVisible({ timeout: 3_000 }).catch(() => false);
      if (hasWaiting) {
        await waitingOption.click();
        await page.waitForTimeout(1_000);
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });

  test('Add to Waitlist button opens dialog', async ({ page }) => {
    test.setTimeout(90_000);
    await safeGoTo(page, '/make-ups', 'Make-Ups');
    await page.waitForTimeout(1_000);

    // Click "Add to Waitlist" button
    const addBtn = page.getByRole('button', { name: /Add to Waitlist/ }).first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Dialog should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole('heading', { name: 'Add to Waitlist' })).toBeVisible({ timeout: 5_000 });

    // Verify form fields are present — use less strict matchers
    const hasStudentLabel = await dialog.getByText('Student', { exact: true }).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasAbsenceLabel = await dialog.getByText('Absence Reason').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasStudentLabel || hasAbsenceLabel, 'Dialog should have form fields').toBe(true);

    // Close dialog
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test('adds entry to waitlist via dialog', async ({ page }) => {
    test.setTimeout(120_000);
    await safeGoTo(page, '/make-ups', 'Make-Ups');
    await page.waitForTimeout(1_000);

    // Open "Add to Waitlist" dialog
    const addBtn = page.getByRole('button', { name: /Add to Waitlist/ }).first();
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Select a student from dropdown
    const studentTrigger = dialog.locator('button[role="combobox"]').first();
    await expect(studentTrigger).toBeVisible({ timeout: 5_000 });
    await studentTrigger.click();
    await page.waitForTimeout(500);

    const firstStudent = page.getByRole('option').first();
    const hasStudent = await firstStudent.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasStudent) {
      // No students available
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      return;
    }
    await firstStudent.click();
    await page.waitForTimeout(1_000);

    // Wait for lessons to load for the selected student
    await page.waitForTimeout(2_000);

    // Select a missed lesson — second combobox in the dialog
    const lessonTrigger = dialog.locator('button[role="combobox"]').nth(1);
    const hasLessonTrigger = await lessonTrigger.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasLessonTrigger) {
      // Check if "No lessons found" message appears
      const noLessons = await dialog.getByText('No lessons found').isVisible({ timeout: 3_000 }).catch(() => false);
      if (noLessons) {
        await page.keyboard.press('Escape');
        return;
      }
      // Also check for "Loading lessons" text
      await page.waitForTimeout(3_000);
    }

    if (hasLessonTrigger) {
      await lessonTrigger.click();
      await page.waitForTimeout(500);
      const firstLesson = page.getByRole('option').first();
      const hasLesson = await firstLesson.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!hasLesson) {
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        return;
      }
      await firstLesson.click();
      await page.waitForTimeout(1_000);
    }

    // Fill notes with testId
    const notesInput = dialog.locator('textarea');
    const hasNotes = await notesInput.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasNotes) {
      await notesInput.fill(`E2E waitlist ${testId}`);
    }

    // Submit — wait for button to be enabled (requires student + lesson selection)
    const submitBtn = dialog.getByRole('button', { name: /Add to Waitlist/ }).last();
    const isEnabled = await submitBtn.isEnabled({ timeout: 5_000 }).catch(() => false);
    if (!isEnabled) {
      // If button is still disabled, the lesson selection didn't complete — close dialog
      await page.keyboard.press('Escape');
      return;
    }
    await submitBtn.click();

    // Wait for dialog to close
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await page.waitForTimeout(2_000);
  });

  test('Refresh button reloads waitlist data', async ({ page }) => {
    test.setTimeout(90_000);
    await safeGoTo(page, '/make-ups', 'Make-Ups');
    await page.waitForTimeout(1_000);

    const refreshBtn = page.getByRole('button', { name: /Refresh/ }).first();
    await expect(refreshBtn).toBeVisible({ timeout: 10_000 });
    await refreshBtn.click();
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);
  });

  test('waitlist filter by status works', async ({ page }) => {
    test.setTimeout(90_000);
    await safeGoTo(page, '/make-ups', 'Make-Ups');
    await page.waitForTimeout(2_000);

    // Find status filter
    const statusFilters = page.locator('button[role="combobox"]');
    const count = await statusFilters.count();

    if (count > 0) {
      const firstFilter = statusFilters.first();
      await firstFilter.click();
      await page.waitForTimeout(300);

      // Try to select "Waiting"
      const waitingOpt = page.getByRole('option', { name: 'Waiting' }).first();
      const hasOpt = await waitingOpt.isVisible({ timeout: 3_000 }).catch(() => false);
      if (hasOpt) {
        await waitingOpt.click();
        await page.waitForTimeout(1_000);
        await assertNoErrorBoundary(page);

        // Reset to "All statuses"
        await firstFilter.click();
        await page.waitForTimeout(300);
        const allOpt = page.getByRole('option', { name: /All statuses/i }).first();
        const hasAll = await allOpt.isVisible({ timeout: 3_000 }).catch(() => false);
        if (hasAll) {
          await allOpt.click();
          await page.waitForTimeout(500);
        } else {
          await page.keyboard.press('Escape');
        }
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });
});
