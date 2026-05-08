/**
 * 26 — Parent portal (every page)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §26
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.parent);
  refreshStorageStateIfStale(AUTH.parent2);
});

const PORTAL_PAGES = [
  { path: '/portal/home', label: 'Home' },
  { path: '/portal/schedule', label: 'Schedule' },
  { path: '/portal/practice', label: 'Practice' },
  { path: '/portal/resources', label: 'Resources' },
  { path: '/portal/invoices', label: 'Invoices & Payments' },
  { path: '/portal/messages', label: 'Messages' },
  { path: '/portal/profile', label: 'Profile' },
];

test.describe('Parent portal — page loads', () => {
  test.use({ storageState: AUTH.parent });

  for (const p of PORTAL_PAGES) {
    test(`${p.label} (${p.path}) loads without error`, async ({ page }) => {
      await goTo(page, p.path);
      await assertNoErrorBoundary(page);
      await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Parent portal — login redirect', () => {
  test.use({ storageState: AUTH.parent });

  test('parent login → redirected to /portal/home', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/portal\/home/, { timeout: 15_000 });
  });
});

test.describe('Parent portal — child filter', () => {
  test.use({ storageState: AUTH.parent });

  test('home page renders for parent with child(ren)', async ({ page }) => {
    await goTo(page, '/portal/home');
    await assertNoErrorBoundary(page);
  });
});

test.describe('Parent portal — invoices', () => {
  test.use({ storageState: AUTH.parent });

  test('invoices page renders without currency-error boundary', async ({ page }) => {
    // This was a real production bug fixed 2026-05-08:
    // empty currency_code triggered RangeError → ErrorBoundary
    await goTo(page, '/portal/invoices');
    await page.waitForTimeout(3000);
    await assertNoErrorBoundary(page);
    // "Something went wrong" should NOT appear
    const errorBoundary = await page.getByText('Something went wrong').first().isVisible({ timeout: 2000 }).catch(() => false);
    expect(errorBoundary).toBe(false);
  });
});

test.fixme('§26.4 — make-up offer email link triggers respond_to_makeup_offer RPC', async () => {});
test.fixme('§26.4 — child filter switches data context for multi-child parents', async () => {});
test.fixme('§26.5 — reschedule self-service: pick slot → lesson updated', async () => {});
test.fixme('§26.5 — reschedule request-only: submits message_request', async () => {});
test.fixme('§26.5 — admin-locked policy hides reschedule button', async () => {});
test.fixme('§26.5 — Add to Google Calendar opens correctly formatted URL', async () => {});
test.fixme('§26.7 — log practice 30 min → practice_logs row + streak', async () => {});
test.fixme('§26.9 — pay full invoice via embedded drawer (Stripe test mode)', async () => {});
test.fixme('§26.9 — pay one installment → only that installment paid', async () => {});
test.fixme('§26.10 — compose new thread → notify-internal-message fires', async () => {});
test.fixme('§26.12 — authed parent submits continuation response', async () => {});
test.fixme('§26.13 — public token /respond/continuation works without login', async () => {});
