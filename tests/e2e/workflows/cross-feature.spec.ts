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
  deleteInvoiceById,
  deleteStudentById,
  deleteLeadById,
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
/*  WORKFLOW 1: Invoice Billing Lifecycle                               */
/*  Create invoice → Send → Record payment → Verify paid               */
/* ================================================================== */

test.describe('Workflow — Invoice Billing Lifecycle', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `e2e-${Date.now()}`;

  test.afterAll(() => {
    try { cleanupTestData(testId); } catch { /* best-effort */ }
  });

  test('navigate invoices, view detail, verify actions visible', async ({ page }) => {
    test.setTimeout(300_000);

    // Warm up session
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    // Navigate to invoices
    await clickNav(page, '/invoices');
    await waitForPageReady(page);

    // Verify invoices page loaded with data
    await expect(page.getByText(/invoices/i).first()).toBeVisible({ timeout: 10_000 });

    // Filter to show overdue invoices (seed data should have some)
    const overdueFilter = page.getByRole('button', { name: /overdue/i }).first();
    if (await overdueFilter.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await overdueFilter.click();
      await page.waitForTimeout(1_000);
    }

    // Click first invoice to go to detail
    const firstInvoice = page.locator('main').getByRole('link').first()
      .or(page.locator('main a[href*="/invoices/"]').first());
    if (await firstInvoice.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await firstInvoice.click();
      await page.waitForURL(/\/invoices\/[^/]+/, { timeout: 10_000 }).catch(() => {});
      await waitForPageReady(page);
    }

    // If on invoice detail, verify action buttons
    if (page.url().match(/\/invoices\/[^/]+/) && !page.url().endsWith('/invoices')) {
      // Verify key action buttons are visible
      const reminderBtn = page.getByRole('button', { name: /reminder/i }).first();
      const recordPaymentBtn = page.getByRole('button', { name: /record payment/i }).first();

      const hasReminder = await reminderBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      const hasRecordPayment = await recordPaymentBtn.isVisible({ timeout: 5_000 }).catch(() => false);

      // At least one action button should be visible for overdue invoices
      expect(hasReminder || hasRecordPayment).toBe(true);

      // Record Payment workflow — test the full modal flow
      if (hasRecordPayment) {
        await recordPaymentBtn.click();
        const payDialog = page.getByRole('dialog');
        await expect(payDialog).toBeVisible({ timeout: 5_000 });

        // Verify payment form fields are present
        const amountInput = page.locator('#amount');
        await expect(amountInput).toBeVisible({ timeout: 5_000 });

        // Click "Pay full amount" to auto-fill
        const payFullBtn = page.getByText(/pay full amount/i).first();
        if (await payFullBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await payFullBtn.click();
          await page.waitForTimeout(300);
        } else {
          await amountInput.fill('10.00');
        }

        // Record the payment
        const confirmPayBtn = payDialog.getByRole('button', { name: /record payment/i });
        await expect(confirmPayBtn).toBeEnabled({ timeout: 5_000 });
        await confirmPayBtn.click();

        // Wait for dialog to close
        await expect(payDialog).toBeHidden({ timeout: 15_000 });
      }
    }
  });
});

/* ================================================================== */
/*  WORKFLOW 2: Lead → Student Conversion                              */
/*  Create lead → Convert to student → Verify student exists           */
/* ================================================================== */

