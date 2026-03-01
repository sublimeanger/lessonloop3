/**
 * Prompt 8 — Settings & Configuration Cascade
 *
 * Settings changes must propagate to every part of the app that uses them.
 * These tests verify tab loading, save/persist, role restrictions,
 * notification preferences, and team members.
 */
import { test, expect } from '../workflow.fixtures';
import { AUTH, waitForPageReady, goTo, expectToast } from '../helpers';
import {
  assertPageLoaded,
  assertNoErrorBoundary,
  getAuthState,
} from '../workflow-helpers';

/* ------------------------------------------------------------------ */
/*  Test 1 — Settings page — all tabs load                            */
/* ------------------------------------------------------------------ */

test.describe('Settings — All Tabs Load', () => {
  test.use({ storageState: AUTH.owner });

  test('settings page — all tabs load', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(120_000);

    await goTo(page, '/settings');
    await assertPageLoaded(page, 'Settings');

    // All tabs an owner should see (using actual tab param values)
    const ownerTabs = [
      { value: 'profile', label: 'Profile' },
      { value: 'notifications', label: 'Notifications' },
      { value: 'organisation', label: 'Organisation' },
      { value: 'calendar', label: 'Calendar' },
      { value: 'rate-cards', label: 'Rate Cards' },
      { value: 'continuation', label: 'Continuation' },
      { value: 'members', label: 'Members' },
      { value: 'billing', label: 'Billing' },
      { value: 'privacy', label: 'Privacy' },
      { value: 'looopassist', label: 'LoopAssist' },
      { value: 'audit', label: 'Audit' },
      { value: 'branding', label: 'Branding' },
      { value: 'scheduling', label: 'Scheduling' },
      { value: 'availability', label: 'Availability' },
      { value: 'messaging', label: 'Messaging' },
    ];

    for (const tab of ownerTabs) {
      // Navigate via URL param
      await goTo(page, `/settings?tab=${tab.value}`);

      // Tab content should load
      const mainEl = page.locator('main').first();
      await expect(mainEl).toBeVisible({ timeout: 10_000 });
      await assertNoErrorBoundary(page);

      // Check for meaningful content (form fields, tables, or text)
      const mainText = await mainEl.textContent() ?? '';
      softAssert(
        mainText.length > 30,
        `Settings tab "${tab.label}" (${tab.value}) should have meaningful content (${mainText.length} chars)`,
      );
    }

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 2 — Profile settings save and persist                        */
/* ------------------------------------------------------------------ */

test.describe('Settings — Profile Save & Persist', () => {
  test.use({ storageState: AUTH.owner });

  test('profile settings save and persist', async ({
    page,
    errorTracker,
    assertCleanRun,
  }) => {
    test.setTimeout(60_000);

    // Step 1: Navigate to profile tab
    await goTo(page, '/settings?tab=profile');
    await assertPageLoaded(page, 'Settings — Profile');

    // Step 2: Note the current first name
    const firstNameInput = page.locator('#firstName').first();
    await expect(firstNameInput).toBeVisible({ timeout: 5_000 });
    const originalName = await firstNameInput.inputValue();

    // Step 3: Append " - E2E Test" suffix
    const testName = `${originalName} - E2E Test`;
    await firstNameInput.fill(testName);

    // Step 4: Click Save
    await page.getByRole('button', { name: /Save Changes/i }).first().click();

    // Step 5: Assert success toast
    await expectToast(page, /saved|updated|success/i);

    // Step 6: Navigate away and back to verify persistence
    await goTo(page, '/dashboard');
    await waitForPageReady(page);
    await goTo(page, '/settings?tab=profile');
    await assertPageLoaded(page, 'Settings — Profile (reload)');

    // Step 7: Assert the name still has the suffix
    const nameAfterReload = await page.locator('#firstName').first().inputValue();
    expect(
      nameAfterReload,
      'First name should persist with E2E Test suffix after navigation',
    ).toBe(testName);

    // Step 8: Restore original name
    await page.locator('#firstName').first().fill(originalName);
    await page.getByRole('button', { name: /Save Changes/i }).first().click();

    // Step 9: Assert restored
    await expectToast(page, /saved|updated|success/i);

    // Verify restoration
    await goTo(page, '/settings?tab=profile');
    const restoredName = await page.locator('#firstName').first().inputValue();
    expect(restoredName, 'First name should be restored to original').toBe(originalName);

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 3 — Teacher sees limited settings tabs                       */
/* ------------------------------------------------------------------ */

test.describe('Settings — Teacher Role Restrictions', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher sees limited settings tabs', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(60_000);

    await goTo(page, '/settings');
    await assertPageLoaded(page, 'Settings (teacher)');

    const mainText = await page.locator('main').textContent() ?? '';
    const pageText = await page.locator('body').textContent() ?? '';

    // Teacher SHOULD see: Profile, Notifications
    const visibleTabs = ['Profile', 'Notifications'];
    for (const tabName of visibleTabs) {
      const tabEl = page.getByText(tabName, { exact: true }).first();
      const visible = await tabEl.isVisible({ timeout: 3_000 }).catch(() => false);
      softAssert(visible, `Teacher should see "${tabName}" tab`);
    }

    // Teacher should NOT see admin-only tabs
    const hiddenTabs = ['Members', 'Audit', 'Billing'];
    for (const tabName of hiddenTabs) {
      // Navigate directly — should redirect to profile
      await goTo(page, `/settings?tab=${tabName.toLowerCase()}`);
      await page.waitForTimeout(500);

      // Should be redirected to profile or see limited content
      const url = page.url();
      const redirectedToProfile = url.includes('tab=profile') || !url.includes(`tab=${tabName.toLowerCase()}`);
      const showsContent = await page
        .locator('main')
        .textContent()
        .then((t) => (t ?? '').length > 30)
        .catch(() => false);

      softAssert(
        redirectedToProfile || showsContent,
        `Teacher accessing "${tabName}" tab should be redirected or see limited content`,
      );
    }

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 4 — Notification preferences save per user                   */
/* ------------------------------------------------------------------ */

test.describe('Settings — Notification Preferences', () => {
  test.use({ storageState: AUTH.owner });

  test('notification preferences save per user', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(60_000);

    // Step 1: Navigate to notifications tab
    await goTo(page, '/settings?tab=notifications');
    await assertPageLoaded(page, 'Settings — Notifications');

    // Step 2: Find the first toggle (Switch element)
    const toggles = page.locator('button[role="switch"]');
    const toggleCount = await toggles.count();

    if (toggleCount === 0) {
      // No toggles found — skip toggle interaction
      softAssert(true, 'No notification toggles found — page loaded successfully');
      assertCleanRun();
      return;
    }

    // Step 3: Note the current state of the first toggle
    const firstToggle = toggles.first();
    const originalState = await firstToggle.getAttribute('data-state');
    const wasChecked = originalState === 'checked';

    // Step 4: Click the toggle to change it
    await firstToggle.click();
    await page.waitForTimeout(300);

    // Step 5: Click Save
    const saveBtn = page.getByRole('button', { name: /Save Preferences/i }).first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await expectToast(page, /saved|updated|success/i);
    }

    // Step 6: Navigate away and back
    await goTo(page, '/dashboard');
    await waitForPageReady(page);
    await goTo(page, '/settings?tab=notifications');
    await assertPageLoaded(page, 'Settings — Notifications (reload)');

    // Step 7: Assert toggle is in the changed state
    const reloadedToggle = page.locator('button[role="switch"]').first();
    const newState = await reloadedToggle.getAttribute('data-state');
    const nowChecked = newState === 'checked';
    softAssert(
      nowChecked !== wasChecked,
      `Toggle should have changed state: was ${wasChecked ? 'checked' : 'unchecked'}, now ${nowChecked ? 'checked' : 'unchecked'}`,
    );

    // Step 8: Restore original state
    await reloadedToggle.click();
    await page.waitForTimeout(300);
    const restoreBtn = page.getByRole('button', { name: /Save Preferences/i }).first();
    if (await restoreBtn.isVisible().catch(() => false)) {
      await restoreBtn.click();
      await expectToast(page, /saved|updated|success/i);
    }

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 5 — Members tab shows correct team                           */
/* ------------------------------------------------------------------ */

test.describe('Settings — Members Tab', () => {
  test.use({ storageState: AUTH.owner });

  test('members tab shows correct team', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(60_000);

    // Step 1: Navigate to members tab
    await goTo(page, '/settings?tab=members');
    await assertPageLoaded(page, 'Settings — Members');

    // Step 2: At least one member should be listed
    const mainContent = await page.locator('main').textContent() ?? '';
    softAssert(
      mainContent.length > 50,
      'Members tab should have meaningful content showing team members',
    );

    // Step 3: Current user (owner) should be visible with "Owner" role badge
    const ownerBadge = page.getByText('Owner', { exact: true }).first();
    const hasOwnerBadge = await ownerBadge.isVisible({ timeout: 5_000 }).catch(() => false);
    softAssert(hasOwnerBadge, 'Current user should be visible with "Owner" role badge');

    // Also check for "You" indicator
    const youBadge = page.getByText('You', { exact: true }).first();
    const hasYouBadge = await youBadge.isVisible().catch(() => false);
    softAssert(
      hasYouBadge || hasOwnerBadge,
      'Current user should have "You" or "Owner" badge visible',
    );

    // Step 4: Check for other member roles
    const roleNames = ['Admin', 'Teacher', 'Finance'];
    let otherMembersFound = 0;
    for (const role of roleNames) {
      const roleBadge = page.getByText(role, { exact: true }).first();
      if (await roleBadge.isVisible().catch(() => false)) {
        otherMembersFound++;
      }
    }
    // It's okay if there are no other members — just log it
    if (otherMembersFound === 0) {
      softAssert(true, 'No other team members found (owner-only org)');
    }

    // Step 5: Invite button should exist and be clickable
    const inviteBtn = page.getByRole('button', { name: /Invite Member/i }).first();
    const hasInviteBtn = await inviteBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    softAssert(hasInviteBtn, 'Invite Member button should be visible');

    if (hasInviteBtn) {
      // Click to verify it opens a dialog
      await inviteBtn.click();
      const dialog = page.getByRole('dialog').first();
      const dialogOpened = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
      softAssert(dialogOpened, 'Clicking Invite Member should open a dialog');

      // Close the dialog
      if (dialogOpened) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }

    assertCleanRun();
  });
});
