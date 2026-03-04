import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, goTo, waitForPageReady, assertNoErrorBoundary } from '../helpers';

// ═══════════════════════════════════════════════════════════════
// SECTION 1: FORM VALIDATION — EMPTY SUBMISSIONS
// Verify every major form rejects empty/incomplete submissions
// ═══════════════════════════════════════════════════════════════

test.describe('Empty Submissions — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('Student Wizard — empty submit shows validation error', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/students', 'Students');
    if (!page.url().includes('/students')) return;

    // Open Add Student wizard
    const addBtn = page.locator('[data-tour="add-student-button"]').first()
      .or(page.getByRole('button', { name: /add student/i }).first());
    const hasBtn = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) {
      test.skip(true, 'Add Student button not found');
      return;
    }
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Click Next without filling anything — should trigger zod validation toast
    const nextBtn = dialog.getByRole('button', { name: /next/i }).first();
    const hasNext = await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasNext) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }

    // Validation: should see destructive toast (first name / last name required)
    const toast = page.locator('[data-radix-collection-item]').filter({ hasText: /required|validation/i });
    const hasToast = await toast.first().isVisible({ timeout: 5_000 }).catch(() => false);
    // Or check for FormMessage error text in the dialog
    const formError = dialog.locator('.text-destructive, [role="alert"]').first();
    const hasFormError = await formError.isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasToast || hasFormError, 'Should show validation error for empty student form').toBe(true);

    // Dialog should still be open (not navigated away)
    await expect(dialog).toBeVisible();

    // Fill first name only, click Next — should still fail (last name required)
    const firstNameInput = dialog.locator('#wizard-firstName')
      .or(dialog.getByLabel(/first name/i).first())
      .or(dialog.getByPlaceholder(/first name/i).first());
    const hasFirstName = await firstNameInput.first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasFirstName) {
      await firstNameInput.first().fill('TestOnly');
      if (hasNext) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      }
      // Should still show validation error for last name
      const toast2 = page.locator('[data-radix-collection-item]').filter({ hasText: /required|last name|validation/i });
      const hasToast2 = await toast2.first().isVisible({ timeout: 5_000 }).catch(() => false);
      const formError2 = dialog.locator('.text-destructive, [role="alert"]').first();
      const hasFormError2 = await formError2.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasToast2 || hasFormError2, 'Should require last name').toBe(true);
    }

    // Close dialog
    await page.keyboard.press('Escape');
    await assertNoErrorBoundary(page);
  });

  test('Lesson Modal — empty submit shows validation error', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/calendar', 'Calendar');
    if (!page.url().includes('/calendar')) return;

    // Open New Lesson modal
    const addBtn = page.locator('[data-tour="add-lesson-button"]').first()
      .or(page.getByRole('button', { name: /new lesson|add lesson/i }).first());
    const hasBtn = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) {
      test.skip(true, 'Add Lesson button not found');
      return;
    }
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    const drawer = page.locator('[role="dialog"], [data-vaul-drawer]');
    const formContainer = dialog.or(drawer);
    await expect(formContainer.first()).toBeVisible({ timeout: 10_000 });

    // Click Create Lesson / Save without filling anything
    const saveBtn = formContainer.getByRole('button', { name: /create lesson|save/i }).first();
    const hasSave = await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasSave) {
      await saveBtn.click();
      await page.waitForTimeout(500);
    }

    // Validation: should see destructive toast for missing teacher/student
    const toast = page.locator('[data-radix-collection-item]').filter({ hasText: /select|required|teacher|student/i });
    const hasToast = await toast.first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasToast, 'Should show validation error for empty lesson form').toBe(true);

    // Form should still be open
    await expect(formContainer.first()).toBeVisible();

    await page.keyboard.press('Escape');
    await assertNoErrorBoundary(page);
  });

  test('Invoice — empty submit shows validation error', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/invoices', 'Invoices');
    if (!page.url().includes('/invoices')) return;

    // Open Create Invoice
    const addBtn = page.locator('[data-tour="create-invoice-button"]').first()
      .or(page.getByRole('button', { name: /create invoice|new invoice/i }).first());
    const hasBtn = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) {
      test.skip(true, 'Create Invoice button not found');
      return;
    }
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Click Create Invoice without selecting payer
    const submitBtn = dialog.getByRole('button', { name: /create invoice/i }).first();
    const hasSubmit = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasSubmit) {
      // The button should be disabled when no payer is selected
      const isDisabled = await submitBtn.isDisabled().catch(() => false);
      if (isDisabled) {
        // Good — the button is disabled, preventing empty submission
        expect(isDisabled, 'Create Invoice button disabled without payer').toBe(true);
      } else {
        await submitBtn.click();
        await page.waitForTimeout(500);
        // Should see validation toast
        const toast = page.locator('[data-radix-collection-item]').filter({ hasText: /payer|required|select/i });
        await expect(toast.first()).toBeVisible({ timeout: 5_000 });
      }
    }

    // Dialog should still be open
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await assertNoErrorBoundary(page);
  });

  test('Lead — empty submit shows validation error', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/leads', 'Leads');
    if (!page.url().includes('/leads')) return;

    // Open Create Lead
    const addBtn = page.locator('[data-tour="add-lead-button"]').first()
      .or(page.getByRole('button', { name: /add lead|new lead/i }).first());
    const hasBtn = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) {
      test.skip(true, 'Add Lead button not found');
      return;
    }
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    const drawer = page.locator('[role="dialog"], [data-vaul-drawer]');
    const formContainer = dialog.or(drawer);
    await expect(formContainer.first()).toBeVisible({ timeout: 10_000 });

    // Click Create Lead without filling anything
    const submitBtn = formContainer.getByRole('button', { name: /create lead/i }).first();
    const hasSubmit = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasSubmit) {
      await submitBtn.click();
      await page.waitForTimeout(500);
    }

    // Validation: contact name is required, child first name required
    const errorText = formContainer.first().locator('.text-destructive, .text-xs.text-destructive');
    const hasError = await errorText.first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasError, 'Should show validation error for empty lead form').toBe(true);

    // Form should still be open
    await expect(formContainer.first()).toBeVisible();

    await page.keyboard.press('Escape');
    await assertNoErrorBoundary(page);
  });

  test('Teacher — empty submit shows validation error', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/teachers', 'Teachers');
    if (!page.url().includes('/teachers')) return;

    // Open Add Teacher dialog
    const addBtn = page.locator('[data-tour="add-teacher-button"]').first()
      .or(page.getByRole('button', { name: /add teacher|new teacher/i }).first());
    const hasBtn = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) {
      test.skip(true, 'Add Teacher button not found');
      return;
    }
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Click Save/Create without filling anything
    const submitBtn = dialog.getByRole('button', { name: /create|save|add/i }).first();
    const hasSubmit = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasSubmit) {
      await submitBtn.click();
      await page.waitForTimeout(500);
    }

    // Validation: display name is required (zod schema)
    const formMessage = dialog.locator('[id*="message"], .text-destructive, p.text-\\[0\\.8rem\\]');
    const hasFormMsg = await formMessage.first().isVisible({ timeout: 5_000 }).catch(() => false);
    const toast = page.locator('[data-radix-collection-item]').filter({ hasText: /required|name|validation/i });
    const hasToast = await toast.first().isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasFormMsg || hasToast, 'Should show validation error for empty teacher form').toBe(true);

    // Dialog should still be open
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await assertNoErrorBoundary(page);
  });

  test('Location — empty submit shows validation error', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/locations', 'Locations');
    if (!page.url().includes('/locations')) return;

    // Open Add Location dialog
    const addBtn = page.locator('[data-tour="add-location-button"]').first()
      .or(page.getByRole('button', { name: /add location|new location/i }).first());
    const hasBtn = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) {
      test.skip(true, 'Add Location button not found');
      return;
    }
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Click Save without filling name
    const submitBtn = dialog.getByRole('button', { name: /save|create|add/i }).first();
    const hasSubmit = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasSubmit) {
      await submitBtn.click();
      await page.waitForTimeout(500);
    }

    // Validation: name required — toast "Name required"
    const toast = page.locator('[data-radix-collection-item]').filter({ hasText: /name required|required/i });
    const hasToast = await toast.first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasToast, 'Should show validation error for empty location form').toBe(true);

    // Dialog should still be open
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await assertNoErrorBoundary(page);
  });

  test('Message — empty send is prevented', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/messages', 'Messages');
    if (!page.url().includes('/messages')) return;

    // Open Compose Message
    const composeBtn = page.locator('[data-tour="compose-message-button"]').first()
      .or(page.getByRole('button', { name: /compose|new message|send message/i }).first());
    const hasBtn = await composeBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) {
      test.skip(true, 'Compose message button not found');
      return;
    }
    await composeBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // The Send button should be disabled without recipient/subject/body
    const sendBtn = dialog.getByRole('button', { name: /send/i }).first();
    const hasSend = await sendBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasSend) {
      const isDisabled = await sendBtn.isDisabled().catch(() => false);
      expect(isDisabled, 'Send button should be disabled without content').toBe(true);
    }

    // Dialog should still be open
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await assertNoErrorBoundary(page);
  });

  test('Settings Profile — empty name shows error', async ({ page }) => {
    test.setTimeout(60_000);
    await goTo(page, '/settings');
    if (!page.url().includes('/settings')) return;

    await waitForPageReady(page);

    // Look for a name/organisation name input in settings
    const nameInput = page.getByLabel(/name/i).first()
      .or(page.locator('#name, #org-name, #organisation-name').first());
    const hasNameInput = await nameInput.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasNameInput) {
      test.skip(true, 'Settings name field not found');
      return;
    }

    // Store original value
    const originalValue = await nameInput.inputValue().catch(() => '');

    // Clear the name field
    await nameInput.fill('');
    await page.waitForTimeout(300);

    // Click Save
    const saveBtn = page.getByRole('button', { name: /save/i }).first();
    const hasSave = await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasSave) {
      await saveBtn.click();
      await page.waitForTimeout(500);
    }

    // Should see validation error or destructive toast
    const toast = page.locator('[data-radix-collection-item]').filter({ hasText: /required|name|error|invalid/i });
    const hasToast = await toast.first().isVisible({ timeout: 5_000 }).catch(() => false);
    const formError = page.locator('.text-destructive, [role="alert"]').first();
    const hasFormError = await formError.isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasToast || hasFormError, 'Should show validation error for empty name').toBe(true);

    // Restore original value
    if (originalValue) {
      await nameInput.fill(originalValue);
      if (hasSave) {
        await saveBtn.click();
        await page.waitForTimeout(1_000);
      }
    }

    await assertNoErrorBoundary(page);
  });
});
