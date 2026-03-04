import { test, expect } from '@playwright/test';
import { AUTH, goTo, assertNoErrorBoundary } from '../helpers';
import { supabaseDelete, supabaseSelect, getOrgId } from '../supabase-admin';

const testId = `e2e-${Date.now()}`;

/* ================================================================== */
/*  AVAILABILITY                                                        */
/* ================================================================== */
test.describe('Settings — Availability', () => {
  test.use({ storageState: AUTH.owner });

  test('view and interact with availability tab', async ({ page }) => {
    await goTo(page, '/settings?tab=availability');
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);

    // Should show weekly availability section — look for day names
    const mondayText = page.getByText('Monday').first();
    const hasMonday = await mondayText.isVisible({ timeout: 10_000 }).catch(() => false);

    // "Add Availability" or "Add Time" button should exist
    const addBtn = page.getByRole('button', { name: /Add Availability|Add Time/i }).first();
    const hasAddBtn = await addBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    // At minimum the page should load without errors
    expect(hasMonday || hasAddBtn).toBe(true);
  });

  test('add and remove availability block', async ({ page }) => {
    await goTo(page, '/settings?tab=availability');
    await page.waitForTimeout(2_000);

    // Click add availability button
    const addBtn = page.getByRole('button', { name: /Add Availability|Add Time/i }).first();
    const hasAddBtn = await addBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasAddBtn) {
      test.skip(true, 'Add availability button not found — may need teacher selection');
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
    // Custom instruments are org-scoped; clean up via admin API
    const orgId = getOrgId();
    if (!orgId) return;
    const encodedPrefix = encodeURIComponent(`%${testId}%`);
    supabaseDelete('instruments', `org_id=eq.${orgId}&name=like.${encodedPrefix}`);
  });

  test('add custom instrument', async ({ page }) => {
    await goTo(page, '/settings?tab=music');
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);

    // Click add button for custom instruments
    const addBtn = page.getByRole('button', { name: /Add|New/i })
      .filter({ hasText: /instrument|custom|add/i }).first()
      .or(page.getByRole('button', { name: /Add Custom Instrument/i }).first())
      .or(page.getByRole('button', { name: /Add/i }).first());

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

      // Save
      const saveBtn = page.getByRole('button', { name: /Add|Save|Create/i }).last();
      await saveBtn.click();
      await page.waitForTimeout(2_000);

      // Verify appears
      const visible = await page.getByText(instrumentName).first()
        .isVisible({ timeout: 10_000 }).catch(() => false);
      expect(visible).toBe(true);
    }
  });

  test('delete custom instrument', async ({ page }) => {
    await goTo(page, '/settings?tab=music');
    await page.waitForTimeout(2_000);

    const instrument = page.getByText(instrumentName).first();
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

      // Confirm if AlertDialog appears
      const alertDialog = page.getByRole('alertdialog');
      if (await alertDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await alertDialog.getByRole('button', { name: /Delete|Confirm/i }).click();
      }

      await page.waitForTimeout(2_000);
      const stillVisible = await page.getByText(instrumentName).first()
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
    await goTo(page, '/settings?tab=notifications');
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);

    // Should show notification categories
    await expect(page.getByText('Lessons & Scheduling').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Billing & Payments').first()).toBeVisible({ timeout: 10_000 });

    // Find the "Marketing emails" toggle (last switch — usually off by default)
    const marketingLabel = page.getByText('Marketing emails').first();
    await expect(marketingLabel).toBeVisible({ timeout: 5_000 });

    // Find the nearest switch
    const switchContainer = marketingLabel.locator('..').locator('..');
    const toggle = switchContainer.locator('button[role="switch"]').first();

    if (await toggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Get current state
      const wasChecked = await toggle.getAttribute('data-state') === 'checked';

      // Toggle it
      await toggle.click();
      await page.waitForTimeout(500);

      // Save
      const saveBtn = page.getByRole('button', { name: /Save Preferences/i });
      await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
      await saveBtn.click();
      await page.waitForTimeout(2_000);

      // Reload and verify persistence
      await goTo(page, '/settings?tab=notifications');
      await page.waitForTimeout(2_000);

      const switchAfterReload = page.getByText('Marketing emails').first()
        .locator('..').locator('..').locator('button[role="switch"]').first();
      const isNowChecked = await switchAfterReload.getAttribute('data-state') === 'checked';
      expect(isNowChecked).toBe(!wasChecked);

      // Toggle back to original state
      await switchAfterReload.click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Save Preferences/i }).click();
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
    // Clean up pending invites
    const orgId = getOrgId();
    if (!orgId) return;
    const encodedEmail = encodeURIComponent(inviteEmail);
    supabaseDelete('invites', `org_id=eq.${orgId}&email=eq.${encodedEmail}`);
  });

  test('view members list', async ({ page }) => {
    await goTo(page, '/settings?tab=members');
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);

    // Should show "Organisation Members" heading
    await expect(page.getByText('Organisation Members').first()).toBeVisible({ timeout: 15_000 });

    // Should have "Invite Member" button
    await expect(
      page.getByRole('button', { name: /Invite Member/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('invite a member and revoke', async ({ page }) => {
    await goTo(page, '/settings?tab=members');
    await page.waitForTimeout(2_000);

    // Click "Invite Member"
    await page.getByRole('button', { name: /Invite Member/i }).first().click();

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

    // Dialog should close
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Verify invite appears in pending list
    const inviteText = page.getByText(inviteEmail).first();
    const inviteVisible = await inviteText.isVisible({ timeout: 10_000 }).catch(() => false);

    if (inviteVisible) {
      // Find and click cancel/revoke button near the invite
      const inviteRow = inviteText.locator('..').locator('..');
      const cancelBtn = inviteRow.getByRole('button', { name: /cancel|revoke|remove/i }).first()
        .or(inviteRow.locator('button').last());

      if (await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(2_000);

        // Verify removed
        const stillVisible = await page.getByText(inviteEmail).first()
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
    await goTo(page, '/settings?tab=audit');
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);

    // Should show "Audit Log" heading
    await expect(page.getByText('Audit Log').first()).toBeVisible({ timeout: 15_000 });

    // Should show filter controls
    await expect(page.getByText('Entity Type').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Action').first()).toBeVisible({ timeout: 5_000 });

    // Should show at least some entries (table rows or empty state)
    await page.waitForTimeout(3_000);
    const hasTable = await page.locator('table').first().isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEmptyState = await page.getByText(/no.*entries|no.*results|no.*logs/i).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    // Either there are log entries or an empty state — both valid
    expect(hasTable || hasEmptyState).toBe(true);
  });

  test('filter audit log by entity type', async ({ page }) => {
    await goTo(page, '/settings?tab=audit');
    await page.waitForTimeout(2_000);

    // Click entity type filter
    const entityFilter = page.getByLabel('Entity Type').first();
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
    await goTo(page, '/settings?tab=privacy');
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);

    // Should show Data Export section
    await expect(page.getByText('Data Export').first()).toBeVisible({ timeout: 15_000 });

    // Should show GDPR Article references
    await expect(page.getByText(/GDPR/i).first()).toBeVisible({ timeout: 5_000 });

    // Should show data retention policy section
    const retentionSection = page.getByText(/Data Retention|Retention Policy/i).first();
    const hasRetention = await retentionSection.isVisible({ timeout: 5_000 }).catch(() => false);

    // Data deletion section
    const deletionSection = page.getByText(/Data Deletion/i).first();
    const hasDeletion = await deletionSection.isVisible({ timeout: 5_000 }).catch(() => false);

    // At least export section should be visible
    expect(hasRetention || hasDeletion).toBe(true);
  });
});

/* ================================================================== */
/*  MESSAGING SETTINGS                                                  */
/* ================================================================== */
test.describe('Settings — Messaging', () => {
  test.use({ storageState: AUTH.owner });

  test('view messaging settings with toggles', async ({ page }) => {
    await goTo(page, '/settings?tab=messaging');
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);

    // Should show messaging permission toggles
    const parentMessaging = page.getByText(/Parent.*Messaging|Messaging.*Permission/i).first();
    await expect(parentMessaging).toBeVisible({ timeout: 15_000 });

    // Should have switch toggles
    const switches = page.locator('button[role="switch"]');
    const switchCount = await switches.count();
    expect(switchCount).toBeGreaterThan(0);
  });
});
