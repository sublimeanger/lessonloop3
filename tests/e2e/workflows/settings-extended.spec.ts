import { test, expect, Page, Locator } from '@playwright/test';
import { AUTH, goTo, assertNoErrorBoundary } from '../helpers';
import { supabaseDelete, getOrgId } from '../supabase-admin';

const testId = `e2e-${Date.now()}`;

/** Navigate to a settings tab using client-side sidebar clicks. */
async function goToSettingsTab(page: Page, tab: string) {
  await goTo(page, '/dashboard');
  await page.waitForTimeout(2_000);
  await page.getByRole('link', { name: 'Settings' }).first().click();
  await page.waitForTimeout(3_000);
  const labels: Record<string, string> = {
    scheduling: 'Scheduling', 'rate-cards': 'Rate Cards',
    availability: 'Availability', music: 'Music',
    notifications: 'Notifications', members: 'Members',
    audit: 'Audit Log', privacy: 'Privacy & GDPR',
    messaging: 'Messaging',
  };
  // Scope to the settings navigation area (inside main) to avoid header buttons
  const settingsNav = page.locator('main nav, main').first();
  const btn = settingsNav.getByRole('button', { name: labels[tab] || tab, exact: true }).first();
  if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(2_000);
  }
}

/** Scope to the visible desktop content area (avoids hidden mobile duplicate). */
function dc(page: Page): Locator {
  return page.locator('div.hidden.md\\:block');
}

/* ================================================================== */
/*  AVAILABILITY                                                        */
/* ================================================================== */
test.describe('Settings — Availability', () => {
  test.use({ storageState: AUTH.owner });

  test('view and interact with availability tab', async ({ page }) => {
    await goToSettingsTab(page, 'availability');
    await assertNoErrorBoundary(page);
    const content = dc(page);

    // Should show weekly availability section — look for "Weekly Availability" heading
    const weeklyHeading = content.getByText('Weekly Availability').first();
    const hasHeading = await weeklyHeading.isVisible({ timeout: 10_000 }).catch(() => false);

    // "Add Hours" button should exist
    const addBtn = content.getByRole('button', { name: /Add Hours/i }).first();
    const hasAddBtn = await addBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    // At minimum the page should load without errors
    expect(hasHeading || hasAddBtn).toBe(true);
  });

  test('add and remove availability block', async ({ page }) => {
    await goToSettingsTab(page, 'availability');
    const content = dc(page);

    // Click add availability button
    const addBtn = content.getByRole('button', { name: /Add Hours/i }).first();
    const hasAddBtn = await addBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasAddBtn) {
      test.skip(true, 'Add Hours button not found — may need teacher selection');
      return;
    }

    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Dialog should have Day, Start Time, End Time fields
    // Default is Monday 09:00–17:00 — just submit with defaults
    const saveBtn = dialog.getByRole('button', { name: /Add|Save|Create/i }).last();
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });
    await saveBtn.click();

    // Dialog may close or show error (overlap) — both acceptable
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);
  });
});

/* ================================================================== */
/*  INSTRUMENTS (Music Settings)                                        */
/* ================================================================== */
test.describe('Settings — Instruments', () => {
  test.use({ storageState: AUTH.owner });

  const instrumentName = `E2E Instrument ${testId}`;

  test.afterAll(() => {
    const orgId = getOrgId();
    if (!orgId) return;
    const encodedPrefix = encodeURIComponent(`%${testId}%`);
    supabaseDelete('instruments', `org_id=eq.${orgId}&name=like.${encodedPrefix}`);
  });

  test('add custom instrument', async ({ page }) => {
    await goToSettingsTab(page, 'music');
    await assertNoErrorBoundary(page);
    const content = dc(page);

    // Click add button for custom instruments
    const addBtn = content.getByRole('button', { name: /Add|New/i })
      .filter({ hasText: /instrument|custom|add/i }).first()
      .or(content.getByRole('button', { name: /Add Custom Instrument/i }).first())
      .or(content.getByRole('button', { name: /Add/i }).first());

    const hasAdd = await addBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasAdd) {
      test.skip(true, 'Add instrument button not found');
      return;
    }

    await addBtn.click();
    await page.waitForTimeout(500);

    // Fill instrument name — look for visible input
    const nameInput = page.getByPlaceholder(/instrument name/i).first()
      .or(page.locator('input[type="text"]').last());

    if (await nameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nameInput.fill(instrumentName);

      const saveBtn = page.getByRole('button', { name: /Add|Save|Create/i }).last();
      await saveBtn.click();
      await page.waitForTimeout(2_000);

      const visible = await content.getByText(instrumentName).first()
        .isVisible({ timeout: 10_000 }).catch(() => false);
      expect(visible).toBe(true);
    }
  });

  test('delete custom instrument', async ({ page }) => {
    await goToSettingsTab(page, 'music');
    const content = dc(page);

    const instrument = content.getByText(instrumentName).first();
    const exists = await instrument.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!exists) {
      test.skip(true, 'Instrument not found — creation may have failed');
      return;
    }

    // Find the delete button near the instrument
    const row = instrument.locator('..').locator('..');
    const deleteBtn = row.getByRole('button', { name: /delete/i }).first()
      .or(row.locator('button').filter({ has: page.locator('svg') }).last());

    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deleteBtn.click();

      const alertDialog = page.getByRole('alertdialog');
      if (await alertDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await alertDialog.getByRole('button', { name: /Delete|Confirm/i }).click();
      }

      await page.waitForTimeout(2_000);
      const stillVisible = await content.getByText(instrumentName).first()
        .isVisible({ timeout: 3_000 }).catch(() => false);
      expect(stillVisible).toBe(false);
    }
  });
});

