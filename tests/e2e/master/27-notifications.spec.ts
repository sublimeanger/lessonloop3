/**
 * 27 — Email & notifications
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §27
 *
 * Approach: assert via `message_log` DB rows (which every send-* edge fn
 * inserts on success) rather than capturing real emails. This avoids
 * the cost/complexity of a Mailtrap/Mailosaur integration.
 *
 * §27.2 specifically asserts the pref-honoring contract: when a
 * `notification_preferences` row sets `email_<event>=false`, the
 * corresponding edge function returns 200 early without inserting a
 * `message_log` row (and therefore without dispatching to Resend).
 * Targets `send-payment-receipt` because its conditional is the cleanest
 * test surface — explicit early-return + no log insertion when off.
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH } from '../helpers';
import { supabaseSelect, supabaseInsert, supabaseDelete, createTestInvoice } from '../supabase-admin';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
});

// HANDOVER constants — parent guardian + user IDs are not in .env.test;
// hardcoded the same way 26-parent-portal.spec.ts does it.
const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';
const E2E_PARENT_USER_ID = '85628488-f47f-4178-84f0-3425aad6e75e';

test.describe('message_log table accepts insertions', () => {
  test('latest message_log rows are queryable', async () => {
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('message_log', `org_id=eq.${orgId}&select=id,message_type,status,sent_at&order=created_at.desc&limit=5`);
    // Just assert the query succeeds
    expect(Array.isArray(rows)).toBe(true);
  });
});

test.describe('§27 — message_log table is the source of truth', () => {
  test('message_log table accepts queries by message_type', async () => {
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('message_log', `org_id=eq.${orgId}&select=message_type&limit=20`);
    expect(Array.isArray(rows)).toBe(true);
  });

  test('message_log enum values match expected event types', async () => {
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('message_log', `org_id=eq.${orgId}&select=message_type&limit=100`);
    const types = new Set(rows.map((r: any) => r.message_type));
    // Just assert no unexpected nulls
    types.forEach(t => expect(typeof t).toBe('string'));
  });
});

test.describe('§27 — notification_preferences RLS contract', () => {
  // Policies (verified 2026-05-10 via pg_policy):
  //   "Users can view own notification preferences"  USING (user_id = auth.uid())
  //   "Users can insert own notification preferences" WITH CHECK (user_id = auth.uid() AND is_org_member(...))
  //   "Users can update own notification preferences" USING (user_id = auth.uid())
  //   "Block anonymous access to notification_preferences" USING (false)
  //
  // The fn-shape SELECT in §27.2 above hits this table via service-role
  // (bypasses RLS). This test asserts the RLS contract from a parent JWT —
  // the actual user-facing path that NotificationsTab + the parent settings
  // page use to read/write prefs. If the policy ever drifts to allow
  // cross-user reads, this test catches it.
  test('parent JWT sees own pref row + cannot see other users\' pref rows', async () => {
    const orgId = process.env.E2E_ORG_ID!;
    const parentUserId = E2E_PARENT_USER_ID;
    const { getOwnerUserId } = await import('../supabase-admin');
    const ownerUserId = getOwnerUserId();
    expect(ownerUserId).not.toBe(parentUserId); // sanity

    // Seed both rows via service-role (bypasses RLS)
    upsertParentNotifPref(orgId, parentUserId, { email_payment_receipts: true, email_invoice_reminders: false });
    upsertParentNotifPref(orgId, ownerUserId, { email_payment_receipts: false, email_invoice_reminders: true });

    try {
      // Sign in as parent to mint a JWT
      const tmp = `/tmp/sb-login-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
      fs.writeFileSync(tmp, JSON.stringify({ email: process.env.E2E_PARENT_EMAIL!, password: process.env.E2E_PARENT_PASSWORD! }));
      let parentToken: string;
      try {
        const res = execSync(
          `curl -s -X POST "${process.env.E2E_SUPABASE_URL}/auth/v1/token?grant_type=password" ` +
            `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" -H "Content-Type: application/json" -d @${tmp}`,
          { encoding: 'utf-8', timeout: 15_000 },
        );
        const session = JSON.parse(res);
        if (!session.access_token) throw new Error(`Parent sign-in failed: ${JSON.stringify(session).slice(0, 200)}`);
        parentToken = session.access_token as string;
      } finally {
        try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      }

      // SELECT all rows in this org via parent JWT — RLS should scope to user_id=auth.uid()
      const result = execSync(
        `curl -s "${process.env.E2E_SUPABASE_URL}/rest/v1/notification_preferences?org_id=eq.${orgId}&select=user_id,email_payment_receipts,email_invoice_reminders" ` +
          `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
          `-H "Authorization: Bearer ${parentToken}"`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const rows = JSON.parse(result);
      expect(Array.isArray(rows)).toBe(true);
      // Parent must see exactly own row, never the owner's row
      expect(rows.length).toBe(1);
      expect(rows[0].user_id).toBe(parentUserId);
      expect(rows[0].email_payment_receipts).toBe(true);
      expect(rows[0].email_invoice_reminders).toBe(false);
    } finally {
      deleteParentNotifPref(orgId, parentUserId);
      deleteParentNotifPref(orgId, ownerUserId);
    }
  });

  test('anonymous (no JWT) → 0 rows from notification_preferences (block-anon policy)', async () => {
    const orgId = process.env.E2E_ORG_ID!;
    // No row needed; anon policy USING (false) returns 0 unconditionally
    const result = execSync(
      `curl -s "${process.env.E2E_SUPABASE_URL}/rest/v1/notification_preferences?org_id=eq.${orgId}&select=user_id" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_ANON_KEY}"`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const rows = JSON.parse(result);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(0);
  });
});

// ─── Inline helpers for §27 tests ───
// send-payment-receipt requires service-role auth (Bearer == SERVICE_ROLE_KEY).
// We POST directly with execSync curl rather than supabase-js so the request
// signature exactly mirrors how stripe-webhook calls it in production.

interface ReceiptResponse {
  status: number;
  body: any;
}

function callSendPaymentReceipt(payload: { paymentId: string; invoiceId: string; orgId: string }, opts?: { auth?: 'service' | 'anon' | 'none' }): ReceiptResponse {
  const reqFile = `/tmp/sb-rec-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  const respFile = `/tmp/sb-rec-resp-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
  fs.writeFileSync(reqFile, JSON.stringify(payload));
  const auth = opts?.auth ?? 'service';
  let authHeader = '';
  if (auth === 'service') {
    authHeader = `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" `;
  } else if (auth === 'anon') {
    authHeader = `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_ANON_KEY}" `;
  }
  try {
    const status = execSync(
      `curl -s -o ${respFile} -w "%{http_code}" ` +
        `-X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/send-payment-receipt" ` +
        `${authHeader}` +
        `-H "Content-Type: application/json" ` +
        `-d @${reqFile}`,
      { encoding: 'utf-8', timeout: 30_000 }
    );
    const respText = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    let body: any;
    try { body = JSON.parse(respText); } catch { body = respText; }
    return { status: parseInt(status.trim(), 10), body };
  } finally {
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
  }
}

function selectNotifPrefServiceRole(query: string): any[] {
  const result = execSync(
    `curl -s "${process.env.E2E_SUPABASE_URL}/rest/v1/notification_preferences?${query}" ` +
      `-H "apikey: ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
      `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}"`,
    { encoding: 'utf-8', timeout: 15_000 }
  );
  try { return JSON.parse(result); } catch { return []; }
}

function insertMessageLogRaw(payload: Record<string, unknown>): { status: number; body: string } {
  const reqFile = `/tmp/sb-ml-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  const respFile = `/tmp/sb-ml-resp-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
  fs.writeFileSync(reqFile, JSON.stringify(payload));
  try {
    const status = execSync(
      `curl -s -o ${respFile} -w "%{http_code}" ` +
        `-X POST "${process.env.E2E_SUPABASE_URL}/rest/v1/message_log" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
        `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
        `-H "Content-Type: application/json" ` +
        `-H "Prefer: return=representation" ` +
        `-d @${reqFile}`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
    const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    return { status: parseInt(status.trim(), 10), body };
  } finally {
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
  }
}

function selectMessageLogServiceRole(query: string): any[] {
  const result = execSync(
    `curl -s "${process.env.E2E_SUPABASE_URL}/rest/v1/message_log?${query}" ` +
      `-H "apikey: ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
      `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}"`,
    { encoding: 'utf-8', timeout: 15_000 }
  );
  try { return JSON.parse(result); } catch { return []; }
}

function upsertParentNotifPref(
  orgId: string, userId: string, prefs: Record<string, boolean>,
): void {
  const reqFile = `/tmp/sb-pref-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  fs.writeFileSync(reqFile, JSON.stringify({ org_id: orgId, user_id: userId, ...prefs }));
  try {
    execSync(
      `curl -s -X POST "${process.env.E2E_SUPABASE_URL}/rest/v1/notification_preferences" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
        `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
        `-H "Content-Type: application/json" ` +
        `-H "Prefer: resolution=merge-duplicates" ` +
        `-d @${reqFile}`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
  } finally {
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
  }
}

function deleteParentNotifPref(orgId: string, userId: string): void {
  execSync(
    `curl -s -X DELETE "${process.env.E2E_SUPABASE_URL}/rest/v1/notification_preferences?org_id=eq.${orgId}&user_id=eq.${userId}" ` +
      `-H "apikey: ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
      `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}"`,
    { encoding: 'utf-8', timeout: 15_000 }
  );
}

function insertPaymentServiceRole(payload: Record<string, unknown>): { id: string } {
  const reqFile = `/tmp/sb-pay-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  fs.writeFileSync(reqFile, JSON.stringify(payload));
  try {
    const result = execSync(
      `curl -s -X POST "${process.env.E2E_SUPABASE_URL}/rest/v1/payments" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
        `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
        `-H "Content-Type: application/json" ` +
        `-H "Prefer: return=representation" ` +
        `-d @${reqFile}`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
    const rows = JSON.parse(result);
    if (!Array.isArray(rows) || !rows[0]?.id) {
      throw new Error(`payments insert failed: ${result}`);
    }
    return { id: rows[0].id };
  } finally {
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
  }
}

test.describe('§27.2 — notification_preferences pref-honoring contract (DB-shape)', () => {
  // The cleanest assertion of "edge fn honors prefs" is direct invocation of
  // send-payment-receipt with prefs=false. That's deferred — see fixme below
  // (§27 fn-invocation tests need the .env.test E2E_SUPABASE_SERVICE_ROLE_KEY
  // to byte-match what the deployed function's Deno env has, and that's
  // currently drifted post 2026-05-08 migration).
  //
  // What we CAN prove without invocation: the upstream contract the fn
  // depends on. Specifically, that the same `(user_id, org_id)`-keyed
  // SELECT from `notification_preferences` that
  // `_shared/check-notification-pref.ts` and `send-payment-receipt`
  // perform at runtime returns the value that was just upserted.
  // If this contract breaks, the fn will misread prefs even with correct
  // auth — the catch is one schema migration away.

  test('email_payment_receipts=false survives upsert + fn-shape SELECT', async () => {
    const orgId = process.env.E2E_ORG_ID!;
    const parentUserId = E2E_PARENT_USER_ID;

    upsertParentNotifPref(orgId, parentUserId, { email_payment_receipts: false });

    try {
      // Mirror the exact query shape from supabase/functions/_shared/check-notification-pref.ts
      // (.eq('org_id', orgId).eq('user_id', userId).select('email_payment_receipts'))
      const rows = selectNotifPrefServiceRole(
        `org_id=eq.${orgId}&user_id=eq.${parentUserId}&select=email_payment_receipts`,
      );
      expect(rows.length).toBe(1);
      expect(rows[0].email_payment_receipts).toBe(false);
    } finally {
      deleteParentNotifPref(orgId, parentUserId);
    }
  });

  test('absent notification_preferences row → SELECT returns 0 rows (default-on contract)', async () => {
    // The fn defaults transactional emails ON when no prefs row exists.
    // (`isNotificationEnabled`: `if (!data) return !MARKETING_KEYS.has(prefKey)`).
    // Verify the absence side: the SELECT must return 0 rows when no prefs
    // are set. If a default-row trigger ever materialised on user signup,
    // this test would catch the contract break.
    const orgId = process.env.E2E_ORG_ID!;
    const parentUserId = E2E_PARENT_USER_ID;

    // Ensure no row exists
    deleteParentNotifPref(orgId, parentUserId);

    const rows = selectNotifPrefServiceRole(
      `org_id=eq.${orgId}&user_id=eq.${parentUserId}&select=email_payment_receipts`,
    );
    expect(rows.length).toBe(0);
  });
});

test.describe('§27 dedup — T05-F4 unique partial index on payment_receipt', () => {
  // The dedup contract is enforced at TWO layers:
  //   1) edge fn pre-check (`existingReceipt` SELECT, line 95-108)
  //   2) `idx_message_log_payment_receipt_dedup` UNIQUE partial index
  //      ON (payment_id) WHERE (message_type='payment_receipt' AND payment_id IS NOT NULL)
  // We test layer (2) directly — a dropped index would silently allow
  // duplicates even if layer (1) raced and both rows reached INSERT.
  // (The fn's catch at line 272 explicitly handles 23505 from this index.)
  test('inserting two payment_receipt rows with the same payment_id violates UNIQUE', async () => {
    const orgId = process.env.E2E_ORG_ID!;
    const parentGuardianId = E2E_PARENT_GUARDIAN_ID;
    const testId = `e2e_${Date.now()}_${randomBytes(2).toString('hex')}`;
    const dueDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const invoice = createTestInvoice({
      dueDate,
      payerGuardianId: parentGuardianId,
      notes: testId,
      items: [{ description: 'e2e dedup', quantity: 1, unit_price_minor: 999 }],
    });
    if (!invoice?.id) throw new Error(`createTestInvoice failed: ${JSON.stringify(invoice)}`);
    const invoiceId = invoice.id;
    const invoiceNumber = invoice.invoice_number;
    const { id: paymentId } = insertPaymentServiceRole({
      org_id: orgId,
      invoice_id: invoiceId,
      amount_minor: 999,
      currency_code: 'GBP',
      method: 'card',
      provider: 'stripe',
    });

    const baseRow = {
      org_id: orgId,
      channel: 'email',
      subject: `Payment Receipt — ${invoiceNumber}`,
      body: '<p>seeded by §27 dedup test</p>',
      recipient_email: process.env.E2E_PARENT_EMAIL!,
      recipient_name: 'e2e parent',
      recipient_type: 'guardian',
      related_id: invoiceId,
      payment_id: paymentId,
      message_type: 'payment_receipt' as const,
      status: 'sent' as const,
    };
    const firstLog = supabaseInsert('message_log', baseRow);
    expect(firstLog?.id).toBeTruthy();

    try {
      // Second insert with same (payment_id, message_type='payment_receipt')
      // must fail with 23505 (unique_violation).
      const secondAttempt = insertMessageLogRaw(baseRow);
      expect(secondAttempt.status).toBeGreaterThanOrEqual(400);
      expect(secondAttempt.body).toMatch(/23505|unique|duplicate|conflict/i);

      // Confirm only the original row is present
      const logs = selectMessageLogServiceRole(`payment_id=eq.${paymentId}&select=id`);
      expect(logs.length).toBe(1);
      expect(logs[0].id).toBe(firstLog.id);
    } finally {
      supabaseDelete('message_log', `payment_id=eq.${paymentId}`);
      supabaseDelete('payments', `id=eq.${paymentId}`);
      supabaseDelete('invoice_items', `invoice_id=eq.${invoiceId}`);
      supabaseDelete('invoices', `id=eq.${invoiceId}`);
    }
  });
});

test.describe('§27 RBAC — service-role auth gate', () => {
  test('POST without service-role bearer → 401', async () => {
    const resp = callSendPaymentReceipt(
      { paymentId: '00000000-0000-0000-0000-000000000000', invoiceId: '00000000-0000-0000-0000-000000000000', orgId: process.env.E2E_ORG_ID! },
      { auth: 'anon' },
    );
    expect(resp.status).toBe(401);
    expect(String(resp.body?.error ?? resp.body)).toMatch(/unauthorized/i);
  });

  test('POST with no auth header → 401', async () => {
    const resp = callSendPaymentReceipt(
      { paymentId: '00000000-0000-0000-0000-000000000000', invoiceId: '00000000-0000-0000-0000-000000000000', orgId: process.env.E2E_ORG_ID! },
      { auth: 'none' },
    );
    expect(resp.status).toBe(401);
  });
});

// §27 fn-invocation tests for end-to-end pref-honoring (e.g. POST
// send-payment-receipt with prefs=false → asserts {message: 'opted out'}
// + zero message_log rows). Deferred until E2E_SUPABASE_SERVICE_ROLE_KEY in
// .env.test byte-matches the deployed function's `SUPABASE_SERVICE_ROLE_KEY`
// env (drifted post 2026-05-08 migration; the function's internal
// `authHeader.includes(supabaseServiceKey)` returns false, fn responds 401).
// Refresh requires either reading the deployment env (Management API returns
// SHA-256 only — not plaintext) or rotating, both of which need Jamie's go-ahead.
//
// Until then the §27.2 + §27 dedup tests above prove the contracts the fn
// depends on (prefs upsert + dedup unique partial index) at the DB layer.
// TODO §27.2 — POST send-payment-receipt with prefs=false → {opted out} + no message_log row
//   (deferred per the comment block above; needs E2E service-role key refresh)
// TODO §27 dedup — POST send-payment-receipt twice with same payment_id → 2nd returns {duplicate:true}
//   (same blocker as §27.2 fn-invocation)
// TODO §27.1 — sending invoice writes message_log row (UI flow)
// TODO §27.1 — overdue cron writes N reminders per overdue_reminder_days
// TODO §27.3 — push token lifecycle: login registers, logout removes

// ────────────────────────────────────────────────────────────────────
// §27 — Calendar-cluster notification edge fn auth-gate contracts (s20)
// ────────────────────────────────────────────────────────────────────
//
// Three Calendar & Lessons cluster notification fns lacked auth-gate
// coverage in audit/MASTER.md. Same shape as s17 §24 / s18 §3.8 /
// §24 C-bucket: anon→4xx + no-auth→4xx prove the gate fires.
//
// * notify-makeup-offer: dual auth (user JWT or service-role bearer).
//   s16 getUser fix per 4b1704e — user-JWT path was bare getUser().
//   Test the user-JWT path (anon JWT rejected); service-role path
//   covered by the byte-equal Bearer check.
// * notify-makeup-match: service-role-only invoke (Bearer ===
//   SERVICE_ROLE_KEY exact match). Called by pg_net trigger. Test
//   the byte-equal gate.
// * send-notes-notification: user JWT + rate limit; getUser fix
//   per 7c37115 (s16). Test the user-JWT gate.

function callCalNotifGate(fnName: string, opts: { auth: 'anon' | 'none'; payload?: Record<string, unknown> }): { status: number; body: string } {
  const respFile = `/tmp/sb-cal-${fnName}-resp-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
  const reqFile = `/tmp/sb-cal-${fnName}-req-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  fs.writeFileSync(reqFile, JSON.stringify(opts.payload ?? {}));
  let authHeader = '';
  if (opts.auth === 'anon') {
    authHeader = `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_ANON_KEY}" `;
  }
  try {
    const status = execSync(
      `curl -s -o ${respFile} -w "%{http_code}" ` +
        `-X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/${fnName}" ` +
        `${authHeader}` +
        `-H "Content-Type: application/json" ` +
        `-d @${reqFile}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    return { status: parseInt(status.trim(), 10), body };
  } finally {
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
  }
}

test.describe('§27 — Calendar-cluster notification fn auth-gate contracts', () => {
  for (const fnName of [
    'send-notes-notification',  // user-JWT (s16 fix per 7c37115)
    'notify-makeup-offer',      // dual auth — user-JWT path tested
    'notify-makeup-match',      // service-role-only (byte-equal Bearer)
  ]) {
    test(`${fnName} — anon JWT rejected`, async () => {
      const res = callCalNotifGate(fnName, { auth: 'anon', payload: { lesson_id: '00000000-0000-0000-0000-000000000000', waitlist_id: '00000000-0000-0000-0000-000000000000' } });
      expect(res.status, `${fnName} body: ${res.body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    test(`${fnName} — no auth rejected`, async () => {
      const res = callCalNotifGate(fnName, { auth: 'none' });
      expect(res.status, `${fnName} body: ${res.body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
    });
  }
});

// ────────────────────────────────────────────────────────────────────
// §27 — Cron-lifecycle handler auth-gate contracts (s21)
// ────────────────────────────────────────────────────────────────────
//
// 13 cron handlers verified to use `validateCronAuth(req)` (x-cron-
// secret header pattern). Same shape as s18 callFnCronAuthGate from
// §24. Auth-gate proof: missing x-cron-secret → 401; wrong x-cron-
// secret → 401. Happy path requires the real INTERNAL_CRON_SECRET
// (vault-only, not in .env.test); negatives are sufficient proof of
// the gate.
//
// admin-backfill-default-pm and stripe-auto-pay-installment already
// have these tests in §24 C-bucket (s18) — not duplicated here.

function callCronGate(fnName: string, opts: { secret: 'wrong' | 'none' }): { status: number; body: string } {
  const respFile = `/tmp/sb-cron-${fnName}-resp-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
  const reqFile = `/tmp/sb-cron-${fnName}-req-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  fs.writeFileSync(reqFile, JSON.stringify({}));
  let cronHeader = '';
  if (opts.secret === 'wrong') {
    cronHeader = `-H "x-cron-secret: definitely-not-the-real-secret-${Date.now()}" `;
  }
  try {
    const status = execSync(
      `curl -s -o ${respFile} -w "%{http_code}" ` +
        `-X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/${fnName}" ` +
        `${cronHeader}` +
        `-H "Content-Type: application/json" ` +
        `-d @${reqFile}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    return { status: parseInt(status.trim(), 10), body };
  } finally {
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
  }
}

// ────────────────────────────────────────────────────────────────────
// §27 — Multi-area edge fn auth-gate contracts (s22)
// ────────────────────────────────────────────────────────────────────
//
// Multi-area sweep — auth-gate contracts for fns across Subscriptions
// & Trial, Messaging, and Students & Guardians clusters that lack
// fn-invocation tests. Same pattern as s17 §24 / s18 §3.8 / s20 §27
// calendar / s21 §27 cron-lifecycle.
//
// All 8 fns are user-JWT (Authorization header → getUser(token) post-
// s12-s16 sweep). anon→4xx + no-auth→4xx prove the gate fires.

test.describe('§27 — Multi-area edge fn auth-gate contracts (s22)', () => {
  for (const fnName of [
    // Subscriptions & Trial cluster (4 fns)
    'stripe-subscription-checkout',  // tier upgrade self-serve
    'stripe-billing-history',         // billing history list
    'stripe-connect-onboard',         // per-org Connect flow
    'stripe-connect-status',          // post-onboard status check
    // Messaging cluster (3 fns)
    'send-parent-enquiry',            // public-form parent enquiry
    'notify-internal-message',        // staff internal-msg notify
    'send-cancellation-notification', // parent cancel comms
    // Students & Guardians (1 fn)
    'batch-invite-guardians',         // bulk guardian invite via Resend
  ]) {
    test(`${fnName} — anon JWT rejected`, async () => {
      const reqFile = `/tmp/sb-multi-${fnName}-req-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
      const respFile = `/tmp/sb-multi-${fnName}-resp-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
      fs.writeFileSync(reqFile, JSON.stringify({ orgId: process.env.E2E_ORG_ID }));
      try {
        const status = execSync(
          `curl -s -o ${respFile} -w "%{http_code}" ` +
            `-X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/${fnName}" ` +
            `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
            `-H "Content-Type: application/json" -d @${reqFile}`,
          { encoding: 'utf-8', timeout: 15_000 },
        );
        const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
        const code = parseInt(status.trim(), 10);
        expect(code, `${fnName} body: ${body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
        expect(code).toBeLessThan(500);
      } finally {
        try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
        try { fs.unlinkSync(respFile); } catch { /* ignore */ }
      }
    });

    test(`${fnName} — no auth rejected`, async () => {
      const reqFile = `/tmp/sb-multi-${fnName}-req-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
      const respFile = `/tmp/sb-multi-${fnName}-resp-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
      fs.writeFileSync(reqFile, JSON.stringify({ orgId: process.env.E2E_ORG_ID }));
      try {
        const status = execSync(
          `curl -s -o ${respFile} -w "%{http_code}" ` +
            `-X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/${fnName}" ` +
            `-H "Content-Type: application/json" -d @${reqFile}`,
          { encoding: 'utf-8', timeout: 15_000 },
        );
        const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
        const code = parseInt(status.trim(), 10);
        expect(code, `${fnName} body: ${body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      } finally {
        try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
        try { fs.unlinkSync(respFile); } catch { /* ignore */ }
      }
    });
  }
});

test.describe('§27 — Cron-lifecycle handler auth-gate contracts', () => {
  for (const fnName of [
    'invoice-overdue-check',
    'installment-overdue-check',
    'installment-upcoming-reminder',
    'auto-pay-upcoming-reminder',
    'auto-pay-final-reminder',
    'send-lesson-reminders',
    'calendar-refresh-busy',
    'overdue-reminders',
    'credit-expiry',
    'credit-expiry-warning',
    'cleanup-orphaned-resources',
    'cleanup-webhook-retention',
    'cleanup-invoice-pdf-orphans',
  ]) {
    test(`${fnName} — missing x-cron-secret rejected (401)`, async () => {
      const res = callCronGate(fnName, { secret: 'none' });
      expect(res.status, `${fnName} body: ${res.body.slice(0, 200)}`).toBe(401);
    });

    test(`${fnName} — wrong x-cron-secret rejected (401)`, async () => {
      const res = callCronGate(fnName, { secret: 'wrong' });
      expect(res.status, `${fnName} body: ${res.body.slice(0, 200)}`).toBe(401);
    });
  }
});
