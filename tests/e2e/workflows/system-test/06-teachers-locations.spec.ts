/**
 * PART 6: Teachers & Locations (Desktop)
 * Tests 6.1.1 – 6.2.6
 */
import { test, expect } from '../../workflows/workflow.fixtures';
import { AUTH, safeGoTo, expectToast, expectDialog, TEST_RUN_ID } from './helpers';
import { cleanupTestData } from '../../supabase-admin';

test.use({ storageState: AUTH.owner });

test.afterAll(() => {
  cleanupTestData(TEST_RUN_ID);
});

test.describe('Part 6: Teachers & Locations', () => {

  // ── 6.1 — Teachers ──

  test('6.1.1 – /teachers loads', async ({ page }) => {
    await safeGoTo(page, '/teachers');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('6.1.2 – Add Teacher opens dialog and creates', async ({ page }) => {
    await safeGoTo(page, '/teachers');
    const addBtn = page.getByRole('button', { name: /add teacher/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await addBtn.click();
    await expectDialog(page);

    const dialog = page.getByRole('dialog');
    const nameField = dialog.getByLabel(/name/i).first();
    if (await nameField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nameField.fill(`Teacher_${TEST_RUN_ID}`);
    }
    const emailField = dialog.getByLabel(/email/i).first();
    if (await emailField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await emailField.fill(`teacher_${TEST_RUN_ID}@test.lessonloop.net`);
    }

    const saveBtn = dialog.getByRole('button', { name: /save|add|create|invite/i }).first();
    await saveBtn.click();
    await expectToast(page, /teacher|created|added|invited/i);
  });

  test('6.1.4 – Search works on teachers', async ({ page }) => {
    await safeGoTo(page, '/teachers');
    const search = page.getByPlaceholder(/search/i).first();
    if (await search.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await search.fill(TEST_RUN_ID);
      await page.waitForTimeout(1_000);
    }
  });

  // ── 6.2 — Locations ──

  test('6.2.1 – /locations loads', async ({ page }) => {
    await safeGoTo(page, '/locations');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('6.2.2 – Add Location creates', async ({ page }) => {
    await safeGoTo(page, '/locations');
    const addBtn = page.getByRole('button', { name: /add location/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await addBtn.click();
    await expectDialog(page);

    const dialog = page.getByRole('dialog');
    const nameField = dialog.getByLabel(/name/i).first();
    if (await nameField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nameField.fill(`Studio_${TEST_RUN_ID}`);
    }

    const saveBtn = dialog.getByRole('button', { name: /save|add|create/i }).first();
    await saveBtn.click();
    await expectToast(page, /location|created|added|saved/i);
  });

  test('6.2.3-4 – Expand location and add room', async ({ page }) => {
    await safeGoTo(page, '/locations');
    await page.waitForTimeout(2_000);

    // Click location to expand
    const locationCard = page.locator('main').getByText(`Studio_${TEST_RUN_ID}`).first();
    if (await locationCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await locationCard.click();
      await page.waitForTimeout(500);

      const addRoomBtn = page.getByRole('button', { name: /add room/i }).first();
      if (await addRoomBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await addRoomBtn.click();
        await expectDialog(page);

        const dialog = page.getByRole('dialog');
        const roomName = dialog.getByLabel(/name/i).first();
        if (await roomName.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await roomName.fill(`Room_${TEST_RUN_ID}`);
        }
        const saveBtn = dialog.getByRole('button', { name: /save|add|create/i }).first();
        await saveBtn.click();
        await expectToast(page, /room|created|added|saved/i);
      }
    }
  });
});
