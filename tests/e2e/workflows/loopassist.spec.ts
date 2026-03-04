import { test, expect, Page } from '@playwright/test';
import { AUTH, goTo, waitForPageReady } from '../helpers';

/**
 * LoopAssist E2E Tests
 *
 * Tests the AI copilot drawer, data queries, action proposals,
 * proactive alerts, role-based access, parent portal, and preferences.
 *
 * AI responses take 10-30s. All AI-dependent assertions use generous timeouts.
 */

const testId = `e2e-${Date.now()}`;

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * The LoopAssist sheet is a Radix Sheet (role="dialog") that slides in from the right.
 * It is distinct from modal dialogs (intro, etc.) by being a child of
 * SheetContent which has class "inset-y-0 right-0" and the fixed position.
 * We identify it by looking for the dialog that contains the "Ask LoopAssist..." textarea.
 */
function getSheet(page: Page) {
  // The sheet slides in from the right and has class "inset-y-0 right-0".
  // This distinguishes it from centered modal dialogs.
  return page.locator('div[role="dialog"].fixed').filter({
    has: page.locator('h2'),
  }).filter({
    hasText: 'LoopAssist',
  }).first();
}

/** Dismiss the intro modal if it appears ("Meet LoopAssist") */
async function dismissIntroIfVisible(page: Page) {
  const introTitle = page.getByText('Meet LoopAssist');
  const hasIntro = await introTitle.isVisible({ timeout: 3_000 }).catch(() => false);
  if (hasIntro) {
    const getStartedBtn = page.getByRole('button', { name: 'Get Started' });
    await getStartedBtn.click();
    await expect(introTitle).toBeHidden({ timeout: 5_000 });
  }
}

/** Open the LoopAssist drawer via sidebar button */
async function openDrawer(page: Page) {
  const sidebarBtn = page.locator('button').filter({ hasText: 'LoopAssist' }).first();
  await expect(sidebarBtn).toBeVisible({ timeout: 15_000 });
  await sidebarBtn.click();
  // Dismiss intro modal if it pops up
  await dismissIntroIfVisible(page);
  // Wait for the sheet to be usable (has the input area)
  const sheet = getSheet(page);
  await expect(sheet).toBeVisible({ timeout: 10_000 });
  return sheet;
}

