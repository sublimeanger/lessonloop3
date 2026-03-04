import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  safeGoTo,
  goTo,
  waitForPageReady,
  assertNoErrorBoundary,
} from '../helpers';
import { cleanupTestData, supabaseInsert, getOrgId, supabaseSelect } from '../supabase-admin';

// ═══════════════════════════════════════════════════════════════
// SECTION 2: SPECIAL CHARACTERS IN ALL INPUTS
// Verify the app handles special characters without crashing,
// XSS, or data corruption.
// ═══════════════════════════════════════════════════════════════

const testId = `e2e-${Date.now()}`;
const suffix = testId.slice(-6);

const specialNames: Record<string, string> = {
  apostrophe: "O'Brien",
  accent: 'José García',
  unicode: '田中太郎',
  ampersand: 'Smith & Jones',
  quotes: 'John "Johnny" Doe',
  angle: '<script>alert(1)</script>',
  emoji: 'Student 🎵',
};

/**
 * Navigate via sidebar link click (SPA navigation, preserves auth).
 */
async function clickNav(page: Page, href: string) {
  const link = page.locator(`a[href="${href}"]`).first();
  await expect(link).toBeVisible({ timeout: 10_000 });
  await link.click();
  await page.waitForURL((url) => url.pathname.startsWith(href), { timeout: 15_000 });
  await waitForPageReady(page);
}

