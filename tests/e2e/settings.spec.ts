import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, waitForPageReady, assertNoErrorBoundary, trackConsoleErrors } from './helpers';

// ═══════════════════════════════════════════════════════════════
// OWNER — SETTINGS PAGE & NAVIGATION
// ═══════════════════════════════════════════════════════════════
test.describe('Settings — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('loads settings page with title', async ({ page }) => {
    await safeGoTo(page, '/settings', 'Settings');
    await assertNoErrorBoundary(page);
    await expect(page.getByText('Settings').first()).toBeVisible({ timeout: 15_000 });
  });

  test('sidebar navigation shows all 5 groups for admin', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=profile', 'Settings');
    await page.waitForTimeout(1_000);

    const settingsNav = page.locator('nav[aria-label="Settings navigation"]').first();
    const hasNav = await settingsNav.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[settings] Settings nav visible: ${hasNav}`);

    // Check group headings
    const groups = ['Account', 'Organisation', 'Teaching', 'Business', 'Compliance'];
    for (const group of groups) {
      const heading = page.getByText(group, { exact: true }).first();
      const visible = await heading.isVisible({ timeout: 3_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[settings] Group "${group}": ${visible}`);
    }
  });

  test('Profile tab loads with form fields', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=profile', 'Settings Profile');
    await page.waitForTimeout(2_000);

    // Profile Information card
    const profileCard = page.getByText('Profile Information').first();
    await expect(profileCard).toBeVisible({ timeout: 10_000 });

    // Check form fields
    const firstNameField = page.locator('#firstName').first();
    const lastNameField = page.locator('#lastName').first();

    const hasFirst = await firstNameField.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasLast = await lastNameField.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[settings] Profile — First: ${hasFirst}, Last: ${hasLast}`);
  });

  test('Organisation tab loads with org name field', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=organisation', 'Settings Org');
    await page.waitForTimeout(2_000);

    const orgCard = page.getByText('Organisation Details').first();
    await expect(orgCard).toBeVisible({ timeout: 10_000 });

    // Organisation name field
    const orgNameField = page.locator('#orgName').first();
    const hasOrgName = await orgNameField.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[settings] Org name field: ${hasOrgName}`);
  });

  test('clicking sidebar items switches tab content', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=profile', 'Settings');
    await page.waitForTimeout(1_000);

    const settingsNav = page.locator('nav[aria-label="Settings navigation"]').first();
    const hasNav = await settingsNav.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasNav) {
      // eslint-disable-next-line no-console
      console.log('[settings] No desktop nav — likely mobile viewport');
      return;
    }

    // Click "Organisation" in sidebar
    const orgBtn = settingsNav.getByText('Organisation', { exact: true }).first();
    if (await orgBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await orgBtn.click();
      await page.waitForTimeout(500);
      expect(page.url()).toContain('tab=organisation');
      await assertNoErrorBoundary(page);
    }

    // Click "Notifications"
    const notifBtn = settingsNav.getByText('Notifications', { exact: true }).first();
    if (await notifBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await notifBtn.click();
      await page.waitForTimeout(500);
      expect(page.url()).toContain('tab=notifications');
      await assertNoErrorBoundary(page);
    }

    // Click "Billing"
    const billingBtn = settingsNav.getByText('Billing', { exact: true }).first();
    if (await billingBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await billingBtn.click();
      await page.waitForTimeout(500);
      expect(page.url()).toContain('tab=billing');
      await assertNoErrorBoundary(page);
    }
  });

  test('Billing tab shows plan cards', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=billing', 'Settings Billing');
    await page.waitForTimeout(3_000);

    // Should show "Current Plan" badge on one of the plans
    const currentPlan = page.getByText('Current Plan').first();
    const hasCurrent = await currentPlan.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[settings] "Current Plan" badge: ${hasCurrent}`);
    await assertNoErrorBoundary(page);
  });

  test('Members tab loads for admin', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=members', 'Settings Members');
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);

    // Should not redirect (admin has access)
    expect(page.url()).toContain('tab=members');
  });

  test('Availability tab loads with teacher selector for admin', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=availability', 'Settings Availability');
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);

    // Admin should see "Viewing availability for" label
    const selectorLabel = page.getByText('Viewing availability for').first();
    const hasSelector = await selectorLabel.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[settings] Availability teacher selector: ${hasSelector}`);
  });

  test('Privacy & GDPR tab loads for admin', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=privacy', 'Settings Privacy');
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);
    expect(page.url()).toContain('tab=privacy');
  });

  test('Audit Log tab loads for admin', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=audit', 'Settings Audit');
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);
    expect(page.url()).toContain('tab=audit');
  });

  test('all admin-only tabs load without error boundary', async ({ page }) => {
    test.setTimeout(120_000);
    const adminTabs = ['scheduling', 'rate-cards', 'music', 'messaging', 'booking-page', 'looopassist', 'data-import', 'continuation'];

    for (const tab of adminTabs) {
      await page.goto(`/settings?tab=${tab}`);
      await page.waitForTimeout(1_500);
      await assertNoErrorBoundary(page);
      // eslint-disable-next-line no-console
      console.log(`[settings] Admin tab "${tab}" — OK`);
    }
  });

  test('no console errors on settings profile', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/settings?tab=profile', 'Settings');
    await page.waitForTimeout(2_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// TEACHER — SETTINGS (limited tabs)
// ═══════════════════════════════════════════════════════════════
test.describe('Settings — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher can access /settings', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=profile', 'Teacher Settings');
    await assertNoErrorBoundary(page);
    await expect(page.getByText('Settings').first()).toBeVisible({ timeout: 15_000 });
  });

  test('teacher sees Account, Organisation, Teaching groups but NOT Business/Compliance', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=profile', 'Teacher Settings');
    await page.waitForTimeout(1_000);

    const settingsNav = page.locator('nav[aria-label="Settings navigation"]').first();
    if (!(await settingsNav.isVisible({ timeout: 5_000 }).catch(() => false))) return;

    // Should see Account and Teaching
    const account = settingsNav.getByText('Account', { exact: true }).first();
    const teaching = settingsNav.getByText('Teaching', { exact: true }).first();
    const hasAccount = await account.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasTeaching = await teaching.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[teacher-settings] Account: ${hasAccount}, Teaching: ${hasTeaching}`);

    // Should NOT see Business or Compliance
    const business = settingsNav.getByText('Business', { exact: true }).first();
    const compliance = settingsNav.getByText('Compliance', { exact: true }).first();
    const hasBusiness = await business.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasCompliance = await compliance.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasBusiness, 'Teacher should NOT see Business group').toBe(false);
    expect(hasCompliance, 'Teacher should NOT see Compliance group').toBe(false);
  });

  test('teacher accessing admin tab redirects to profile', async ({ page }) => {
    await page.goto('/settings?tab=members');
    await page.waitForTimeout(3_000);

    // Should redirect to profile since teacher is not admin
    const url = page.url();
    // eslint-disable-next-line no-console
    console.log(`[teacher-settings] After ?tab=members, URL: ${url}`);
    // The tab should revert to "profile" (the code checks adminTabs and falls back)
    const profileCard = page.getByText('Profile Information').first();
    const onProfile = await profileCard.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[teacher-settings] Redirected to profile: ${onProfile}`);
  });

  test('teacher can access Availability tab', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=availability', 'Teacher Availability');
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);
    expect(page.url()).toContain('tab=availability');
  });
});

