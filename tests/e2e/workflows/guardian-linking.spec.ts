import { test, expect } from '@playwright/test';
import {
  AUTH,
  safeGoTo,
  fillField,
  clickButton,
  expectToastSuccess,
  generateTestId,
  waitForPageReady,
  trackConsoleErrors,
} from '../helpers';

/**
 * Stage 2 — Guardian Linking (Owner role)
 *
 * Tests guardian management and primary payer logic:
 *   1. Create student A via wizard with a NEW guardian attached
 *   2. Create student B via wizard WITHOUT a guardian
 *   3. Navigate to student B → Guardians tab → link EXISTING guardian (from student A)
 *   4. Verify guardian appears on student B's Guardians tab
 *   5. Set guardian as primary payer on student A → verify badge
 *   6. Set a second NEW guardian as primary payer on student A → verify it replaces the first
 *   7. Remove guardian link from student B → verify removal
 *   8. Verify guardian still linked to student A
 */

test.describe('Guardian Linking', () => {
  test.use({ storageState: AUTH.owner });

  const uid = generateTestId();
  const STUDENT_A_FIRST = `GrdA${uid}`;
  const STUDENT_A_LAST = `TestA`;
  const STUDENT_A_FULL = `${STUDENT_A_FIRST} ${STUDENT_A_LAST}`;

  const STUDENT_B_FIRST = `GrdB${uid}`;
  const STUDENT_B_LAST = `TestB`;
  const STUDENT_B_FULL = `${STUDENT_B_FIRST} ${STUDENT_B_LAST}`;

  const GUARDIAN_NAME = `Parent ${uid}`;
  const GUARDIAN_EMAIL = `guardian-${uid}@test.lessonloop.net`;

  const GUARDIAN2_NAME = `Parent2 ${uid}`;
  const GUARDIAN2_EMAIL = `guardian2-${uid}@test.lessonloop.net`;

  let studentAUrl = '';
  let studentBUrl = '';

  // ─── Helper: navigate to student detail via search ───
  async function goToStudent(page: import('@playwright/test').Page, firstName: string, fullName: string) {
    await safeGoTo(page, '/students', 'Students list');
    const search = page.getByPlaceholder(/search/i).first();
    await search.fill(firstName);
    await page.waitForTimeout(600);
    await page.getByText(fullName).first().click();
    await waitForPageReady(page);
    return page.url();
  }

  // ─── Helper: open Guardians tab ───
  async function openGuardiansTab(page: import('@playwright/test').Page) {
    await page.getByRole('tab', { name: /guardian/i }).first().click();
    await page.waitForTimeout(800);
  }

  // ── 1. Create student A WITH a new guardian ──
  test('1 — Create student A with new guardian', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/students', 'Students list');

    await page.getByRole('button', { name: /add student/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Step 1 — Student details
    await fillField(page, 'First Name', STUDENT_A_FIRST);
    await fillField(page, 'Last Name', STUDENT_A_LAST);
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2 — Guardian: toggle ON, create new
    const addToggle = page.locator('#add-guardian');
    await addToggle.click(); // enable
    await page.waitForTimeout(300);

    // Select "Create new guardian" radio
    const newRadio = page.locator('#mode-new');
    await newRadio.click();
    await page.waitForTimeout(300);

    await fillField(page, 'Full name', GUARDIAN_NAME);
    await fillField(page, 'Email', GUARDIAN_EMAIL);

    // Primary payer switch should be on by default
    await page.getByRole('button', { name: /next/i }).click();

    // Step 3 — Teaching setup: skip
    await page.getByRole('button', { name: /create student/i }).click();
    await expectToastSuccess(page, /student created/i);

    // Navigate to detail
    const viewBtn = page.getByRole('button', { name: /view student/i });
    if (await viewBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await viewBtn.click();
      await waitForPageReady(page);
      studentAUrl = page.url();
    }

    checkErrors();
  });

  // ── 2. Create student B WITHOUT guardian ──
  test('2 — Create student B without guardian', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students list');

    await page.getByRole('button', { name: /add student/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    await fillField(page, 'First Name', STUDENT_B_FIRST);
    await fillField(page, 'Last Name', STUDENT_B_LAST);
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2 — Guardian: leave toggle OFF
    await page.getByRole('button', { name: /next/i }).click();

    // Step 3 — skip
    await page.getByRole('button', { name: /create student/i }).click();
    await expectToastSuccess(page, /student created/i);

    const viewBtn = page.getByRole('button', { name: /view student/i });
    if (await viewBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await viewBtn.click();
      await waitForPageReady(page);
      studentBUrl = page.url();
    }
  });

  // ── 3. Link existing guardian to student B ──
  test('3 — Link existing guardian to student B', async ({ page }) => {
    test.skip(!studentBUrl, 'No student B URL');

    await safeGoTo(page, studentBUrl, 'Student B detail');
    await openGuardiansTab(page);

    // Click "Add Guardian"
    await page.getByRole('button', { name: /add guardian/i }).first().click();
    await page.waitForTimeout(500);

    // Should default to "Link existing" mode — select the guardian we created
    // Look for the select trigger for existing guardians
    const existingSelect = page.getByRole('combobox').first()
      .or(page.locator('[role="combobox"]').first());

    if (await existingSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await existingSelect.click();
      await page.waitForTimeout(500);

      // Click the guardian option
      const option = page.getByRole('option', { name: new RegExp(GUARDIAN_NAME, 'i') }).first()
        .or(page.getByText(new RegExp(GUARDIAN_NAME, 'i')).first());
      await option.click();
      await page.waitForTimeout(300);
    } else {
      // Fallback: try to find a tab/radio for "existing" and then select
      const existingTab = page.getByText(/existing/i).first();
      if (await existingTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await existingTab.click();
        await page.waitForTimeout(300);
      }
      // Try select
      const sel = page.locator('select, [role="combobox"]').first();
      await sel.click();
      await page.waitForTimeout(300);
      await page.getByText(new RegExp(GUARDIAN_NAME, 'i')).first().click();
    }

    // Submit the link
    const submitBtn = page.getByRole('button', { name: /add|save|link/i })
      .filter({ hasNotText: /cancel/i }).first();
    await submitBtn.click();

    await expectToastSuccess(page);
  });

  // ── 4. Verify guardian appears on student B ──
  test('4 — Verify guardian on student B', async ({ page }) => {
    test.skip(!studentBUrl, 'No student B URL');

    await safeGoTo(page, studentBUrl, 'Student B detail');
    await openGuardiansTab(page);

    await expect(
      page.getByText(new RegExp(GUARDIAN_NAME, 'i')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── 5. Verify primary payer badge on student A ──
  test('5 — Verify primary payer badge on student A', async ({ page }) => {
    if (!studentAUrl) {
      studentAUrl = await goToStudent(page, STUDENT_A_FIRST, STUDENT_A_FULL);
    } else {
      await safeGoTo(page, studentAUrl, 'Student A detail');
    }
    await openGuardiansTab(page);

    // The guardian created with the wizard should already be primary payer
    const primaryBadge = page.getByText(/primary payer/i).first();
    await expect(primaryBadge).toBeVisible({ timeout: 10_000 });
  });

  // ── 6. Add second guardian to student A as primary payer (replaces first) ──
  test('6 — Add second guardian as primary payer on student A', async ({ page }) => {
    if (!studentAUrl) {
      studentAUrl = await goToStudent(page, STUDENT_A_FIRST, STUDENT_A_FULL);
    } else {
      await safeGoTo(page, studentAUrl, 'Student A detail');
    }
    await openGuardiansTab(page);

    // Add another guardian
    await page.getByRole('button', { name: /add guardian/i }).first().click();
    await page.waitForTimeout(500);

    // Switch to "new" mode
    const newTab = page.getByText(/create new/i).first()
      .or(page.getByRole('tab', { name: /new/i }).first())
      .or(page.locator('label').filter({ hasText: /new/i }).first());

    if (await newTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await newTab.click();
      await page.waitForTimeout(300);
    }

    await fillField(page, 'Full Name', GUARDIAN2_NAME);
    await fillField(page, 'Email', GUARDIAN2_EMAIL);

    // Set as primary payer
    const primaryPayerSelect = page.getByLabel(/primary payer/i).first()
      .or(page.locator('#primary-payer').first());
    // It might be a Select (yes/no) or a Switch
    if (await primaryPayerSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // If it's a Select component, select "Yes"
      const selectTrigger = page.locator('[role="combobox"]').filter({ hasText: /no|yes/i }).first();
      if (await selectTrigger.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await selectTrigger.click();
        await page.getByRole('option', { name: /yes/i }).first().click();
      } else {
        // It's a switch — click to enable
        await primaryPayerSelect.click();
      }
    }

    // Submit
    const submitBtn = page.getByRole('button', { name: /add|save|link/i })
      .filter({ hasNotText: /cancel/i }).first();
    await submitBtn.click();
    await expectToastSuccess(page);

    // Verify the NEW guardian now has Primary Payer badge
    await page.waitForTimeout(1_000);
    const guardian2Row = page.getByText(new RegExp(GUARDIAN2_NAME, 'i')).first();
    await expect(guardian2Row).toBeVisible({ timeout: 10_000 });

    // There should be exactly one "Primary Payer" badge (the new one replaced the old)
    const primaryBadges = page.getByText(/primary payer/i);
    const count = await primaryBadges.count();
    expect(count).toBe(1);
  });

  // ── 7. Remove guardian from student B ──
  test('7 — Remove guardian link from student B', async ({ page }) => {
    test.skip(!studentBUrl, 'No student B URL');

    await safeGoTo(page, studentBUrl, 'Student B detail');
    await openGuardiansTab(page);

    // Find the guardian entry and click remove/unlink
    const guardianRow = page.getByText(new RegExp(GUARDIAN_NAME, 'i')).first().locator('..').locator('..');

    // Try different removal patterns: trash icon, remove button, or dropdown
    const removeBtn = guardianRow.getByRole('button', { name: /remove|unlink|delete/i }).first()
      .or(guardianRow.locator('button').filter({ has: page.locator('svg') }).last());

    if (await removeBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await removeBtn.click();
      await page.waitForTimeout(500);
    }

    // Handle confirmation dialog (DeleteValidationDialog)
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const confirmBtn = dialog.getByRole('button', { name: /confirm|remove|delete|yes/i }).first();
      await confirmBtn.click();
    }

    await expectToastSuccess(page);

    // Verify guardian is no longer listed
    await page.waitForTimeout(1_000);
    const guardianText = page.getByText(new RegExp(GUARDIAN_NAME, 'i')).first();
    const stillVisible = await guardianText.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(stillVisible).toBe(false);
  });

  // ── 8. Verify guardian still linked to student A ──
  test('8 — Guardian still linked to student A after removal from B', async ({ page }) => {
    if (!studentAUrl) {
      studentAUrl = await goToStudent(page, STUDENT_A_FIRST, STUDENT_A_FULL);
    } else {
      await safeGoTo(page, studentAUrl, 'Student A detail');
    }
    await openGuardiansTab(page);

    // The first guardian should still be listed on student A
    await expect(
      page.getByText(new RegExp(GUARDIAN_NAME, 'i')).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
