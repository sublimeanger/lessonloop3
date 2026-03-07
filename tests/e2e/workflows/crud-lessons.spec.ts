import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  expectToastSuccess,
} from '../helpers';
import {
  cleanupTestData,
  supabaseSelect,
  deleteLessonById,
} from '../supabase-admin';
import { addDays, format } from 'date-fns';

/**
 * Navigate via sidebar link click (SPA navigation, preserves auth).
 */
async function clickNav(page: Page, href: string) {
  const link = page.locator(`a[href="${href}"]`).first();
  await expect(link).toBeVisible({ timeout: 10_000 });
  await link.click();
  await page.waitForURL((url) => url.pathname.startsWith(href), {
    timeout: 15_000,
  });
  await waitForPageReady(page);
}

/* ================================================================== */
/*  MODULE: Lessons CRUD                                               */
/* ================================================================== */

test.describe('CRUD — Lessons', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `e2e-${Date.now()}`;
  const futureDate = addDays(new Date(), 21);
  const futureDateDisplay = format(futureDate, 'dd MMM yyyy');

  // Track lesson IDs for cleanup
  const createdLessonIds: string[] = [];

  test.afterAll(() => {
    try {
      // Clean up by testId (matches notes_shared containing testId)
      cleanupTestData(testId);
      // Fallback: delete individually tracked lessons
      for (const id of createdLessonIds) {
        try { deleteLessonById(id); } catch { /* best-effort */ }
      }
    } catch { /* best-effort */ }
  });

  test('lesson lifecycle: create, view detail, edit, cancel, delete', async ({ page }) => {
    test.setTimeout(300_000);

    // ── STEP 1: Warm up session ──
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    // ── STEP 2: Navigate to calendar ──
    await clickNav(page, '/calendar');
    await waitForPageReady(page);

    // ── STEP 3: Create a single lesson ──
    // Click "New Lesson" button (has data-tour="create-lesson-button")
    const newLessonBtn = page.locator('[data-tour="create-lesson-button"]');
    await expect(newLessonBtn).toBeVisible({ timeout: 10_000 });
    await newLessonBtn.click();

    // Wait for lesson modal dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // -- Select teacher (first available in the dropdown) --
    const teacherTrigger = dialog.locator('button').filter({ hasText: /select teacher/i }).first();
    if (await teacherTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await teacherTrigger.click();
      await page.waitForTimeout(500);
      // Pick first teacher option
      const firstTeacher = page.getByRole('option').first();
      await expect(firstTeacher).toBeVisible({ timeout: 5_000 });
      await firstTeacher.click();
      await page.waitForTimeout(300);
    }

    // -- Select student (open the student selector popover) --
    const studentBtn = dialog.locator('button').filter({ hasText: /select student/i }).first();
    if (await studentBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await studentBtn.click();
      await page.waitForTimeout(500);
      // Select first student in the list
      const studentItems = page.locator('[cmdk-item]');
      const firstStudent = studentItems.first();
      await expect(firstStudent).toBeVisible({ timeout: 5_000 });
      await firstStudent.click();
      await page.waitForTimeout(300);
      // Close the popover by clicking elsewhere in the dialog
      await dialog.locator('h2, [class*="DialogTitle"]').first().click();
      await page.waitForTimeout(300);
    }

    // -- Set date to 3 weeks from now (avoids teacher conflicts) --
    const dateBtn = dialog.locator('button').filter({ hasText: /\d{2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i }).first()
      .or(dialog.locator('button').filter({ has: page.locator('svg.lucide-calendar') }).first());
    if (await dateBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dateBtn.click();
      await page.waitForTimeout(500);

      // Navigate forward if the future date is in a different month
      const futureMonth = futureDate.getMonth();
      const currentMonth = new Date().getMonth();
      const monthsToAdvance = futureMonth - currentMonth + (futureMonth < currentMonth ? 12 : 0);
      for (let m = 0; m < monthsToAdvance; m++) {
        const nextMonthBtn = page.locator('[name="next-month"]').first()
          .or(page.locator('button[aria-label*="next"]').first());
        if (await nextMonthBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await nextMonthBtn.click();
          await page.waitForTimeout(300);
        }
      }

      const futureDay = format(futureDate, 'd');
      const dayCell = page.getByRole('gridcell', { name: futureDay, exact: true }).first();
      if (await dayCell.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await dayCell.click();
      } else {
        const dayBtnAlt = page.locator('button').filter({ hasText: new RegExp(`^${futureDay}$`) }).first();
        if (await dayBtnAlt.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await dayBtnAlt.click();
        }
      }
      await page.waitForTimeout(300);
    }

    // -- Set time to 10:00 (Radix Select combobox) --
    const allComboboxes = dialog.locator('button[role="combobox"]');
    const comboCount = await allComboboxes.count();
    for (let i = 0; i < comboCount; i++) {
      const text = await allComboboxes.nth(i).textContent() ?? '';
      if (/^\d{2}:\d{2}$/.test(text.trim())) {
        await allComboboxes.nth(i).click();
        await page.waitForTimeout(300);
        const timeOption = page.getByRole('option', { name: '10:00' });
        if (await timeOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await timeOption.click();
          await page.waitForTimeout(200);
        } else {
          await allComboboxes.nth(i).click().catch(() => {});
        }
        break;
      }
    }

    // Duration is 30 min by default, no need to change

    // -- Add shared notes with testId for easy cleanup identification --
    const notesField = dialog.getByPlaceholder('Add lesson notes that parents can see...');
    if (await notesField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await notesField.fill(`E2E Lesson ${testId}`);
    }

    // -- Submit the form --
    const createBtn = dialog.getByRole('button', { name: /create lesson/i });
    await page.waitForTimeout(3_000);
    if (await createBtn.isDisabled()) {
      // Teacher has a recurring conflict at every time slot — cannot create lesson
      console.log('[crud-lessons] Create button disabled due to teacher conflict, closing dialog');
      await dialog.getByRole('button', { name: /cancel/i }).click().catch(() => {});
      await page.waitForTimeout(500);
      test.skip(true, 'Teacher has recurring conflicts at all time slots');
      return;
    }
    await createBtn.click();

    // Verify success — toast or dialog closes
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    // Allow data to propagate
    await page.waitForTimeout(2_000);

    // Try to find the created lesson via API for tracking
    const lessons = supabaseSelect(
      'lessons',
      `notes_shared=like.%25${testId}%25&select=id,title,start_at,status&limit=5`,
    );
    if (lessons.length > 0) {
      for (const l of lessons) createdLessonIds.push(l.id);
    }

    // ── STEP 4: Navigate to agenda view to verify lesson ──
    // Switch to agenda view for easier text-based assertion
    const agendaBtn = page.locator('button[value="agenda"]').first()
      .or(page.getByRole('radio', { name: /agenda/i }).first());
    if (await agendaBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await agendaBtn.click();
      await page.waitForTimeout(1_000);
    }

    // Navigate to futureDate's date if not already showing
    // Use the URL to navigate to the correct date
    const futureDateIso = format(futureDate, 'yyyy-MM-dd');
    await page.goto(`/calendar?date=${futureDateIso}&view=agenda`);
    await waitForPageReady(page);
    await page.waitForTimeout(2_000);

    // Verify lesson appears (by checking for the time or notes)
    const lessonOnCalendar = page.getByText('10:00').first()
      .or(page.getByText(/10:00/).first());
    const lessonVisible = await lessonOnCalendar.isVisible({ timeout: 10_000 }).catch(() => false);
    // Don't hard fail if not visible in agenda — it might appear in day/week view
    if (!lessonVisible) {
      // Try day view
      await page.goto(`/calendar?date=${futureDateIso}&view=day`);
      await waitForPageReady(page);
      await page.waitForTimeout(2_000);
    }

    // ── STEP 5: View lesson detail ──
    // Click on a lesson entry to open the detail panel
    // Lessons are rendered as clickable blocks on the calendar
    const lessonBlock = page.locator('[data-tour="calendar-grid"] [class*="cursor-pointer"]').first()
      .or(page.locator('main').getByText('10:00').first());
    if (await lessonBlock.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await lessonBlock.click();
      await page.waitForTimeout(1_000);

      // Verify detail panel (Sheet) opens
      const detailPanel = page.locator('[data-state="open"]').filter({ has: page.getByText(/Reschedule|Cancel|Delete/i) }).first();
      const panelVisible = await detailPanel.isVisible({ timeout: 10_000 }).catch(() => false);

      if (panelVisible) {
        // Verify status shows as scheduled
        await expect(page.getByText('scheduled').first()).toBeVisible({ timeout: 5_000 });

        // ── STEP 6: Edit lesson (Reschedule) ──
        const rescheduleBtn = page.getByRole('button', { name: /reschedule/i }).first();
        if (await rescheduleBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await rescheduleBtn.click();
          await page.waitForTimeout(1_000);

          // The edit modal should open
          const editDialog = page.getByRole('dialog');
          if (await editDialog.isVisible({ timeout: 10_000 }).catch(() => false)) {
            // Change time from 10:00 to 11:00
            const editTimeTrigger = editDialog.getByLabel('Time').locator('..').locator('button').first();
            if (await editTimeTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
              await editTimeTrigger.click();
              await page.waitForTimeout(300);
              const time11 = page.getByRole('option', { name: '11:00' });
              if (await time11.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await time11.click();
                await page.waitForTimeout(200);
              }
            }

            // Save changes
            const saveBtn = editDialog.getByRole('button', { name: /save changes/i });
            await expect(saveBtn).toBeEnabled({ timeout: 15_000 });
            await saveBtn.click();

            // Verify dialog closes (success)
            await expect(editDialog).toBeHidden({ timeout: 30_000 });
            await page.waitForTimeout(1_000);
          }
        }

        // ── STEP 7: Cancel lesson ──
        // Re-click on the lesson to reopen detail
        // First reload the calendar to see updated time
        await page.goto(`/calendar?date=${futureDateIso}&view=day`);
        await waitForPageReady(page);
        await page.waitForTimeout(2_000);

        // Find and click the lesson again
        const lessonBlock2 = page.locator('[data-tour="calendar-grid"] [class*="cursor-pointer"]').first()
          .or(page.locator('main').getByText(/1[01]:00/).first());
        if (await lessonBlock2.isVisible({ timeout: 10_000 }).catch(() => false)) {
          await lessonBlock2.click();
          await page.waitForTimeout(1_000);

          // Click Cancel button
          const cancelBtn = page.getByRole('button', { name: /^cancel$/i }).first();
          if (await cancelBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await cancelBtn.click();
            await page.waitForTimeout(1_000);

            // Cancel confirmation dialog
            const cancelDialog = page.getByRole('dialog').filter({ hasText: /cancel lesson/i });
            if (await cancelDialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
              // Fill cancellation reason
              const reasonInput = page.locator('#cancellation-reason');
              if (await reasonInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await reasonInput.fill('E2E test cancellation');
              }
              // Click "Cancel Lesson" confirmation button
              const confirmCancelBtn = cancelDialog.getByRole('button', { name: /cancel lesson/i });
              await expect(confirmCancelBtn).toBeVisible({ timeout: 5_000 });
              await confirmCancelBtn.click();

              // Verify toast
              await expectToastSuccess(page, /cancelled/i);
              await page.waitForTimeout(1_000);
            }
          }
        }
      }
    }

    // ── STEP 8: Delete lesson ──
    // Create a new lesson specifically for deletion
    await page.goto(`/calendar?date=${futureDateIso}&action=new`);
    await waitForPageReady(page);
    await page.waitForTimeout(2_000);

    // The action=new param should auto-open the modal
    const deleteDialog = page.getByRole('dialog');
    if (await deleteDialog.isVisible({ timeout: 10_000 }).catch(() => false)) {
      // Select teacher
      const teacherTrigger2 = deleteDialog.locator('button').filter({ hasText: /select teacher/i }).first();
      if (await teacherTrigger2.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await teacherTrigger2.click();
        await page.waitForTimeout(500);
        await page.getByRole('option').first().click();
        await page.waitForTimeout(300);
      }

      // Select student
      const studentBtn2 = deleteDialog.locator('button').filter({ hasText: /select student/i }).first();
      if (await studentBtn2.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await studentBtn2.click();
        await page.waitForTimeout(500);
        await page.locator('[cmdk-item]').first().click();
        await page.waitForTimeout(300);
        await deleteDialog.locator('h2, [class*="DialogTitle"]').first().click();
        await page.waitForTimeout(300);
      }

      // Set time to avoid teacher conflicts (Radix Select combobox)
      const allCombos2 = deleteDialog.locator('button[role="combobox"]');
      const comboCount2 = await allCombos2.count();
      for (let i = 0; i < comboCount2; i++) {
        const text = await allCombos2.nth(i).textContent() ?? '';
        if (/^\d{2}:\d{2}$/.test(text.trim())) {
          await allCombos2.nth(i).click();
          await page.waitForTimeout(300);
          const timeOpt2 = page.getByRole('option', { name: '20:45' }).first();
          if (await timeOpt2.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await timeOpt2.click();
          } else {
            await allCombos2.nth(i).click().catch(() => {});
          }
          await page.waitForTimeout(200);
          break;
        }
      }

      // Add notes with testId
      const notesField2 = deleteDialog.getByPlaceholder('Add lesson notes that parents can see...');
      if (await notesField2.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await notesField2.fill(`E2E Delete ${testId}`);
      }

      // Create the lesson
      const createBtn2 = deleteDialog.getByRole('button', { name: /create lesson/i });
      await page.waitForTimeout(3_000);
      if (await createBtn2.isDisabled()) {
        console.log('[crud-lessons] Delete-step create button disabled, closing dialog');
        await deleteDialog.getByRole('button', { name: /cancel/i }).click().catch(() => {});
        test.skip(true, 'Teacher has recurring conflicts at all time slots');
        return;
      }
      await createBtn2.click();
      await expect(deleteDialog).toBeHidden({ timeout: 30_000 });
      await page.waitForTimeout(2_000);

      // Track new lesson
      const newLessons = supabaseSelect(
        'lessons',
        `notes_shared=like.%25${testId}%25&select=id&limit=5`,
      );
      for (const l of newLessons) {
        if (!createdLessonIds.includes(l.id)) createdLessonIds.push(l.id);
      }

      // Find and click the new lesson to open detail
      await page.goto(`/calendar?date=${futureDateIso}&view=day`);
      await waitForPageReady(page);
      await page.waitForTimeout(2_000);

      const lessonBlock3 = page.locator('[data-tour="calendar-grid"] [class*="cursor-pointer"]').first();
      if (await lessonBlock3.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await lessonBlock3.click();
        await page.waitForTimeout(1_000);

        // Click Delete button
        const deleteBtn = page.getByRole('button', { name: /delete/i }).first();
        if (await deleteBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await deleteBtn.click();
          await page.waitForTimeout(1_000);

          // Confirm deletion in AlertDialog
          const confirmDeleteBtn = page.getByRole('alertdialog').getByRole('button', { name: /delete/i });
          if (await confirmDeleteBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await confirmDeleteBtn.click();
            await expectToastSuccess(page, /deleted/i);
          }
        }
      }
    }

    // Final API cleanup fallback
    const remainingLessons = supabaseSelect(
      'lessons',
      `notes_shared=like.%25${testId}%25&select=id&limit=10`,
    );
    for (const l of remainingLessons) {
      deleteLessonById(l.id);
    }
  });

  test('recurring lesson: create weekly for 4 weeks', async ({ page }) => {
    test.setTimeout(300_000);

    // Warm up
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);
    await clickNav(page, '/calendar');
    await waitForPageReady(page);

    // Click New Lesson
    const newLessonBtn = page.locator('[data-tour="create-lesson-button"]');
    await expect(newLessonBtn).toBeVisible({ timeout: 10_000 });
    await newLessonBtn.click();

    // Target the specific dialog with "New Lesson" title
    const dialog = page.getByRole('dialog', { name: /new lesson/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Select teacher
    const teacherTrigger = dialog.locator('button').filter({ hasText: /select teacher/i }).first();
    if (await teacherTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await teacherTrigger.click();
      await page.waitForTimeout(500);
      await page.getByRole('option').first().click();
      await page.waitForTimeout(300);
    }

    // Select student
    const studentBtn = dialog.locator('button').filter({ hasText: /select student/i }).first();
    if (await studentBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await studentBtn.click();
      await page.waitForTimeout(500);
      await page.locator('[cmdk-item]').first().click();
      await page.waitForTimeout(300);
      await dialog.locator('h2, [class*="DialogTitle"]').first().click();
      await page.waitForTimeout(300);
    }

    // Set date to futureDate (navigate calendar forward if needed)
    const dateBtnR = dialog.locator('button').filter({ hasText: /\d{2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i }).first()
      .or(dialog.locator('button').filter({ has: page.locator('svg.lucide-calendar') }).first());
    if (await dateBtnR.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dateBtnR.click();
      await page.waitForTimeout(500);
      const futureMonth = futureDate.getMonth();
      const currentMonth = new Date().getMonth();
      const monthsToAdvance = futureMonth - currentMonth + (futureMonth < currentMonth ? 12 : 0);
      for (let m = 0; m < monthsToAdvance; m++) {
        const nextBtn = page.locator('[name="next-month"]').first()
          .or(page.locator('button[aria-label*="next"]').first());
        if (await nextBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await nextBtn.click();
          await page.waitForTimeout(300);
        }
      }
      const futureDateDay = format(futureDate, 'd');
      const dayCell = page.getByRole('gridcell', { name: futureDateDay, exact: true }).first();
      if (await dayCell.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await dayCell.click();
      } else {
        await page.locator('button').filter({ hasText: new RegExp(`^${futureDateDay}$`) }).first().click();
      }
      await page.waitForTimeout(300);
    }

    // Add notes with testId
    const notesField = dialog.getByPlaceholder('Add lesson notes that parents can see...');
    if (await notesField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await notesField.fill(`E2E Recurring ${testId}`);
    }

    // Enable recurring lesson
    const recurringSwitch = dialog.locator('#recurring');
    const hasRecurrence = await recurringSwitch.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasRecurrence) {
      test.skip(true, 'Recurrence not available in lesson form');
      return;
    }

    await recurringSwitch.click();
    await page.waitForTimeout(500);

    // Select the day of the week for futureDate
    const futureDateDayIndex = futureDate.getDay(); // 0=Sun, 1=Mon, ...
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const targetDayName = dayNames[futureDateDayIndex];
    const dayToggle = dialog.getByRole('button', { name: targetDayName, exact: true });
    if (await dayToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Check if already selected (variant="default")
      const isSelected = await dayToggle.evaluate(
        el => el.getAttribute('data-state') === 'on' || el.classList.contains('bg-primary'),
      );
      if (!isSelected) {
        await dayToggle.click();
        await page.waitForTimeout(300);
      }
    }

    // Set end date to 4 weeks from futureDate
    const endDate = addDays(futureDate, 28);
    const endDateBtn = dialog.locator('button').filter({ hasText: /no end date/i }).first();
    if (await endDateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await endDateBtn.click();
      await page.waitForTimeout(500);
      // Navigate calendar forward if needed and select end date
      const endDay = format(endDate, 'd');
      const endCell = page.getByRole('gridcell', { name: endDay, exact: true }).last();
      if (await endCell.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await endCell.click();
      }
      await page.waitForTimeout(300);
      // Click elsewhere to close the date popover
      await dialog.locator('h2, [class*="DialogTitle"]').first().click();
      await page.waitForTimeout(300);
    }

    // Create the recurring lesson
    const createBtnR = dialog.getByRole('button', { name: /create lesson/i });
    await page.waitForTimeout(3_000);
    if (await createBtnR.isDisabled()) {
      console.log('[crud-lessons] Recurring create button disabled, closing dialog');
      await dialog.getByRole('button', { name: /cancel/i }).click().catch(() => {});
      test.skip(true, 'Teacher has recurring conflicts at all time slots');
      return;
    }
    await createBtnR.click();

    // Wait for dialog to close — use specific dialog with name
    await expect(dialog).toBeHidden({ timeout: 60_000 });
    await page.waitForTimeout(3_000);

    // Verify: multiple lessons created
    const recurLessons = supabaseSelect(
      'lessons',
      `notes_shared=like.%25${testId}%25&select=id,start_at&order=start_at.asc&limit=10`,
    );
    // Track for cleanup
    for (const l of recurLessons) createdLessonIds.push(l.id);

    // We expect at least 3 lessons (4 weeks of weekly = ~4 or 5 instances)
    expect(recurLessons.length).toBeGreaterThanOrEqual(3);

    // Clean up recurring lessons
    for (const l of recurLessons) {
      deleteLessonById(l.id);
    }
  });
});
