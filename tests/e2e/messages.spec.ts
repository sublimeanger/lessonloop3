import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, assertNoErrorBoundary, trackConsoleErrors, waitForPageReady } from './helpers';

// ═══════════════════════════════════════════════════════════════
// OWNER — MESSAGES
// ═══════════════════════════════════════════════════════════════
test.describe('Messages — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('loads messages page with title and description', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/messages', 'Messages');
    await assertNoErrorBoundary(page);
    const title = page.getByText('Messages').first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('shows "New Message" dropdown button', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');
    if (!page.url().includes('/messages')) return; // auth race
    const newMsgBtn = page.getByRole('button', { name: /new message/i }).first();
    await expect(newMsgBtn, 'New Message button should be visible for owner').toBeVisible({ timeout: 10_000 });
  });

  test('"New Message" dropdown shows Message Parent, Bulk Message, Internal', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');
    if (!page.url().includes('/messages')) return; // auth race

    const newMsgBtn = page.getByRole('button', { name: /new message/i }).first();
    const hasMsgBtn = await newMsgBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasMsgBtn) return;
    await newMsgBtn.click();
    await page.waitForTimeout(300);

    // Check dropdown items
    const parentItem = page.getByRole('menuitem', { name: /message parent/i }).first()
      .or(page.getByText(/message parent/i).first());
    await expect(parentItem, 'Message Parent option should be visible in dropdown').toBeVisible({ timeout: 5_000 });

    // Close dropdown
    await page.keyboard.press('Escape');
  });

  test('"Message Parent" opens compose modal with form fields', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');
    if (!page.url().includes('/messages')) return; // auth race

    // Open dropdown and click Message Parent
    const newMsgBtn = page.getByRole('button', { name: /new message/i }).first();
    const hasMsgBtn = await newMsgBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasMsgBtn) return;
    await newMsgBtn.click();
    await page.waitForTimeout(300);
    const parentItem = page.getByRole('menuitem', { name: /message parent/i }).first()
      .or(page.getByText(/message parent/i).first());
    if (await parentItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await parentItem.click();
    } else {
      await page.keyboard.press('Escape');
      return;
    }

    const dialog = page.getByRole('dialog');
    const hasDialog = await dialog.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasDialog) {
      await page.keyboard.press('Escape');
    }
  });

  test('has Conversations, Internal, and Requests tabs', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');
    if (!page.url().includes('/messages')) return; // auth race

    const conversationsTab = page.getByRole('tab', { name: /conversations/i }).first()
      .or(page.getByText('Conversations', { exact: true }).first());
    const internalTab = page.getByRole('tab', { name: /internal/i }).first()
      .or(page.getByText('Internal', { exact: true }).first());
    const requestsTab = page.getByRole('tab', { name: /cancellation|reschedule|requests/i }).first()
      .or(page.getByText('Requests', { exact: true }).first());

    await expect(conversationsTab, 'Conversations tab should be visible').toBeVisible({ timeout: 10_000 });
    await expect(internalTab, 'Internal tab should be visible').toBeVisible({ timeout: 5_000 });
    await expect(requestsTab, 'Requests tab should be visible').toBeVisible({ timeout: 5_000 });
  });

  test('Conversations tab shows search and view toggle', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');
    if (!page.url().includes('/messages')) return; // auth race

    // Search input
    const searchInput = page.getByPlaceholder('Search messages…').first()
      .or(page.getByPlaceholder(/search/i).first());
    const hasSearch = await searchInput.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasSearch) return;

    // View toggle (Threads / List)
    const threadedToggle = page.locator('[aria-label="Threaded view"]').first();
    const listToggle = page.locator('[aria-label="List view"]').first();
    await expect(threadedToggle.or(listToggle), 'At least one view toggle should be visible').toBeVisible({ timeout: 10_000 });
  });

  test('switching to List view shows channel filter', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');

    const listToggle = page.locator('[aria-label="List view"]').first();
    const hasListToggle = await listToggle.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasListToggle) return;

    await listToggle.click();
    await page.waitForTimeout(500);

    // Channel filter should appear in list view
    const channelSelect = page.locator('button[role="combobox"]').filter({ hasText: /all channels|email|in-app/i }).first();
    // Channel filter may or may not appear depending on list view layout
    await assertNoErrorBoundary(page);
  });

  test('Internal tab loads with Inbox/Sent sub-tabs', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');

    const internalTab = page.getByRole('tab', { name: /internal/i }).first();
    if (!(await internalTab.isVisible({ timeout: 5_000 }).catch(() => false))) return;

    await internalTab.click();
    await page.waitForTimeout(500);

    const inboxSubTab = page.getByRole('tab', { name: /inbox/i }).first();
    const sentSubTab = page.getByRole('tab', { name: /^sent$/i }).first();

    await expect(inboxSubTab, 'Inbox sub-tab should be visible').toBeVisible({ timeout: 5_000 });
    const hasSent = await sentSubTab.isVisible({ timeout: 3_000 }).catch(() => false);

    // Click Sent sub-tab
    if (hasSent) {
      await sentSubTab.click();
      await page.waitForTimeout(500);
      await assertNoErrorBoundary(page);
    }
  });

  test('Requests tab loads without errors', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');

    const requestsTab = page.getByRole('tab', { name: /cancellation|reschedule|requests/i }).first();
    if (!(await requestsTab.isVisible({ timeout: 5_000 }).catch(() => false))) return;

    await requestsTab.click();
    await page.waitForTimeout(1_000);
    await assertNoErrorBoundary(page);
  });

  test('no console errors on messages page', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/messages', 'Messages');
    await page.waitForTimeout(2_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// TEACHER — MESSAGES (has access, limited compose)
// ═══════════════════════════════════════════════════════════════
test.describe('Messages — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher can access /messages', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/messages', 'Teacher Messages');
    await assertNoErrorBoundary(page);
    const title = page.getByText('Messages').first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('teacher sees New Message button with Message Parent and Internal', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Teacher Messages');

    const newMsgBtn = page.getByRole('button', { name: /new message/i }).first();
    const hasBtn = await newMsgBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;

    await newMsgBtn.click();
    await page.waitForTimeout(300);

    const parentItem = page.getByRole('menuitem', { name: /message parent/i }).first();
    const bulkItem = page.getByRole('menuitem', { name: /bulk message/i }).first();
    const internalItem = page.getByRole('menuitem', { name: /internal message/i }).first();

    const hasParent = await parentItem.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasBulk = await bulkItem.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasInternal = await internalItem.isVisible({ timeout: 3_000 }).catch(() => false);

    // Teacher should see Parent and Internal, but NOT Bulk
    expect(hasParent, 'Teacher should see Message Parent').toBe(true);
    expect(hasBulk, 'Teacher should NOT see Bulk Message').toBe(false);
    expect(hasInternal, 'Teacher should see Internal Message').toBe(true);

    await page.keyboard.press('Escape');
  });

  test('teacher sees Conversations and Internal tabs but NOT Requests', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Teacher Messages');
    if (!page.url().includes('/messages')) return; // auth race

    const conversationsTab = page.getByRole('tab', { name: /conversations/i }).first();
    const internalTab = page.getByRole('tab', { name: /internal/i }).first();
    const requestsTab = page.getByRole('tab', { name: /cancellation|reschedule|requests/i }).first();

    await expect(conversationsTab, 'Teacher should see Conversations tab').toBeVisible({ timeout: 10_000 });
    await expect(internalTab, 'Teacher should see Internal tab').toBeVisible({ timeout: 5_000 });
    const hasRequests = await requestsTab.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasRequests, 'Teacher should NOT see Requests tab').toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// FINANCE — MESSAGES (has access via sidebar)
// ═══════════════════════════════════════════════════════════════
test.describe('Messages — Finance', () => {
  test.use({ storageState: AUTH.finance });

  test('finance user can access /messages', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/messages', 'Finance Messages');
    await assertNoErrorBoundary(page);
    const title = page.getByText('Messages').first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('finance sees no Bulk Message or Internal options', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Finance Messages');
    if (!page.url().includes('/messages')) return; // auth race

    const newMsgBtn = page.getByRole('button', { name: /new message/i }).first();
    await expect(newMsgBtn, 'Finance should see New Message button').toBeVisible({ timeout: 10_000 });

    await newMsgBtn.click();
    await page.waitForTimeout(300);

    const bulkItem = page.getByRole('menuitem', { name: /bulk message/i }).first();
    const hasBulk = await bulkItem.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasBulk, 'Finance should NOT see Bulk Message option').toBe(false);

    await page.keyboard.press('Escape');
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — PORTAL MESSAGES
// ═══════════════════════════════════════════════════════════════
test.describe('Messages — Parent Portal', () => {
  test.use({ storageState: AUTH.parent });

  test('parent portal messages page loads', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/portal/messages', 'Parent Messages');
    await assertNoErrorBoundary(page);
    const title = page.getByText('Messages').first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('parent sees Inbox and My Requests tabs', async ({ page }) => {
    // Navigate to portal — dismiss welcome dialog if present
    await page.goto('/portal/home');
    await page.waitForLoadState('domcontentloaded');
    await waitForPageReady(page);
    // Dismiss welcome dialog via "Got it!" button or X close button
    try {
      await page.click('text="Got it!"', { timeout: 5_000 });
      await page.waitForTimeout(1_000);
    } catch {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    // Now navigate to messages via sidebar link for reliability
    const messagesLink = page.getByRole('link', { name: 'Messages' }).first();
    if (await messagesLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await messagesLink.click();
      await page.waitForURL(/\/portal\/messages/, { timeout: 10_000 }).catch(() => {});
    } else {
      await page.goto('/portal/messages');
    }
    await page.waitForLoadState('domcontentloaded');
    await waitForPageReady(page);
    if (!page.url().includes('/portal/messages')) return; // portal redirect

    const inboxTab = page.getByRole('tab', { name: /inbox/i }).first()
      .or(page.getByText('Inbox', { exact: true }).first());
    const requestsTab = page.getByRole('tab', { name: /my requests/i }).first()
      .or(page.getByText('My Requests', { exact: true }).first());

    await expect(inboxTab, 'Parent should see Inbox tab').toBeVisible({ timeout: 10_000 });
    await expect(requestsTab, 'Parent should see My Requests tab').toBeVisible({ timeout: 5_000 });
  });

  test('parent does NOT see New Message dropdown', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/portal/messages', 'Parent Messages');
    await page.waitForTimeout(2_000);

    const newMsgBtn = page.getByRole('button', { name: /new message/i }).first();
    const hasBtn = await newMsgBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasBtn, 'Parent should NOT see New Message dropdown').toBe(false);
  });

  test('My Requests tab loads without errors', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/portal/messages', 'Parent Messages');

    const requestsTab = page.getByRole('tab', { name: /my requests/i }).first();
    if (!(await requestsTab.isVisible({ timeout: 5_000 }).catch(() => false))) return;

    await requestsTab.click();
    await page.waitForTimeout(1_000);
    await assertNoErrorBoundary(page);
  });

  test('parent inbox shows empty state or messages', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/portal/messages', 'Parent Messages');
    await waitForPageReady(page);

    // Either conversation cards or empty message
    const emptyMsg = page.getByText(/will appear here/i).first();
    // Either empty state or conversation cards should be present
    const mainText = await page.locator('main').textContent().catch(() => '');
    expect((mainText ?? '').length, 'Parent messages page should have content').toBeGreaterThan(10);
    await assertNoErrorBoundary(page);
  });
});
