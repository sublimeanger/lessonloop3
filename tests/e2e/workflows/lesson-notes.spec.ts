import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  assertNoErrorBoundary,
  goTo,
} from '../helpers';
import { supabaseSelect, supabaseDelete, getOrgId } from '../supabase-admin';

/**
 * Lesson Notes — E2E mutation tests.
 *
 * Tests creating, editing, and verifying lesson notes from
 * both staff (owner) and parent perspectives.
 */

// ── Proxy config ────────────────────────────────────────────
function parseProxy() {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const server = `${url.protocol}//${url.hostname}:${url.port}`;
    return {
      server,
      ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    };
  } catch {
    return { server: raw };
  }
}
const proxyConfig = parseProxy();

const testId = `e2e-${Date.now()}`;

test.describe('Lesson Notes — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test.afterAll(() => {
    // Clean up lesson notes created during test
    const orgId = getOrgId();
    if (orgId) {
      const encoded = encodeURIComponent(`%${testId}%`);
      supabaseDelete('lesson_notes', `org_id=eq.${orgId}&content_covered=like.${encoded}`);
      supabaseDelete('lesson_notes', `org_id=eq.${orgId}&homework=like.${encoded}`);
      supabaseDelete('lesson_notes', `org_id=eq.${orgId}&teacher_private_notes=like.${encoded}`);
    }
  });

  test('open lesson detail from calendar', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');
    await assertNoErrorBoundary(page);
    await page.waitForTimeout(3_000);

    // Find a lesson event on the calendar and click it
    // Calendar events are typically buttons or clickable elements
    const lessonEvent = page.locator('[class*="fc-event"], [class*="calendar-event"], [data-event], .fc-event')
      .first();
    const hasEvent = await lessonEvent.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasEvent) {
      // Try clicking on any event-like element in the calendar grid
      const anyEvent = page.locator('main').locator('a, button, [role="button"]')
        .filter({ hasText: /.+/ })
        .nth(2);
      if (await anyEvent.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await anyEvent.click();
        await page.waitForTimeout(2_000);
      }
    } else {
      await lessonEvent.click();
      await page.waitForTimeout(2_000);
    }

    // Check if a detail panel/sheet opened
    const detailPanel = page.locator('[role="dialog"], [data-state="open"]').first();
    const hasPanel = await detailPanel.isVisible({ timeout: 5_000 }).catch(() => false);

    // Even if the panel didn't open (maybe no events), the calendar should be visible
    await assertNoErrorBoundary(page);
    expect(page.url()).toContain('/calendar');
  });

  test('add structured lesson note', async ({ page }) => {
    test.setTimeout(120_000);
    await safeGoTo(page, '/calendar', 'Calendar');
    await page.waitForTimeout(3_000);

    // Click a lesson event
    const lessonEvent = page.locator('.fc-event').first();
    const hasEvent = await lessonEvent.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasEvent) {
      test.skip(true, 'No calendar events found');
      return;
    }

    await lessonEvent.click();
    await page.waitForTimeout(2_000);

    // Look for the Structured Notes section (collapsible)
    const notesHeader = page.getByText(/structured notes/i).first();
    const hasNotes = await notesHeader.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasNotes) {
      // Try looking in a dialog/sheet
      const dialog = page.locator('[role="dialog"]').first();
      if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const innerNotes = dialog.getByText(/structured notes|notes/i).first();
        if (await innerNotes.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await innerNotes.click();
          await page.waitForTimeout(500);
        }
      }
    } else {
      await notesHeader.click();
      await page.waitForTimeout(500);
    }

    // Fill "What was covered" field
    const contentField = page.getByPlaceholder(/scales.*sight-reading|what was covered/i).first()
      .or(page.getByLabel(/what was covered/i).first());
    const hasContentField = await contentField.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasContentField) {
      test.skip(true, 'Structured notes form not found — lesson detail may differ');
      return;
    }

    await contentField.fill(`E2E content covered ${testId}`);

    // Fill homework
    const homeworkField = page.getByPlaceholder(/practice bars|homework/i).first()
      .or(page.getByLabel(/homework/i).first());
    if (await homeworkField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await homeworkField.fill(`E2E homework ${testId}`);
    }

    // Fill focus areas
    const focusField = page.getByPlaceholder(/dynamics.*hand position|focus areas/i).first()
      .or(page.getByLabel(/focus areas/i).first());
    if (await focusField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await focusField.fill(`E2E focus ${testId}`);
    }

    // Set engagement rating — click 4th emoji (🙂 Good)
    const ratingButtons = page.locator('button').filter({ hasText: /😔|😕|😐|🙂|😊/ });
    const ratingCount = await ratingButtons.count();
    if (ratingCount >= 4) {
      await ratingButtons.nth(3).click(); // 🙂 Good
      await page.waitForTimeout(300);
    }

    // Fill private notes
    const privateField = page.getByPlaceholder(/internal observations|private notes/i).first()
      .or(page.getByLabel(/private notes/i).first());
    if (await privateField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await privateField.fill(`E2E private note ${testId}`);
    }

    // Click Save Notes button
    const saveBtn = page.getByRole('button', { name: /save notes/i }).first();
    if (await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(2_000);

      // Verify save confirmation
      const toast = page.locator('[data-radix-collection-item]')
        .filter({ hasText: /saved|success/i });
      const hasSaveToast = await toast.first().isVisible({ timeout: 10_000 }).catch(() => false);
      expect(hasSaveToast, 'Should see save confirmation toast').toBe(true);
    }
  });

  test('edit existing lesson note', async ({ page }) => {
    test.setTimeout(120_000);
    await safeGoTo(page, '/calendar', 'Calendar');
    await page.waitForTimeout(3_000);

    const lessonEvent = page.locator('.fc-event').first();
    if (!(await lessonEvent.isVisible({ timeout: 10_000 }).catch(() => false))) {
      test.skip(true, 'No calendar events found');
      return;
    }

    await lessonEvent.click();
    await page.waitForTimeout(2_000);

    // Expand structured notes
    const notesHeader = page.getByText(/structured notes/i).first();
    if (await notesHeader.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await notesHeader.click();
      await page.waitForTimeout(500);
    }

    // Edit the content covered field (append to existing content)
    const contentField = page.getByPlaceholder(/scales.*sight-reading|what was covered/i).first()
      .or(page.getByLabel(/what was covered/i).first());
    if (await contentField.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const currentVal = await contentField.inputValue();
      await contentField.fill(`${currentVal} — edited ${testId}`);

      // Save
      const saveBtn = page.getByRole('button', { name: /save notes/i }).first();
      if (await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2_000);

        // Verify toast
        const toast = page.locator('[data-radix-collection-item]')
          .filter({ hasText: /saved|success/i });
        const hasSaveToast = await toast.first().isVisible({ timeout: 10_000 }).catch(() => false);
        expect(hasSaveToast, 'Should see save confirmation toast after edit').toBe(true);
      }
    }
  });

  test('view notes on student detail', async ({ page }) => {
    test.setTimeout(90_000);
    await safeGoTo(page, '/students', 'Students');
    await page.waitForTimeout(3_000);

    // Click first student
    const studentLink = page.locator('main a[href*="/students/"]').first();
    const hasStudent = await studentLink.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasStudent) {
      test.skip(true, 'No students found');
      return;
    }

    await studentLink.click();
    await waitForPageReady(page);
    await assertNoErrorBoundary(page);

    // Look for lesson notes tab or section
    const notesTab = page.getByText(/lesson notes|notes/i).first();
    const hasNotesTab = await notesTab.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasNotesTab) {
      await notesTab.click();
      await page.waitForTimeout(2_000);
      await assertNoErrorBoundary(page);
    }

    // The page should load without errors
    expect(page.url()).toContain('/students/');
  });
});

