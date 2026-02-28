import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

// ═══ MOBILE LOGIN (unauthenticated) ═══
test.describe('Mobile Login Page', () => {
  test.use({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });

  test('login page usable on mobile', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    const emailBox = await page.getByLabel('Email').boundingBox();
    expect(emailBox!.width).toBeGreaterThan(200);
  });
});

// ═══ MOBILE TESTS (authenticated) ═══
test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 390, height: 844 }, storageState: AUTH.owner });

  test('dashboard no horizontal scroll', async ({ page }) => {
    await goTo(page, '/dashboard');
    const body = await page.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
    }));
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 5);
  });

  test('students page renders on mobile', async ({ page }) => {
    await goTo(page, '/students');
    const body = await page.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
    }));
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 5);
  });

  test('calendar renders on mobile', async ({ page }) => {
    await goTo(page, '/calendar');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('invoices page renders on mobile', async ({ page }) => {
    await goTo(page, '/invoices');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('settings page shows mobile nav list', async ({ page }) => {
    await goTo(page, '/settings');
    // On mobile, settings should show a nav list or the settings page heading
    await expect(
      page.getByText(/account|profile|settings/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Mobile Portal', () => {
  test.use({ viewport: { width: 390, height: 844 }, storageState: AUTH.parent });

  test('portal home usable on mobile', async ({ page }) => {
    await goTo(page, '/portal/home');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
    const body = await page.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
    }));
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 5);
  });

  test('portal bottom nav visible', async ({ page }) => {
    await goTo(page, '/portal/home');
    // Mobile portal should show bottom navigation or sidebar
    const nav = page.locator('nav').last();
    const sidebar = page.locator('[data-sidebar], [class*="sidebar"]').first();
    const hasNav = await nav.isVisible().catch(() => false);
    const hasSidebar = await sidebar.isVisible().catch(() => false);
    expect(hasNav || hasSidebar).toBeTruthy();
  });
});

// ═══ ERROR STATE TESTS ═══
test.describe('Error & Empty States', () => {
  test.use({ storageState: AUTH.owner });

  test('404 page renders for unknown routes', async ({ page }) => {
    // Navigate directly without goTo (which retries and may redirect)
    await page.goto('/this-route-definitely-does-not-exist-xyz123');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/not found|404|page not found/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('no console errors on dashboard', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await goTo(page, '/dashboard');
    await page.waitForTimeout(2000);
    const real = errors.filter(e =>
      !e.includes('favicon') && !e.includes('net::') &&
      !e.includes('Failed to fetch') && !e.includes('401') && !e.includes('403') &&
      !e.includes('ResizeObserver') && !e.includes('postMessage') &&
      !e.includes('AbortError') && !e.includes('ChunkLoadError') &&
      !e.includes('Loading chunk')
    );
    expect(real, `Console errors: ${real.join(', ')}`).toHaveLength(0);
  });

  test('no 5xx errors across key pages', async ({ page }) => {
    test.setTimeout(120_000);
    const failed: string[] = [];
    page.on('response', r => { if (r.status() >= 500) failed.push(`${r.status()} ${r.url()}`); });
    for (const path of ['/dashboard', '/students', '/calendar', '/invoices', '/settings', '/reports', '/messages', '/leads', '/waitlist']) {
      await goTo(page, path);
      await page.waitForTimeout(500);
    }
    expect(failed, `Server errors: ${failed.join(', ')}`).toHaveLength(0);
  });

  test('help page loads', async ({ page }) => {
    await goTo(page, '/help');
    await expect(page.getByText(/help|support|guide/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Portal Error States', () => {
  test.use({ storageState: AUTH.parent });

  test('no 5xx errors on portal pages', async ({ page }) => {
    test.setTimeout(120_000);
    const failed: string[] = [];
    page.on('response', r => { if (r.status() >= 500) failed.push(`${r.status()} ${r.url()}`); });
    for (const path of ['/portal/home', '/portal/schedule', '/portal/practice', '/portal/invoices', '/portal/messages', '/portal/profile']) {
      await goTo(page, path);
      await page.waitForTimeout(500);
    }
    expect(failed, `Server errors: ${failed.join(', ')}`).toHaveLength(0);
  });
});
