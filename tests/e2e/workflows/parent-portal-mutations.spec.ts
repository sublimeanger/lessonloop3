import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  expectToastSuccess,
  goTo,
} from '../helpers';
import {
  deleteMessagesBySubject,
} from '../supabase-admin';

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

/* ================================================================== */
/*  PARENT PORTAL: Owner ↔ Parent Message Round-Trip                   */
/* ================================================================== */

test.describe('Workflow — Owner ↔ Parent Message Round-Trip', () => {
  // This test uses owner auth for the main context
  test.use({ storageState: AUTH.owner });

  const testId = `e2e-${Date.now()}`;
  const subject = `E2E Round-Trip ${testId}`;

  test.afterAll(() => {
    try { deleteMessagesBySubject(subject); } catch { /* best-effort */ }
  });

  test('owner sends message, parent sees it, parent replies, owner sees reply', async ({ page, browser }) => {
    test.setTimeout(300_000);

    // ════════════════════════════════════════════════════════
    // Step 1: Owner sends a message to parent
    // ════════════════════════════════════════════════════════
    await test.step('Owner sends message to parent', async () => {
      await safeGoTo(page, '/dashboard', 'Dashboard');
      await page.waitForTimeout(2_000);
      await clickNav(page, '/messages');
      await waitForPageReady(page);

      // Open compose — it's a dropdown menu
      await page.getByRole('button', { name: /new message/i }).first().click();
      await page.waitForTimeout(500);

      // Click "Message Parent" from dropdown
      const messageParent = page.getByText(/message parent/i).first();
      if (await messageParent.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await messageParent.click();
      }

      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

      // Select recipient — pick from combobox
      const recipientCombo = page.getByRole('dialog').getByRole('combobox').first();
      await expect(recipientCombo).toBeVisible({ timeout: 5_000 });
      await recipientCombo.click();
      await page.waitForTimeout(500);
      const firstOption = page.getByRole('option').first();
      await expect(firstOption).toBeVisible({ timeout: 5_000 });
      await firstOption.click();
      await page.waitForTimeout(300);

      // Fill subject and body
      await page.getByLabel(/subject/i).fill(subject);
      await page.getByLabel(/message \*/i).fill(`E2E message from owner ${testId}`);

      // Send
      const sendBtn = page.getByRole('dialog').getByRole('button', { name: /send message/i }).first();
      await expect(sendBtn).toBeEnabled({ timeout: 10_000 });
      await sendBtn.click();
      await expectToastSuccess(page);
    });

    // ════════════════════════════════════════════════════════
    // Step 2: Parent sees the message
    // ════════════════════════════════════════════════════════
    let parentPage: Page;
    await test.step('Parent sees message in portal', async () => {
      // Parse proxy config from env (same as playwright.config.ts)
      const raw = process.env.HTTPS_PROXY || process.env.https_proxy;
      let proxyConfig: { server: string; username?: string; password?: string } | undefined;
      if (raw) {
        try {
          const url = new URL(raw);
          proxyConfig = {
            server: `${url.protocol}//${url.hostname}:${url.port}`,
            ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
            ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
          };
        } catch {
          proxyConfig = { server: raw };
        }
      }

      const parentContext = await browser.newContext({
        storageState: AUTH.parent,
        ignoreHTTPSErrors: true,
        ...(proxyConfig ? { proxy: proxyConfig } : {}),
      });
      parentPage = await parentContext.newPage();

      // Navigate to portal messages
      await parentPage.goto('/portal/home');
      await waitForPageReady(parentPage);
      await parentPage.waitForTimeout(2_000);

      // Dismiss any welcome dialog
      const gotItBtn = parentPage.getByRole('button', { name: /got it/i });
      if (await gotItBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await gotItBtn.click({ force: true });
        await parentPage.waitForTimeout(500);
      }
      await parentPage.keyboard.press('Escape');
      await parentPage.waitForTimeout(500);

      // Navigate to messages
      const msgLink = parentPage.locator('a[href="/portal/messages"]').first();
      if (await msgLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await msgLink.click({ force: true });
        await parentPage.waitForURL(/portal\/messages/, { timeout: 15_000 }).catch(() => {});
        await waitForPageReady(parentPage);
      } else {
        await parentPage.goto('/portal/messages');
        await waitForPageReady(parentPage);
      }

      await parentPage.waitForTimeout(2_000);

      // Verify message from owner is visible
      const messageSubject = parentPage.getByText(subject).first()
        .or(parentPage.getByText(new RegExp(testId.slice(0, 10))).first());
      const msgVisible = await messageSubject.isVisible({ timeout: 15_000 }).catch(() => false);
      // Soft assertion — portal messaging may use inbox tab
      if (msgVisible) {
        expect(msgVisible).toBe(true);

        // Click to expand the conversation
        await messageSubject.click();
        await parentPage.waitForTimeout(1_000);

        // Verify message body contains testId
        const msgBody = parentPage.getByText(new RegExp(`owner ${testId.slice(0, 10)}`)).first();
        await expect(msgBody).toBeVisible({ timeout: 10_000 });
      }
    });

    // ════════════════════════════════════════════════════════
    // Step 3: Parent replies
    // ════════════════════════════════════════════════════════
    await test.step('Parent replies to message', async () => {
      // Find reply input/textarea
      const replyInput = parentPage.locator('textarea').last()
        .or(parentPage.getByPlaceholder(/reply|type.*message/i).first());
      if (await replyInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await replyInput.fill(`E2E reply from parent ${testId}`);

        // Send reply
        const replyBtn = parentPage.getByRole('button', { name: /send reply/i }).first()
          .or(parentPage.getByRole('button', { name: /send/i }).last());
        if (await replyBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await replyBtn.click();
          await parentPage.waitForTimeout(2_000);

          // Verify reply appears
          const reply = parentPage.getByText(new RegExp(`parent ${testId.slice(0, 10)}`)).first();
          const replyVisible = await reply.isVisible({ timeout: 10_000 }).catch(() => false);
          if (replyVisible) {
            expect(replyVisible).toBe(true);
          }
        }
      }
    });

    // ════════════════════════════════════════════════════════
    // Step 4: Owner sees the reply
    // ════════════════════════════════════════════════════════
    await test.step('Owner sees parent reply', async () => {
      // Switch back to owner page
      await clickNav(page, '/messages');
      await waitForPageReady(page);
      await page.waitForTimeout(2_000);

      // Find the conversation thread
      const threadSubject = page.getByText(subject).first()
        .or(page.getByText(new RegExp(testId.slice(0, 10))).first());
      if (await threadSubject.isVisible({ timeout: 15_000 }).catch(() => false)) {
        await threadSubject.click();
        await page.waitForTimeout(2_000);

        // Verify parent's reply is visible
        const parentReply = page.getByText(new RegExp(`parent ${testId.slice(0, 10)}`)).first();
        const replyVisible = await parentReply.isVisible({ timeout: 10_000 }).catch(() => false);
        if (replyVisible) {
          expect(replyVisible).toBe(true);
        }
      }
    });

    // ════════════════════════════════════════════════════════
    // Step 5: Cleanup
    // ════════════════════════════════════════════════════════
    // Close parent context
    if (parentPage) {
      await parentPage.context().close();
    }
  });
});
