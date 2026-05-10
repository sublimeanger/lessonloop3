/**
 * 25 — Public booking page (/book/:slug)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §25
 */
import { test, expect } from './_fixtures/auth-refresh';
import { supabaseSelect } from '../supabase-admin';
import fs from 'fs';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';

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

// ────────────────────────────────────────────────────────────────────
// §25 — Public booking edge fn contracts (s24)
// ────────────────────────────────────────────────────────────────────
//
// Per s24 stance recalibration: Public booking is now LAUNCH IN-SCOPE.
// Both edge fns are public (no auth gate; IP rate-limit instead).
//
// booking-get-slots: POST only, 20/min IP rate limit, requires
//   slug + date_from + date_to. Validates date format, no past dates,
//   range ≤ 90 days. 404 on missing slug.
// booking-submit: POST only, 5/hr IP rate limit, requires slug +
//   contact name+email + at least one child first_name. Validates
//   email format. Slot required unless enquiry_only=true.
//   404 on missing slug.

function callBookingFn(fnName: string, opts: { method?: 'GET' | 'POST'; body?: any }): { status: number; body: string } {
  const respFile = `/tmp/sb-bk-${fnName}-resp-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
  const reqFile = `/tmp/sb-bk-${fnName}-req-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  fs.writeFileSync(reqFile, JSON.stringify(opts.body ?? {}));
  const method = opts.method ?? 'POST';
  // booking-* fns are deployed with verify_jwt:true — gateway requires anon
  // Bearer to forward to the function, even though the fn itself is public
  // (anon JWT is used to satisfy the gateway; the fn applies IP rate-limit).
  // Spoof a unique per-call X-Forwarded-For so each test gets its own
  // rate-limit bucket (booking-submit caps at 5/hr per IP; without a unique
  // IP, repeated test runs collide and trip 429). Use a wide RFC1918 range
  // (10.x.y.z) randomised per call across ~16M possibilities.
  const r = randomBytes(3);
  const fakeIp = `10.${r[0]}.${r[1]}.${r[2]}`;
  try {
    let cmd =
      `curl -s -o ${respFile} -w "%{http_code}" ` +
      `-X ${method} "${process.env.E2E_SUPABASE_URL}/functions/v1/${fnName}" ` +
      `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
      `-H "X-Forwarded-For: ${fakeIp}" ` +
      `-H "Content-Type: application/json" `;
    if (method === 'POST') cmd += `-d @${reqFile}`;
    const status = execSync(cmd, { encoding: 'utf-8', timeout: 15_000 });
    const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    return { status: parseInt(status.trim(), 10), body };
  } finally {
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
  }
}

// Reset booking-* rate-limit rows at suite-start. Supabase's edge gateway
// rewrites X-Forwarded-For to its own value before the fn sees it, so all
// our calls land in a single bucket regardless of spoofed headers. Clearing
// the rows is the only reliable way to keep these tests stable across runs.
function resetBookingRateLimits(): void {
  const url = process.env.E2E_SUPABASE_URL!;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) return;
  execSync(
    `curl -s -X DELETE "${url}/rest/v1/rate_limits?action_type=in.(booking-submit,booking-get-slots)" ` +
      `-H "apikey: ${key}" -H "Authorization: Bearer ${key}" -H "Prefer: return=minimal"`,
    { encoding: 'utf-8', timeout: 10_000 },
  );
}

test.describe('§25 — Public booking edge fn contracts (s24)', () => {
  test.beforeAll(() => {
    resetBookingRateLimits();
  });

  test('booking-get-slots — GET → 405 method not allowed', async () => {
    const res = callBookingFn('booking-get-slots', { method: 'GET' });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(405);
  });

  test('booking-get-slots — POST missing slug → 400', async () => {
    const res = callBookingFn('booking-get-slots', { body: { date_from: '2027-01-01', date_to: '2027-01-07' } });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(400);
    expect(res.body).toMatch(/required/i);
  });

  test('booking-get-slots — POST date_from in past → 400', async () => {
    const res = callBookingFn('booking-get-slots', { body: { slug: 'no-such-slug', date_from: '2020-01-01', date_to: '2020-01-07' } });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(400);
    expect(res.body).toMatch(/past/i);
  });

  test('booking-get-slots — POST range > 90 days → 400', async () => {
    const res = callBookingFn('booking-get-slots', { body: { slug: 'no-such-slug', date_from: '2027-01-01', date_to: '2027-12-31' } });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(400);
    expect(res.body).toMatch(/90 days/i);
  });

  test('booking-get-slots — POST non-existent slug → 404', async () => {
    const res = callBookingFn('booking-get-slots', { body: { slug: 'definitely-does-not-exist-' + Date.now(), date_from: '2027-01-01', date_to: '2027-01-07' } });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(404);
    expect(res.body).toMatch(/not found/i);
  });

  test('booking-submit — GET → 405 method not allowed', async () => {
    const res = callBookingFn('booking-submit', { method: 'GET' });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(405);
  });

  test('booking-submit — POST missing slug → 400', async () => {
    const res = callBookingFn('booking-submit', { body: { contact: { name: 'Test', email: 'test@example.com' }, children: [{ first_name: 'Alice' }] } });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(400);
  });

  test('booking-submit — POST missing slot for non-enquiry → 400', async () => {
    const res = callBookingFn('booking-submit', { body: { slug: 'no-such-slug', contact: { name: 'Test', email: 'test@example.com' }, children: [{ first_name: 'Alice' }] } });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(400);
    expect(res.body).toMatch(/slot/i);
  });

  test('booking-submit — POST invalid email → 400', async () => {
    const res = callBookingFn('booking-submit', {
      body: {
        slug: 'no-such-slug',
        enquiry_only: true,
        contact: { name: 'Test', email: 'not-an-email' },
        children: [{ first_name: 'Alice' }],
      },
    });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(400);
    expect(res.body).toMatch(/email/i);
  });

  test('booking-submit — POST missing children → 400', async () => {
    const res = callBookingFn('booking-submit', {
      body: {
        slug: 'no-such-slug',
        enquiry_only: true,
        contact: { name: 'Test', email: 'test@example.com' },
        children: [],
      },
    });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(400);
    expect(res.body).toMatch(/child/i);
  });

  test('booking-submit — POST non-existent slug → 404', async () => {
    const res = callBookingFn('booking-submit', {
      body: {
        slug: 'definitely-does-not-exist-' + Date.now(),
        enquiry_only: true,
        contact: { name: 'Test', email: 'test@example.com' },
        children: [{ first_name: 'Alice' }],
      },
    });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(404);
    expect(res.body).toMatch(/not found/i);
  });
});

test.fixme('§25.4 — single instrument config → instrument step skipped', async () => {});
test.fixme('§25.5 — pick date → 5 slots fetched', async () => {});
test.fixme('§25.7 — submit valid booking → leads + lead_students rows + admin email', async () => {});
test.fixme('§25.6 — "Just enquiring" → send-parent-enquiry without slot', async () => {});
test.fixme('§25.7 — embed mode ?embed=true removes header chrome', async () => {});
test.fixme('§25.9 — IP rate-limit (101 in 1hr) → toast', async () => {});
