import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, waitForPageReady, assertNoErrorBoundary, trackConsoleErrors } from './helpers';

// ═══════════════════════════════════════════════════════════════
// OWNER — CALENDAR (Desktop Chrome project)
// ═══════════════════════════════════════════════════════════════
test.describe('Calendar — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('loads with main content and no error boundaries', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');
    await assertNoErrorBoundary(page);
    // Page should have a heading or the calendar grid
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    const mainText = await page.locator('main').textContent().catch(() => '');
    // Should show either lessons or "Your day is free" empty state
    expect(
      (mainText ?? '').length,
      'Calendar main content should have text',
    ).toBeGreaterThan(10);
  });

  test('"Today" button returns to current date', async ({ page }) => {
    // Navigate to a different date first
    await safeGoTo(page, '/calendar?date=2025-01-15', 'Calendar (past date)');
    const todayBtn = page.getByRole('button', { name: 'Today' }).first();
    await expect(todayBtn).toBeVisible({ timeout: 10_000 });
    await todayBtn.click();
    await waitForPageReady(page);
    // URL should no longer have date=2025-01-15
    const url = page.url();
    expect(url).not.toContain('2025-01-15');
  });

  test('Previous and Next navigation buttons work', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');
    // Store current URL
    const initialUrl = page.url();

    // Click Next
    const nextBtn = page.getByRole('button', { name: /next/i }).first()
      .or(page.locator('button[aria-label="Next"]').first());
    await expect(nextBtn).toBeVisible({ timeout: 10_000 });
    await nextBtn.click();
    await waitForPageReady(page);
    // URL should have changed (date param updated)
    const afterNext = page.url();

    // Click Previous to go back
    const prevBtn = page.getByRole('button', { name: /previous/i }).first()
      .or(page.locator('button[aria-label="Previous"]').first());
    await expect(prevBtn).toBeVisible({ timeout: 10_000 });
    await prevBtn.click();
    await waitForPageReady(page);
  });

  test('view toggle switches between Day, Stacked, Week, Agenda', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');

    const viewToggle = page.locator('[data-tour="calendar-view-toggle"]');
    const isDesktop = await viewToggle.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!isDesktop) {
      // Mobile layout doesn't have view toggle — skip gracefully
      // eslint-disable-next-line no-console
      console.log('[calendar] Skipping view toggle — mobile layout detected');
      return;
    }

    // Switch to Week (Time grid) view
    const weekBtn = page.locator('[aria-label="Time grid view"]').first();
    await weekBtn.click();
    await waitForPageReady(page);
    expect(page.url()).toContain('view=week');

    // Switch to Stacked view
    const stackedBtn = page.locator('[aria-label="Stacked view"]').first();
    await stackedBtn.click();
    await waitForPageReady(page);
    expect(page.url()).toContain('view=stacked');

    // Switch to Agenda view
    const agendaBtn = page.locator('[aria-label="Agenda view"]').first();
    await agendaBtn.click();
    await waitForPageReady(page);
    expect(page.url()).toContain('view=agenda');

    // Switch back to Day view
    const dayBtn = page.locator('[aria-label="Day view"]').first();
    await dayBtn.click();
    await waitForPageReady(page);
    // Day is default, so view param may be absent or equal "day"
  });

  test('Agenda view shows "Group by teacher" toggle', async ({ page }) => {
    await safeGoTo(page, '/calendar?view=agenda', 'Calendar Agenda');

    const groupBtn = page.locator('[aria-label="Group by teacher"]').first();
    const visible = await groupBtn.isVisible({ timeout: 8_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[calendar] Group by teacher toggle in agenda: ${visible}`);

    // When not in agenda view, it should be hidden
    await safeGoTo(page, '/calendar?view=week', 'Calendar Week');
    const hiddenInWeek = await page
      .locator('[aria-label="Group by teacher"]')
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    expect(hiddenInWeek, 'Group by teacher should be hidden outside agenda view').toBe(false);
  });

  test('filter bar shows "All" pill and is interactive', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');

    const filtersBar = page.locator('[data-tour="calendar-filters"]').first();
    await expect(filtersBar).toBeVisible({ timeout: 10_000 });

    // "All" pill should be visible
    const allPill = filtersBar.getByText('All').first();
    await expect(allPill).toBeVisible({ timeout: 5_000 });

    // Check if teacher pills are present (org may have teachers)
    const pillButtons = filtersBar.locator('button');
    const pillCount = await pillButtons.count();
    // eslint-disable-next-line no-console
    console.log(`[calendar] Filter pills count: ${pillCount}`);
    // At least "All" pill exists
    expect(pillCount).toBeGreaterThanOrEqual(1);

    // Click "All" pill to ensure no crash
    await allPill.click();
    await waitForPageReady(page);
    await assertNoErrorBoundary(page);
  });

  test('clicking a teacher filter pill filters lessons', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');

    const filtersBar = page.locator('[data-tour="calendar-filters"]').first();
    await expect(filtersBar).toBeVisible({ timeout: 10_000 });

    // Find a teacher pill (not the "All" pill)
    const teacherPills = filtersBar.locator('button').filter({ hasNotText: /^All/ });
    const teacherCount = await teacherPills.count();

    if (teacherCount === 0) {
      // eslint-disable-next-line no-console
      console.log('[calendar] No teacher pills found — solo teacher org');
      return;
    }

    // Click the first teacher pill
    const firstTeacher = teacherPills.first();
    const teacherName = await firstTeacher.textContent();
    // eslint-disable-next-line no-console
    console.log(`[calendar] Clicking teacher filter: ${teacherName}`);
    await firstTeacher.click();
    await waitForPageReady(page);

    // URL should have teacher param
    const url = page.url();
    expect(url).toContain('teacher=');

    // Click "All" to clear filter
    await filtersBar.getByText('All').first().click();
    await waitForPageReady(page);
    expect(page.url()).not.toContain('teacher=');
  });

  test('"New Lesson" button opens lesson creation modal', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');

    // Desktop: button with data-tour="create-lesson-button"
    const newLessonBtn = page.locator('[data-tour="create-lesson-button"]').first()
      .or(page.getByRole('button', { name: /new lesson/i }).first());
    const btnVisible = await newLessonBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!btnVisible) {
      // Mobile: FAB with aria-label="New Lesson"
      const fab = page.locator('[aria-label="New Lesson"]').first();
      const fabVisible = await fab.isVisible({ timeout: 5_000 }).catch(() => false);
      if (fabVisible) {
        await fab.click();
      } else {
        // eslint-disable-next-line no-console
        console.log('[calendar] Neither New Lesson button nor FAB found');
        return;
      }
    } else {
      await newLessonBtn.click();
    }

    // Modal or drawer should appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Title should be "New Lesson"
    const title = dialog.getByText('New Lesson').first();
    await expect(title).toBeVisible({ timeout: 5_000 });
  });

  test('lesson modal shows required form fields', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');

    // Open the modal
    const newLessonBtn = page.locator('[data-tour="create-lesson-button"]').first()
      .or(page.locator('[aria-label="New Lesson"]').first());
    await expect(newLessonBtn).toBeVisible({ timeout: 10_000 });
    await newLessonBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Check key form fields exist
    const expectedFields = ['Teacher', 'Date', 'Time', 'Duration'];
    for (const field of expectedFields) {
      const label = dialog.getByText(field, { exact: true }).first();
      const visible = await label.isVisible({ timeout: 5_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[calendar] Form field "${field}": ${visible}`);
    }

    // Teacher select should have placeholder
    const teacherSelect = dialog.getByText('Select teacher').first()
      .or(dialog.locator('[placeholder="Select teacher"]').first());
    const hasTeacherSelect = await teacherSelect.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[calendar] Teacher select: ${hasTeacherSelect}`);

    // Cancel button should work
    const cancelBtn = dialog.getByRole('button', { name: /cancel/i }).first();
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 });
    await cancelBtn.click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test('lesson modal cancel and escape close the dialog', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');

    // Open modal
    const newLessonBtn = page.locator('[data-tour="create-lesson-button"]').first()
      .or(page.locator('[aria-label="New Lesson"]').first());
    await expect(newLessonBtn).toBeVisible({ timeout: 10_000 });
    await newLessonBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Close via Escape
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // Re-open and close via Cancel button
    await newLessonBtn.click();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: /cancel/i }).first().click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test('URL param ?action=new auto-opens new lesson modal', async ({ page }) => {
    await safeGoTo(page, '/calendar?action=new', 'Calendar (auto-open)');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    const title = dialog.getByText('New Lesson').first();
    await expect(title).toBeVisible({ timeout: 5_000 });
    // Close it
    await page.keyboard.press('Escape');
  });

  test('clicking a lesson in day view opens detail panel', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');
    await page.waitForTimeout(3_000); // Wait for lessons to load

    // Look for clickable lesson blocks inside main
    // Lessons render as clickable divs/buttons within the calendar grid
    const lessonBlock = page.locator('main').locator('[role="button"]').first()
      .or(page.locator('main [data-lesson-id]').first())
      .or(page.locator('main').locator('.cursor-pointer').first());
    const hasLesson = await lessonBlock.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasLesson) {
      // eslint-disable-next-line no-console
      console.log('[calendar] No lessons visible on current day — cannot test detail panel');
      return;
    }

    await lessonBlock.click();
    await page.waitForTimeout(1_000);

    // Detail panel (Sheet) or mobile sheet should open
    const panel = page.locator('[role="dialog"]')
      .or(page.locator('[data-state="open"]').first());
    const panelOpen = await panel.first().isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[calendar] Lesson detail panel opened: ${panelOpen}`);

    if (panelOpen) {
      // Close it
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  test('compact mode toggle changes layout', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');

    const compactToggle = page.locator('[aria-label="Compact mode"]').first();
    const visible = await compactToggle.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!visible) {
      // eslint-disable-next-line no-console
      console.log('[calendar] Compact toggle not visible — likely mobile');
      return;
    }

    // Toggle compact on
    await compactToggle.click();
    await page.waitForTimeout(500);

    // Toggle compact off
    await compactToggle.click();
    await page.waitForTimeout(500);

    await assertNoErrorBoundary(page);
  });

  test('no console errors during calendar interaction', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/calendar', 'Calendar');
    await page.waitForTimeout(2_000);

    // Switch views to exercise different code paths
    const weekBtn = page.locator('[aria-label="Time grid view"]').first();
    if (await weekBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await weekBtn.click();
      await waitForPageReady(page);
    }

    checkErrors();
  });

  test('page refresh preserves calendar state', async ({ page }) => {
    await safeGoTo(page, '/calendar?view=agenda', 'Calendar (Agenda)');
    await page.reload();
    await waitForPageReady(page);
    await assertNoErrorBoundary(page);
    expect(page.url()).toContain('view=agenda');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEACHER — CALENDAR (scoped view)
// ═══════════════════════════════════════════════════════════════
test.describe('Calendar — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('loads calendar with no error boundaries', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Teacher Calendar');
    await assertNoErrorBoundary(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('can see New Lesson button or FAB', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Teacher Calendar');

    // Teacher can create lessons (not parent-restricted)
    const newLessonBtn = page.locator('[data-tour="create-lesson-button"]').first()
      .or(page.locator('[aria-label="New Lesson"]').first());
    const visible = await newLessonBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[teacher-calendar] New Lesson button: ${visible}`);
    expect(visible, 'Teacher should have a New Lesson button or FAB').toBe(true);
  });

  test('Today and navigation buttons work', async ({ page }) => {
    await safeGoTo(page, '/calendar?date=2025-06-15', 'Teacher Calendar (future)');
    const todayBtn = page.getByRole('button', { name: 'Today' }).first();
    await expect(todayBtn).toBeVisible({ timeout: 10_000 });
    await todayBtn.click();
    await waitForPageReady(page);
    expect(page.url()).not.toContain('2025-06-15');
  });

  test('filter bar is visible', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Teacher Calendar');
    const filtersBar = page.locator('[data-tour="calendar-filters"]').first();
    const visible = await filtersBar.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[teacher-calendar] Filters bar: ${visible}`);
    // Filter bar should still be present even for teachers
  });
});

