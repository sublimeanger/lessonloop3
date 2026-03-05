import { test, expect } from '@playwright/test';
import { AUTH, goTo, waitForPageReady, assertNoErrorBoundary } from './helpers';

// ═══════════════════════════════════════════════════════════════
// SECTION 1: FEATURE REQUEST BOARD
// ═══════════════════════════════════════════════════════════════

test.describe('Feature Request Board — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('Help page shows Feature Requests card', async ({ page }) => {
    await goTo(page, '/help');
    await assertNoErrorBoundary(page);

    // The Feature Requests card has title "Feature Requests"
    const card = page.getByText('Feature Requests', { exact: true });
    await expect(card, 'Feature Requests card should be visible').toBeVisible({ timeout: 15_000 });
  });

  test('Feature Requests card has link to feedback.lessonloop.net', async ({ page }) => {
    await goTo(page, '/help');

    // The card itself is a clickable div that opens feedback.lessonloop.net
    // It has description: "Have an idea? Vote on what gets built next."
    const description = page.getByText('Have an idea? Vote on what gets built next.');
    await expect(description).toBeVisible({ timeout: 15_000 });

    // The card also shows "Submit a request" text with ExternalLink icon
    const submitText = page.getByText('Submit a request');
    await expect(submitText).toBeVisible({ timeout: 10_000 });
  });

  test('Feature Requests card is clickable and wired to feedback.lessonloop.net', async ({ page }) => {
    await goTo(page, '/help');

    // The card has onClick={() => window.open('https://feedback.lessonloop.net', '_blank')}
    // We intercept window.open before clicking
    await page.evaluate(() => {
      (window as any).__openedUrl = '';
      window.open = (url?: string | URL, ...args: any[]) => {
        (window as any).__openedUrl = String(url || '');
        return null;
      };
    });

    // Click the Feature Requests card
    const featureCard = page.getByText('Feature Requests', { exact: true });
    await featureCard.click();
    await page.waitForTimeout(500);

    const openedUrl = await page.evaluate(() => (window as any).__openedUrl);
    expect(openedUrl).toContain('feedback.lessonloop.net');
  });

  test('Sidebar shows "Suggest a feature" link', async ({ page }) => {
    await goTo(page, '/dashboard');

    const suggestLink = page.getByText('Suggest a feature');
    await expect(suggestLink, 'Suggest a feature link should be visible in sidebar').toBeVisible({ timeout: 15_000 });

    // Verify it links to feedback.lessonloop.net
    const href = await suggestLink.getAttribute('href');
    expect(href).toBe('https://feedback.lessonloop.net');
  });

  test('Sidebar "Suggest a feature" link targets _blank', async ({ page }) => {
    await goTo(page, '/dashboard');

    const suggestLink = page.locator('a[href="https://feedback.lessonloop.net"]');
    await expect(suggestLink).toBeVisible({ timeout: 15_000 });

    const target = await suggestLink.getAttribute('target');
    expect(target).toBe('_blank');

    const rel = await suggestLink.getAttribute('rel');
    expect(rel).toContain('noopener');
  });
});

test.describe('Feature Request Board — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('Teacher can see Feature Requests card on Help page', async ({ page }) => {
    await goTo(page, '/help');
    await assertNoErrorBoundary(page);

    const card = page.getByText('Feature Requests', { exact: true });
    await expect(card, 'Feature Requests card should be visible for teacher').toBeVisible({ timeout: 15_000 });

    const description = page.getByText('Have an idea? Vote on what gets built next.');
    await expect(description).toBeVisible({ timeout: 10_000 });
  });

  test('Teacher sees "Suggest a feature" link in sidebar', async ({ page }) => {
    await goTo(page, '/dashboard');

    const suggestLink = page.getByText('Suggest a feature');
    await expect(suggestLink, 'Suggest a feature link should be visible for teacher').toBeVisible({ timeout: 15_000 });

    const href = await suggestLink.getAttribute('href');
    expect(href).toBe('https://feedback.lessonloop.net');
  });
});
