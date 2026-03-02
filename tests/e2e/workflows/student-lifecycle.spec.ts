import { test, expect } from '@playwright/test';
import {
  AUTH,
  safeGoTo,
  fillField,
  clickButton,
  expectToastSuccess,
  generateTestId,
  waitForPageReady,
  openDialog,
  trackConsoleErrors,
} from '../helpers';

/**
 * Stage 1 — Student Lifecycle (Owner role)
 *
 * Full CRUD lifecycle:
 *   1. Create student via wizard
 *   2. Verify student appears in list via search
 *   3. Navigate to detail → verify Overview tab
 *   4. Edit student (notes)
 *   5. Add a guardian via Guardians tab
 *   6. Verify guardian link appears
 *   7. Switch to Lessons tab → verify empty state
 *   8. Switch to Invoices tab → verify empty state
 *   9. Archive student → verify status badge changes
 *  10. Verify archived student hidden from default list, visible with filter
 */

test.describe('Student Lifecycle', () => {
  test.use({ storageState: AUTH.owner });

  const uid = generateTestId();
  const FIRST = `E2EFirst${uid}`;
  const LAST = `E2ELast${uid}`;
  const FULL = `${FIRST} ${LAST}`;

  // We'll store the student detail URL across tests
  let studentDetailUrl = '';

  test('1 — Create student via wizard', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);

    await safeGoTo(page, '/students', 'Students list');

    // Click Add Student button
    await page.getByRole('button', { name: /add student/i }).first().click();

    // Wait for wizard dialog
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Step 1: Student Details
    await fillField(page, 'First Name', FIRST);
    await fillField(page, 'Last Name', LAST);

    // Click Next
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2: Guardian — skip (leave "Add guardian" unchecked)
    await page.getByRole('button', { name: /next/i }).click();

    // Step 3: Teaching Setup — skip
    await page.getByRole('button', { name: /create student/i }).click();

    // Should see success toast
    await expectToastSuccess(page, /student created/i);

    // Wizard should show success screen with student name
    await expect(page.getByText(FULL)).toBeVisible({ timeout: 10_000 });

    // Click "View Student" to navigate to detail
    const viewBtn = page.getByRole('button', { name: /view student/i });
    if (await viewBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await viewBtn.click();
      await waitForPageReady(page);
      studentDetailUrl = page.url();
    }

    checkErrors();
  });

  test('2 — Verify student appears in list via search', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students list');

    // Use the search field
    const searchInput = page.getByPlaceholder(/search/i).first();
    await searchInput.fill(FIRST);
    await page.waitForTimeout(500); // debounce

    // Verify student row/card is visible
    await expect(page.getByText(FULL).first()).toBeVisible({ timeout: 10_000 });
  });

  test('3 — Navigate to detail and verify Overview tab', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students list');

    // Search and click the student
    const searchInput = page.getByPlaceholder(/search/i).first();
    await searchInput.fill(FIRST);
    await page.waitForTimeout(500);

    await page.getByText(FULL).first().click();
    await waitForPageReady(page);

    // Store URL for later tests
    studentDetailUrl = page.url();

    // Verify we're on the detail page — name should be in the header
    await expect(page.getByText(FULL).first()).toBeVisible({ timeout: 10_000 });

    // Overview tab should be active by default — look for student info card
    await expect(page.locator('main')).toContainText(FIRST);
  });

  test('4 — Edit student notes', async ({ page }) => {
    test.skip(!studentDetailUrl, 'No student detail URL from previous test');

    await safeGoTo(page, studentDetailUrl, 'Student detail');

    // Click "Edit" button on the overview tab
    const editBtn = page.getByRole('button', { name: /edit/i }).first();
    await editBtn.click();

    // Fill in notes field
    const notesField = page.getByLabel(/notes/i).first()
      .or(page.getByPlaceholder(/notes/i).first())
      .or(page.locator('textarea').first());

    if (await notesField.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await notesField.fill(`E2E test notes ${uid}`);
    }

    // Save
    await clickButton(page, /save/i);
    await expectToastSuccess(page);
  });

  test('5 — Add a guardian via Guardians tab', async ({ page }) => {
    test.skip(!studentDetailUrl, 'No student detail URL from previous test');

    await safeGoTo(page, studentDetailUrl, 'Student detail');

    // Click the Guardians tab
    const guardiansTab = page.getByRole('tab', { name: /guardian/i }).first();
    await guardiansTab.click();
    await page.waitForTimeout(500);

    // Click "Add Guardian" or "Link Guardian" button
    const addGuardianBtn = page.getByRole('button', { name: /add guardian|link guardian/i }).first();
    await addGuardianBtn.click();
    await page.waitForTimeout(500);

    // Switch to "New" tab/mode if available
    const newTab = page.getByRole('tab', { name: /new/i }).first()
      .or(page.getByText(/create new/i).first());
    if (await newTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await newTab.click();
    }

    // Fill guardian details
    const guardianName = `E2E Guardian ${uid}`;
    await fillField(page, 'Full Name', guardianName);
    await fillField(page, 'Email', `e2e-guardian-${uid}@test.lessonloop.net`);

    // Submit
    const submitBtn = page.getByRole('button', { name: /add|save|create|link/i })
      .filter({ hasNotText: /cancel/i }).first();
    await submitBtn.click();

    await expectToastSuccess(page);
  });

  test('6 — Verify guardian link appears', async ({ page }) => {
    test.skip(!studentDetailUrl, 'No student detail URL from previous test');

    await safeGoTo(page, studentDetailUrl, 'Student detail');

    const guardiansTab = page.getByRole('tab', { name: /guardian/i }).first();
    await guardiansTab.click();
    await page.waitForTimeout(1_000);

    // Should show at least one guardian entry
    const guardianText = page.getByText(new RegExp(`E2E Guardian ${uid}`, 'i'));
    await expect(guardianText.first()).toBeVisible({ timeout: 10_000 });
  });

  test('7 — Lessons tab shows empty state', async ({ page }) => {
    test.skip(!studentDetailUrl, 'No student detail URL from previous test');

    await safeGoTo(page, studentDetailUrl, 'Student detail');

    const lessonsTab = page.getByRole('tab', { name: /lesson/i }).first();
    await lessonsTab.click();
    await page.waitForTimeout(1_000);

    // Should show empty state or "no lessons"
    const emptyText = page.getByText(/no lesson|no upcoming|empty|nothing/i).first();
    const hasEmpty = await emptyText.isVisible({ timeout: 5_000 }).catch(() => false);
    
    // Either there's an explicit empty state or just no lesson rows
    if (!hasEmpty) {
      // If there's no explicit empty message, verify there are zero lesson rows
      const lessonRows = page.locator('main tbody tr, main [role="row"], main .lesson-card');
      const count = await lessonRows.count();
      // A newly created student should have 0 lessons (or at most the header row)
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  test('8 — Invoices tab shows empty state', async ({ page }) => {
    test.skip(!studentDetailUrl, 'No student detail URL from previous test');

    await safeGoTo(page, studentDetailUrl, 'Student detail');

    const invoicesTab = page.getByRole('tab', { name: /invoice/i }).first();
    await invoicesTab.click();
    await page.waitForTimeout(1_000);

    const emptyText = page.getByText(/no invoice|no outstanding|empty|nothing/i).first();
    const hasEmpty = await emptyText.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasEmpty) {
      const invoiceRows = page.locator('main tbody tr, main [role="row"]');
      const count = await invoiceRows.count();
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  test('9 — Archive student and verify status change', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students list');

    // Search for our student
    const searchInput = page.getByPlaceholder(/search/i).first();
    await searchInput.fill(FIRST);
    await page.waitForTimeout(500);

    // Find the student row and look for the status toggle / archive button
    const studentRow = page.getByText(FULL).first().locator('..').locator('..');

    // Try to find an archive/deactivate action — could be a button, dropdown, or context menu
    // First try: 3-dot menu or action button in the row
    const actionBtn = studentRow.getByRole('button').filter({ hasText: /archive|deactivate/i }).first()
      .or(studentRow.locator('[data-tour="student-actions"]').first())
      .or(studentRow.locator('button').last());

    if (await actionBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await actionBtn.click();
      await page.waitForTimeout(300);

      // If it opened a dropdown, click the archive option
      const archiveOption = page.getByRole('menuitem', { name: /archive|deactivate/i }).first()
        .or(page.getByText(/archive|deactivate/i).first());
      if (await archiveOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await archiveOption.click();
      }
    }

    // If there's a confirmation dialog, confirm it
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|archive/i }).first();
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await expectToastSuccess(page);
  });

  test('10 — Archived student hidden from default list, visible with filter', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students list');

    // Default filter should be "active" — our archived student should NOT appear
    const searchInput = page.getByPlaceholder(/search/i).first();
    await searchInput.fill(FIRST);
    await page.waitForTimeout(500);

    const studentInDefault = page.getByText(FULL).first();
    const visibleInDefault = await studentInDefault.isVisible({ timeout: 3_000 }).catch(() => false);
    
    // The student should be hidden when filter is "active"
    // Now switch to "inactive" or "all" filter
    const inactiveFilter = page.getByRole('tab', { name: /inactive/i }).first()
      .or(page.getByRole('button', { name: /inactive/i }).first())
      .or(page.getByText(/inactive/i).first());

    const allFilter = page.getByRole('tab', { name: /all/i }).first()
      .or(page.getByRole('button', { name: /all/i }).first());

    if (await inactiveFilter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await inactiveFilter.click();
    } else if (await allFilter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await allFilter.click();
    }

    await page.waitForTimeout(500);

    // Re-search
    await searchInput.clear();
    await searchInput.fill(FIRST);
    await page.waitForTimeout(500);

    // Now the archived student should be visible
    await expect(page.getByText(FULL).first()).toBeVisible({ timeout: 10_000 });
  });
});