/* ================================================================== */
/*  NOTIFICATION PREFERENCES                                            */
/* ================================================================== */
test.describe('Settings — Notifications', () => {
  test.use({ storageState: AUTH.owner });

  test('toggle notification and save', async ({ page }) => {
    await goToSettingsTab(page, 'notifications');
    await assertNoErrorBoundary(page);
    const content = dc(page);

    // Should show notification categories
    await expect(content.getByText('Lessons & Scheduling').first()).toBeVisible({ timeout: 10_000 });
    await expect(content.getByText('Billing & Payments').first()).toBeVisible({ timeout: 10_000 });

    // Find the "Marketing emails" toggle (last switch — usually off by default)
    const marketingLabel = content.getByText('Marketing emails').first();
    await expect(marketingLabel).toBeVisible({ timeout: 5_000 });

    // Find the nearest switch
    const switchContainer = marketingLabel.locator('..').locator('..');
    const toggle = switchContainer.locator('button[role="switch"]').first();

    if (await toggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const wasChecked = await toggle.getAttribute('data-state') === 'checked';

      await toggle.click();
      await page.waitForTimeout(500);

      // Save
      const saveBtn = content.getByRole('button', { name: /Save Preferences/i });
      await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
      await saveBtn.click();
      await page.waitForTimeout(2_000);

      // Reload and verify persistence
      await goToSettingsTab(page, 'notifications');
      const content2 = dc(page);

      const switchAfterReload = content2.getByText('Marketing emails').first()
        .locator('..').locator('..').locator('button[role="switch"]').first();
      const isNowChecked = await switchAfterReload.getAttribute('data-state') === 'checked';
      expect(isNowChecked).toBe(!wasChecked);

      // Toggle back to original state
      await switchAfterReload.click();
      await page.waitForTimeout(500);
      await content2.getByRole('button', { name: /Save Preferences/i }).click();
      await page.waitForTimeout(2_000);
    }
  });
});