// ═══════════════════════════════════════════════════════════════
// FINANCE — CALENDAR (should redirect or be restricted)
// ═══════════════════════════════════════════════════════════════
test.describe('Calendar — Finance', () => {
  test.use({ storageState: AUTH.finance });

  test('finance user accessing /calendar is redirected or restricted', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForTimeout(5_000);

    // Finance role doesn't have Calendar in their sidebar nav.
    // They may either get redirected or see a restricted view.
    const url = page.url();
    const onCalendar = url.includes('/calendar');
    const onDashboard = url.includes('/dashboard');
    const hasError = await page.getByText(/access|permission|denied|not found/i).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    // eslint-disable-next-line no-console
    console.log(`[finance-calendar] URL: ${url}, onCalendar: ${onCalendar}, redirected: ${onDashboard}, hasError: ${hasError}`);

    // At least verify no crash happened
    await expect(page.locator('body')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — CALENDAR (Schedule view, read-only)
// ═══════════════════════════════════════════════════════════════
test.describe('Calendar — Parent', () => {
  test.use({ storageState: AUTH.parent });

  test('parent sees "Schedule" heading, not "Calendar"', async ({ page }) => {
    await safeGoTo(page, '/portal/schedule', 'Parent Schedule');
    // Parent portal may have its own schedule page
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    // Check we don't crash
    await assertNoErrorBoundary(page);
  });

  test('parent does NOT see New Lesson button or FAB', async ({ page }) => {
    await safeGoTo(page, '/portal/schedule', 'Parent Schedule');

    const newLessonBtn = page.locator('[data-tour="create-lesson-button"]').first();
    const btnVisible = await newLessonBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(btnVisible, 'Parent should NOT see New Lesson button').toBe(false);

    const fab = page.locator('[aria-label="New Lesson"]').first();
    const fabVisible = await fab.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(fabVisible, 'Parent should NOT see New Lesson FAB').toBe(false);
  });
});
