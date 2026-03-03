import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  expectToastSuccess,
} from '../helpers';

/**
 * Dismiss any dialog overlay (e.g. welcome dialog) before interacting.
 */
async function dismissOverlays(page: Page) {
  // Try clicking "Got it!" button (welcome dialog)
  const gotItBtn = page.getByRole('button', { name: /got it/i });
  if (await gotItBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await gotItBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
  // Press Escape to close any remaining dialog/overlay
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

/**
 * Navigate via sidebar/nav link click (SPA navigation, preserves auth).
 */
async function clickNav(page: Page, href: string) {
  // Dismiss any overlay dialog that could block clicks
  await dismissOverlays(page);
  const link = page.locator(`a[href="${href}"]`).first();
  await expect(link).toBeVisible({ timeout: 10_000 });
  await link.click({ force: true });
  await page.waitForURL((url) => url.pathname.startsWith(href), {
    timeout: 15_000,
  });
  await waitForPageReady(page);
}

/* ================================================================== */
/*  PARENT PORTAL: Profile Update                                       */
/* ================================================================== */

test.describe('Parent Portal — Profile Update', () => {
  test.use({ storageState: AUTH.parent });

  test('update profile name and restore', async ({ page }) => {
    test.setTimeout(300_000);

    // Navigate to portal profile
    await safeGoTo(page, '/portal/home', 'Portal Home');
    await page.waitForTimeout(2_000);
    await clickNav(page, '/portal/profile');
    await waitForPageReady(page);

    // Find the Full Name input
    const nameInput = page.locator('#fullName');
    await expect(nameInput).toBeVisible({ timeout: 10_000 });

    // Save original value
    const originalName = await nameInput.inputValue();
    const testName = `E2E Parent ${Date.now()}`;

    // Update name
    await nameInput.clear();
    await nameInput.fill(testName);

    // Save
    await page.getByRole('button', { name: /save changes/i }).first().click();
    await expectToastSuccess(page);

    // Restore original name
    await nameInput.clear();
    await nameInput.fill(originalName);
    await page.getByRole('button', { name: /save changes/i }).first().click();
    await expectToastSuccess(page);
  });
});

/* ================================================================== */
/*  PARENT PORTAL: Practice Logging                                     */
/* ================================================================== */

test.describe('Parent Portal — Practice Logging', () => {
  test.use({ storageState: AUTH.parent });

  test('log practice via quick log', async ({ page }) => {
    test.setTimeout(300_000);

    // Navigate to portal practice page
    await safeGoTo(page, '/portal/home', 'Portal Home');
    await page.waitForTimeout(2_000);
    await clickNav(page, '/portal/practice');
    await waitForPageReady(page);

    // Check if practice is enabled
    const featureDisabled = page.getByText(/not currently enabled/i).first();
    if (await featureDisabled.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'Practice feature is not enabled for this org');
      return;
    }

    // Click "Quick Log" tab
    const quickLogTab = page.getByText(/quick log/i).first();
    if (await quickLogTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await quickLogTab.click();
      await page.waitForTimeout(500);
    }

    // Select student if there's a dropdown (multi-child families)
    const studentSelect = page.getByLabel(/student/i).first();
    if (await studentSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // It's a select — click it and pick first option
      await studentSelect.click();
      await page.waitForTimeout(300);
      const firstStudent = page.getByRole('option').first();
      if (await firstStudent.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await firstStudent.click();
        await page.waitForTimeout(300);
      }
    }

    // Select duration preset — 15 minutes
    const durationBtn = page.getByRole('button', { name: '15m' }).first();
    if (await durationBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await durationBtn.click();
      await page.waitForTimeout(300);
    } else {
      // Try custom duration
      const customInput = page.getByPlaceholder('Custom mins').first();
      if (await customInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await customInput.fill('15');
      }
    }

    // Add practice notes
    const notesField = page.getByPlaceholder(/what did you pract/i).first();
    if (await notesField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await notesField.fill('E2E test practice session');
    }

    // Submit — click the Log button
    const logBtn = page.getByRole('button', { name: /log.*practice/i }).first();
    if (await logBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(logBtn).toBeEnabled({ timeout: 5_000 });
      await logBtn.click();
      await expectToastSuccess(page);
    }
  });
});

/* ================================================================== */
/*  PARENT PORTAL: Message Request                                      */
/* ================================================================== */

test.describe('Parent Portal — Message Request', () => {
  test.use({ storageState: AUTH.parent });

  const testId = `e2e-${Date.now()}`;

  test('send a message request from portal', async ({ page }) => {
    test.setTimeout(300_000);

    // Navigate to portal messages
    await safeGoTo(page, '/portal/home', 'Portal Home');
    await page.waitForTimeout(2_000);
    await clickNav(page, '/portal/messages');
    await waitForPageReady(page);

    // Click "New Message" button
    const newMsgBtn = page.getByRole('button', { name: /new message/i }).first();
    await expect(newMsgBtn).toBeVisible({ timeout: 10_000 });
    await newMsgBtn.click();

    // Wait for request dialog to fully render
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);

    // Fill subject
    const subjectInput = page.locator('#subject');
    await expect(subjectInput).toBeVisible({ timeout: 5_000 });
    await subjectInput.fill(`E2E Test Request ${testId}`);
    await page.waitForTimeout(300);

    // Fill message
    const messageInput = page.locator('#message');
    await expect(messageInput).toBeVisible({ timeout: 5_000 });
    await messageInput.fill(`This is an automated E2E test request. TestId: ${testId}`);
    await page.waitForTimeout(500);

    // Submit — use specific button text and force click
    const sendBtn = page.getByRole('button', { name: /send message/i });
    await expect(sendBtn).toBeEnabled({ timeout: 5_000 });
    await sendBtn.click({ force: true });
    await expectToastSuccess(page);
  });
});

/* ================================================================== */
/*  PARENT PORTAL: Invoice Visibility                                   */
/* ================================================================== */

test.describe('Parent Portal — Invoice Visibility', () => {
  test.use({ storageState: AUTH.parent });

  test('view invoices page and verify content', async ({ page }) => {
    test.setTimeout(300_000);

    // Navigate to portal invoices
    await safeGoTo(page, '/portal/home', 'Portal Home');
    await page.waitForTimeout(2_000);
    await clickNav(page, '/portal/invoices');
    await waitForPageReady(page);

    // Check if invoices feature is enabled
    const featureDisabled = page.getByText(/not currently enabled/i).first();
    if (await featureDisabled.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'Invoices feature is not enabled for this org');
      return;
    }

    // Verify page loaded — check for invoices heading or content
    await expect(
      page.getByRole('heading', { name: /invoices/i }).first()
        .or(page.getByText(/invoices/i).first())
    ).toBeVisible({ timeout: 10_000 });

    // Check for invoice data (LL- prefix), empty state, or no-students state
    const invoiceCard = page.getByText(/LL-\d{4}/i).first();
    const emptyState = page.getByText(/no invoices/i).first();
    const noStudents = page.getByText(/no students found/i).first();
    const hasInvoices = await invoiceCard.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasNoStudents = await noStudents.isVisible({ timeout: 3_000 }).catch(() => false);

    // At least one state should be visible
    expect(hasInvoices || hasEmpty || hasNoStudents).toBe(true);
  });
});