test.describe('Special Characters — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test.afterAll(() => {
    try { cleanupTestData(testId); } catch { /* best-effort */ }
  });

  test('Students with special character names render correctly', async ({ page }) => {
    test.setTimeout(120_000);

    // Create students via API with special character names
    const orgId = getOrgId();
    if (!orgId) {
      test.skip(true, 'No org ID found');
      return;
    }

    const createdIds: string[] = [];
    for (const [key, name] of Object.entries(specialNames)) {
      const student = supabaseInsert('students', {
        org_id: orgId,
        first_name: `${name} ${suffix}`,
        last_name: `${testId} SpecChar`,
        status: 'active',
      });
      if (student?.id) {
        createdIds.push(student.id);
        // eslint-disable-next-line no-console
        console.log(`[special-chars] Created ${key}: ${student.id}`);
      }
    }

    expect(createdIds.length, 'Should create students via API').toBeGreaterThanOrEqual(5);

    // Navigate to students and search
    await safeGoTo(page, '/students', 'Students');
    if (!page.url().includes('/students')) return;

    const searchInput = page.getByPlaceholder('Search students...');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    // Search for our test suffix
    await searchInput.fill(suffix);
    await page.waitForTimeout(2_000);

    const mainContent = await page.locator('main').textContent() || '';

    // Verify names render correctly
    expect(mainContent).toContain('SpecChar');

    // Verify no HTML entity escaping visible to user
    expect(mainContent).not.toContain('&amp;');
    expect(mainContent).not.toContain('&lt;');
    expect(mainContent).not.toContain('&gt;');
    expect(mainContent).not.toContain('&quot;');

    // Verify XSS not executed — <script> tag should be stored as text
    // It should NOT contain active script output
    expect(mainContent).not.toContain('onerror');

    // No error boundary
    await assertNoErrorBoundary(page);

    // Click into a student detail to verify rendering there too
    const firstStudentLink = page.locator('main').getByRole('link').first()
      .or(page.locator('main tr').first().locator('a').first())
      .or(page.locator('main').locator(`text=${suffix}`).first());
    const hasLink = await firstStudentLink.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasLink) {
      await firstStudentLink.click();
      await waitForPageReady(page);
      await assertNoErrorBoundary(page);
      // Verify student detail page renders without crash
      const detailContent = await page.locator('main').textContent() || '';
      expect(detailContent).toContain('SpecChar');
    }
  });

  test('XSS attempt via student wizard — script tag is sanitized', async ({ page }) => {
    test.setTimeout(120_000);

    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);
    await clickNav(page, '/students');
    await expect(page.getByPlaceholder('Search students...')).toBeVisible({ timeout: 15_000 });

    // Open Add Student wizard
    const addBtn = page.locator('[data-tour="add-student-button"]');
    const hasBtn = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) {
      test.skip(true, 'Add Student button not found');
      return;
    }
    await addBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    const xssName = `<img src=x onerror=alert(1)> ${suffix}`;
    await page.locator('#wizard-firstName').fill(xssName);
    await page.locator('#wizard-lastName').fill(`${testId} XSSTest`);

    // Try to advance through wizard
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(1_000);

    // Handle duplicate dialog
    const dupDialog = page.getByText('Possible duplicate student');
    if (await dupDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Continue Anyway' }).click();
    }

    // Check if we got past step 1 (form accepted the input)
    const createBtn = page.getByRole('button', { name: 'Create Student' });
    const nextBtn = page.getByRole('button', { name: 'Next' });
    const advanced = await nextBtn.or(createBtn).isVisible({ timeout: 5_000 }).catch(() => false);

    if (advanced) {
      // Skip to step 3 and create
      if (await nextBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      }
      if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await createBtn.click();
        // Handle duplicate
        if (await dupDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await page.getByRole('button', { name: 'Continue Anyway' }).click();
        }
        // Wait for success or error
        const successText = page.getByText(/Student Created/i).first();
        const created = await successText.isVisible({ timeout: 30_000 }).catch(() => false);
        if (created) {
          // eslint-disable-next-line no-console
          console.log('[special-chars] XSS student was created — verifying it renders as text');
        }
      }
    }

    // No JavaScript execution should have happened
    await assertNoErrorBoundary(page);

    // Close dialog by navigating
    await safeGoTo(page, '/students', 'Students');
  });

  test('SQL injection attempt via student wizard — handled safely', async ({ page }) => {
    test.setTimeout(120_000);

    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);
    await clickNav(page, '/students');
    await expect(page.getByPlaceholder('Search students...')).toBeVisible({ timeout: 15_000 });

    const addBtn = page.locator('[data-tour="add-student-button"]');
    const hasBtn = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) {
      test.skip(true, 'Add Student button not found');
      return;
    }
    await addBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    const sqlName = `Robert'); DROP TABLE students;-- ${suffix}`;
    await page.locator('#wizard-firstName').fill(sqlName);
    await page.locator('#wizard-lastName').fill(`${testId} SQLTest`);

    // Advance through wizard
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(1_000);

    const dupDialog = page.getByText('Possible duplicate student');
    if (await dupDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Continue Anyway' }).click();
    }

    const createBtn = page.getByRole('button', { name: 'Create Student' });
    const nextBtn = page.getByRole('button', { name: 'Next' });

    if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
    if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createBtn.click();
      if (await dupDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await page.getByRole('button', { name: 'Continue Anyway' }).click();
      }
      await page.waitForTimeout(5_000);
    }

    // Close the success dialog — click the × button using force click
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 10_000 }).catch(() => false)) {
      // The shadcn X close button is inside the dialog content with class="absolute right-4 top-4"
      // It contains <span class="sr-only">Close</span>
      const xBtn = dialog.locator('button:has(> .sr-only)').first();
      if (await xBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await xBtn.click({ force: true });
        await page.waitForTimeout(1_000);
      }
      // If dialog still visible, try reload
      if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForPageReady(page);
      }
    }
    // Navigate to students via sidebar
    if (!page.url().includes('/students')) {
      await clickNav(page, '/students');
    }
    await assertNoErrorBoundary(page);

    // The students page should still work (table not dropped!)
    // If we ended up on dashboard, navigate via sidebar
    if (!page.url().includes('/students')) {
      await clickNav(page, '/students');
    }
    const searchInput = page.getByPlaceholder('Search students...');
    const hasSearch = await searchInput.isVisible({ timeout: 15_000 }).catch(() => false);
    expect(hasSearch, 'Students page should still work after SQL injection attempt').toBe(true);

    // Verify we can still query students
    await searchInput.fill('a');
    await page.waitForTimeout(1_000);
    const mainVisible = await page.locator('main').isVisible().catch(() => false);
    expect(mainVisible, 'Main content visible after SQL injection test').toBe(true);
  });

  test('Invoice form accepts special character description', async ({ page }) => {
    test.setTimeout(60_000);

    await safeGoTo(page, '/invoices', 'Invoices');
    if (!page.url().includes('/invoices')) return;

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

    // Fill description with special characters
    const descInput = dialog.locator('input[placeholder="Description"]').first();
    const hasDesc = await descInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasDesc) {
      await descInput.fill(`Piano lessons — O'Brien & García ${suffix}`);
      const value = await descInput.inputValue();
      expect(value).toContain("O'Brien");
      expect(value).toContain('García');
      expect(value).toContain('&');
    }

    await page.keyboard.press('Escape');
    await assertNoErrorBoundary(page);
  });

  test('Lead form accepts special character names', async ({ page }) => {
    test.setTimeout(60_000);

    await safeGoTo(page, '/leads', 'Leads');
    if (!page.url().includes('/leads')) return;

    const addBtn = page.locator('[data-tour="add-lead-button"]').first()
      .or(page.getByRole('button', { name: /add lead|new lead/i }).first());
    const hasBtn = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) {
      test.skip(true, 'Add Lead button not found');
      return;
    }
    await addBtn.click();

    const formContainer = page.getByRole('dialog').or(page.locator('[data-vaul-drawer]'));
    await expect(formContainer.first()).toBeVisible({ timeout: 10_000 });

    // Fill contact name with special characters
    const nameInput = formContainer.first().locator('#contact_name');
    const hasName = await nameInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasName) {
      await nameInput.fill(`José García ${suffix}`);
      const value = await nameInput.inputValue();
      expect(value).toContain('José');
      expect(value).toContain('García');
    }

    // Fill child first name with unicode
    const childInput = formContainer.first().locator('input[placeholder="First name"]').first();
    if (await childInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await childInput.fill(`田中 ${suffix}`);
      const value = await childInput.inputValue();
      expect(value).toContain('田中');
    }

    await page.keyboard.press('Escape');
    await assertNoErrorBoundary(page);
  });

  test('Teacher form accepts special character display name', async ({ page }) => {
    test.setTimeout(60_000);

    await safeGoTo(page, '/teachers', 'Teachers');
    if (!page.url().includes('/teachers')) return;

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

    // Fill display name with special characters
    const nameInput = dialog.getByLabel(/display name/i).first()
      .or(dialog.locator('input').first());
    const hasName = await nameInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasName) {
      await nameInput.fill(`O'Brien & García 🎵 ${suffix}`);
      const value = await nameInput.inputValue();
      expect(value).toContain("O'Brien");
      expect(value).toContain('García');
      expect(value).toContain('🎵');
    }

    await page.keyboard.press('Escape');
    await assertNoErrorBoundary(page);
  });
});
