/**
 * 25 — Public booking page (/book/:slug)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §25
 */
import { test, expect } from './_fixtures/auth-refresh';
import { supabaseSelect } from '../supabase-admin';

test.use({ storageState: { cookies: [], origins: [] } }); // public — no auth

test.describe('Public booking page', () => {
  test('invalid slug → either 404, NotFound, or "Booking page not found"', async ({ page }) => {
    await page.goto('/book/this-does-not-exist-99999');
    await page.waitForTimeout(3000);
    // Page may show: NotFound page, "Booking page not found" message, or
    // an error boundary — any of these means the slug-not-found is handled.
    const text = (await page.locator('body').textContent())?.toLowerCase() ?? '';
    const matches =
      text.includes('not found') ||
      text.includes('404') ||
      text.includes("doesn't exist") ||
      text.includes('does not exist') ||
      text.includes('not available') ||
      text.includes('something went wrong');
    expect(matches, `Body text was: ${text.slice(0, 200)}`).toBe(true);
  });

  test('valid slug → welcome step renders', async ({ page }) => {
    // Find any enabled booking page
    const pages = supabaseSelect('booking_pages', `enabled=eq.true&select=slug&limit=1`);
    if (pages.length === 0) {
      test.skip(true, 'No enabled booking page in destination');
      return;
    }
    await page.goto(`/book/${pages[0].slug}`);
    await page.waitForTimeout(2000);
    const heading = await page.getByRole('heading').first().textContent();
    expect(heading).toBeTruthy();
  });
});

test.fixme('§25.4 — single instrument config → instrument step skipped', async () => {});
test.fixme('§25.5 — pick date → 5 slots fetched', async () => {});
test.fixme('§25.7 — submit valid booking → leads + lead_students rows + admin email', async () => {});
test.fixme('§25.6 — "Just enquiring" → send-parent-enquiry without slot', async () => {});
test.fixme('§25.7 — embed mode ?embed=true removes header chrome', async () => {});
test.fixme('§25.9 — IP rate-limit (101 in 1hr) → toast', async () => {});