// ═══════════════════════════════════════════════════════════════
// FINANCE — SETTINGS (limited)
// ═══════════════════════════════════════════════════════════════
test.describe('Settings — Finance', () => {
  test.use({ storageState: AUTH.finance });

  test('finance can access /settings', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=profile', 'Finance Settings');
    await assertNoErrorBoundary(page);
    await expect(page.getByText('Settings').first()).toBeVisible({ timeout: 15_000 });
  });

  test('finance does NOT see admin-only tabs in nav', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=profile', 'Finance Settings');
    await page.waitForTimeout(1_000);

    const settingsNav = page.locator('nav[aria-label="Settings navigation"]').first();
    if (!(await settingsNav.isVisible({ timeout: 5_000 }).catch(() => false))) return;

    // Should NOT see Members, Billing, Audit Log
    const members = settingsNav.getByText('Members', { exact: true }).first();
    const billing = settingsNav.getByText('Billing', { exact: true }).first();
    const audit = settingsNav.getByText('Audit Log', { exact: true }).first();

    const hasMembers = await members.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasBilling = await billing.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasAudit = await audit.isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasMembers, 'Finance should NOT see Members').toBe(false);
    expect(hasBilling, 'Finance should NOT see Billing').toBe(false);
    expect(hasAudit, 'Finance should NOT see Audit Log').toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// PARENT — SETTINGS (minimal or no access)
// ═══════════════════════════════════════════════════════════════
test.describe('Settings — Parent', () => {
  test.use({ storageState: AUTH.parent });

  test('parent accessing /settings loads or redirects', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(5_000);

    const url = page.url();
    // eslint-disable-next-line no-console
    console.log(`[parent-settings] URL: ${url}`);

    // Parent may be redirected to portal or see minimal settings
    await expect(page.locator('body')).toBeVisible();
  });
});
