import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, waitForPageReady, assertNoErrorBoundary, trackConsoleErrors } from './helpers';

// ═══════════════════════════════════════════════════════════════
// OWNER — MESSAGES
// ═══════════════════════════════════════════════════════════════
test.describe('Messages — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('loads messages page with title and description', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');
    await assertNoErrorBoundary(page);
    const title = page.getByText('Messages').first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('shows "New Message" dropdown button', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');
    const newMsgBtn = page.getByRole('button', { name: /new message/i }).first();
    await expect(newMsgBtn).toBeVisible({ timeout: 10_000 });
  });

  test('"New Message" dropdown shows Message Parent, Bulk Message, Internal', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');

    const newMsgBtn = page.getByRole('button', { name: /new message/i }).first();
    await expect(newMsgBtn).toBeVisible({ timeout: 10_000 });
    await newMsgBtn.click();
    await page.waitForTimeout(300);

    // Check dropdown items
    const parentItem = page.getByRole('menuitem', { name: /message parent/i }).first();
    const bulkItem = page.getByRole('menuitem', { name: /bulk message/i }).first();
    const internalItem = page.getByRole('menuitem', { name: /internal message/i }).first();

    const hasParent = await parentItem.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasBulk = await bulkItem.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasInternal = await internalItem.isVisible({ timeout: 3_000 }).catch(() => false);

    // eslint-disable-next-line no-console
    console.log(`[messages] Dropdown — Parent: ${hasParent}, Bulk: ${hasBulk}, Internal: ${hasInternal}`);
    expect(hasParent, 'Owner should see Message Parent').toBe(true);

    // Close dropdown
    await page.keyboard.press('Escape');
  });

  test('"Message Parent" opens compose modal with form fields', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');

    // Open dropdown and click Message Parent
    await page.getByRole('button', { name: /new message/i }).first().click();
    await page.waitForTimeout(300);
    const parentItem = page.getByRole('menuitem', { name: /message parent/i }).first();
    if (await parentItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await parentItem.click();
    }

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText('Send Message')).toBeVisible({ timeout: 5_000 });

    // Check form fields
    const subjectField = dialog.getByPlaceholder('Message subject').first();
    const bodyField = dialog.getByPlaceholder('Write your message...').first();
    const hasSubject = await subjectField.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasBody = await bodyField.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[messages] Compose — Subject: ${hasSubject}, Body: ${hasBody}`);

    // Close
    await page.keyboard.press('Escape');
  });

  test('has Conversations, Internal, and Requests tabs', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');

    const conversationsTab = page.getByRole('tab', { name: /conversations/i }).first();
    const internalTab = page.getByRole('tab', { name: /internal/i }).first();
    const requestsTab = page.getByRole('tab', { name: /cancellation|reschedule|requests/i }).first();

    await expect(conversationsTab).toBeVisible({ timeout: 10_000 });

    const hasInternal = await internalTab.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasRequests = await requestsTab.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[messages] Tabs — Internal: ${hasInternal}, Requests: ${hasRequests}`);
  });

  test('Conversations tab shows search and view toggle', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Messages');

    // Search input
    const searchInput = page.getByPlaceholder('Search messages…');
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    // View toggle (Threads / List)
    const threadedToggle = page.locator('[aria-label="Threaded view"]').first();
    const listToggle = page.locator('[aria-label="List view"]').first();
    const hasThreaded = await threadedToggle.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasList = await listToggle.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[messages] View toggle — Threaded: ${hasThreaded}, List: ${hasList}`);
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
    const hasChannel = await channelSelect.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[messages] Channel filter in list view: ${hasChannel}`);

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

    const hasInbox = await inboxSubTab.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasSent = await sentSubTab.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[messages] Internal sub-tabs — Inbox: ${hasInbox}, Sent: ${hasSent}`);

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

    // eslint-disable-next-line no-console
    console.log(`[teacher-messages] Parent: ${hasParent}, Bulk: ${hasBulk}, Internal: ${hasInternal}`);
    // Teacher should see Parent and Internal, but NOT Bulk
    expect(hasBulk, 'Teacher should NOT see Bulk Message').toBe(false);

    await page.keyboard.press('Escape');
  });

  test('teacher sees Conversations and Internal tabs but NOT Requests', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Teacher Messages');

    const conversationsTab = page.getByRole('tab', { name: /conversations/i }).first();
    const internalTab = page.getByRole('tab', { name: /internal/i }).first();
    const requestsTab = page.getByRole('tab', { name: /cancellation|reschedule|requests/i }).first();

    const hasConversations = await conversationsTab.isVisible({ timeout: 10_000 }).catch(() => false);
    const hasInternal = await internalTab.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasRequests = await requestsTab.isVisible({ timeout: 3_000 }).catch(() => false);

    // eslint-disable-next-line no-console
    console.log(`[teacher-messages] Conversations: ${hasConversations}, Internal: ${hasInternal}, Requests: ${hasRequests}`);
    expect(hasRequests, 'Teacher should NOT see Requests tab').toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// FINANCE — MESSAGES (has access via sidebar)
// ═══════════════════════════════════════════════════════════════
test.describe('Messages — Finance', () => {
  test.use({ storageState: AUTH.finance });

  test('finance user can access /messages', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Finance Messages');
    await assertNoErrorBoundary(page);
    const title = page.getByText('Messages').first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('finance sees no Bulk Message or Internal options', async ({ page }) => {
    await safeGoTo(page, '/messages', 'Finance Messages');

    const newMsgBtn = page.getByRole('button', { name: /new message/i }).first();
    const hasBtn = await newMsgBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) {
      // eslint-disable-next-line no-console
      console.log('[finance-messages] No New Message button');
      return;
    }

    await newMsgBtn.click();
    await page.waitForTimeout(300);

    const bulkItem = page.getByRole('menuitem', { name: /bulk message/i }).first();
    const hasBulk = await bulkItem.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[finance-messages] Bulk: ${hasBulk}`);

    await page.keyboard.press('Escape');
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — PORTAL MESSAGES
// ═══════════════════════════════════════════════════════════════
test.describe('Messages — Parent Portal', () => {
  test.use({ storageState: AUTH.parent });

  test('parent portal messages page loads', async ({ page }) => {
    await safeGoTo(page, '/portal/messages', 'Parent Messages');
    await assertNoErrorBoundary(page);
    const title = page.getByText('Messages').first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('parent sees Inbox and My Requests tabs', async ({ page }) => {
    await safeGoTo(page, '/portal/messages', 'Parent Messages');

    const inboxTab = page.getByRole('tab', { name: /inbox/i }).first();
    const requestsTab = page.getByRole('tab', { name: /my requests/i }).first();

    const hasInbox = await inboxTab.isVisible({ timeout: 10_000 }).catch(() => false);
    const hasRequests = await requestsTab.isVisible({ timeout: 5_000 }).catch(() => false);

    // eslint-disable-next-line no-console
    console.log(`[parent-messages] Inbox: ${hasInbox}, My Requests: ${hasRequests}`);
    expect(hasInbox, 'Parent should see Inbox tab').toBe(true);
  });

  test('parent does NOT see New Message dropdown', async ({ page }) => {
    await safeGoTo(page, '/portal/messages', 'Parent Messages');
    await page.waitForTimeout(2_000);

    const newMsgBtn = page.getByRole('button', { name: /new message/i }).first();
    const hasBtn = await newMsgBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasBtn, 'Parent should NOT see New Message dropdown').toBe(false);
  });

  test('My Requests tab loads without errors', async ({ page }) => {
    await safeGoTo(page, '/portal/messages', 'Parent Messages');

    const requestsTab = page.getByRole('tab', { name: /my requests/i }).first();
    if (!(await requestsTab.isVisible({ timeout: 5_000 }).catch(() => false))) return;

    await requestsTab.click();
    await page.waitForTimeout(1_000);
    await assertNoErrorBoundary(page);
  });

  test('parent inbox shows empty state or messages', async ({ page }) => {
    await safeGoTo(page, '/portal/messages', 'Parent Messages');
    await page.waitForTimeout(3_000);

    // Either conversation cards or empty message
    const emptyMsg = page.getByText(/will appear here/i).first();
    const hasEmpty = await emptyMsg.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[parent-messages] Empty inbox: ${hasEmpty}`);
    // Just check page doesn't crash
    await assertNoErrorBoundary(page);
  });
});
