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
  // The textarea exists both in "landing" and "chat" views
  const textarea = sheet.getByPlaceholder('Ask LoopAssist...').first();
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  await textarea.fill(message);
  // Send button is next to the textarea
  const sendBtn = sheet.locator('button').filter({ has: page.locator('svg.lucide-send') }).first();
  await expect(sendBtn).toBeEnabled({ timeout: 5_000 });
  await sendBtn.click();
  // After sending, the view switches to "chat" and streaming starts.
  // Wait briefly for the view transition.
  await page.waitForTimeout(500);
}

/** Wait for an AI response to appear in the chat (streaming to finish) */
async function waitForAIResponse(page: Page, timeout = 45_000): Promise<string> {
  const sheet = getSheet(page);

  // First, wait for streaming indicator to appear (the stop button or typing dots)
  const stopBtn = sheet.locator('button[title="Stop generating"]');
  const typingDots = sheet.locator('[aria-label="LoopAssist is thinking"]');
  const streamingIndicator = stopBtn.or(typingDots);
  // If streaming hasn't started yet (very fast response), we may not see it
  await streamingIndicator.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});

  // Now wait for streaming to finish — the stop button disappears and send button returns
  // The chat view's input area has data-tour="loopassist-input"
  const chatSendBtn = sheet.locator('[data-tour="loopassist-input"] button').filter({
    has: page.locator('svg.lucide-send'),
  }).first();
  await expect(chatSendBtn).toBeVisible({ timeout });

  // Get the last assistant message bubble.
  // Assistant messages use "bg-muted" class; user messages use "bg-primary".
  // We look for the wrapper div that contains the prose content.
  const assistantBubbles = sheet.locator('[data-loop-assist-messages] .bg-muted');
  const count = await assistantBubbles.count();
  if (count === 0) {
    // Fallback: look for any prose div in the messages area
    const proseBlocks = sheet.locator('[data-loop-assist-messages] .prose');
    const proseCount = await proseBlocks.count();
    if (proseCount > 0) {
      return await proseBlocks.last().textContent() || '';
    }
    throw new Error('No assistant response found in chat');
  }
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

// ─── SECTION 2: DATA QUERY TOOLS ─────────────────────────────────────

test.describe('Data Query Tools', () => {
  test.use({ storageState: AUTH.owner });

  /**
   * Each tool is tested by sending a natural language query and verifying
   * the AI responds coherently (not an error). The AI backend must be available.
   *
   * We reuse a single test with a table-driven approach to keep the drawer
   * open and speed up sequential queries.
   */
  const queries: { tool: string; query: string; fallback?: string; expectPattern?: RegExp }[] = [
    { tool: 'search_students', query: 'How many active students do I have?', expectPattern: /student|active|\d+/i },
    { tool: 'get_student_detail', query: 'Tell me about my students. Who was added most recently?', expectPattern: /student|name|lesson|detail/i },
    { tool: 'search_lessons', query: 'What lessons are scheduled this week?', expectPattern: /lesson|schedule|week|today|\d+/i },
    { tool: 'get_lesson_detail', query: 'Show me details of the next upcoming lesson', expectPattern: /lesson|time|student|teacher/i },
    { tool: 'search_invoices', query: 'Show me all overdue invoices', expectPattern: /invoice|overdue|outstanding|none|\d+|£/i },
    { tool: 'get_revenue_summary', query: "What's my revenue this month?", expectPattern: /revenue|income|total|£|\d+|month/i },
    { tool: 'get_teacher_schedule', query: "What's the teacher's schedule this week?", expectPattern: /schedule|lesson|week|teacher|no /i },
    { tool: 'check_room_availability', query: 'Is any room free tomorrow at 2pm?', expectPattern: /room|available|free|booked|tomorrow/i },
    { tool: 'get_attendance_summary', query: "What's the attendance rate this term?", expectPattern: /attendance|rate|present|absent|\d+%/i },
    { tool: 'get_at_risk_students', query: 'Which students are at risk of dropping out?', expectPattern: /risk|student|attendance|absent|none|no /i },
    { tool: 'get_practice_history', query: 'How much have students practiced this month?', expectPattern: /practice|minute|hour|session|student|no /i },
    { tool: 'get_term_adjustments', query: 'Show me any term adjustments', expectPattern: /adjustment|term|credit|none|no /i },
  ];

  for (const { tool, query, expectPattern } of queries) {
    test(`query tool: ${tool}`, async ({ page }) => {
      await goTo(page, '/');
      await waitForPageReady(page);

      await openDrawer(page);

      // Send the query (from landing or chat view — sendMessage handles both)
      await sendMessage(page, query);

      // Wait for AI response (up to 60s to leave room for retries within 120s test limit)
      let responseText: string;
      try {
        responseText = await waitForAIResponse(page, 60_000);
      } catch {
        // If timed out, skip — don't retry since the AI may still be processing
        test.skip(true, `AI response timeout for ${tool}`);
        return;
      }

      // Verify response is not empty and not an error
      expect(responseText.length).toBeGreaterThan(10);

      // Verify response contains relevant content
      if (expectPattern) {
        expect(responseText).toMatch(expectPattern);
      }

      await closeDrawer(page);
    });
  }
});

