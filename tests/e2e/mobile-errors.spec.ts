import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

// ═══ MOBILE TESTS ═══
test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 390, height: 844 }, storageState: AUTH.owner });

  test('login page usable on mobile', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    const emailBox = await page.getByLabel('Email').boundingBox();
    expect(emailBox!.width).toBeGreaterThan(200);
  });

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
    await page.goto('/settings');
    await waitForPageReady(page);
    // On mobile, settings should show a nav list (not sidebar)
    await expect(page.getByText(/account|profile/i).first()).toBeVisible();
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
    // Mobile portal should show bottom navigation
    await expect(page.locator('nav').last()).toBeVisible();
  });
});

// ═══ ERROR STATE TESTS ═══
test.describe('Error & Empty States', () => {
  test.use({ storageState: AUTH.owner });

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/this-route-definitely-does-not-exist-xyz123');
    await expect(page.getByText(/not found|404/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('no console errors on dashboard', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await goTo(page, '/dashboard');
    await page.waitForTimeout(2000);
    const real = errors.filter(e => !e.includes('favicon') && !e.includes('net::') && !e.includes('Failed to fetch'));
    expect(real, `Console errors: ${real.join(', ')}`).toHaveLength(0);
  });

  test('no 5xx errors across key pages', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', r => { if (r.status() >= 500) failed.push(`${r.status()} ${r.url()}`); });
    for (const path of ['/dashboard', '/students', '/calendar', '/invoices', '/settings', '/reports', '/messages', '/leads', '/waitlist']) {
      await page.goto(path);
      await waitForPageReady(page);
      await page.waitForTimeout(1000);
    }
    expect(failed, `Server errors: ${failed.join(', ')}`).toHaveLength(0);
  });

  test('no 5xx errors on portal pages', async ({ page }) => {
    const failed: string[] = [];
    // Switch to parent auth for portal
    await page.goto('/login');
  });

  test('help page loads', async ({ page }) => {
    await goTo(page, '/help');
    await expect(page.getByText(/help|support|guide/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Portal Error States', () => {
  test.use({ storageState: AUTH.parent });

  test('no 5xx errors on portal pages', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', r => { if (r.status() >= 500) failed.push(`${r.status()} ${r.url()}`); });
    for (const path of ['/portal/home', '/portal/schedule', '/portal/practice', '/portal/invoices', '/portal/messages', '/portal/profile']) {
      await page.goto(path);
      await waitForPageReady(page);
      await page.waitForTimeout(1000);
    }
    expect(failed, `Server errors: ${failed.join(', ')}`).toHaveLength(0);
  });
});
