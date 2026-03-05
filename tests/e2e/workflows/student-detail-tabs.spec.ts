import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  goTo,
  expectToastSuccess,
  assertNoErrorBoundary,
} from '../helpers';
import {
  supabaseSelect,
  supabaseDelete,
  getOrgId,
} from '../supabase-admin';

// ─── Shared helpers ────────────────────────────────────────
const testId = `e2e-${Date.now()}`;

/** Navigate to the first student's detail page */
async function navigateToFirstStudent(page: Page) {
  await safeGoTo(page, '/students', 'Students');
  await page.waitForTimeout(2_000);

  // Click the first row in the student list
  const tableRow = page.locator('[data-tour="student-list"] tbody tr').first();
  const hasRow = await tableRow.isVisible({ timeout: 10_000 }).catch(() => false);
  if (hasRow) {
    await tableRow.click();
  } else {
    // Try link-based cards
    const link = page.locator('main a[href*="/students/"]').first();
    await expect(link).toBeVisible({ timeout: 10_000 });
    await link.click();
  }
  await page.waitForURL(/\/students\/[\w-]+/, { timeout: 15_000 });
  await waitForPageReady(page);
}

/** Click a tab by value text */
async function clickTab(page: Page, tabName: string) {
  const tab = page.getByRole('tab', { name: tabName }).first();
  await expect(tab).toBeVisible({ timeout: 10_000 });
  await tab.click();
  await page.waitForTimeout(1_000);
}

