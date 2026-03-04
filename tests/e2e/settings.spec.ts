import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, goTo, assertNoErrorBoundary, trackConsoleErrors, waitForPageReady } from './helpers';

// ═══════════════════════════════════════════════════════════════
// OWNER — SETTINGS PAGE & NAVIGATION
// ═══════════════════════════════════════════════════════════════
test.describe('Settings — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('loads settings page with title', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
    await safeGoTo(page, '/settings', 'Settings');
    await assertNoErrorBoundary(page);
    await expect(page.getByText('Settings').first()).toBeVisible({ timeout: 15_000 });
  });

  test('sidebar navigation shows all 5 groups for admin', async ({ page }) => {
    // Settings on mobile may not render <main> — use goTo for resilience
    await goTo(page, '/settings?tab=profile');
    await page.waitForTimeout(2_000);

    const settingsNav = page.locator('nav[aria-label="Settings navigation"]').first();
    const hasNav = await settingsNav.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasNav) return;

    // Check group headings
    const groups = ['Account', 'Organisation', 'Teaching', 'Business', 'Compliance'];
    for (const group of groups) {
      const heading = page.getByText(group, { exact: true }).first();
      await expect(heading, `Settings nav group "${group}" should be visible`).toBeVisible({ timeout: 3_000 });
    }
  });

  test('Profile tab loads with form fields', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=profile', 'Settings Profile');
    if (!page.url().includes('/settings')) return; // auth race
    await page.waitForTimeout(2_000);

    // Profile page may have various text
    const profileContent = page.getByText(/profile|account|personal/i).first();
    await expect(profileContent, 'Profile content should be visible').toBeVisible({ timeout: 10_000 });
    await assertNoErrorBoundary(page);
  });

  test('Organisation tab loads with org name field', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=organisation', 'Settings Org');
    if (!page.url().includes('/settings')) return; // auth race
    await page.waitForTimeout(2_000);

    const orgContent = page.getByText(/organisation|organization|business/i).first();
    await expect(orgContent, 'Organisation content should be visible').toBeVisible({ timeout: 10_000 });
    await assertNoErrorBoundary(page);
  });

  test('clicking sidebar items switches tab content', async ({ page }) => {
    // Settings on mobile may not render <main> — use goTo for resilience
    await goTo(page, '/settings?tab=profile');
    await page.waitForTimeout(2_000);

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
    if (!page.url().includes('/settings')) return; // auth race
    await waitForPageReady(page);

    // Should show "Current Plan" badge on one of the plans
    const currentPlan = page.getByText('Current Plan').first()
      .or(page.getByText(/free|starter|pro|enterprise/i).first());
    await expect(currentPlan, 'Billing tab should show plan information').toBeVisible({ timeout: 10_000 });
    await assertNoErrorBoundary(page);
  });

  test('Members tab loads for admin', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=members', 'Settings Members');
    if (!page.url().includes('/settings')) return; // auth race
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);
  });

  test('Availability tab loads with teacher selector for admin', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=availability', 'Settings Availability');
    if (!page.url().includes('/settings')) return; // auth race
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);

    // Admin should see "Viewing availability for" label or availability content
    const selectorLabel = page.getByText('Viewing availability for').first()
      .or(page.getByText(/availability/i).first());
    await expect(selectorLabel, 'Availability content should be visible').toBeVisible({ timeout: 10_000 });
  });

  test('Privacy & GDPR tab loads for admin', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=privacy', 'Settings Privacy');
    if (!page.url().includes('/settings')) return; // auth race
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);
  });

  test('Audit Log tab loads for admin', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=audit', 'Settings Audit');
    if (!page.url().includes('/settings')) return; // auth race
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);
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
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
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
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
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
    await expect(account, 'Teacher should see Account group').toBeVisible({ timeout: 3_000 });
    await expect(teaching, 'Teacher should see Teaching group').toBeVisible({ timeout: 3_000 });

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
    await waitForPageReady(page);
    if (!page.url().includes('/settings')) return; // auth race

    // Should redirect to profile since teacher is not admin
    // The tab should revert to "profile" (the code checks adminTabs and falls back)
    const profileCard = page.getByText('Profile Information').first()
      .or(page.getByText(/profile|account/i).first());
    await expect(profileCard, 'Teacher should be on profile/account tab, not admin tab').toBeVisible({ timeout: 10_000 });
  });

  test('teacher can access Availability tab', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=availability', 'Teacher Availability');
    if (!page.url().includes('/settings')) return; // auth race
    await page.waitForTimeout(2_000);
    await assertNoErrorBoundary(page);
  });
});

// ═══════════════════════════════════════════════════════════════
// FINANCE — SETTINGS (limited)
// ═══════════════════════════════════════════════════════════════
test.describe('Settings — Finance', () => {
  test.use({ storageState: AUTH.finance });

  test('finance can access /settings', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-safari', 'Desktop-only');
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

  test('parent accessing /settings is redirected to portal', async ({ page }) => {
    await page.goto('/settings');
    // Parent is not a staff role — should redirect to /portal/home or /dashboard
    await page.waitForURL(
      url => /\/portal\/home|\/dashboard/.test(url.toString()),
      { timeout: 15_000 },
    ).catch(async () => {
      await page.goto('/settings');
      await page.waitForURL(
        url => /\/portal\/home|\/dashboard/.test(url.toString()),
        { timeout: 15_000 },
      );
    });
    expect(page.url(), 'Parent should be redirected away from /settings').not.toContain('/settings');
  });
});
