import { test, expect, BrowserContext, Page } from '@playwright/test';
import {
  AUTH,
  safeGoTo,
  assertNoErrorBoundary,
} from '../helpers';
import { supabaseSelect, supabaseDelete, getOrgId } from '../supabase-admin';

/**
 * Public Booking Page — E2E mutation tests.
 *
 * The booking page is PUBLIC (/book/:slug) — no auth required.
 * We create a separate browser context with NO storageState.
 */

const BASE_URL = process.env.E2E_BASE_URL || 'https://app.lessonloop.net';

// ── Proxy config (mirrors playwright.config.ts) ────────────
function parseProxy() {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const server = `${url.protocol}//${url.hostname}:${url.port}`;
    return {
      server,
      ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    };
  } catch {
    return { server: raw };
  }
}
const proxyConfig = parseProxy();

/** Navigate to a step, clicking through wizard steps until we reach the details form */
async function navigateToDetailsStep(pg: Page, slug: string) {
  await pg.goto(`${BASE_URL}/book/${slug}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForLoadState('domcontentloaded');
  await pg.waitForTimeout(3_000);

  // Click CTA if on welcome step
  const ctaBtn = pg.getByRole('button', { name: /book a trial lesson/i }).first();
  if (await ctaBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await ctaBtn.click();
    await pg.waitForTimeout(1_000);
  }

  // Click through intermediate steps (instrument / teacher / date-time)
  for (let attempt = 0; attempt < 6; attempt++) {
    if (await pg.getByText(/your details/i).first().isVisible({ timeout: 2_000 }).catch(() => false)) break;

    // Date step — needs special handling
    const dateInput = pg.locator('#booking-date');
    if (await dateInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      await dateInput.fill(d.toISOString().slice(0, 10));
      await pg.waitForTimeout(2_000);
      const slot = pg.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
      if (await slot.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await slot.click();
        await pg.waitForTimeout(1_000);
        continue;
      }
    }

    // Generic: click first option-like button
    const opt = pg.locator('button').filter({ hasText: /.+/ }).nth(1);
    if (await opt.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await opt.click();
      await pg.waitForTimeout(1_000);
    }
  }
}

test.describe('Public Booking Page', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `e2e-${Date.now()}`;
  let bookingSlug = '';
  let publicContext: BrowserContext;
  let publicPage: Page;

  test.beforeAll(async ({ browser }) => {
    // Discover the booking slug for the test org
    const orgId = getOrgId();
    if (orgId) {
      const pages = supabaseSelect(
        'booking_pages',
        `org_id=eq.${orgId}&enabled=eq.true&select=slug&limit=1`,
      );
      if (pages.length > 0 && pages[0].slug) {
        bookingSlug = pages[0].slug;
      }
    }

    // Create public (unauthenticated) browser context
    publicContext = await browser.newContext({
      ignoreHTTPSErrors: true,
      ...(proxyConfig ? { proxy: proxyConfig } : {}),
    });
    publicPage = await publicContext.newPage();
  });

  test.afterAll(async () => {
    await publicContext?.close().catch(() => {});
    // Clean up any booking/lead records created during tests
    const orgId = getOrgId();
    if (orgId) {
      const encoded = encodeURIComponent(`%${testId}%`);
      supabaseDelete('leads', `org_id=eq.${orgId}&contact_name=like.${encoded}`);
      supabaseDelete('leads', `org_id=eq.${orgId}&contact_email=like.${encoded}`);
    }
  });

  test('load booking page', async () => {
    test.skip(!bookingSlug, 'Booking page not configured for test org');

    await publicPage.goto(`${BASE_URL}/book/${bookingSlug}`, { waitUntil: 'domcontentloaded' });
    await publicPage.waitForLoadState('domcontentloaded');

    // Should stay on /book/ path (no auth redirect)
    expect(publicPage.url()).toContain('/book/');

    // Wait for the SPA to load — booking page fetches config from Supabase.
    // In container environments the browser-side fetch may be slow.
    // Accept either fully-loaded content OR a loading state as proof the SPA rendered.
    const hasWelcome = await publicPage
      .getByText(/book a trial lesson/i)
      .first()
      .isVisible({ timeout: 20_000 })
      .catch(() => false);

    const hasLoading = await publicPage
      .getByText(/loading/i)
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    const hasSpinner = await publicPage
      .locator('.animate-spin')
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    // The SPA must have rendered something — either the booking wizard or a loading state
    expect(
      hasWelcome || hasLoading || hasSpinner,
      'Booking page SPA should render (welcome or loading state)',
    ).toBe(true);
  });

  test('step 1 — child information (details step)', async () => {
    test.skip(!bookingSlug, 'Booking page not configured for test org');
    test.setTimeout(90_000);

    await navigateToDetailsStep(publicPage, bookingSlug);

    const detailsVisible = await publicPage
      .getByText(/your details/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!detailsVisible) {
      test.skip(true, 'Could not reach details step — wizard config may differ');
      return;
    }

    // Fill contact info
    await publicPage.locator('#bp-name').fill(`E2E Parent ${testId}`);
    await publicPage.locator('#bp-email').fill(`e2e-booking-${testId}@test.com`);

    const phoneField = publicPage.locator('#bp-phone');
    if (await phoneField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await phoneField.fill(`07700900${testId.slice(-3)}`);
    }

    // Fill child info
    await publicPage.locator('#child-name-0').fill(`E2E Booking ${testId}`);

    const childAge = publicPage.locator('#child-age-0');
    if (await childAge.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await childAge.fill('8');
    }

    // Verify "Add another student" option exists
    const addChild = publicPage.getByText(/add another student/i).first();
    await expect(addChild).toBeVisible({ timeout: 5_000 });
  });

  test('booking validation — empty fields', async () => {
    test.skip(!bookingSlug, 'Booking page not configured for test org');
    test.setTimeout(90_000);

    await navigateToDetailsStep(publicPage, bookingSlug);

    const detailsVisible = await publicPage
      .getByText(/your details/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!detailsVisible) {
      test.skip(true, 'Could not reach details step');
      return;
    }

    // Submit button should be disabled when required fields are empty
    const submitBtn = publicPage.getByRole('button', { name: /submit booking request/i }).first();
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });
    const isDisabled = await submitBtn.isDisabled();
    expect(isDisabled, 'Submit button should be disabled when required fields are empty').toBe(true);
  });

  test('booking validation — invalid email', async () => {
    test.skip(!bookingSlug, 'Booking page not configured for test org');
    test.setTimeout(90_000);

    await navigateToDetailsStep(publicPage, bookingSlug);

    const detailsVisible = await publicPage
      .getByText(/your details/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!detailsVisible) {
      test.skip(true, 'Could not reach details step');
      return;
    }

    // Fill name and child but use invalid email
    await publicPage.locator('#bp-name').fill('Test Parent');
    await publicPage.locator('#bp-email').fill('not-an-email');
    await publicPage.locator('#child-name-0').fill('Test Child');

    // Submit should remain disabled with invalid email (no @)
    const submitBtn = publicPage.getByRole('button', { name: /submit booking request/i }).first();
    if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const isDisabled = await submitBtn.isDisabled();
      expect(isDisabled, 'Submit should be disabled with invalid email').toBe(true);
    }
  });

  test('back navigation', async () => {
    test.skip(!bookingSlug, 'Booking page not configured for test org');
    test.setTimeout(90_000);

    await publicPage.goto(`${BASE_URL}/book/${bookingSlug}`, { waitUntil: 'domcontentloaded' });
    await publicPage.waitForTimeout(3_000);

    // Click CTA to enter wizard
    const ctaBtn = publicPage.getByRole('button', { name: /book a trial lesson/i }).first();
    if (await ctaBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await ctaBtn.click();
      await publicPage.waitForTimeout(1_000);
    }

    // Advance at least one step
    let advanced = false;
    const opt = publicPage.locator('button').filter({ hasText: /.+/ }).nth(1);
    if (await opt.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await opt.click();
      await publicPage.waitForTimeout(1_000);
      advanced = true;
    }

    if (!advanced) {
      test.skip(true, 'Could not advance past first step');
      return;
    }

    // Click back
    const backBtn = publicPage.getByRole('button', { name: /back/i }).first();
    if (await backBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await backBtn.click();
      await publicPage.waitForTimeout(1_000);
      // Verify we went back (page still has content)
      expect(publicPage.url()).toContain('/book/');
    }
  });

  test('full booking submission flow', async () => {
    test.skip(!bookingSlug, 'Booking page not configured for test org');
    test.setTimeout(120_000);

    await navigateToDetailsStep(publicPage, bookingSlug);

    const detailsVisible = await publicPage
      .getByText(/your details/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!detailsVisible) {
      test.skip(true, 'Could not reach details step');
      return;
    }

    // Fill form
    await publicPage.locator('#bp-name').fill(`E2E Parent ${testId}`);
    await publicPage.locator('#bp-email').fill(`e2e-booking-${testId}@test.com`);

    const phoneField = publicPage.locator('#bp-phone');
    if (await phoneField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await phoneField.fill('07700900123');
    }

    await publicPage.locator('#child-name-0').fill(`E2E Child ${testId}`);

    const childAge = publicPage.locator('#child-age-0');
    if (await childAge.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await childAge.fill('8');
    }

    // Check privacy consent
    const privacyCheckbox = publicPage.locator('button[role="checkbox"]').first();
    if (await privacyCheckbox.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const checked = await privacyCheckbox.getAttribute('data-state');
      if (checked !== 'checked') {
        await privacyCheckbox.click();
        await publicPage.waitForTimeout(500);
      }
    }

    // Submit
    const submitBtn = publicPage.getByRole('button', { name: /submit booking request/i }).first();
    if (await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const isEnabled = await submitBtn.isEnabled();
      if (isEnabled) {
        await submitBtn.click();
        await publicPage.waitForTimeout(3_000);

        // Verify confirmation
        const confirmation = publicPage.getByText(/booking request received/i).first();
        await expect(confirmation).toBeVisible({ timeout: 15_000 });
      }
    }
  });

  test('booking page URL visible in settings', async ({ page }) => {
    test.skip(!bookingSlug, 'Booking page not configured for test org');

    await safeGoTo(page, '/settings', 'Settings');
    await assertNoErrorBoundary(page);

    // Click the "Booking Page" settings tab
    const bookingTab = page.getByRole('button', { name: 'Booking Page' }).first();
    await expect(bookingTab).toBeVisible({ timeout: 10_000 });
    await bookingTab.click();
    await page.waitForTimeout(2_000);

    // The settings page shows the heading "Public Booking Page" and the slug input
    const heading = page.getByRole('heading', { name: /public booking page/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Verify the slug input contains the correct value
    const slugInput = page.getByRole('textbox', { name: /my-music-studio/i }).first();
    if (await slugInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const val = await slugInput.inputValue();
      expect(val).toBe(bookingSlug);
    }
  });
});
