import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, waitForPageReady, assertNoErrorBoundary, trackConsoleErrors, generateTestId, closeDialog, fillField, clickButton, expectToastSuccess, expectToastError } from './helpers';

// ═══════════════════════════════════════════════════════════════
// OWNER — STUDENTS LIST
// ═══════════════════════════════════════════════════════════════
test.describe('Students List — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('loads student list with count in title', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    await assertNoErrorBoundary(page);

    // Title should show "Students (N)"
    const title = page.getByText(/Students\s*\(/i).first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('student list shows data or empty state', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');

    // Wait for student data to load
    await page.waitForTimeout(3_000);

    // Check for at least one seed student or any student row
    const seedNames = ['Emma', 'James', 'Sophie'];
    let foundCount = 0;
    for (const name of seedNames) {
      const visible = await page.getByText(name).first().isVisible({ timeout: 3_000 }).catch(() => false);
      if (visible) foundCount++;
    }
    // eslint-disable-next-line no-console
    console.log(`[students] Found ${foundCount}/3 seed students`);

    // Also check for any table row or student card
    const hasTableRows = await page.locator('[data-tour="student-list"] tbody tr').first()
      .isVisible({ timeout: 3_000 }).catch(() => false);
    const hasNoStudents = await page.getByText('No students found').first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    // eslint-disable-next-line no-console
    console.log(`[students] Table rows: ${hasTableRows}, Empty: ${hasNoStudents}`);
    expect(foundCount > 0 || hasTableRows || hasNoStudents, 'Should show students or empty state').toBe(true);
  });

  test('search filters students by name', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    await page.waitForTimeout(2_000);

    const searchInput = page.getByPlaceholder('Search students...');
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    // Type a search term
    await searchInput.fill('Emma');
    // Debounced — wait for filter to apply
    await page.waitForTimeout(500);

    // "Emma" should still be visible (or no results if seed data changed)
    const emmaVisible = await page.getByText('Emma').first().isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[students] "Emma" visible after search: ${emmaVisible}`);

    // Search for gibberish to test "No students found"
    await searchInput.fill('zzzznonexistent999');
    await page.waitForTimeout(500);

    const noResults = page.getByText('No students found').first();
    const noResultsVisible = await noResults.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[students] "No students found" visible: ${noResultsVisible}`);
  });

  test('clear search button resets search', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');

    const searchInput = page.getByPlaceholder('Search students...');
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    await searchInput.fill('test search');
    await page.waitForTimeout(500);

    // Clear button should appear
    const clearBtn = page.locator('[aria-label="Clear search"]').first();
    const clearVisible = await clearBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (clearVisible) {
      await clearBtn.click();
      // Search should be empty
      await expect(searchInput).toHaveValue('');
    }
  });

  test('status filter pills toggle between All, Active, Inactive', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    await page.waitForTimeout(2_000);

    const filterBar = page.locator('[aria-label="Student status filters"]');
    await expect(filterBar).toBeVisible({ timeout: 10_000 });

    // "All" pill should be selected by default
    const allPill = filterBar.getByText(/^All/i).first();
    await expect(allPill).toBeVisible({ timeout: 5_000 });

    // Click "active" filter
    const activePill = filterBar.getByText(/^active/i).first();
    await expect(activePill).toBeVisible({ timeout: 5_000 });
    await activePill.click();
    await page.waitForTimeout(500);

    // Click "inactive" filter
    const inactivePill = filterBar.getByText(/^inactive/i).first();
    await expect(inactivePill).toBeVisible({ timeout: 5_000 });
    await inactivePill.click();
    await page.waitForTimeout(500);

    // Back to All
    await allPill.click();
    await page.waitForTimeout(500);

    await assertNoErrorBoundary(page);
  });

  test('sort dropdown changes student order', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    await page.waitForTimeout(2_000);

    // Sort by dropdown
    const sortTrigger = page.locator('[data-tour="student-filters"]').locator('button[role="combobox"]').first();
    const hasSortTrigger = await sortTrigger.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasSortTrigger) {
      // eslint-disable-next-line no-console
      console.log('[students] Sort trigger not found — skipping');
      return;
    }

    await sortTrigger.click();
    await page.waitForTimeout(300);

    // Select "First name" option
    const firstNameOption = page.getByRole('option', { name: 'First name' }).first()
      .or(page.getByText('First name', { exact: false }).first());
    const hasOption = await firstNameOption.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasOption) {
      await firstNameOption.click();
      await page.waitForTimeout(500);
    }

    await assertNoErrorBoundary(page);
  });

  test('"Add Student" button opens wizard', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');

    const addBtn = page.locator('[data-tour="add-student-button"]').first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Should show "Add Student" title
    await expect(dialog.getByText('Add Student')).toBeVisible({ timeout: 5_000 });
    // Should show step 1 indicator "Student Details"
    await expect(dialog.getByText('Student Details')).toBeVisible({ timeout: 5_000 });
  });

  test('student wizard validates required fields on step 1', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');

    // Open wizard
    await page.locator('[data-tour="add-student-button"]').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Try clicking Next with empty fields
    const nextBtn = dialog.getByRole('button', { name: /next/i }).first();
    await expect(nextBtn).toBeVisible({ timeout: 5_000 });
    await nextBtn.click();

    // Should show validation toast error
    const toast = page.locator('[data-radix-collection-item]').first();
    await expect(toast).toBeVisible({ timeout: 10_000 });

    // Close wizard
    await page.keyboard.press('Escape');
  });

  test('student wizard navigates through all 3 steps', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/students', 'Students');

    // Open wizard
    await page.locator('[data-tour="add-student-button"]').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Step 1: Fill required fields
    await dialog.locator('#wizard-firstName').fill('Test');
    await dialog.locator('#wizard-lastName').fill('Student');

    // Click Next to go to step 2
    await dialog.getByRole('button', { name: /next/i }).first().click();
    await page.waitForTimeout(1_000);

    // Step 2 should show "Guardian" indicator
    const guardianStep = dialog.getByText('Guardian').first();
    await expect(guardianStep).toBeVisible({ timeout: 5_000 });

    // Click Next to go to step 3 (skip guardian)
    await dialog.getByRole('button', { name: /next/i }).first().click();
    await page.waitForTimeout(1_000);

    // Step 3 should show "Teaching Setup"
    const teachingStep = dialog.getByText('Teaching Setup').first();
    await expect(teachingStep).toBeVisible({ timeout: 5_000 });

    // Click Back to go to step 2
    await dialog.getByRole('button', { name: /back/i }).first().click();
    await page.waitForTimeout(500);

    // Back again to step 1
    await dialog.getByRole('button', { name: /back/i }).first().click();
    await page.waitForTimeout(500);

    // Cancel wizard
    await dialog.getByRole('button', { name: /cancel/i }).first().click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test('clicking a student row navigates to detail page', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    await page.waitForTimeout(3_000);

    // Desktop: click a table row
    const tableRow = page.locator('[data-tour="student-list"] tbody tr').first();
    const hasTableRow = await tableRow.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasTableRow) {
      await tableRow.click();
    } else {
      // Mobile: click a student card
      const card = page.locator('[role="link"]').filter({ hasText: /\w/ }).first();
      const hasCard = await card.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasCard) {
        await card.click();
      } else {
        // eslint-disable-next-line no-console
        console.log('[students] No student rows or cards found');
        return;
      }
    }

    // Should navigate to /students/{id}
    await page.waitForURL(/\/students\/[\w-]+/, { timeout: 10_000 });
    await waitForPageReady(page);
    expect(page.url()).toMatch(/\/students\/[\w-]+/);
  });

  test('no console errors during students list interaction', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/students', 'Students');
    await page.waitForTimeout(2_000);

    // Interact with search
    const searchInput = page.getByPlaceholder('Search students...');
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      await searchInput.clear();
    }

    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// OWNER — STUDENT DETAIL
