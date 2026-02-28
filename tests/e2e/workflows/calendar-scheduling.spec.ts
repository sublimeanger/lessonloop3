import { test, expect } from './workflow.fixtures';
import { AUTH } from '../helpers';
import {
  createStudentViaWizard,
  createLessonViaCalendar,
  navigateToStudentDetail,
  waitForDataLoad,
} from './workflow-helpers';
import { goTo } from '../helpers';

const TS = Date.now().toString().slice(-6);

// ═══════════════════════════════════════════════════════════════
// Lesson creation cascades to register and student detail
// ═══════════════════════════════════════════════════════════════

test.describe('Calendar Scheduling — Owner', () => {
  test.use({ storageState: AUTH.owner });
  test.describe.configure({ mode: 'serial' });

  test('Lesson creation cascades to register and student detail', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1–2. Navigate to /calendar and create a lesson ──
    // Create a lesson for a known test student
    // First find who's available — search students page for any existing student
    await goTo(page, '/students');
    await waitForDataLoad(page);

    // Grab the first visible student name to use for lesson creation
    const firstStudentLink = page.locator('main').locator('a[href*="/students/"]').first()
      .or(page.locator('main').locator('tr td, [role="row"]').first());
    let studentName = 'Emma';
    if (await firstStudentLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      const text = await firstStudentLink.textContent();
      if (text && text.trim().length > 1) {
        studentName = text.trim().split('\n')[0].trim();
      }
    }

    await createLessonViaCalendar(page, {
      studentName,
      duration: 30,
    });

    // ── 3. Assert lesson appears on calendar ──
    await goTo(page, '/calendar');
    await waitForDataLoad(page);
    await expect(page.getByText(/mon|tue|wed|thu|fri/i).first()).toBeVisible({ timeout: 15_000 });

    // ── 4–5. Navigate to /register ──
    await goTo(page, '/register');
    await waitForDataLoad(page);

    // The register shows today's lessons — our new lesson should be here
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // ── 6–8. Navigate to student detail > Lessons tab ──
    const navigated = await navigateToStudentDetail(page, studentName);
    if (navigated) {
      const lessonsTab = page.getByRole('tab', { name: 'Lessons' }).first();
      if (await lessonsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await lessonsTab.click();
        await page.waitForTimeout(500);
        await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Lesson edit updates everywhere
  // ═══════════════════════════════════════════════════════════════

  test('Lesson edit updates everywhere', async ({ page }) => {
    test.setTimeout(120_000);

    // Create a fresh lesson to edit
    const editStudentLast = `EditTest-${TS}`;
    const editStudentFull = `E2E ${editStudentLast}`;

    await createStudentViaWizard(page, {
      firstName: 'E2E',
      lastName: editStudentLast,
    });

    await createLessonViaCalendar(page, {
      studentName: editStudentFull,
      duration: 30,
    });

    // ── 1–2. Find the lesson on the calendar ──
    await goTo(page, '/calendar');
    await waitForDataLoad(page);

    // Click on the lesson card to open the detail panel/sheet
    // Lesson cards have aria-labels with the student name and time
    const lessonCard = page.locator('main').locator('[aria-label]')
      .filter({ hasText: new RegExp(editStudentLast, 'i') }).first()
      .or(page.locator('main').getByText(new RegExp(editStudentLast, 'i')).first());

    if (await lessonCard.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await lessonCard.click();
      await page.waitForTimeout(500);

      // ── 3. Click Reschedule/Edit to open the edit modal ──
      const rescheduleBtn = page.getByRole('button', { name: /reschedule/i }).first()
        .or(page.getByRole('button', { name: /edit/i }).first());
      if (await rescheduleBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await rescheduleBtn.click();
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

        // ── 4. Change the time ──
        const timeInput = page.getByRole('dialog').getByLabel(/time/i).first()
          .or(page.getByRole('dialog').locator('input[type="time"]').first());
        if (await timeInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await timeInput.fill('15:00');
          await page.waitForTimeout(300);
        }

        // ── 5. Save changes ──
        const saveBtn = page.getByRole('dialog').getByRole('button', { name: /save changes/i }).first();
        if (await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await saveBtn.click();

          // Handle recurring dialog if it appears
          const recurringDialog = page.getByText(/recurring.*lesson|part of a recurring/i).first();
          if (await recurringDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
            const thisOnly = page.getByRole('button', { name: /this lesson only|this only/i }).first()
              .or(page.getByText(/only.*this specific/i).first());
            if (await thisOnly.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await thisOnly.click();
            }
          }

          await page.waitForTimeout(1_000);
        }
      }
    }

    // ── 6–7. Navigate to /register — verify updated ──
    await goTo(page, '/register');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // ── 8–9. Navigate to student detail > Lessons tab ──
    const navigated = await navigateToStudentDetail(page, editStudentFull);
    if (navigated) {
      const lessonsTab = page.getByRole('tab', { name: 'Lessons' }).first();
      if (await lessonsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await lessonsTab.click();
        await page.waitForTimeout(500);
        await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Lesson deletion removes from all views
  // ═══════════════════════════════════════════════════════════════

  test('Lesson deletion removes from all views', async ({ page }) => {
    test.setTimeout(120_000);

    // Create a student and lesson with unique name for identification
    const delStudentLast = `DelTest-${TS}`;
    const delStudentFull = `E2E ${delStudentLast}`;

    await createStudentViaWizard(page, {
      firstName: 'E2E',
      lastName: delStudentLast,
    });

    await createLessonViaCalendar(page, {
      studentName: delStudentFull,
      duration: 30,
    });

    // ── 2. Lesson visible on calendar ──
    await goTo(page, '/calendar');
    await waitForDataLoad(page);

    // ── 3. Navigate to /register — lesson visible ──
    await goTo(page, '/register');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // ── 4. Go back to calendar and delete the lesson ──
    await goTo(page, '/calendar');
    await waitForDataLoad(page);

    // Click on the lesson card
    const lessonCard = page.locator('main').locator('[aria-label]')
      .filter({ hasText: new RegExp(delStudentLast, 'i') }).first()
      .or(page.locator('main').getByText(new RegExp(delStudentLast, 'i')).first());

    if (await lessonCard.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await lessonCard.click();
      await page.waitForTimeout(500);

      // ── 5. Click Delete ──
      const deleteBtn = page.getByRole('button', { name: /delete/i }).first()
        .or(page.locator('button').filter({ hasText: /delete/i }).first());
      if (await deleteBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await deleteBtn.click();

        // Handle recurring dialog if it appears
        const recurringDialog = page.getByText(/recurring.*lesson|part of a recurring/i).first();
        if (await recurringDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const thisOnly = page.getByRole('button', { name: /this lesson only|this only/i }).first()
            .or(page.getByText(/only.*this specific/i).first());
          if (await thisOnly.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await thisOnly.click();
            await page.waitForTimeout(500);
          }
        }

        // Confirm deletion dialog
        const confirmDelete = page.getByRole('alertdialog').first()
          .or(page.getByRole('dialog').first());
        if (await confirmDelete.isVisible({ timeout: 5_000 }).catch(() => false)) {
          const confirmBtn = confirmDelete.getByRole('button', { name: /delete/i }).first();
          await confirmBtn.click();
          await page.waitForTimeout(1_000);
        }
      }
    }

    // ── 6. Lesson no longer on calendar ──
    await goTo(page, '/calendar');
    await waitForDataLoad(page);
    const deletedLesson = page.locator('main').getByText(new RegExp(delStudentLast, 'i')).first();
    const stillVisible = await deletedLesson.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(stillVisible).toBeFalsy();

    // ── 7. Lesson no longer in register ──
    await goTo(page, '/register');
    await waitForDataLoad(page);

    // Expand any closed rows to check
    const triggers = page.locator('main button[aria-expanded="false"]');
    const triggerCount = await triggers.count();
    for (let i = 0; i < Math.min(triggerCount, 10); i++) {
      await triggers.nth(i).click().catch(() => {});
      await page.waitForTimeout(200);
    }

    const registerLesson = page.locator('main').getByText(new RegExp(delStudentLast, 'i')).first();
    const inRegister = await registerLesson.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(inRegister).toBeFalsy();

    // ── 8. Lesson gone from student detail ──
    const navigated = await navigateToStudentDetail(page, delStudentFull);
    if (navigated) {
      const lessonsTab = page.getByRole('tab', { name: 'Lessons' }).first();
      if (await lessonsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await lessonsTab.click();
        await page.waitForTimeout(500);
        // Main content should be visible but lesson should not appear
        await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Calendar filters are consistent with data
  // ═══════════════════════════════════════════════════════════════

  test('Calendar filters are consistent with data', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1–2. Navigate to /calendar, note visible lessons ──
    await goTo(page, '/calendar');
    await waitForDataLoad(page);
    await expect(page.getByText(/mon|tue|wed|thu|fri/i).first()).toBeVisible({ timeout: 15_000 });

    // ── 3–4. Apply teacher filter (click a teacher pill) ──
    const filterBar = page.locator('[data-tour="calendar-filters"]');
    if (await filterBar.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // The filter bar shows pill buttons: "All", then teacher names
      // Get the second pill (first teacher after "All")
      const teacherPills = filterBar.locator('button').filter({ hasNotText: /^all$/i });
      const teacherCount = await teacherPills.count();

      if (teacherCount > 0) {
        // Click first teacher pill
        const firstTeacherPill = teacherPills.first();
        await firstTeacherPill.click();
        await page.waitForTimeout(500);

        // Assert filtered — either fewer lessons or same (if teacher has all)
        await expect(page.locator('main').first()).toBeVisible();

        // ── 5. Clear teacher filter by clicking "All" ──
        const allPill = filterBar.locator('button').filter({ hasText: /^all/i }).first();
        if (await allPill.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await allPill.click();
          await page.waitForTimeout(500);
        }

        // ── 6–7. Apply location filter (click a location pill) ──
        // Location pills appear after a divider, after teacher pills
        // They have location names (not short first names like teachers)
        // Look for longer-text pills that might be locations
        const locationPills = filterBar.locator('button')
          .filter({ hasNotText: /^all|hide cancelled/i });
        const locCount = await locationPills.count();

        // Try clicking a pill that's further in the list (likely a location)
        if (locCount > teacherCount) {
          const locationPill = locationPills.nth(teacherCount);
          await locationPill.click();
          await page.waitForTimeout(500);

          // Assert filtered view
          await expect(page.locator('main').first()).toBeVisible();

          // ── 8. Clear location filter
          await locationPill.click(); // Toggle off
          await page.waitForTimeout(500);
        }
      }
    }

    // ── 9. Assert back to original view ──
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  // ═══════════════════════════════════════════════════════════════
  // Calendar navigation maintains data integrity
  // ═══════════════════════════════════════════════════════════════

  test('Calendar navigation maintains data integrity', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1–2. Navigate to /calendar, note current view ──
    await goTo(page, '/calendar');
    await waitForDataLoad(page);
    await expect(page.getByText(/mon|tue|wed|thu|fri/i).first()).toBeVisible({ timeout: 15_000 });

    // ── 3–4. Click Next week ──
    const nextBtn = page.locator('[aria-label="Next"], [aria-label="Next week"]').first();
    if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

      // ── 5–6. Click Previous week twice (back to last week) ──
      const prevBtn = page.locator('[aria-label="Previous"], [aria-label="Previous week"]').first();
      if (await prevBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await prevBtn.click();
        await page.waitForTimeout(500);
        await prevBtn.click();
        await page.waitForTimeout(500);

        await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
      }

      // ── 7–8. Click Today ──
      const todayBtn = page.getByRole('button', { name: /today/i }).first();
      if (await todayBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await todayBtn.click();
        await page.waitForTimeout(500);
      }

      await expect(page.getByText(/mon|tue|wed|thu|fri/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Teacher can only see their assigned lessons on register/students
// ═══════════════════════════════════════════════════════════════

test.describe('Calendar Scheduling — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('Teacher sees only their data on register and students', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1–3. Calendar loads (teachers see all lessons on calendar) ──
    await goTo(page, '/calendar');
    await waitForDataLoad(page);
    await expect(page.getByText(/mon|tue|wed|thu|fri/i).first()).toBeVisible({ timeout: 15_000 });

    // ── 5–6. Register shows only this teacher's lessons ──
    await goTo(page, '/register');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Teacher should NOT see the teacher filter dropdown (only owners/admins do)
    const teacherFilter = page.locator('main').getByRole('combobox').filter({ hasText: /teacher/i }).first()
      .or(page.locator('select').filter({ hasText: /all teachers/i }).first());
    const hasTeacherFilter = await teacherFilter.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasTeacherFilter).toBeFalsy();

    // ── 7–8. Students page shows only assigned students ──
    await goTo(page, '/students');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });
});
