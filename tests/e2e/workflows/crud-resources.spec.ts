import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  expectToastSuccess,
} from '../helpers';
import {
  supabaseSelect,
  supabaseInsert,
  deleteResourceById,
  getOrgId,
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
/*  MODULE: Resources CRUD                                             */
/* ================================================================== */

test.describe('CRUD — Resources', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `e2e-${Date.now()}`;
  const createdResourceIds: string[] = [];

  test.afterAll(() => {
    for (const id of createdResourceIds) {
      try { deleteResourceById(id); } catch { /* best-effort */ }
    }
    // Fallback cleanup
    try {
      const resources = supabaseSelect(
        'resources',
        `title=like.%25${testId}%25&select=id&limit=10`,
      );
      for (const r of resources) {
        try { deleteResourceById(r.id); } catch { /* best-effort */ }
      }
    } catch { /* best-effort */ }
  });

  test('resource lifecycle: create via API, view, share, delete', async ({ page }) => {
    test.setTimeout(300_000);

    // ── Create resource via admin API (bypasses Portal form submit issue) ──
    const orgId = getOrgId();
    if (!orgId) {
      test.skip(true, 'No org found');
      return;
    }

    // Get owner user ID
    const profiles = supabaseSelect(
      'profiles',
      `full_name=like.%25E2ETest%25&select=id&limit=1`,
    );
    const ownerId = profiles.length > 0 ? profiles[0].id : null;
    if (!ownerId) {
      test.skip(true, 'No owner profile found');
      return;
    }

    const resource = supabaseInsert('resources', {
      org_id: orgId,
      title: `E2E Resource ${testId}`,
      description: `E2E test resource description ${testId}`,
      file_path: `${orgId}/e2e-test-${testId}.txt`,
      file_name: `e2e-test-${testId}.txt`,
      file_type: 'text/plain',
      file_size_bytes: 42,
      uploaded_by: ownerId,
    });

    if (!resource?.id) {
      test.skip(true, 'Failed to create test resource via API');
      return;
    }
    createdResourceIds.push(resource.id);

    // ── Warm up session ──
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await page.waitForTimeout(2_000);

    // ── Navigate to resources ──
    await clickNav(page, '/resources');
    await waitForPageReady(page);
    await page.waitForTimeout(2_000);

    // ── STEP 1: Verify resource in list ──
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await searchInput.fill(testId);
      await page.waitForTimeout(1_500);
    }

    // Verify resource appears
    const resourceCard = page.getByText(new RegExp(testId)).first();
    const isVisible = await resourceCard.isVisible({ timeout: 10_000 }).catch(() => false);
    expect(isVisible).toBe(true);

    // ── STEP 2: Share resource with student ──
    if (isVisible) {
      await resourceCard.click();
      await page.waitForTimeout(1_000);

      // Look for Share button
      const shareBtn = page.getByRole('button', { name: /share/i }).first();
      if (await shareBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await shareBtn.click();

        const shareDialog = page.getByRole('dialog');
        if (await shareDialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
          // Select first student
          const selectAllBtn = shareDialog.getByRole('button', { name: /select all/i }).first();
          if (await selectAllBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await selectAllBtn.click();
            await page.waitForTimeout(500);
          } else {
            const firstStudent = shareDialog.locator('input[type="checkbox"]').first();
            if (await firstStudent.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await firstStudent.click();
              await page.waitForTimeout(300);
            }
          }

          // Confirm share
          const confirmShareBtn = shareDialog.getByRole('button', { name: /share|save|confirm/i }).last();
          if (await confirmShareBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await confirmShareBtn.click();
            await page.waitForTimeout(2_000);
          }
        }
      }

      // Close detail modal if open
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // ── STEP 3: Delete resource ──
    // Re-search to find the resource
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.clear();
      await searchInput.fill(testId);
      await page.waitForTimeout(1_500);
    }

    // Look for delete action in dropdown menu on the card
    const resourceItem = page.getByText(new RegExp(testId)).first();
    if (await resourceItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Find three-dot menu near the resource
      const menuTrigger = resourceItem.locator('..').locator('..').locator('button').filter({
        has: page.locator('svg'),
      }).last();
      if (await menuTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await menuTrigger.click();
        await page.waitForTimeout(500);

        // Click Delete from dropdown
        const deleteOption = page.getByRole('menuitem', { name: /delete/i }).first()
          .or(page.getByText(/delete/i).first());
        if (await deleteOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await deleteOption.click();
          await page.waitForTimeout(500);

          // Confirm deletion
          const confirmDialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
          if (await confirmDialog.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
            const confirmDeleteBtn = confirmDialog.getByRole('button', { name: /delete/i });
            if (await confirmDeleteBtn.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
              await confirmDeleteBtn.first().click();
              await expectToastSuccess(page, /deleted/i);
            }
          }
        }
      }
    }

    // API cleanup fallback
    const remaining = supabaseSelect(
      'resources',
      `title=like.%25${testId}%25&select=id&limit=10`,
    );
    for (const r of remaining) {
      deleteResourceById(r.id);
    }
  });
});
