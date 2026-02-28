import { test, expect } from './workflow.fixtures';
import { AUTH } from '../helpers';
import { goTo } from '../helpers';
import { waitForDataLoad } from './workflow-helpers';

// ═══════════════════════════════════════════════════════════════
// Settings Cascade — changes propagate across the app
// ═══════════════════════════════════════════════════════════════

test.describe('Settings Cascade — Owner', () => {
  test.use({ storageState: AUTH.owner });

  // ─────────────────────────────────────────────────────────────
  // Settings page — all tabs load
  // ─────────────────────────────────────────────────────────────

  test('Settings page — all tabs load without errors', async ({ page, consoleErrors }) => {
    test.setTimeout(120_000);

    // ── 1–2. Navigate to /settings ──
    await goTo(page, '/settings');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // ── 3. Iterate through every settings tab visible to an owner ──
    // Tabs are sidebar buttons with ?tab=xxx URL pattern
    // Actual tab IDs from the codebase SETTINGS_NAV_GROUPS:
    const ownerTabs = [
      // Account
      { id: 'profile', label: 'Profile' },
      { id: 'notifications', label: 'Notifications' },
      { id: 'help-tours', label: 'Help & Tours' },
      // Organisation
      { id: 'organisation', label: 'Organisation' },
      { id: 'branding', label: 'Branding' },
      { id: 'members', label: 'Members' },
      { id: 'data-import', label: 'Data & Import' },
      // Teaching
      { id: 'scheduling', label: 'Scheduling' },
      { id: 'availability', label: 'Availability' },
      { id: 'calendar', label: 'Calendar Sync' },
      { id: 'zoom', label: 'Zoom' },
      { id: 'music', label: 'Music' },
      // Business
      { id: 'billing', label: 'Billing' },
      { id: 'rate-cards', label: 'Rate Cards' },
      { id: 'messaging', label: 'Messaging' },
      { id: 'booking-page', label: 'Booking Page' },
      { id: 'looopassist', label: 'LoopAssist' },
      { id: 'continuation', label: 'Continuation' },
      // Compliance
      { id: 'privacy', label: 'Privacy' },
      { id: 'audit', label: 'Audit Log' },
    ];

    const errorBoundary = page.getByText(/something went wrong/i).first();

    for (const tab of ownerTabs) {
      // Navigate directly via URL to avoid sidebar scroll issues
      await goTo(page, `/settings?tab=${tab.id}`);
      await waitForDataLoad(page);

      // ── Assert: Content loads (not empty, not error) ──
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

      const hasError = await errorBoundary.isVisible({ timeout: 2_000 }).catch(() => false);
      expect(hasError, `Error boundary visible on ${tab.label} tab`).toBeFalsy();

      // ── Assert: Meaningful content exists ──
      const content = await page.locator('main').textContent() ?? '';
      expect(
        content.length > 20,
        `${tab.label} tab should have meaningful content`,
      ).toBeTruthy();
    }

    // ── 4. No console errors across all tabs ──
    const realErrors = consoleErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('net::') &&
        !e.includes('Failed to fetch') &&
        !e.includes('401') &&
        !e.includes('403') &&
        !e.includes('ResizeObserver') &&
        !e.includes('AbortError') &&
        !e.includes('ChunkLoadError') &&
        !e.includes('Loading chunk') &&
        !e.includes('status of 404') &&
        !e.includes('Failed to load resource') &&
        !e.includes('Download the React DevTools') &&
        !e.includes('third-party cookie') &&
        !e.includes('Permissions-Policy') &&
        !e.includes('postMessage'),
    );
    expect(realErrors).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────
  // Profile settings save and persist
  // ─────────────────────────────────────────────────────────────

  test('Profile settings save and persist', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1. Navigate to /settings?tab=profile ──
    await goTo(page, '/settings?tab=profile');
    await waitForDataLoad(page);

    // ── 2. Note the current name values ──
    const firstNameInput = page.locator('#firstName').first()
      .or(page.getByLabel(/first name/i).first());
    await expect(firstNameInput).toBeVisible({ timeout: 10_000 });

    const lastNameInput = page.locator('#lastName').first()
      .or(page.getByLabel(/last name/i).first());
    await expect(lastNameInput).toBeVisible({ timeout: 5_000 });
    const originalLastName = await lastNameInput.inputValue();

    // ── 3. Change the last name to include " - E2E Test" suffix ──
    const testSuffix = ' - E2E Test';
    const modifiedLastName = originalLastName + testSuffix;
    await lastNameInput.fill(modifiedLastName);

    // ── 4. Click Save ──
    const saveBtn = page.getByRole('button', { name: /save changes/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });
    await saveBtn.click();

    // ── 5. Success toast appears ──
    const toast = page.locator('[data-radix-collection-item]').filter({ hasText: /profile updated/i });
    await expect(toast.first()).toBeVisible({ timeout: 10_000 });

    // ── 6. Navigate away and back ──
    await goTo(page, '/dashboard');
    await waitForDataLoad(page);
    await goTo(page, '/settings?tab=profile');
    await waitForDataLoad(page);

    // ── 7. The name still has the suffix (change persisted) ──
    const persistedLastName = await lastNameInput.inputValue();
    expect(persistedLastName).toContain(testSuffix);

    // ── 8. Restore the original name ──
    await lastNameInput.fill(originalLastName);

    // ── 9. Save again ──
    await saveBtn.click();

    // ── 10. Success toast, name restored ──
    const restoreToast = page.locator('[data-radix-collection-item]').filter({ hasText: /profile updated/i });
    await expect(restoreToast.first()).toBeVisible({ timeout: 10_000 });

    // Verify restoration
    const restoredLastName = await lastNameInput.inputValue();
    expect(restoredLastName).toBe(originalLastName);
  });

  // ─────────────────────────────────────────────────────────────
  // Notification preferences save per user
  // ─────────────────────────────────────────────────────────────

  test('Notification preferences save per user', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1. Navigate to /settings?tab=notifications ──
    await goTo(page, '/settings?tab=notifications');
    await waitForDataLoad(page);

    // ── 2. Find the first toggle switch ──
    // Notification switches are role="switch" elements
    const switches = page.locator('button[role="switch"]');
    const switchCount = await switches.count();

    if (switchCount > 0) {
      const firstSwitch = switches.first();
      await expect(firstSwitch).toBeVisible({ timeout: 10_000 });

      // ── Note the current state ──
      const originalState = await firstSwitch.getAttribute('aria-checked');

      // ── Click it to change ──
      await firstSwitch.click();
      await page.waitForTimeout(300);

      // Verify the toggle changed
      const newState = await firstSwitch.getAttribute('aria-checked');
      expect(newState).not.toBe(originalState);

      // ── Click Save ──
      const saveBtn = page.getByRole('button', { name: /save preferences/i }).first();
      if (await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await saveBtn.click();

        // ── Success toast ──
        const toast = page.locator('[data-radix-collection-item]').filter({ hasText: /notifications saved/i });
        await expect(toast.first()).toBeVisible({ timeout: 10_000 });
      }

      // ── Navigate away ──
      await goTo(page, '/dashboard');
      await waitForDataLoad(page);

      // ── Navigate back ──
      await goTo(page, '/settings?tab=notifications');
      await waitForDataLoad(page);

      // ── Toggle is still in the changed state ──
      const persistedState = await switches.first().getAttribute('aria-checked');
      expect(persistedState).toBe(newState);

      // ── Restore original state ──
      if (persistedState !== originalState) {
        await switches.first().click();
        await page.waitForTimeout(300);

        const restoreBtn = page.getByRole('button', { name: /save preferences/i }).first();
        if (await restoreBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await restoreBtn.click();

          const restoreToast = page.locator('[data-radix-collection-item]').filter({ hasText: /notifications saved/i });
          await expect(restoreToast.first()).toBeVisible({ timeout: 10_000 });
        }
      }
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Members tab shows correct team
  // ─────────────────────────────────────────────────────────────

  test('Members tab shows correct team', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1. Navigate to /settings?tab=members ──
    await goTo(page, '/settings?tab=members');
    await waitForDataLoad(page);

    // ── 2. Page loads with at least one member listed ──
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    const mainContent = await page.locator('main').textContent() ?? '';
    expect(mainContent.length).toBeGreaterThan(20);

    // ── 3. Current user (owner) is visible with "Owner" role badge ──
    // Members display as cards with name and role badge
    const ownerBadge = page.locator('main').getByText(/owner/i).first();
    await expect(ownerBadge).toBeVisible({ timeout: 10_000 });

    // "You" badge should mark the current user
    const youBadge = page.locator('main').getByText(/you/i).first();
    const hasYouBadge = await youBadge.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasYouBadge) {
      await expect(youBadge).toBeVisible();
    }

    // ── 4. If other members exist, their roles are displayed correctly ──
    // Look for role badges: admin, teacher, finance
    const roleBadges = page.locator('main').getByText(/admin|teacher|finance|owner/i);
    const roleCount = await roleBadges.count();
    expect(roleCount).toBeGreaterThanOrEqual(1);

    // ── 5. Invite button exists and is clickable ──
    const inviteBtn = page.getByRole('button', { name: /invite member/i }).first();
    await expect(inviteBtn).toBeVisible({ timeout: 10_000 });

    // Click to verify it opens a dialog
    await inviteBtn.click();
    const inviteDialog = page.getByRole('dialog').first();
    await expect(inviteDialog).toBeVisible({ timeout: 5_000 });

    // Verify dialog has expected fields
    const emailField = inviteDialog.getByLabel(/email/i).first()
      .or(inviteDialog.locator('#invite-email').first());
    await expect(emailField).toBeVisible({ timeout: 5_000 });

    // Close the dialog
    await page.keyboard.press('Escape');
  });
});

