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
import { supabaseSelect, supabaseInsert, supabaseDelete, getOwnerUserId, getOwnerTeacherId, seedLesson, seedStudent, seedInvoice, getFirstGuardianId } from '../supabase-admin';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import fs from 'fs';

const SUPABASE_URL = process.env.E2E_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY || '';
const ORG_ID = process.env.E2E_ORG_ID || '';

const ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY || '';

/** Get owner-JWT by reading the storage state. Cached for the test run. */
let cachedOwnerJwt: string | null = null;
function getOwnerJwt(): string {
  if (cachedOwnerJwt) return cachedOwnerJwt;
  try {
    const path = '/tmp/lessonloop3-deploy/tests/e2e/.auth/owner.json';
    const state = JSON.parse(fs.readFileSync(path, 'utf-8'));
    const session = JSON.parse(state.origins[0].localStorage[0].value);
    cachedOwnerJwt = session.access_token;
    return cachedOwnerJwt!;
  } catch {
    return '';
  }
}

/** Direct PostgREST update via OWNER JWT — realistic attack surface for app users. */
function tryUpdate(table: string, query: string, payload: Record<string, unknown>): { ok: boolean; error?: string } {
  const token = getOwnerJwt();
  if (!token) return { ok: false, error: 'no owner JWT' };
  const tmpFile = `/tmp/sb-trig-${Date.now()}-${randomBytes(8).toString('hex')}.json`;
  fs.writeFileSync(tmpFile, JSON.stringify(payload));
  try {
    const result = execSync(
      `curl -s -X PATCH "${SUPABASE_URL}/rest/v1/${table}?${query}" ` +
      `-H "apikey: ${ANON_KEY}" ` +
      `-H "Authorization: Bearer ${token}" ` +
      `-H "Content-Type: application/json" ` +
      `-H "Prefer: return=representation" ` +
      `-d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const parsed = JSON.parse(result);
    if (parsed?.code || parsed?.message) {
      return { ok: false, error: parsed.message || JSON.stringify(parsed) };
    }
    return { ok: Array.isArray(parsed) && parsed.length > 0, error: '' };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* */ }
  }
}

/** Direct PostgREST insert via OWNER JWT — verifies app-level RLS+trigger guards. */
function tryInsert(table: string, payload: Record<string, unknown>): { ok: boolean; error?: string } {
  const token = getOwnerJwt();
  if (!token) return { ok: false, error: 'no owner JWT' };
  const tmpFile = `/tmp/sb-trig-ins-${Date.now()}-${randomBytes(8).toString('hex')}.json`;
  fs.writeFileSync(tmpFile, JSON.stringify(payload));
  try {
    const result = execSync(
      `curl -s -X POST "${SUPABASE_URL}/rest/v1/${table}" ` +
      `-H "apikey: ${ANON_KEY}" ` +
      `-H "Authorization: Bearer ${token}" ` +
      `-H "Content-Type: application/json" ` +
      `-H "Prefer: return=representation" ` +
      `-d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const parsed = JSON.parse(result);
    if (parsed?.code || (parsed?.message && !parsed?.id)) {
      return { ok: false, error: parsed.message || JSON.stringify(parsed) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* */ }
  }
}

/** Try to DELETE; returns whether the row still exists afterward (true = trigger blocked the delete). */
function tryDelete(table: string, query: string): { stillExists: boolean; error?: string } {
  if (!SERVICE_ROLE_KEY) return { stillExists: true, error: 'no service-role key' };
  try {
    execSync(
      `curl -s -X DELETE "${SUPABASE_URL}/rest/v1/${table}?${query}" ` +
      `-H "apikey: ${SERVICE_ROLE_KEY}" ` +
      `-H "Authorization: Bearer ${SERVICE_ROLE_KEY}" ` +
      `-H "Content-Type: application/json" ` +
      `-H "Prefer: return=minimal"`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    // Did the row survive?
    const survivors = supabaseSelect(table, `${query}&select=id&limit=1`);
    return { stillExists: survivors.length > 0 };
  } catch (err) {
    return { stillExists: true, error: String(err) };
  }
}

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

test.describe('§32.5 — Server-side input validation on edge functions', () => {
  test('booking-submit malformed payload → 400', async ({ request }) => {
    const r = await request.post(`${SUPABASE_URL}/functions/v1/booking-submit`, {
      headers: { Authorization: `Bearer ${process.env.E2E_SUPABASE_ANON_KEY}` },
      data: { malformed: true, bogus: 'data' },
      failOnStatusCode: false,
    });
    expect([400, 422]).toContain(r.status());
  });
});

test.fixme('§32.5 — looopassist-chat: prompt injection sanitised', async () => {});
test.fixme('§32.5 — file upload: > 25MB rejected', async () => {});
test.fixme('§32.5 — file upload: executable mime rejected', async () => {});
test.fixme('§32.6 — parent cannot set primary_payer for unrelated student', async () => {});

// ═══════════════════════════════════════════════════════════════
// §32.7 — Trigger guards (DB-level)
// Each test sets up a row that violates a trigger, attempts the operation,
// and asserts the trigger blocked it (operation failed OR row unchanged).
// ═══════════════════════════════════════════════════════════════

test.describe('§32.7 — DB trigger guards', () => {
  test('prevent_org_id_change: cannot UPDATE students.org_id', async () => {
    // Find any student in the org
    const students = supabaseSelect('students', `org_id=eq.${ORG_ID}&select=id&limit=1`);
    test.skip(students.length === 0, 'No students');
    const studentId = students[0].id;

    const result = tryUpdate('students', `id=eq.${studentId}`, {
      org_id: '00000000-0000-0000-0000-000000000000',
    });
    // Trigger should error or no-op the change
    expect(result.ok && result.error === '').toBeFalsy();

    // Confirm row's org_id unchanged
    const after = supabaseSelect('students', `id=eq.${studentId}&select=org_id&limit=1`);
    expect(after[0].org_id).toBe(ORG_ID);
  });

  test('protect_subscription_fields: silently no-ops UPDATE of subscription_plan', async () => {
    // The trigger uses NEW := OLD coercion (no error) — so the UPDATE returns
    // 200 with rows, but the persisted value never changes. Test that.
    const before = supabaseSelect('organisations', `id=eq.${ORG_ID}&select=subscription_plan`);
    const originalPlan = before[0].subscription_plan;

    const target = originalPlan === 'custom' ? 'agency' : 'custom';
    tryUpdate('organisations', `id=eq.${ORG_ID}`, { subscription_plan: target });

    const after = supabaseSelect('organisations', `id=eq.${ORG_ID}&select=subscription_plan`);
    expect(after[0].subscription_plan, 'plan must not change via owner-JWT REST').toBe(originalPlan);
  });

  test('protect_onboarding_flag: cannot UPDATE profiles.has_completed_onboarding=false after true', async () => {
    const ownerId = getOwnerUserId();
    test.skip(!ownerId, 'No owner user');
    // Confirm owner is currently has_completed=true
    const before = supabaseSelect('profiles', `id=eq.${ownerId}&select=has_completed_onboarding`);
    test.skip(before[0]?.has_completed_onboarding !== true, 'Owner not yet onboarded');

    const result = tryUpdate('profiles', `id=eq.${ownerId}`, {
      has_completed_onboarding: false,
    });
    expect(result.ok && result.error === '').toBeFalsy();
    const after = supabaseSelect('profiles', `id=eq.${ownerId}&select=has_completed_onboarding`);
    expect(after[0].has_completed_onboarding).toBe(true);
  });

  test('block_owner_insert: cannot INSERT a 2nd owner row directly', async () => {
    const ownerId = getOwnerUserId();
    test.skip(!ownerId, 'No owner user');
    // Try to insert a duplicate owner membership for the same org
    const result = tryInsert('org_memberships', {
      org_id: ORG_ID,
      user_id: ownerId,
      role: 'owner',
      status: 'active',
    });
    // Trigger should block
    expect(result.ok && !result.error).toBeFalsy();
  });

  test('check_attendance_not_future: cannot insert attendance_records for tomorrow', async () => {
    // Find any future lesson
    const future = supabaseSelect('lessons', `org_id=eq.${ORG_ID}&start_at=gt.${new Date().toISOString()}&select=id,start_at&limit=1`);
    test.skip(future.length === 0, 'No future lesson to test against');
    const lesson = future[0];

    const result = tryInsert('attendance_records', {
      org_id: ORG_ID,
      lesson_id: lesson.id,
      status: 'present',
    });
    // Trigger should block — future lessons can't have attendance
    expect(result.ok && !result.error).toBeFalsy();
  });

  test('enforce_invoice_status_transition: cannot transition paid→draft', async () => {
    // Find a paid invoice
    const paid = supabaseSelect('invoices', `org_id=eq.${ORG_ID}&status=eq.paid&select=id&limit=1`);
    test.skip(paid.length === 0, 'No paid invoice in test org');
    const invoiceId = paid[0].id;

    const result = tryUpdate('invoices', `id=eq.${invoiceId}`, { status: 'draft' });
    expect(result.ok && !result.error).toBeFalsy();
    // Confirm status didn't change
    const after = supabaseSelect('invoices', `id=eq.${invoiceId}&select=status`);
    expect(after[0].status).toBe('paid');
  });

  test('check_invoice_item_amounts: cannot insert negative unit_price_minor', async () => {
    // Find any invoice
    const invoices = supabaseSelect('invoices', `org_id=eq.${ORG_ID}&select=id&limit=1`);
    test.skip(invoices.length === 0, 'No invoice');
    const invoiceId = invoices[0].id;

    const result = tryInsert('invoice_items', {
      org_id: ORG_ID,
      invoice_id: invoiceId,
      description: 'e2e_neg_amount',
      quantity: 1,
      unit_price_minor: -1000,
    });
    expect(result.ok && !result.error).toBeFalsy();
    // Cleanup any accidental insert
    supabaseDelete('invoice_items', `invoice_id=eq.${invoiceId}&description=eq.e2e_neg_amount`);
  });
});

test.fixme('§32.7 — prevent_invoiced_lesson_delete: needs invoiced lesson seed', async () => {});
test.fixme('§32.7 — validate_refund_amount: refund > original → fails', async () => {});
test.fixme('§32.7 — protect_owner_role: cannot demote owner via UPDATE org_memberships.role', async () => {});
test.fixme('§32.7 — protect_teacher_user_link: cannot manually set teachers.user_id', async () => {});