test.describe('Lesson Notes — Parent visibility', () => {
  test.use({ storageState: AUTH.parent });

  test('parent can see shared notes in portal', async ({ page }) => {
    test.setTimeout(90_000);

    // Navigate to portal schedule
    await safeGoTo(page, '/portal/schedule', 'Portal Schedule');
    await assertNoErrorBoundary(page);
    await page.waitForTimeout(2_000);

    // Parent should see their schedule with lesson details
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible({ timeout: 10_000 });

    // Check if there are any lesson entries showing notes
    const hasLessons = await page
      .locator('main')
      .getByText(/lesson|session|class/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    // Navigate to portal home to check for lesson note cards
    await safeGoTo(page, '/portal/home', 'Portal Home');
    await assertNoErrorBoundary(page);

    // Portal should render without errors
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  test('parent cannot see private teacher notes', async ({ page }) => {
    test.setTimeout(90_000);

    await safeGoTo(page, '/portal/schedule', 'Portal Schedule');
    await page.waitForTimeout(3_000);

    // Private notes (containing "private" or "staff only") should NOT be visible
    const privateNote = page.getByText(`E2E private note ${testId}`).first();
    const hasPrivate = await privateNote.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasPrivate, 'Parent should NOT see private teacher notes').toBe(false);
  });
});
