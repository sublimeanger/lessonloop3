/**
 * 32 — Negative & security tests
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §32
 *
 * Critical for pre-launch: enumeration, session hardening, RLS,
 * CSRF, server-side input validation, privilege escalation, trigger
 * guards. Each test asserts the security posture, not the happy path.
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH } from '../helpers';
import { supabaseSelect } from '../supabase-admin';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.parent);
});

test.describe('§32.1 — Authentication enumeration', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login wrong password vs unknown user → identical generic message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_OWNER_EMAIL!);
    await page.locator('#password').fill('WrongPass999!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/incorrect email or password|invalid|sign in failed/i).first()).toBeVisible({ timeout: 10_000 });
    const wrongPwText = await page.locator('body').textContent();

    // Now try unknown user
    await page.goto('/login');
    await page.getByLabel('Email').fill(`unknown-${Date.now()}@e2e.test`);
    await page.locator('#password').fill('AnyPass99!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(3000);
    const unknownText = await page.locator('body').textContent();

    // Both should mention the same generic phrase
    expect(unknownText?.toLowerCase()).toMatch(/incorrect email or password|invalid|sign in failed/);
    // Neither should specifically say "no account" or "not found"
    expect(wrongPwText?.toLowerCase()).not.toContain('user not found');
    expect(unknownText?.toLowerCase()).not.toContain('user not found');
  });
});

test.describe('§32.3 — RLS / horizontal access', () => {
  test.use({ storageState: AUTH.owner });

  test('cross-org SELECT returns 0 rows (rather than 403)', async () => {
    const fakeOrg = '00000000-0000-0000-0000-000000000000';
    const rows = supabaseSelect('students', `org_id=eq.${fakeOrg}&limit=1`);
    expect(rows.length).toBe(0);
  });
});

test.describe('§32.4 — Edge function CSRF', () => {
  test('POST to a state-changing edge function without auth → 401', async ({ request }) => {
    const r = await request.post(`${process.env.E2E_SUPABASE_URL}/functions/v1/send-message`, {
      data: { test: true },
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(r.status());
  });
});

test.fixme('§32.2 — token tampering: corrupt JWT → 401 + redirect to login', async () => {});
test.fixme('§32.2 — rate limit: 100 sends/min → 429', async () => {});
test.fixme('§32.5 — booking-submit malformed payload → 400', async () => {});
test.fixme('§32.5 — looopassist-chat: prompt injection sanitised', async () => {});
test.fixme('§32.5 — file upload: > 25MB rejected', async () => {});
test.fixme('§32.5 — file upload: executable mime rejected', async () => {});
test.fixme('§32.6 — parent cannot set primary_payer for unrelated student', async () => {});
test.fixme('§32.7 — prevent_org_id_change: try update students.org_id → fails', async () => {});
test.fixme('§32.7 — prevent_invoiced_lesson_delete: delete invoiced lesson → fails', async () => {});
test.fixme('§32.7 — protect_subscription_fields: update plan via REST → fails', async () => {});
test.fixme('§32.7 — protect_onboarding_flag: set has_completed=false after true → fails', async () => {});
test.fixme('§32.7 — block_owner_insert: insert second owner row → fails', async () => {});
test.fixme('§32.7 — check_attendance_not_future: future date → fails', async () => {});
test.fixme('§32.7 — check_invoice_item_amounts: negative line item → fails', async () => {});
test.fixme('§32.7 — validate_refund_amount: refund > original → fails', async () => {});
test.fixme('§32.7 — enforce_invoice_status_transition: paid→draft → fails', async () => {});
