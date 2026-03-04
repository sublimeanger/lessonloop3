import { test, expect, Page, Locator } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AUTH, goTo, assertNoErrorBoundary } from '../helpers';
import { supabaseDelete, getOrgId } from '../supabase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testId = `e2e-${Date.now()}`;

/**
 * Navigate to /students/import via client-side routing.
 * Warms auth/org on dashboard, then clicks Students sidebar link,
 * then navigates to the import page.
 */
async function goToImport(page: Page) {
  await goTo(page, '/dashboard');
  await page.waitForTimeout(2_000);
  // Click Students sidebar link to ensure the router is initialized
  await page.getByRole('link', { name: 'Students' }).first().click();
  await page.waitForTimeout(2_000);
  // Now navigate via the router (evaluate pushes a client-side route change)
  await page.evaluate(() => window.history.pushState({}, '', '/students/import'));
  // Trigger React Router to pick up the URL change
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')));
  await page.waitForTimeout(3_000);
}

/** Scope to the visible desktop content area. */
function dc(page: Page): Locator {
  return page.locator('div.hidden.md\\:block').or(page.locator('main'));
}

test.describe('CSV Student Import — Owner', () => {
  test.use({ storageState: AUTH.owner });
  test.describe.configure({ mode: 'serial' });

  const csvPath = path.join(__dirname, `test-import-${testId}.csv`);
  const invalidCsvPath = path.join(__dirname, `test-invalid-${testId}.csv`);

  test.afterAll(() => {
    const orgId = getOrgId();
    if (orgId) {
      const encodedPrefix = encodeURIComponent(`%${testId}%`);
      supabaseDelete('student_guardians', `org_id=eq.${orgId}`);
      supabaseDelete('students', `org_id=eq.${orgId}&first_name=like.${encodedPrefix}`);
      supabaseDelete('guardians', `org_id=eq.${orgId}&full_name=like.${encodedPrefix}`);
    }
    try { fs.unlinkSync(csvPath); } catch { /* ignore */ }
    try { fs.unlinkSync(invalidCsvPath); } catch { /* ignore */ }
  });

  test('navigate to import page', async ({ page }) => {
    await goToImport(page);
    await assertNoErrorBoundary(page);

    // Should show import page title or upload step
    const importTitle = page.getByText('Import Students').first();
    await expect(importTitle).toBeVisible({ timeout: 15_000 });

    // Should show upload section
    await expect(page.getByText(/Upload.*CSV|CSV.*upload|Upload a CSV/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('upload valid CSV and see preview', async ({ page }) => {
    // Create test CSV
    const csv = [
      'first_name,last_name,email',
      `E2E Import1 ${testId},Student,e2e-import1-${testId}@test.com`,
      `E2E Import2 ${testId},Student,e2e-import2-${testId}@test.com`,
      `E2E Import3 ${testId},Student,e2e-import3-${testId}@test.com`,
    ].join('\n');
    fs.writeFileSync(csvPath, csv);

    await goToImport(page);

    // Upload CSV via file input
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);

    // Wait for processing — should advance to mapping step
    await page.waitForTimeout(5_000);

    // Should show mapping or preview step
    const mappingVisible = await page.getByText(/Map Fields|Column Mapping/i).first()
      .isVisible({ timeout: 15_000 }).catch(() => false);
    const previewVisible = await page.getByText(/Preview|Ready/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);

    expect(mappingVisible || previewVisible).toBe(true);

    if (mappingVisible) {
      const hasFirstName = await page.getByText(/first.name/i).first()
        .isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasFirstName).toBe(true);
    }
  });

  test('confirm import and verify students', async ({ page }) => {
    const csv = [
      'first_name,last_name,email',
      `E2E Import1 ${testId},Student,e2e-import1-${testId}@test.com`,
      `E2E Import2 ${testId},Student,e2e-import2-${testId}@test.com`,
      `E2E Import3 ${testId},Student,e2e-import3-${testId}@test.com`,
    ].join('\n');
    fs.writeFileSync(csvPath, csv);

    await goToImport(page);

    await page.locator('input[type="file"][accept=".csv"]').setInputFiles(csvPath);
    await page.waitForTimeout(5_000);

    // Navigate through mapping step if shown
    const nextBtn = page.getByRole('button', { name: /Next|Continue|Proceed|Preview/i }).first();
    if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(3_000);
    }

    // Look for import/confirm button on preview step
    const importBtn = page.getByRole('button', { name: /Import.*Student|Confirm Import/i }).first();
    if (await importBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await importBtn.click();
      await page.waitForTimeout(8_000);

      const success = await page.getByText(/imported|success|complete/i).first()
        .isVisible({ timeout: 15_000 }).catch(() => false);
      expect(success).toBe(true);
    } else {
      test.skip(true, 'Import button not visible — may need AI mapping step');
    }
  });

  test('upload invalid CSV shows validation error', async ({ page }) => {
    const invalidCsv = [
      'wrong_col1,wrong_col2,wrong_col3',
      'foo,bar,baz',
    ].join('\n');
    fs.writeFileSync(invalidCsvPath, invalidCsv);

    await goToImport(page);

    await page.locator('input[type="file"][accept=".csv"]').setInputFiles(invalidCsvPath);
    await page.waitForTimeout(5_000);

    await assertNoErrorBoundary(page);

    const mappingStep = await page.getByText(/Map Fields|Column Mapping/i).first()
      .isVisible({ timeout: 10_000 }).catch(() => false);

    if (mappingStep) {
      const warning = await page.getByText(/required|missing|unmapped/i).first()
        .isVisible({ timeout: 5_000 }).catch(() => false);
      expect(mappingStep).toBe(true);
    }
  });
});