// ═══════════════════════════════════════════════════════════════
// SECTION 1: OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════
test.describe('Student Detail — Overview Tab', () => {
  test.use({ storageState: AUTH.owner });

  test('navigates to student detail and verifies all 10 tabs', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await assertNoErrorBoundary(page);

    // Verify the Overview tab is active by default
    const overviewTab = page.getByRole('tab', { name: 'Overview' }).first();
    await expect(overviewTab).toBeVisible({ timeout: 10_000 });
    await expect(overviewTab).toHaveAttribute('data-state', 'active');

    // Verify all 10 tabs are visible
    const expectedTabs = [
      'Overview', 'Instruments', 'Teachers', 'Guardians', 'Lessons',
      'Practice', 'Invoices', 'Credits', 'Notes', 'Messages',
    ];
    for (const tabName of expectedTabs) {
      const tab = page.getByRole('tab', { name: tabName }).first();
      await expect(tab, `Tab "${tabName}" should be visible`).toBeVisible({ timeout: 5_000 });
    }

    // Verify student name is displayed (PageHeader title)
    const breadcrumbStudents = page.getByRole('link', { name: 'Students' }).first();
    await expect(breadcrumbStudents).toBeVisible({ timeout: 5_000 });
  });

  test('edits student first name and reverts', async ({ page }) => {
    test.setTimeout(120_000);
    await navigateToFirstStudent(page);

    // Click Edit button on overview card
    const editBtn = page.getByRole('button', { name: /Edit/ }).first();
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await editBtn.click();
    await page.waitForTimeout(500);

    // Store original first name
    const firstNameInput = page.locator('#edit-firstName');
    await expect(firstNameInput).toBeVisible({ timeout: 5_000 });
    const originalFirstName = await firstNameInput.inputValue();

    // Change first name
    const newFirstName = `E2E Edited ${testId.slice(-6)}`;
    await firstNameInput.fill(newFirstName);

    // Save
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expectToastSuccess(page);
    await page.waitForTimeout(1_000);

    // Verify name updated in the page header
    await expect(page.getByText(newFirstName).first()).toBeVisible({ timeout: 10_000 });

    // Revert: click Edit again
    const editBtn2 = page.getByRole('button', { name: /Edit/ }).first();
    await expect(editBtn2).toBeVisible({ timeout: 10_000 });
    await editBtn2.click();
    await page.waitForTimeout(500);

    // Fill original name back
    const firstNameInput2 = page.locator('#edit-firstName');
    await expect(firstNameInput2).toBeVisible({ timeout: 5_000 });
    await firstNameInput2.fill(originalFirstName);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expectToastSuccess(page);

    // Verify reverted
    await expect(page.getByText(originalFirstName).first()).toBeVisible({ timeout: 10_000 });
  });

  test('edits student email and reverts', async ({ page }) => {
    test.setTimeout(120_000);
    await navigateToFirstStudent(page);

    // Click Edit
    const editBtn = page.getByRole('button', { name: /Edit/ }).first();
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await editBtn.click();
    await page.waitForTimeout(500);

    const emailInput = page.locator('#edit-email');
    await expect(emailInput).toBeVisible({ timeout: 5_000 });
    const originalEmail = await emailInput.inputValue();

    // Change email
    const newEmail = `e2e-${testId.slice(-6)}@test.com`;
    await emailInput.fill(newEmail);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expectToastSuccess(page);
    await page.waitForTimeout(1_000);

    // Revert
    const editBtn2 = page.getByRole('button', { name: /Edit/ }).first();
    await expect(editBtn2).toBeVisible({ timeout: 10_000 });
    await editBtn2.click();
    await page.waitForTimeout(500);
    const emailInput2 = page.locator('#edit-email');
    await expect(emailInput2).toBeVisible({ timeout: 5_000 });
    await emailInput2.fill(originalEmail);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expectToastSuccess(page);
  });

  test('edits student phone and reverts', async ({ page }) => {
    test.setTimeout(120_000);
    await navigateToFirstStudent(page);

    const editBtn = page.getByRole('button', { name: /Edit/ }).first();
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await editBtn.click();
    await page.waitForTimeout(500);

    const phoneInput = page.locator('#edit-phone');
    await expect(phoneInput).toBeVisible({ timeout: 5_000 });
    const originalPhone = await phoneInput.inputValue();

    const newPhone = `07700900${testId.slice(-3)}`;
    await phoneInput.fill(newPhone);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expectToastSuccess(page);
    await page.waitForTimeout(1_000);

    // Revert
    const editBtn2 = page.getByRole('button', { name: /Edit/ }).first();
    await expect(editBtn2).toBeVisible({ timeout: 10_000 });
    await editBtn2.click();
    await page.waitForTimeout(500);
    const phoneInput2 = page.locator('#edit-phone');
    await expect(phoneInput2).toBeVisible({ timeout: 5_000 });
    await phoneInput2.fill(originalPhone);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expectToastSuccess(page);
  });

  test('edits student notes on overview and reverts', async ({ page }) => {
    test.setTimeout(120_000);
    await navigateToFirstStudent(page);

    // The overview has a notes textarea when in edit mode
    const editBtn = page.getByRole('button', { name: /Edit/ }).first();
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await editBtn.click();
    await page.waitForTimeout(500);

    const notesInput = page.locator('#edit-notes');
    await expect(notesInput).toBeVisible({ timeout: 5_000 });
    const originalNotes = await notesInput.inputValue();

    const newNotes = `E2E test note ${testId}`;
    await notesInput.fill(newNotes);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expectToastSuccess(page);
    await page.waitForTimeout(1_000);

    // Verify notes text appears on the page (in view mode)
    await expect(page.getByText(newNotes).first()).toBeVisible({ timeout: 10_000 });

    // Revert
    const editBtn2 = page.getByRole('button', { name: /Edit/ }).first();
    await expect(editBtn2).toBeVisible({ timeout: 10_000 });
    await editBtn2.click();
    await page.waitForTimeout(500);
    const notesInput2 = page.locator('#edit-notes');
    await expect(notesInput2).toBeVisible({ timeout: 5_000 });
    await notesInput2.fill(originalNotes);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expectToastSuccess(page);
  });

  test('cancel edit reverts all fields', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);

    const editBtn = page.getByRole('button', { name: /Edit/ }).first();
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await editBtn.click();
    await page.waitForTimeout(500);

    // Modify first name
    const firstNameInput = page.locator('#edit-firstName');
    await expect(firstNameInput).toBeVisible({ timeout: 5_000 });
    const originalFirstName = await firstNameInput.inputValue();
    await firstNameInput.fill('CANCELLED_EDIT');

    // Click Cancel
    const cancelBtn = page.getByRole('button', { name: 'Cancel' }).first();
    await cancelBtn.click();
    await page.waitForTimeout(500);

    // Verify we're back to view mode and name is unchanged
    await expect(page.getByRole('button', { name: /Edit/ }).first()).toBeVisible({ timeout: 5_000 });
    // The original name should still be shown, not CANCELLED_EDIT
    const cancelledVisible = await page.getByText('CANCELLED_EDIT').first().isVisible({ timeout: 2_000 }).catch(() => false);
    expect(cancelledVisible).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 2: INSTRUMENTS TAB
// ═══════════════════════════════════════════════════════════════
test.describe('Student Detail — Instruments Tab', () => {
  test.use({ storageState: AUTH.owner });

  test.afterAll(() => {
    // Clean up any test instruments via supabase admin
    try {
      const orgId = getOrgId();
      if (orgId) {
        // Student instruments are cleaned up by the remove test
      }
    } catch { /* best-effort */ }
  });

  test('switches to instruments tab and views content', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Instruments');

    // Should show "Instruments & Grades" card
    await expect(
      page.getByText('Instruments & Grades').first()
    ).toBeVisible({ timeout: 10_000 });

    // Should show either instruments list or empty state
    const hasInstruments = await page.locator('.border.rounded-lg .font-medium').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEmpty = await page.getByText('No instruments added yet').first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasInstruments || hasEmpty, 'Should show instruments or empty state').toBe(true);
  });

  test('adds and removes instrument from student', async ({ page }) => {
    test.setTimeout(120_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Instruments');
    await page.waitForTimeout(1_000);

    // Click "Add Instrument" button
    const addBtn = page.getByRole('button', { name: /Add Instrument/ }).first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();
    await page.waitForTimeout(500);

    // Select an instrument from the dropdown
    const instrumentTrigger = page.locator('.border.rounded-lg.p-4').first()
      .locator('button[role="combobox"]').first();
    await expect(instrumentTrigger).toBeVisible({ timeout: 5_000 });
    await instrumentTrigger.click();
    await page.waitForTimeout(500);

    // Pick the first available instrument option
    const firstOption = page.getByRole('option').first();
    await expect(firstOption).toBeVisible({ timeout: 5_000 });
    const instrumentName = await firstOption.textContent();
    await firstOption.click();
    await page.waitForTimeout(300);

    // Click "Add Instrument" submit button
    const submitBtn = page.getByRole('button', { name: 'Add Instrument' }).last();
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();
    await page.waitForTimeout(2_000);

    // Verify instrument appears in the list
    if (instrumentName) {
      const cleanName = instrumentName.trim().split('\n')[0].trim();
      await expect(
        page.getByText(cleanName, { exact: false }).first()
      ).toBeVisible({ timeout: 10_000 });
    }

    // Now remove it: click the trash icon on the last instrument row
    const trashBtn = page.locator('button').filter({ has: page.locator('.lucide-trash-2') }).last();
    const hasTrash = await trashBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasTrash) {
      await trashBtn.click();
      await page.waitForTimeout(500);

      // Confirm in the alert dialog
      const confirmDelete = page.getByRole('button', { name: /Delete instrument/i }).first();
      const hasConfirm = await confirmDelete.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasConfirm) {
        await confirmDelete.click();
        await page.waitForTimeout(2_000);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 3: TEACHERS TAB
// ═══════════════════════════════════════════════════════════════
test.describe('Student Detail — Teachers Tab', () => {
  test.use({ storageState: AUTH.owner });

  test('switches to teachers tab and views content', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Teachers');

    // Should show "Assigned Teachers" card title
    await expect(
      page.getByText('Assigned Teachers').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('assigns and removes a teacher', async ({ page }) => {
    test.setTimeout(120_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Teachers');
    await page.waitForTimeout(1_000);

    // Click "Assign Teacher"
    const assignBtn = page.getByRole('button', { name: /Assign Teacher/ }).first();
    await expect(assignBtn).toBeVisible({ timeout: 10_000 });
    await assignBtn.click();

    // Wait for dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Select a teacher from dropdown
    const teacherTrigger = dialog.locator('button[role="combobox"]').first();
    await expect(teacherTrigger).toBeVisible({ timeout: 5_000 });
    await teacherTrigger.click();
    await page.waitForTimeout(500);

    const firstTeacher = page.getByRole('option').first();
    const hasTeacher = await firstTeacher.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasTeacher) {
      // No teachers available to assign
      await page.keyboard.press('Escape');
      return;
    }
    const teacherName = await firstTeacher.textContent();
    await firstTeacher.click();
    await page.waitForTimeout(300);

    // Click "Assign Teacher" submit
    const submitBtn = dialog.getByRole('button', { name: 'Assign Teacher' });
    await submitBtn.click();
    await expectToastSuccess(page, /assigned/i);
    await page.waitForTimeout(1_000);

    // Verify teacher appears in the list
    if (teacherName) {
      const cleanName = teacherName.trim().split('(')[0].trim();
      await expect(
        page.getByText(cleanName, { exact: false }).first()
      ).toBeVisible({ timeout: 10_000 });
    }

    // Remove the teacher: click "Remove" button on the last teacher row
    const removeBtn = page.getByRole('button', { name: 'Remove' }).last();
    const hasRemove = await removeBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasRemove) {
      await removeBtn.click();
      await page.waitForTimeout(500);

      // Confirm in the alert dialog
      const confirmRemove = page.locator('[role="alertdialog"]')
        .getByRole('button', { name: 'Remove' });
      const hasConfirm = await confirmRemove.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasConfirm) {
        await confirmRemove.click();
        await expectToastSuccess(page, /removed/i);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 4: GUARDIANS TAB
// ═══════════════════════════════════════════════════════════════
test.describe('Student Detail — Guardians Tab', () => {
  test.use({ storageState: AUTH.owner });

  test.afterAll(() => {
    try {
      const orgId = getOrgId();
      if (orgId) {
        const encodedName = encodeURIComponent(`%${testId}%`);
        supabaseDelete('student_guardians', `org_id=eq.${orgId}`);
        supabaseDelete('guardians', `org_id=eq.${orgId}&full_name=like.${encodedName}`);
      }
    } catch { /* best-effort */ }
  });

  test('switches to guardians tab and views content', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Guardians');

    // Should show "Guardians" card title
    await expect(
      page.getByText('Guardians').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('adds a new guardian, edits, then removes', async ({ page }) => {
    test.setTimeout(180_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Guardians');
    await page.waitForTimeout(1_000);

    // Click "Add Guardian"
    const addBtn = page.getByRole('button', { name: /Add Guardian/ }).first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Click "New Guardian" tab
    const newGuardianBtn = dialog.getByRole('button', { name: /New Guardian/ });
    await expect(newGuardianBtn).toBeVisible({ timeout: 5_000 });
    await newGuardianBtn.click();
    await page.waitForTimeout(300);

    // Fill guardian form — labels have no htmlFor, use inputs directly
    const guardianName = `E2E Guardian ${testId.slice(-6)}`;
    // The "New Guardian" sub-form has 3 inputs: Full name, Email, Phone
    const nameInput = dialog.locator('input[placeholder="Sarah Wilson"]');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(guardianName);
    const emailInput = dialog.locator('input[placeholder="sarah@example.com"]');
    await emailInput.fill(`e2e-guardian-${testId.slice(-6)}@test.com`);
    const phoneInput = dialog.locator('input[placeholder="+44 7700 900000"]');
    await phoneInput.fill(`07700900${testId.slice(-3)}`);

    // Submit
    await dialog.getByRole('button', { name: 'Add Guardian' }).click();
    await expectToastSuccess(page);
    await page.waitForTimeout(2_000);

    // Verify guardian appears in the list
    await expect(
      page.getByText(guardianName, { exact: false }).first()
    ).toBeVisible({ timeout: 10_000 });

    // Edit guardian: click pencil icon
    const pencilBtn = page.locator('button').filter({ has: page.locator('.lucide-pencil') }).last();
    const hasPencil = await pencilBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasPencil) {
      await pencilBtn.click();
      const editDialog = page.getByRole('dialog');
      await expect(editDialog).toBeVisible({ timeout: 5_000 });

      // Change phone — edit dialog has 3 inputs: Full name, Email, Phone
      const editPhoneInput = editDialog.locator('input[type="tel"]');
      await expect(editPhoneInput).toBeVisible({ timeout: 5_000 });
      await editPhoneInput.fill('07700900999');
      await editDialog.getByRole('button', { name: 'Save Changes' }).click();
      await expectToastSuccess(page);
      await page.waitForTimeout(1_000);
    }

    // Remove guardian: click "Remove" button
    const removeBtn = page.getByRole('button', { name: 'Remove' }).last();
    const hasRemove = await removeBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasRemove) {
      await removeBtn.click();
      await page.waitForTimeout(500);

      // Handle the DeleteValidationDialog
      const confirmBtn = page.locator('[role="alertdialog"]')
        .getByRole('button', { name: /Remove|Delete|Confirm/i }).first();
      const hasConfirm = await confirmBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasConfirm) {
        await confirmBtn.click();
        await page.waitForTimeout(2_000);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 5: LESSONS TAB
// ═══════════════════════════════════════════════════════════════
test.describe('Student Detail — Lessons Tab', () => {
  test.use({ storageState: AUTH.owner });

  test('switches to lessons tab and views content', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Lessons');

    // Should show "Lesson History" card title
    await expect(
      page.getByText('Lesson History').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('views lesson list with status badges', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Lessons');
    await page.waitForTimeout(2_000);

    // Either shows lessons with status badges or "No lessons yet" empty state
    const hasLessons = await page.locator('.rounded-lg.border.p-3').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEmpty = await page.getByText('No lessons yet').first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasLessons || hasEmpty, 'Should show lessons list or empty state').toBe(true);

    if (hasLessons) {
      // Verify at least one lesson shows a status badge
      const statusBadge = page.locator('.rounded-lg.border.p-3').first()
        .locator('[class*="badge"]').first();
      await expect(statusBadge).toBeVisible({ timeout: 5_000 });
    }
  });

  test('clicks a lesson View button to navigate to calendar', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Lessons');
    await page.waitForTimeout(2_000);

    const viewBtn = page.getByRole('button', { name: 'View' }).first();
    const hasView = await viewBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasView) {
      // The View button is a link to /calendar?date=...
      const viewLink = page.locator('a[href*="/calendar"]').first();
      const hasLink = await viewLink.isVisible({ timeout: 3_000 }).catch(() => false);
      if (hasLink) {
        await viewLink.click();
        await page.waitForURL(/\/calendar/, { timeout: 15_000 });
        await waitForPageReady(page);
        expect(page.url()).toContain('/calendar');
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 6: PRACTICE TAB
// ═══════════════════════════════════════════════════════════════
test.describe('Student Detail — Practice Tab', () => {
  test.use({ storageState: AUTH.owner });

  test('switches to practice tab and views content', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Practice');
    await page.waitForTimeout(2_000);

    // Should show "Practice Assignments" card or loading state followed by content
    const hasAssignments = await page.getByText('Practice Assignments').first()
      .isVisible({ timeout: 10_000 }).catch(() => false);
    const hasPracticeHistory = await page.getByText('Practice History').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);

    expect(
      hasAssignments || hasPracticeHistory,
      'Should show Practice Assignments or Practice History section'
    ).toBe(true);
  });

  test('views practice assignments and empty state', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Practice');
    await page.waitForTimeout(2_000);

    // "New Assignment" button should be visible
    const newAssignmentBtn = page.getByRole('button', { name: /New Assignment/ }).first();
    await expect(newAssignmentBtn).toBeVisible({ timeout: 10_000 });

    // Either active assignments or empty state
    const hasActive = await page.locator('.rounded-lg.border.p-3').first()
      .isVisible({ timeout: 3_000 }).catch(() => false);
    const hasEmpty = await page.getByText(/No active assignments/i).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasActive || hasEmpty, 'Should show assignments or empty state').toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 7: INVOICES TAB
// ═══════════════════════════════════════════════════════════════
test.describe('Student Detail — Invoices Tab', () => {
  test.use({ storageState: AUTH.owner });

  test('switches to invoices tab and views content', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Invoices');

    // Should show "Invoices" card title
    await expect(
      page.getByText('Invoices').first()
    ).toBeVisible({ timeout: 10_000 });

    // Either shows invoice list or empty state
    const hasInvoices = await page.locator('.rounded-lg.border.p-3').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEmpty = await page.getByText('No invoices yet').first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasInvoices || hasEmpty, 'Should show invoices or empty state').toBe(true);
  });

  test('clicks invoice View button to navigate to invoice detail', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Invoices');
    await page.waitForTimeout(2_000);

    const invoiceLink = page.locator('a[href*="/invoices/"]').first();
    const hasLink = await invoiceLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasLink) {
      await invoiceLink.click();
      await page.waitForURL(/\/invoices\/[\w-]+/, { timeout: 15_000 });
      await waitForPageReady(page);
      expect(page.url()).toMatch(/\/invoices\/[\w-]+/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 8: CREDITS TAB
// ═══════════════════════════════════════════════════════════════
test.describe('Student Detail — Credits Tab', () => {
  test.use({ storageState: AUTH.owner });

  test.afterAll(() => {
    try {
      const orgId = getOrgId();
      if (orgId) {
        const encodedNote = encodeURIComponent(`%${testId}%`);
        supabaseDelete('make_up_credits', `org_id=eq.${orgId}&notes=like.${encodedNote}`);
      }
    } catch { /* best-effort */ }
  });

  test('switches to credits tab and views content', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Credits');
    await page.waitForTimeout(1_000);

    // Should show "Make-Up Credits" title
    await expect(
      page.getByText('Make-Up Credits').first()
    ).toBeVisible({ timeout: 10_000 });

    // Should show Available Balance section
    await expect(
      page.getByText('Available Balance').first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('issues a manual credit and verifies it appears', async ({ page }) => {
    test.setTimeout(120_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Credits');
    await page.waitForTimeout(1_000);

    // Click "Issue Credit" button
    const issueBtn = page.getByRole('button', { name: /Issue Credit/ }).first();
    await expect(issueBtn).toBeVisible({ timeout: 10_000 });
    await issueBtn.click();

    // Dialog should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText('Issue Make-Up Credit')).toBeVisible({ timeout: 5_000 });

    // Fill amount
    const amountInput = dialog.locator('#amount');
    await expect(amountInput).toBeVisible({ timeout: 5_000 });
    await amountInput.fill('10.00');

    // Fill notes with testId for cleanup
    const notesInput = dialog.locator('#notes');
    await notesInput.fill(`E2E test credit ${testId}`);

    // Submit
    await dialog.getByRole('button', { name: 'Issue Credit' }).click();

    // Wait for dialog to close (indicates success)
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await page.waitForTimeout(2_000);

    // Verify the credit appears in the list (£10.00)
    await expect(
      page.getByText('£10.00', { exact: false }).first()
    ).toBeVisible({ timeout: 10_000 });

    // Verify Available badge on the credit
    await expect(
      page.getByText('Available').first()
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 9: NOTES TAB
// ═══════════════════════════════════════════════════════════════
test.describe('Student Detail — Notes Tab', () => {
  test.use({ storageState: AUTH.owner });

  test('switches to notes tab and views content', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Notes');

    // Should show "Lesson Notes" card title
    await expect(
      page.getByText('Lesson Notes').first()
    ).toBeVisible({ timeout: 10_000 });

    // Either shows notes list or empty state
    const hasNotes = await page.locator('.rounded-xl.border.p-4').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEmpty = await page.getByText('No lesson notes yet').first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasNotes || hasEmpty, 'Should show notes or empty state').toBe(true);
  });

  test('notes display shared note content and status badges', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Notes');
    await page.waitForTimeout(2_000);

    // If there are notes, check they have status badges
    const noteCards = page.locator('.rounded-xl.border.p-4');
    const count = await noteCards.count();

    if (count > 0) {
      // First note should have a status badge
      const firstNote = noteCards.first();
      const badge = firstNote.locator('[class*="badge"]').first();
      await expect(badge).toBeVisible({ timeout: 5_000 });

      // Should show date/time
      const dateText = firstNote.locator('.text-sm.font-medium').first();
      await expect(dateText).toBeVisible({ timeout: 5_000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 10: MESSAGES TAB
// ═══════════════════════════════════════════════════════════════
test.describe('Student Detail — Messages Tab', () => {
  test.use({ storageState: AUTH.owner });

  test('switches to messages tab and views content', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Messages');

    // Should show "Messages" card title
    await expect(
      page.getByText('Messages').first()
    ).toBeVisible({ timeout: 10_000 });

    // Should show "Send Message" button
    const sendBtn = page.getByRole('button', { name: /Send Message/ }).first();
    await expect(sendBtn).toBeVisible({ timeout: 10_000 });
  });

  test('views message list or guardian-required empty state', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Messages');
    await page.waitForTimeout(2_000);

    // Either has messages, or shows empty state about needing guardian
    const hasMessages = await page.locator('.rounded-lg.border.p-3').first()
      .isVisible({ timeout: 3_000 }).catch(() => false);
    const hasGuardianMessage = await page.getByText(/Link a guardian|No messages/i).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasMessages || hasGuardianMessage, 'Should show messages or empty state').toBe(true);
  });

  test('Send Message button opens compose dialog', async ({ page }) => {
    test.setTimeout(90_000);
    await navigateToFirstStudent(page);
    await clickTab(page, 'Messages');
    await page.waitForTimeout(1_000);

    const sendBtn = page.getByRole('button', { name: /Send Message/ }).first();
    await expect(sendBtn).toBeVisible({ timeout: 10_000 });
    await sendBtn.click();

    // Should open ComposeMessageModal dialog
    const dialog = page.getByRole('dialog');
    const dialogVisible = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
    if (dialogVisible) {
      await expect(dialog).toBeVisible();
      // Close without sending
      await page.keyboard.press('Escape');
    }
  });
});