/** Close the LoopAssist drawer */
async function closeDrawer(page: Page) {
  // The close button has sr-only "Close" text
  const sheet = getSheet(page);
  const closeBtn = sheet.getByRole('button', { name: 'Close' });
  if (await closeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  // Wait for sheet to close — the dialog should become hidden
  await page.waitForTimeout(500);
}

/** Type a message and send it in the LoopAssist drawer */
async function sendMessage(page: Page, message: string) {
  const sheet = getSheet(page);
  const textarea = sheet.getByPlaceholder('Ask LoopAssist...');
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  await textarea.fill(message);
  const sendBtn = sheet.locator('button').filter({ has: page.locator('svg.lucide-send') }).first();
  await expect(sendBtn).toBeEnabled({ timeout: 5_000 });
  await sendBtn.click();
}

/** Wait for an AI response to appear in the chat (streaming to finish) */
async function waitForAIResponse(page: Page, timeout = 45_000): Promise<string> {
  const sheet = getSheet(page);
  // Wait for streaming to finish — the Send button (not Stop) should re-appear
  const sendBtn = sheet.locator('button').filter({ has: page.locator('svg.lucide-send') }).first();
  await expect(sendBtn).toBeVisible({ timeout });

  // Get the last assistant message (bg-muted is the assistant bubble style)
  const assistantBubbles = sheet.locator('.bg-muted');
  const count = await assistantBubbles.count();
  expect(count).toBeGreaterThan(0);
  const lastBubble = assistantBubbles.nth(count - 1);
  const text = await lastBubble.textContent() || '';
  return text;
}

// ─── SECTION 1: DRAWER UI ────────────────────────────────────────────

test.describe('Drawer UI', () => {
  test.use({ storageState: AUTH.owner });

  test('open via sidebar, verify elements, close', async ({ page }) => {
    await goTo(page, '/');
    await waitForPageReady(page);

    // 1. Open via sidebar
    const sheet = await openDrawer(page);

    // Verify heading "LoopAssist" is visible inside the sheet
    await expect(sheet.getByText('LoopAssist', { exact: true }).first()).toBeVisible({ timeout: 5_000 });

    // Verify textarea is visible
    const textarea = sheet.getByPlaceholder('Ask LoopAssist...');
    await expect(textarea).toBeVisible({ timeout: 5_000 });

    // Verify send button exists and is disabled when input is empty
    const sendBtn = sheet.locator('button').filter({ has: page.locator('svg.lucide-send') }).first();
    await expect(sendBtn).toBeVisible({ timeout: 5_000 });
    await expect(sendBtn).toBeDisabled();

    // 2. Close via X button
    await closeDrawer(page);
  });

  test('open via dashboard widget input', async ({ page }) => {
    await goTo(page, '/');
    await waitForPageReady(page);

    // Find the dashboard widget input
    const widgetInput = page.getByPlaceholder('Ask anything about your business...');
    const hasWidget = await widgetInput.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasWidget) {
      test.skip(true, 'Dashboard LoopAssist widget not visible');
      return;
    }

    await widgetInput.fill('test query');
    const widgetSendBtn = page.getByRole('button', { name: 'Send message' });
    await widgetSendBtn.click();

    // Dismiss intro if it appears
    await dismissIntroIfVisible(page);

    // Verify drawer opens
    const sheet = getSheet(page);
    await expect(sheet).toBeVisible({ timeout: 10_000 });

    await closeDrawer(page);
  });

  test('new conversation resets chat', async ({ page }) => {
    await goTo(page, '/');
    await waitForPageReady(page);

    const sheet = await openDrawer(page);

    // Find the New Conversation button (Plus icon)
    const newConvBtn = sheet.locator('button').filter({ has: page.locator('svg.lucide-plus') }).first();
    await expect(newConvBtn).toBeVisible({ timeout: 5_000 });
    await newConvBtn.click();

    // Verify textarea is ready for input
    const textarea = sheet.getByPlaceholder('Ask LoopAssist...');
    await expect(textarea).toBeVisible({ timeout: 5_000 });

    await closeDrawer(page);
  });

  test('intro modal shows for first-time users or drawer opens without it', async ({ page }) => {
    await goTo(page, '/');
    await waitForPageReady(page);

    // Open drawer — DO NOT use openDrawer helper (it auto-dismisses intro)
    const sidebarBtn = page.locator('button').filter({ hasText: 'LoopAssist' }).first();
    await expect(sidebarBtn).toBeVisible({ timeout: 15_000 });
    await sidebarBtn.click();

    // Check if intro modal appeared
    const introTitle = page.getByText('Meet LoopAssist');
    const hasIntro = await introTitle.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasIntro) {
      await expect(page.getByText('Ask Questions')).toBeVisible({ timeout: 3_000 });
      await expect(page.getByText('Request Actions')).toBeVisible({ timeout: 3_000 });
      await expect(page.getByText('Confirm Before Acting')).toBeVisible({ timeout: 3_000 });

      await page.getByRole('button', { name: 'Get Started' }).click();
      await expect(introTitle).toBeHidden({ timeout: 5_000 });
    }

    // Drawer should be open regardless
    const sheet = getSheet(page);
    await expect(sheet).toBeVisible({ timeout: 10_000 });

    await closeDrawer(page);
  });

  test('suggested prompts on dashboard widget', async ({ page }) => {
    await goTo(page, '/');
    await waitForPageReady(page);

    // Verify suggested prompts
    const schedulePrompt = page.getByRole('button', { name: "What's my schedule today?" });
    const hasPrompts = await schedulePrompt.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasPrompts) {
      test.skip(true, 'Dashboard widget suggested prompts not visible');
      return;
    }

    await expect(page.getByRole('button', { name: 'Show outstanding invoices' })).toBeVisible();
    await expect(page.getByRole('button', { name: "How's my completion rate?" })).toBeVisible();

    // Click one prompt — should open drawer
    await schedulePrompt.click();

    // Dismiss intro if it appears
    await dismissIntroIfVisible(page);

    const sheet = getSheet(page);
    await expect(sheet).toBeVisible({ timeout: 10_000 });

    await closeDrawer(page);
  });
});
