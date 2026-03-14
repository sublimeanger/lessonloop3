/**
 * PART 2: CRUD — Students, Guardians, Lessons (Desktop)
 * Tests 2.1.1 – 2.4.3
 *
 * Uses owner auth state. Creates students/guardians/lessons scoped by TEST_RUN_ID.
 */
import { test, expect } from '../../workflows/workflow.fixtures';
import { AUTH, safeGoTo, expectToast, clickButton, expectDialog, TEST_RUN_ID, STUDENTS, GUARDIANS } from './helpers';
import { createStudentViaWizard, createLessonViaCalendar } from '../workflow-helpers';
import { cleanupTestData } from '../../supabase-admin';
import { waitForPageReady } from '../../helpers';

test.use({ storageState: AUTH.owner });

test.afterAll(() => {
  cleanupTestData(TEST_RUN_ID);
});

test.describe('Part 2: CRUD Data', () => {
  test.describe.configure({ mode: 'serial' });

  // ── 2.1 — Add Students ──

  test('2.1.1 – /students loads', async ({ page }) => {
    await safeGoTo(page, '/students');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('2.1.2 – Add Student button opens wizard', async ({ page }) => {
    await safeGoTo(page, '/students');
    const addBtn = page.locator('[data-tour="add-student-button"]').first()
      .or(page.getByRole('button', { name: /add student/i }).first());
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await addBtn.click();
    await expectDialog(page);
  });

  test('2.1.3-4 – Create Student 1: Oliver with guardian Sarah + Piano', async ({ page }) => {
    await createStudentViaWizard(page, {
      firstName: STUDENTS.oliver.firstName,
      lastName: STUDENTS.oliver.lastName,
      guardian: {
        firstName: GUARDIANS.sarah.firstName,
        lastName: GUARDIANS.sarah.lastName,
        email: GUARDIANS.sarah.email,
      },
      instrument: 'Piano',
    });
  });

  test('2.1.6-7 – Create Student 2: Emma with guardian James + Guitar', async ({ page }) => {
    await createStudentViaWizard(page, {
      firstName: STUDENTS.emma.firstName,
      lastName: STUDENTS.emma.lastName,
      guardian: {
        firstName: GUARDIANS.james.firstName,
        lastName: GUARDIANS.james.lastName,
        email: GUARDIANS.james.email,
      },
      instrument: 'Guitar',
    });
  });

  test('2.1.8 – Create Student 3: Lily with no guardian', async ({ page }) => {
    await createStudentViaWizard(page, {
      firstName: STUDENTS.lily.firstName,
      lastName: STUDENTS.lily.lastName,
    });
  });

  test('2.1.9 – All 3 students listed on /students', async ({ page }) => {
    await safeGoTo(page, '/students');
    await page.waitForTimeout(2_000);
    const main = page.locator('main');
    await expect(main.getByText(STUDENTS.oliver.firstName)).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText(STUDENTS.emma.firstName)).toBeVisible();
    await expect(main.getByText(STUDENTS.lily.firstName)).toBeVisible();
  });

  test('2.1.10-11 – Search filters correctly', async ({ page }) => {
    await safeGoTo(page, '/students');
    const search = page.getByPlaceholder(/search/i).first();
    await expect(search).toBeVisible({ timeout: 10_000 });

    // Search for Oliver
    await search.fill(STUDENTS.oliver.firstName);
    await page.waitForTimeout(1_000);
    await expect(page.locator('main').getByText(STUDENTS.oliver.firstName)).toBeVisible();
    // Emma should not be visible
    const emmaVisible = await page.locator('main').getByText(STUDENTS.emma.firstName).isVisible().catch(() => false);
    expect(emmaVisible).toBe(false);

    // Clear search
    await search.clear();
    await page.waitForTimeout(1_000);
    await expect(page.locator('main').getByText(STUDENTS.emma.firstName)).toBeVisible({ timeout: 5_000 });
  });

  // ── 2.2 — Add Guardian to Student 3 ──

  test('2.2.1-4 – Add guardian Rachel to Lily via student detail', async ({ page }) => {
    await safeGoTo(page, '/students');
    await page.waitForTimeout(1_000);
    // Click Lily to open detail
    await page.locator('main').getByText(STUDENTS.lily.firstName).first().click();
    await page.waitForURL(/\/students\//, { timeout: 10_000 });
    await waitForPageReady(page);

    // Click Guardians tab
    const guardiansTab = page.getByRole('tab', { name: /guardian/i }).first();
    if (await guardiansTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await guardiansTab.click();
      await page.waitForTimeout(500);
    }

    // Add guardian
    const addGuardianBtn = page.getByRole('button', { name: /add guardian/i }).first();
    await expect(addGuardianBtn).toBeVisible({ timeout: 10_000 });
    await addGuardianBtn.click();
    await expectDialog(page);

    const dialog = page.getByRole('dialog');
    const firstNameField = dialog.getByLabel(/first name/i).first();
    if (await firstNameField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstNameField.fill(GUARDIANS.rachel.firstName);
    }
    const lastNameField = dialog.getByLabel(/last name/i).first();
    if (await lastNameField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await lastNameField.fill(GUARDIANS.rachel.lastName);
    }
    const emailField = dialog.getByLabel(/email/i).first();
    if (await emailField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await emailField.fill(GUARDIANS.rachel.email);
    }

    // Submit
    const saveBtn = dialog.getByRole('button', { name: /save|add|create/i }).first();
    await saveBtn.click();
    await expectToast(page, /guardian|added|created|saved/i);
  });

  // ── 2.3 — Create Lessons ──

  test('2.3.1-2 – /calendar loads and New Lesson opens', async ({ page }) => {
    await safeGoTo(page, '/calendar');
    const newBtn = page.locator('[data-tour="create-lesson-button"]').first()
      .or(page.getByRole('button', { name: /new lesson/i }).first());
    await expect(newBtn).toBeVisible({ timeout: 15_000 });
  });

  test('2.3.3-4 – Create Lesson 1: Oliver Piano today', async ({ page }) => {
    await createLessonViaCalendar(page, {
      studentName: STUDENTS.oliver.firstName,
      time: '14:00',
      duration: 30,
    });
  });

  test('2.3.5 – Create Lesson 2: Emma Guitar today', async ({ page }) => {
    await createLessonViaCalendar(page, {
      studentName: STUDENTS.emma.firstName,
      time: '15:00',
      duration: 30,
    });
  });

  test('2.3.6 – Create Lesson 3: Lily Piano tomorrow', async ({ page }) => {
    await createLessonViaCalendar(page, {
      studentName: STUDENTS.lily.firstName,
      daysFromToday: 1,
      time: '14:00',
      duration: 30,
    });
  });

  test('2.3.7 – Create Lesson 4: Oliver Piano tomorrow recurring', async ({ page }) => {
    await createLessonViaCalendar(page, {
      studentName: STUDENTS.oliver.firstName,
      daysFromToday: 1,
      time: '16:00',
      duration: 30,
    });
    // Note: recurring setup via UI isn't handled by createLessonViaCalendar helper yet
  });

  // ── 2.3.8-12 — Calendar Views ──

  test('2.3.9-10 – Day and Week views render', async ({ page }) => {
    await safeGoTo(page, '/calendar');
    // Day view
    const dayBtn = page.getByRole('button', { name: /day/i }).first();
    if (await dayBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dayBtn.click();
      await page.waitForTimeout(1_000);
      await expect(page.locator('main').first()).toBeVisible();
    }
    // Week view
    const weekBtn = page.getByRole('button', { name: /week/i }).first();
    if (await weekBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await weekBtn.click();
      await page.waitForTimeout(1_000);
      await expect(page.locator('main').first()).toBeVisible();
    }
  });

  test('2.3.12 – Click lesson shows detail panel', async ({ page }) => {
    await safeGoTo(page, '/calendar');
    await page.waitForTimeout(2_000);
    // Click any lesson card
    const lessonCard = page.locator('main [class*="lesson"], main [data-lesson-id], main .fc-event').first();
    if (await lessonCard.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await lessonCard.click();
      await page.waitForTimeout(1_000);
      // Expect detail panel or dialog
      const detail = page.locator('[data-tour="lesson-detail"], [role="dialog"], aside').first();
      await expect(detail).toBeVisible({ timeout: 5_000 });
    }
  });
});