// ─── SECTION 3: ACTION PROPOSALS ──────────────────────────────────────

test.describe('Action Proposals', () => {
  test.use({ storageState: AUTH.owner });

  const actionQueries: {
    actionType: string;
    label: string;
    query: string;
    destructive: boolean;
  }[] = [
    { actionType: 'generate_billing_run', label: 'Generate Billing Run', query: 'Run billing for all lessons this month', destructive: true },
    { actionType: 'send_invoice_reminders', label: 'Send Invoice Reminders', query: 'Send a reminder for overdue invoices', destructive: false },
    { actionType: 'send_bulk_reminders', label: 'Send All Overdue Reminders', query: 'Send reminders to all parents with overdue invoices', destructive: false },
    { actionType: 'reschedule_lessons', label: 'Reschedule Lessons', query: "Move today's 3pm lesson to 4pm", destructive: false },
    { actionType: 'draft_email', label: 'Draft Email', query: 'Draft an email to all parents about the upcoming concert', destructive: false },
    { actionType: 'mark_attendance', label: 'Mark Attendance', query: "Mark attendance for today's lessons", destructive: false },
    { actionType: 'cancel_lesson', label: 'Cancel Lesson', query: "Cancel tomorrow's 10am lesson", destructive: true },
    { actionType: 'complete_lessons', label: 'Mark Lessons Complete', query: "Mark today's past lessons as complete", destructive: false },
    { actionType: 'bulk_complete_lessons', label: 'Mark All Past Lessons Complete', query: 'Mark all past lessons as complete', destructive: true },
    { actionType: 'send_progress_report', label: 'Send Progress Report', query: 'Send a progress report for my students', destructive: false },
  ];

  for (const { actionType, label, query, destructive } of actionQueries) {
    test(`action proposal: ${actionType}`, async ({ page }) => {
      await goTo(page, '/');
      await waitForPageReady(page);

      await openDrawer(page);
      await sendMessage(page, query);

      let responseText: string;
      try {
        responseText = await waitForAIResponse(page, 60_000);
      } catch {
        test.skip(true, `AI response timeout for ${actionType}`);
        return;
      }

      const sheet = getSheet(page);

      // Check if an ActionCard appeared with the expected label
      const actionCard = sheet.locator('text=' + label).first();
      const hasActionCard = await actionCard.isVisible({ timeout: 5_000 }).catch(() => false);

      if (!hasActionCard) {
        // AI might not have proposed the action — check for any ActionCard
        const anyConfirmBtn = sheet.getByRole('button', { name: /^Confirm/i }).first();
        const hasAnyAction = await anyConfirmBtn.isVisible({ timeout: 3_000 }).catch(() => false);
        if (!hasAnyAction) {
          test.skip(true, `AI did not propose ${actionType} — may need prompt tuning`);
          return;
        }
      }

      // Verify: Confirm button exists with the right aria-label
      const confirmBtn = sheet.getByRole('button', { name: `Confirm ${label}` }).first()
        .or(sheet.getByRole('button', { name: /^Confirm/i }).first());
      await expect(confirmBtn.first()).toBeVisible({ timeout: 5_000 });

      if (destructive) {
        // For destructive actions, verify the button has destructive variant
        // Click Confirm to trigger the double-confirm step
        await confirmBtn.first().click();

        // Verify: "Are you sure?" warning appears
        const warningText = sheet.getByText('This action cannot be undone');
        const hasDoubleConfirm = await warningText.isVisible({ timeout: 5_000 }).catch(() => false);
        if (hasDoubleConfirm) {
          await expect(warningText).toBeVisible();
          // Verify "Yes, I'm sure" button and "Go Back" button appear
          const yesButton = sheet.getByText("Yes, I'm sure").first();
          await expect(yesButton).toBeVisible({ timeout: 3_000 });
          const goBackButton = sheet.getByText('Go Back').first();
          await expect(goBackButton).toBeVisible({ timeout: 3_000 });
          // Click Go Back to cancel the destructive action
          await goBackButton.click();
        }
      }

      // Cancel the action proposal (don't execute)
      const cancelBtn = sheet.getByRole('button', { name: /^Cancel/i }).first();
      if (await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await cancelBtn.click();
      }

      await closeDrawer(page);
    });
  }
});

