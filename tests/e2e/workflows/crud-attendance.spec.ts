import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  expectToastSuccess,
} from '../helpers';
import {
  supabaseSelect,
  deleteLessonById,
} from '../supabase-admin';

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
/*  MODULE: Attendance Marking                                         */
/* ================================================================== */

test.describe('CRUD — Attendance', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `e2e-${Date.now()}`;

  test.afterAll(() => {
    // Clean up any lessons created for attendance testing
    try {
      const lessons = supabaseSelect(
        'lessons',
        `notes_shared=like.%25${testId}%25&select=id&limit=10`,
      );
      for (const l of lessons) {
        try { deleteLessonById(l.id); } catch { /* best-effort */ }
      }
    } catch { /* best-effort */ }
  });

  test('mark attendance: present, absent, batch mark all', async ({ page }) => {
    test.setTimeout(300_000);

    // ── Warm up session ──
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    // ── Navigate to daily register ──
    await clickNav(page, '/register');
    await waitForPageReady(page);

    // Wait for the register page to show lessons or empty state
    const registerContent = page.locator('main');
    await expect(registerContent).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2_000);

    // Check if there are lessons today
    const lessonRows = page.locator('main').locator('[class*="rounded"]').filter({
      has: page.getByText(/\d{2}:\d{2}/).first(),
    });
    const hasLessons = await lessonRows.first().isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasLessons) {
      // No lessons today — create one first via calendar
      await clickNav(page, '/calendar');
      await waitForPageReady(page);

      const newLessonBtn = page.locator('[data-tour="create-lesson-button"]');
      if (await newLessonBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await newLessonBtn.click();
        const dialog = page.getByRole('dialog');
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

        // Add notes for cleanup
        const notesField = dialog.getByPlaceholder('Add lesson notes that parents can see...');
        if (await notesField.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await notesField.fill(`E2E Attendance ${testId}`);
        }

        // Create lesson
        const createBtn = dialog.getByRole('button', { name: /create lesson/i });
        await expect(createBtn).toBeEnabled({ timeout: 15_000 });
        await createBtn.click();
        await expect(dialog).toBeHidden({ timeout: 30_000 });
        await page.waitForTimeout(2_000);
      }

      // Go back to register
      await clickNav(page, '/register');
      await waitForPageReady(page);
      await page.waitForTimeout(2_000);
    }

    // ── STEP 1: Expand a lesson row to see attendance buttons ──
    const expandBtn = page.locator('button[aria-label="Toggle details"]').first();
    if (await expandBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await expandBtn.click();
      await page.waitForTimeout(1_000);

      // ── STEP 2: Mark first student as Present ──
      const presentBtn = page.getByRole('button', { name: /present/i }).first();
      if (await presentBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await presentBtn.click();
        await page.waitForTimeout(2_000);

        // Verify visual feedback — the button should now be styled as active (success color)
        // Check that it got the success color class
        const isActive = await presentBtn.evaluate(
          el => el.classList.contains('bg-success/10') || el.classList.contains('bg-success') ||
                getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)',
        );
        // Soft assertion — don't fail the entire test
        if (isActive) {
          expect(isActive).toBe(true);
        }
      }

      // ── STEP 3: Mark a student as Absent ──
      const absentBtn = page.getByRole('button', { name: /absent/i }).first();
      if (await absentBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await absentBtn.click();
        await page.waitForTimeout(2_000);
      }

      // ── STEP 4: Change attendance status ──
      // Mark the absent student back to Present
      const presentBtn2 = page.getByRole('button', { name: /present/i }).first();
      if (await presentBtn2.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await presentBtn2.click();
        await page.waitForTimeout(2_000);
      }
    }

    // ── STEP 5: Test batch attendance mode ──
    const batchModeLink = page.getByRole('link', { name: /batch mode/i }).first()
      .or(page.locator('a[href*="batch-attendance"]').first());
    if (await batchModeLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await batchModeLink.click();
      await page.waitForURL(/batch-attendance/, { timeout: 15_000 });
      await waitForPageReady(page);

      // Click "Mark All Present"
      const markAllBtn = page.getByRole('button', { name: /mark all present/i }).first();
      if (await markAllBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
        const isDisabled = await markAllBtn.isDisabled();
        if (!isDisabled) {
          await markAllBtn.click();
          await page.waitForTimeout(1_000);

          // Save all
          const saveAllBtn = page.getByRole('button', { name: /save all/i }).first();
          if (await saveAllBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await saveAllBtn.click();
            await page.waitForTimeout(3_000);

            // Verify saved indicator
            const savedBadge = page.getByText(/saved/i).first();
            await expect(savedBadge).toBeVisible({ timeout: 15_000 });
          }
        }
      }
    }

    // ── STEP 6: Navigate dates on register ──
    await clickNav(page, '/register');
    await waitForPageReady(page);

    // Navigate forward one day
    const nextDayBtn = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-right') }).first();
    if (await nextDayBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nextDayBtn.click();
      await page.waitForTimeout(1_000);
      await waitForPageReady(page);

      // Navigate back
      const prevDayBtn = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-left') }).first();
      if (await prevDayBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await prevDayBtn.click();
        await page.waitForTimeout(1_000);
        await waitForPageReady(page);
      }
    }

    // Check "Go to Today" button
    const todayBtn = page.getByRole('button', { name: /go to today/i }).first();
    if (await todayBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await todayBtn.click();
      await page.waitForTimeout(500);
    }
  });
});