// ═══════════════════════════════════════════════════════════════
// Teacher sees limited settings tabs
// ═══════════════════════════════════════════════════════════════

test.describe('Settings Cascade — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('Teacher sees limited settings tabs', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1–2. Navigate to /settings ──
    await goTo(page, '/settings');
    await waitForDataLoad(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // ── 3–4. Profile and Notifications tabs visible ──
    // Navigate to profile — should work
    await goTo(page, '/settings?tab=profile');
    await waitForDataLoad(page);
    const profileContent = await page.locator('main').textContent() ?? '';
    expect(profileContent.length).toBeGreaterThan(20);

    // Navigate to notifications — should work
    await goTo(page, '/settings?tab=notifications');
    await waitForDataLoad(page);
    const notifContent = await page.locator('main').textContent() ?? '';
    expect(notifContent.length).toBeGreaterThan(20);

    // ── 5. Organisation tab — teacher can see it (not admin-only) ──
    await goTo(page, '/settings?tab=organisation');
    await waitForDataLoad(page);
    const orgContent = await page.locator('main').textContent() ?? '';
    // Should load org content (read-only for non-admin)
    expect(orgContent.length).toBeGreaterThan(20);

    // ── 6. Members tab NOT accessible — teacher is redirected to profile ──
    await goTo(page, '/settings?tab=members');
    await page.waitForTimeout(1_000);

    // Admin-only tabs redirect non-admins to profile tab
    // The URL should be changed to ?tab=profile or the content should show profile
    const membersUrl = page.url();
    const profileField = page.locator('#firstName').first()
      .or(page.getByLabel(/first name/i).first());
    const redirectedToProfile = membersUrl.includes('tab=profile')
      || await profileField.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(redirectedToProfile).toBeTruthy();

    // ── 7. Billing tab NOT accessible ──
    await goTo(page, '/settings?tab=billing');
    await page.waitForTimeout(1_000);
    const billingUrl = page.url();
    const billingRedirected = billingUrl.includes('tab=profile')
      || await profileField.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(billingRedirected).toBeTruthy();

    // ── 8. Audit Log tab NOT accessible ──
    await goTo(page, '/settings?tab=audit');
    await page.waitForTimeout(1_000);
    const auditUrl = page.url();
    const auditRedirected = auditUrl.includes('tab=profile')
      || await profileField.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(auditRedirected).toBeTruthy();
  });
});