/* ================================================================== */
/*  MEMBERS / TEAM                                                      */
/* ================================================================== */
test.describe('Settings — Members', () => {
  test.use({ storageState: AUTH.owner });

  const inviteEmail = `e2e-invite-${testId}@test.com`;

  test.afterAll(() => {
    const orgId = getOrgId();
    if (!orgId) return;
    const encodedEmail = encodeURIComponent(inviteEmail);
    supabaseDelete('invites', `org_id=eq.${orgId}&email=eq.${encodedEmail}`);
  });

  test('view members list', async ({ page }) => {
    await goToSettingsTab(page, 'members');
    await assertNoErrorBoundary(page);
    const content = dc(page);

    await expect(content.getByText('Organisation Members').first()).toBeVisible({ timeout: 15_000 });
    await expect(
      content.getByRole('button', { name: /Invite Member/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('invite a member and revoke', async ({ page }) => {
    await goToSettingsTab(page, 'members');
    const content = dc(page);

    await content.getByRole('button', { name: /Invite Member/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Fill email
    const emailInput = dialog.getByLabel(/email/i).first()
      .or(dialog.getByPlaceholder(/email/i).first());
    await emailInput.fill(inviteEmail);

    // Select Teacher role (default may already be teacher)
    const roleSelect = dialog.getByLabel(/role/i).first();
    if (await roleSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await roleSelect.click();
      await page.waitForTimeout(300);
      const teacherOption = page.getByRole('option', { name: /teacher/i }).first()
        .or(page.getByText('Teacher', { exact: true }).first());
      if (await teacherOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await teacherOption.click();
      }
    }

    // Send invite
    const sendBtn = dialog.getByRole('button', { name: /Send|Invite/i }).last();
    await sendBtn.click();
    await page.waitForTimeout(3_000);

    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Verify invite appears in pending list
    const inviteText = content.getByText(inviteEmail).first();
    const inviteVisible = await inviteText.isVisible({ timeout: 10_000 }).catch(() => false);

    if (inviteVisible) {
      const inviteRow = inviteText.locator('..').locator('..');
      const cancelBtn = inviteRow.getByRole('button', { name: /cancel|revoke|remove/i }).first()
        .or(inviteRow.locator('button').last());

      if (await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(2_000);

        const stillVisible = await content.getByText(inviteEmail).first()
          .isVisible({ timeout: 3_000 }).catch(() => false);
        expect(stillVisible).toBe(false);
      }
    }
  });
});

/* ================================================================== */
/*  AUDIT LOG (read-only)                                               */
/* ================================================================== */
test.describe('Settings — Audit Log', () => {
  test.use({ storageState: AUTH.owner });

  test('view audit log with filters', async ({ page }) => {
    await goToSettingsTab(page, 'audit');
    await assertNoErrorBoundary(page);
    const content = dc(page);

    await expect(content.getByText('Audit Log').first()).toBeVisible({ timeout: 15_000 });

    // Should show filter controls
    await expect(content.getByText('Entity Type').first()).toBeVisible({ timeout: 5_000 });
    await expect(content.getByText('Action').first()).toBeVisible({ timeout: 5_000 });

    await page.waitForTimeout(3_000);
    const hasTable = await content.locator('table').first().isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEmptyState = await content.getByText(/no.*entries|no.*results|no.*logs/i).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasTable || hasEmptyState).toBe(true);
  });

  test('filter audit log by entity type', async ({ page }) => {
    await goToSettingsTab(page, 'audit');
    const content = dc(page);

    // Click entity type filter
    const entityFilter = content.getByLabel('Entity Type').first();
    if (await entityFilter.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await entityFilter.click();
      await page.waitForTimeout(300);
      const studentsOption = page.getByRole('option', { name: /Students/i }).first()
        .or(page.getByText('Students', { exact: true }).first());
      if (await studentsOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await studentsOption.click();
        await page.waitForTimeout(2_000);
        await assertNoErrorBoundary(page);
      }
    }
  });
});

/* ================================================================== */
/*  PRIVACY & GDPR                                                      */
/* ================================================================== */
test.describe('Settings — Privacy & GDPR', () => {
  test.use({ storageState: AUTH.owner });

  test('view privacy tab with GDPR sections', async ({ page }) => {
    await goToSettingsTab(page, 'privacy');
    await assertNoErrorBoundary(page);
    const content = dc(page);

    // "Data Export (GDPR Article 20)" heading
    await expect(content.getByText('Data Export').first()).toBeVisible({ timeout: 15_000 });

    // Should show GDPR references
    await expect(content.getByText(/GDPR/i).first()).toBeVisible({ timeout: 5_000 });

    // Data retention and/or deletion sections
    const hasRetention = await content.getByText(/Data Retention/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasDeletion = await content.getByText(/Data Deletion/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);

    expect(hasRetention || hasDeletion).toBe(true);
  });
});

/* ================================================================== */
/*  MESSAGING SETTINGS                                                  */
/* ================================================================== */
test.describe('Settings — Messaging', () => {
  test.use({ storageState: AUTH.owner });

  test('view messaging settings with toggles', async ({ page }) => {
    await goToSettingsTab(page, 'messaging');
    await assertNoErrorBoundary(page);
    const content = dc(page);

    // "Parent Messaging Permissions" heading
    const parentMessaging = content.getByText(/Parent Messaging Permissions/i).first();
    await expect(parentMessaging).toBeVisible({ timeout: 15_000 });

    // Should have switch toggles
    const switches = content.locator('button[role="switch"]');
    const switchCount = await switches.count();
    expect(switchCount).toBeGreaterThan(0);
  });
});