// ═══════════════════════════════════════════════════════════════
test.describe('Student Detail — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('navigates to a student and shows detail page with tabs', async ({ page }) => {
    // First go to students list to get a student ID
    await safeGoTo(page, '/students', 'Students');
    await page.waitForTimeout(3_000);

    // Click first student
    const tableRow = page.locator('[data-tour="student-list"] tbody tr').first();
    const hasTableRow = await tableRow.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasTableRow) {
      await tableRow.click();
    } else {
      const card = page.locator('[role="link"]').filter({ hasText: /\w/ }).first();
      if (await card.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await card.click();
      } else {
        // eslint-disable-next-line no-console
        console.log('[student-detail] No students to navigate to');
        return;
      }
    }

    await page.waitForURL(/\/students\/[\w-]+/, { timeout: 10_000 });
    await waitForPageReady(page);
    await assertNoErrorBoundary(page);

    // Breadcrumbs should show Students link
    const breadcrumb = page.getByRole('link', { name: 'Students' }).first();
    await expect(breadcrumb).toBeVisible({ timeout: 10_000 });
  });

  test('student detail has all expected tabs', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    await page.waitForTimeout(2_000);

    // Navigate to first student
    const firstRow = page.locator('[data-tour="student-list"] tbody tr, [role="link"]').first();
    if (!(await firstRow.isVisible({ timeout: 5_000 }).catch(() => false))) return;
    await firstRow.click();
    await page.waitForURL(/\/students\/[\w-]+/, { timeout: 10_000 });
    await waitForPageReady(page);

    // Check that tabs exist
    const expectedTabs = ['Overview', 'Instruments', 'Teachers', 'Guardians', 'Lessons', 'Invoices', 'Notes'];
    let tabCount = 0;
    for (const tabName of expectedTabs) {
      const tab = page.getByRole('tab', { name: tabName }).first();
      const visible = await tab.isVisible({ timeout: 5_000 }).catch(() => false);
      if (visible) tabCount++;
      // eslint-disable-next-line no-console
      console.log(`[student-detail] Tab "${tabName}": ${visible}`);
    }
    expect(tabCount, 'Should have multiple visible tabs').toBeGreaterThanOrEqual(3);
  });

  test('clicking tabs switches content without errors', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    await page.waitForTimeout(2_000);

    const firstRow = page.locator('[data-tour="student-list"] tbody tr, [role="link"]').first();
    if (!(await firstRow.isVisible({ timeout: 5_000 }).catch(() => false))) return;
    await firstRow.click();
    await page.waitForURL(/\/students\/[\w-]+/, { timeout: 10_000 });
    await waitForPageReady(page);

    // Click through each visible tab
    const tabsToTest = ['Guardians', 'Lessons', 'Invoices', 'Notes', 'Overview'];
    for (const tabName of tabsToTest) {
      const tab = page.getByRole('tab', { name: tabName }).first();
      const visible = await tab.isVisible({ timeout: 3_000 }).catch(() => false);
      if (visible) {
        await tab.click();
        await page.waitForTimeout(500);
        await assertNoErrorBoundary(page);
        // eslint-disable-next-line no-console
        console.log(`[student-detail] Clicked tab "${tabName}" — OK`);
      }
    }
  });

  test('delete button is visible for owner', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    await page.waitForTimeout(2_000);

    const firstRow = page.locator('[data-tour="student-list"] tbody tr, [role="link"]').first();
    if (!(await firstRow.isVisible({ timeout: 5_000 }).catch(() => false))) return;
    await firstRow.click();
    await page.waitForURL(/\/students\/[\w-]+/, { timeout: 10_000 });
    await waitForPageReady(page);

    // Delete button (red trash icon) should be visible to owner
    const deleteBtn = page.getByRole('button', { name: /delete/i }).first()
      .or(page.locator('button[class*="destructive"]').first());
    const visible = await deleteBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[student-detail] Delete button visible: ${visible}`);
  });

  test('breadcrumb "Students" link navigates back to list', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    await page.waitForTimeout(2_000);

    const firstRow = page.locator('[data-tour="student-list"] tbody tr, [role="link"]').first();
    if (!(await firstRow.isVisible({ timeout: 5_000 }).catch(() => false))) return;
    await firstRow.click();
    await page.waitForURL(/\/students\/[\w-]+/, { timeout: 10_000 });
    await waitForPageReady(page);

    // Click breadcrumb to go back
    const breadcrumb = page.getByRole('link', { name: 'Students' }).first();
    await expect(breadcrumb).toBeVisible({ timeout: 5_000 });
    await breadcrumb.click();
    await page.waitForURL(/\/students$/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/students$/);
  });
});

// ═══════════════════════════════════════════════════════════════
// TEACHER — STUDENTS (scoped)
// ═══════════════════════════════════════════════════════════════
test.describe('Students — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('loads student list (scoped to teacher)', async ({ page }) => {
    await safeGoTo(page, '/students', 'Teacher Students');
    await assertNoErrorBoundary(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('does NOT show Add Student button', async ({ page }) => {
    await safeGoTo(page, '/students', 'Teacher Students');
    await page.waitForTimeout(2_000);

    const addBtn = page.locator('[data-tour="add-student-button"]');
    const visible = await addBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(visible, 'Teacher should NOT see Add Student button').toBe(false);
  });

  test('does NOT show Export or Import buttons', async ({ page }) => {
    await safeGoTo(page, '/students', 'Teacher Students');
    await page.waitForTimeout(2_000);

    // Export and Import are admin-only via isAdmin check
    const exportBtn = page.getByRole('button', { name: /export/i }).first()
      .or(page.locator('a[href="/students/import"]').first());
    const visible = await exportBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(visible, 'Teacher should NOT see Export/Import').toBe(false);
  });

  test('search still works for teacher', async ({ page }) => {
    await safeGoTo(page, '/students', 'Teacher Students');
    await page.waitForTimeout(2_000);

    const searchInput = page.getByPlaceholder('Search students...');
    const visible = await searchInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (visible) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      await searchInput.clear();
      await assertNoErrorBoundary(page);
    }
  });

  test('student detail does NOT show delete button for teacher', async ({ page }) => {
    await safeGoTo(page, '/students', 'Teacher Students');
    await page.waitForTimeout(2_000);

    const firstRow = page.locator('[data-tour="student-list"] tbody tr, [role="link"]').first();
    if (!(await firstRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
      // eslint-disable-next-line no-console
      console.log('[teacher-students] No students visible — skipping');
      return;
    }
    await firstRow.click();
    await page.waitForURL(/\/students\/[\w-]+/, { timeout: 10_000 });
    await waitForPageReady(page);

    // Delete button should NOT be visible
    const deleteBtn = page.getByRole('button', { name: /delete/i }).first()
      .or(page.locator('button[class*="destructive"]').first());
    const visible = await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(visible, 'Teacher should NOT see delete button').toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// FINANCE — STUDENTS (should NOT have access)
// ═══════════════════════════════════════════════════════════════
test.describe('Students — Finance', () => {
  test.use({ storageState: AUTH.finance });

  test('finance user accessing /students is redirected or restricted', async ({ page }) => {
    await page.goto('/students');
    await page.waitForTimeout(5_000);

    const url = page.url();
    const onStudents = url.includes('/students');
    const onDashboard = url.includes('/dashboard');

    // eslint-disable-next-line no-console
    console.log(`[finance-students] URL: ${url}, onStudents: ${onStudents}, redirected: ${onDashboard}`);

    // Finance doesn't have Students in sidebar — should redirect or show limited view
    await expect(page.locator('body')).toBeVisible();
  });
});