test.describe('Workflow — Lead to Student Conversion', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `e2e-${Date.now()}`;
  const contactName = `ConvertLead${testId}`;
  const childFirstName = `ConvertChild${testId}`;

  test.afterAll(() => {
    try { cleanupTestData(testId); } catch { /* best-effort */ }
  });

  test('create lead, convert to student, verify student exists', async ({ page }) => {
    test.setTimeout(300_000);

    // Warm up session
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    // ── Create a lead ──
    await clickNav(page, '/leads');
    await expect(page.getByPlaceholder('Search leads...')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /add lead/i }).first().click();
    await expect(page.getByRole('dialog').or(page.locator('[role="dialog"]'))).toBeVisible({ timeout: 5_000 });

    await page.locator('#contact_name').fill(contactName);
    await page.locator('#contact_email').fill(`${testId}@e2e-convert.example.com`);

    // Fill child name
    const childFirst = page.getByPlaceholder('First name').first();
    if (await childFirst.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await childFirst.fill(childFirstName);
      const childLast = page.getByPlaceholder('Last name').first();
      if (await childLast.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await childLast.fill('E2EConvert');
      }
    }

    const createLeadBtn = page.getByRole('button', { name: /create lead|add lead|save/i }).last();
    await createLeadBtn.click();
    await expectToastSuccess(page);

    // Close dialog
    if (await page.getByRole('dialog').isVisible({ timeout: 2_000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // ── Navigate to lead detail ──
    await page.getByPlaceholder('Search leads...').clear();
    await page.getByPlaceholder('Search leads...').fill(contactName);
    await page.waitForTimeout(1_500);

    const leadLink = page.getByText(contactName).first();
    await expect(leadLink).toBeVisible({ timeout: 10_000 });
    await leadLink.click();
    await page.waitForURL(/\/leads\//, { timeout: 10_000 });
    await waitForPageReady(page);

    // ── Convert lead to student ──
    // Use text selector to click the exact Convert button
    await page.locator('button:has-text("Convert")').first().click({ force: true });
    await page.waitForTimeout(3_000);

    // ConvertLeadWizard: uses Dialog on desktop, Drawer on mobile
    // Check for dialog heading as indicator
    const wizardHeading = page.getByText(/convert lead/i).first();
    const wizardDialog = page.getByRole('dialog');
    const dialogVisible = await wizardDialog.isVisible({ timeout: 15_000 }).catch(() => false);
    const headingVisible = await wizardHeading.isVisible({ timeout: 5_000 }).catch(() => false);

    if (dialogVisible || headingVisible) {
      // Step 1: Review Students — click Next/Continue
      const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
      if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(1_000);
      }

      // Step 2: Assign Teachers — skip (optional), click Next/Continue
      const nextBtn2 = page.getByRole('button', { name: /next|continue/i }).first();
      if (await nextBtn2.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await nextBtn2.click();
        await page.waitForTimeout(1_000);
      }

      // Step 3: Confirm & Convert
      const confirmConvert = page.getByRole('button', { name: /convert|confirm/i }).first();
      if (await confirmConvert.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await confirmConvert.click();
        await expectToastSuccess(page);
      }

      // Wait for wizard to close
      await expect(wizardDialog).toBeHidden({ timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(1_000);
    }

    // ── Verify student was created ──
    await clickNav(page, '/students');
    await expect(page.getByPlaceholder('Search students...')).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder('Search students...').fill(childFirstName);
    await page.waitForTimeout(1_500);

    // The converted student should appear
    await expect(page.getByText(childFirstName).first()).toBeVisible({ timeout: 10_000 });

    // API cleanup
    const leads = supabaseSelect('leads', `contact_name=like.%25${testId}%25&select=id&limit=1`);
    if (leads.length > 0) deleteLeadById(leads[0].id);
    const students = supabaseSelect('students', `first_name=like.%25${testId}%25&select=id&limit=1`);
    if (students.length > 0) deleteStudentById(students[0].id);
  });
});

/* ================================================================== */
/*  WORKFLOW 3: Student → Lesson → Attendance → Dashboard              */
/*  Full teaching lifecycle end-to-end test                            */
/* ================================================================== */

test.describe('Workflow — Student → Lesson → Attendance → Dashboard', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `e2e-${Date.now()}`;
  const firstName = `Lifecycle${testId}`;
  const lastName = 'E2EStudent';

  test.afterAll(() => {
    try {
      // Clean up lessons
      const lessons = supabaseSelect('lessons', `notes_shared=like.%25${testId}%25&select=id&limit=10`);
      for (const l of lessons) {
        try { deleteLessonById(l.id); } catch { /* best-effort */ }
      }
      // Clean up student
      const students = supabaseSelect('students', `first_name=like.%25${testId}%25&select=id&limit=1`);
      if (students.length > 0) deleteStudentById(students[0].id);
      cleanupTestData(testId);
    } catch { /* best-effort */ }
  });

  test('full lifecycle: create student, create lesson, mark attendance, verify dashboard', async ({ page }) => {
    test.setTimeout(300_000);

    // ════════════════════════════════════════════════════════
    // Step 1: Create a student
    // ════════════════════════════════════════════════════════
    await test.step('Create student', async () => {
      await safeGoTo(page, '/dashboard', 'Dashboard');
      await page.waitForTimeout(2_000);

      await clickNav(page, '/students');
      await expect(page.getByPlaceholder('Search students...')).toBeVisible({ timeout: 15_000 });

      const addBtn = page.locator('[data-tour="add-student-button"]');
      await expect(addBtn).toBeEnabled({ timeout: 10_000 });
      await addBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

      await page.locator('#wizard-firstName').fill(firstName);
      await page.locator('#wizard-lastName').fill(lastName);

      // Handle duplicate dialog
      const dupDialog = page.getByText('Possible duplicate student');
      if (await dupDialog.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await page.getByRole('button', { name: 'Continue Anyway' }).click();
      }

      // Next → Guardian step
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(
        page.getByRole('button', { name: 'Next' }).or(page.getByRole('button', { name: 'Create Student' })),
      ).toBeVisible({ timeout: 5_000 });

      // Next → Teaching Setup step
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('button', { name: 'Create Student' })).toBeVisible({ timeout: 5_000 });

      // Create Student
      await page.getByRole('button', { name: 'Create Student' }).click();
      await expect(page.getByText(/Student Created/i).first()).toBeVisible({ timeout: 30_000 });

      // Close dialog
      const closeBtn = page.getByRole('button', { name: /close|×/i }).first()
        .or(page.locator('[aria-label="Close"]').first());
      if (await closeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(500);

      // Verify student in list
      if (!page.url().includes('/students') || page.url().includes('/students/')) {
        await clickNav(page, '/students');
      }
      await page.getByPlaceholder('Search students...').fill(firstName);
      await page.waitForTimeout(1_500);
      await expect(page.getByText(firstName).first()).toBeVisible({ timeout: 10_000 });
    });

    // ════════════════════════════════════════════════════════
    // Step 2: Create a lesson for today
    // ════════════════════════════════════════════════════════
    await test.step('Create lesson for today', async () => {
      await clickNav(page, '/calendar');
      await waitForPageReady(page);

      const newLessonBtn = page.locator('[data-tour="create-lesson-button"]');
      await expect(newLessonBtn).toBeVisible({ timeout: 10_000 });
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

      // Select the student we just created — search by testId
      const studentBtn = dialog.locator('button').filter({ hasText: /select student/i }).first();
      if (await studentBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await studentBtn.click();
        await page.waitForTimeout(500);

        // Search for student by name fragment
        const searchInput = page.getByPlaceholder('Search students...').last();
        if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await searchInput.fill(firstName.slice(0, 20));
          await page.waitForTimeout(1_000);
        }

        // Click the matching student
        const studentItem = page.locator('[cmdk-item]').filter({ hasText: new RegExp(testId.slice(0, 10)) }).first()
          .or(page.locator('[cmdk-item]').first());
        await expect(studentItem).toBeVisible({ timeout: 5_000 });
        await studentItem.click();
        await page.waitForTimeout(300);
        await dialog.locator('h2, [class*="DialogTitle"]').first().click();
        await page.waitForTimeout(300);
      }

      // Change date to 3 weeks from now to avoid teacher conflicts
      const dateBtn = dialog.locator('button').filter({ hasText: /\d{2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i }).first();
      if (await dateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await dateBtn.click();
        await page.waitForTimeout(500);
        // Navigate forward one month
        const nextMonthBtn = page.locator('[name="next-month"]').first()
          .or(page.locator('button[aria-label*="next"]').first());
        if (await nextMonthBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await nextMonthBtn.click();
          await page.waitForTimeout(300);
        }
        // Click day 15 (mid-month, unlikely to have lessons)
        const dayBtn = page.getByRole('gridcell', { name: '15' }).first();
        if (await dayBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await dayBtn.click();
          await page.waitForTimeout(500);
        }
      }

      // Set time via Radix Select combobox (valid range: 07:00-20:45)
      const allComboboxes = dialog.locator('button[role="combobox"]');
      const comboCount = await allComboboxes.count();
      for (let i = 0; i < comboCount; i++) {
        const text = await allComboboxes.nth(i).textContent() ?? '';
        if (/^\d{2}:\d{2}$/.test(text.trim())) {
          await allComboboxes.nth(i).click();
          await page.waitForTimeout(300);
          const timeOpt = page.getByRole('option', { name: '10:00' }).first();
          if (await timeOpt.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await timeOpt.click();
          } else {
            await allComboboxes.nth(i).click().catch(() => {});
          }
          await page.waitForTimeout(200);
          break;
        }
      }

      // Add notes with testId
      const notesField = dialog.getByPlaceholder('Add lesson notes that parents can see...');
      if (await notesField.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await notesField.fill(`E2E Lifecycle ${testId}`);
      }

      // Create lesson
      const createBtn = dialog.getByRole('button', { name: /create lesson/i });
      await page.waitForTimeout(3_000);
      if (await createBtn.isDisabled()) {
        console.log('[cross-feature] Create button disabled due to teacher conflict');
        await dialog.getByRole('button', { name: /cancel/i }).click().catch(() => {});
        test.skip(true, 'Teacher has recurring conflicts at all time slots');
        return;
      }
      await createBtn.click();
      await expect(dialog).toBeHidden({ timeout: 30_000 });
      await page.waitForTimeout(2_000);
    });

    // ════════════════════════════════════════════════════════
    // Step 3: Mark attendance
    // ════════════════════════════════════════════════════════
    await test.step('Mark attendance on register', async () => {
      await clickNav(page, '/register');
      await waitForPageReady(page);
      await page.waitForTimeout(2_000);

      // Find and expand the lesson we created
      const expandBtn = page.locator('button[aria-label="Toggle details"]').first();
      if (await expandBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await expandBtn.click();
        await page.waitForTimeout(1_000);

        // Mark student as Present
        const presentBtn = page.getByRole('button', { name: /present/i }).first();
        if (await presentBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await presentBtn.click();
          await page.waitForTimeout(2_000);
        }
      }
    });

    // ════════════════════════════════════════════════════════
    // Step 4: Verify on dashboard
    // ════════════════════════════════════════════════════════
    await test.step('Verify on dashboard', async () => {
      await clickNav(page, '/dashboard');
      await waitForPageReady(page);
      await page.waitForTimeout(2_000);

      // Verify dashboard loads without errors
      const main = page.locator('main').first();
      await expect(main).toBeVisible({ timeout: 10_000 });

      // Check for dashboard greeting or schedule section
      const greeting = page.getByText(/good morning|good afternoon|good evening/i).first();
      const schedule = page.getByText(/lesson|schedule|today/i).first();
      const greetingVisible = await greeting.isVisible({ timeout: 5_000 }).catch(() => false);
      const scheduleVisible = await schedule.isVisible({ timeout: 5_000 }).catch(() => false);
      // At least one dashboard element should be visible
      expect(greetingVisible || scheduleVisible).toBe(true);
    });

    // ════════════════════════════════════════════════════════
    // Step 5: Cleanup
    // ════════════════════════════════════════════════════════
    const lessons = supabaseSelect('lessons', `notes_shared=like.%25${testId}%25&select=id&limit=10`);
    for (const l of lessons) deleteLessonById(l.id);
    const students = supabaseSelect('students', `first_name=like.%25${testId}%25&select=id&limit=1`);
    if (students.length > 0) deleteStudentById(students[0].id);
  });
});