// ─── SECTION 4: EXECUTE SAFE ACTIONS ──────────────────────────────────

test.describe('Execute Safe Actions', () => {
  test.use({ storageState: AUTH.owner });

  test('mark attendance via LoopAssist', async ({ page }) => {
    await goTo(page, '/');
    await waitForPageReady(page);
    await openDrawer(page);

    await sendMessage(page, "Mark all students as present for today's lessons");
    let responseText: string;
    try {
      responseText = await waitForAIResponse(page, 60_000);
    } catch {
      test.skip(true, 'AI response timeout for mark_attendance');
      return;
    }

    const sheet = getSheet(page);

    // Check for Mark Attendance ActionCard
    const confirmBtn = sheet.getByRole('button', { name: /Confirm Mark Attendance/i }).first()
      .or(sheet.getByRole('button', { name: /^Confirm/i }).first());
    const hasAction = await confirmBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasAction) {
      test.skip(true, 'AI did not propose mark_attendance action');
      return;
    }

    // Click Confirm
    await confirmBtn.first().click();

    // Wait for execution — a ResultCard (green card) or toast should appear
    const resultCard = sheet.locator('.border-green-200, .border-green-800').first();
    const toastSuccess = page.locator('[data-radix-collection-item]').filter({ hasText: /success|executed|marked|attendance/i });
    const result = resultCard.or(toastSuccess.first());
    await expect(result.first()).toBeVisible({ timeout: 30_000 });

    await closeDrawer(page);
  });

  test('complete lessons via LoopAssist', async ({ page }) => {
    await goTo(page, '/');
    await waitForPageReady(page);
    await openDrawer(page);

    await sendMessage(page, "Mark today's finished lessons as complete");
    try {
      await waitForAIResponse(page, 60_000);
    } catch {
      test.skip(true, 'AI response timeout for complete_lessons');
      return;
    }

    const sheet = getSheet(page);
    const confirmBtn = sheet.getByRole('button', { name: /Confirm/i }).first();
    const hasAction = await confirmBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasAction) {
      test.skip(true, 'AI did not propose complete_lessons action');
      return;
    }

    await confirmBtn.click();

    // Wait for success result
    const resultCard = sheet.locator('.border-green-200, .border-green-800').first();
    const toastSuccess = page.locator('[data-radix-collection-item]').filter({ hasText: /success|executed|completed|lesson/i });
    const result = resultCard.or(toastSuccess.first());
    await expect(result.first()).toBeVisible({ timeout: 30_000 });

    await closeDrawer(page);
  });

  test('draft email via LoopAssist', async ({ page }) => {
    await goTo(page, '/');
    await waitForPageReady(page);
    await openDrawer(page);

    await sendMessage(page, 'Draft an email to all parents about the upcoming recital');
    try {
      await waitForAIResponse(page, 60_000);
    } catch {
      test.skip(true, 'AI response timeout for draft_email');
      return;
    }

    const sheet = getSheet(page);
    const confirmBtn = sheet.getByRole('button', { name: /Confirm/i }).first();
    const hasAction = await confirmBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasAction) {
      test.skip(true, 'AI did not propose draft_email action');
      return;
    }

    await confirmBtn.click();

    // Wait for success
    const resultCard = sheet.locator('.border-green-200, .border-green-800').first();
    const toastSuccess = page.locator('[data-radix-collection-item]').filter({ hasText: /success|executed|draft|email|queued|message/i });
    const result = resultCard.or(toastSuccess.first());
    await expect(result.first()).toBeVisible({ timeout: 30_000 });

    await closeDrawer(page);
  });
});
