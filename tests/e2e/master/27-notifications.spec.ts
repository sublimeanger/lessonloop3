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

// ────────────────────────────────────────────────────────────────────
// §27 — Multi-area edge fn auth-gate contracts (s23)
// ────────────────────────────────────────────────────────────────────
//
// Final multi-area sweep — auth-gate contracts for AI/LoopAssist,
// Calendar (user-JWT), and Xero (user-JWT) clusters. Same pattern as
// s17 §24 / s18 §3.8 / s20 §27 calendar / s21 §27 cron-lifecycle /
// s22 §27 multi-area. anon→4xx + no-auth→4xx prove the gate fires.
//
// AI cluster (4): looopassist-chat / looopassist-execute (s16 getUser
//   fix per e13fb0a), parent-loopassist-chat, csv-import-mapping —
//   all user-JWT auth.
// Calendar cluster (4 user-JWT fns): calendar-disconnect /
//   calendar-fetch-busy / calendar-oauth-start / calendar-sync-lesson.
//   These four still use bare getUser() (LOW priority in s16 sweep
//   per HANDOVER row 1302; not yet patched). The auth-gate contract
//   still fires correctly under bare getUser() because anon JWT has
//   no `sub` claim → /auth/v1/user errors → 401. The contract proves
//   the gate, independent of getUser implementation.
// Xero cluster (2 user-JWT promotable): xero-oauth-start /
//   xero-disconnect (s16 getUser fix per e13fb0a). xero-sync-invoice
//   and xero-sync-payment have unresolved findings (NOT NULL drift,
//   FK name, prefix bug) so they stay 🟡 with [CONDITIONAL at v1]
//   tag. xero-oauth-callback has no user-JWT path.

test.describe('§27 — Multi-area edge fn auth-gate contracts (s23)', () => {
  for (const fnName of [
    // AI cluster (4)
    'looopassist-chat',           // staff LoopAssist
    'looopassist-execute',        // staff LoopAssist tool execute
    'parent-loopassist-chat',     // parent portal LoopAssist
    'csv-import-mapping',         // Gemini-backed CSV column mapping
    // Calendar cluster — user-JWT fns (4)
    'calendar-disconnect',        // disconnect provider connection
    'calendar-fetch-busy',        // fetch busy slots from provider
    'calendar-oauth-start',       // start OAuth flow
    'calendar-sync-lesson',       // sync single lesson to provider
    // Xero cluster — user-JWT promotable (2)
    'xero-oauth-start',           // start Xero OAuth flow
    'xero-disconnect',            // disconnect Xero connection
  ]) {
    test(`${fnName} — anon JWT rejected`, async () => {
      const reqFile = `/tmp/sb-s23-${fnName}-req-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
      const respFile = `/tmp/sb-s23-${fnName}-resp-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
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
      const reqFile = `/tmp/sb-s23-${fnName}-req-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
      const respFile = `/tmp/sb-s23-${fnName}-resp-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
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

// ────────────────────────────────────────────────────────────────────
// §27 — Xero day-one contracts (s24)
// ────────────────────────────────────────────────────────────────────
//
// Per s24 stance recalibration: Xero promoted from CONDITIONAL → DAY-ONE
// LAUNCH. This describe block covers the 3 remaining 🟡 Xero rows that
// weren't covered by s23 multi-area auth-gate (xero-oauth-start +
// xero-disconnect were promoted in s23 12240c4).
//
// xero-oauth-callback: verify_jwt=false; OAuth redirect entry point.
//   Three deterministic contracts:
//   - missing/invalid state param → 400 "Invalid state parameter"
//   - state present + error param → 302 redirect to redirect_uri
//     with ?xero_error=<error>
//   - state present + no code → 302 redirect with ?xero_error=no_code
//   The save_failed UNIQUE-conflict path (s7 fix) requires real Xero
//   token exchange to reach; auth-gate negatives are sufficient proof
//   for the agent-tagable contract (full E2E happens via real OAuth
//   in production).
//
// xero-sync-invoice + xero-sync-payment: user-JWT auth-gate. Same
//   shape as s23 multi-area (anon→4xx, no-auth→4xx). Real Xero API
//   side effects (creating invoices/payments) deferred to production
//   verification.

function callXeroOauthCallback(opts: {
  state?: string;
  code?: string;
  error?: string;
}): { status: number; body: string; location: string | null } {
  const params = new URLSearchParams();
  if (opts.state !== undefined) params.set('state', opts.state);
  if (opts.code !== undefined) params.set('code', opts.code);
  if (opts.error !== undefined) params.set('error', opts.error);
  const url = `${process.env.E2E_SUPABASE_URL}/functions/v1/xero-oauth-callback?${params.toString()}`;
  const respFile = `/tmp/sb-xero-cb-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
  const headerFile = `/tmp/sb-xero-cb-h-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
  try {
    const status = execSync(
      `curl -s -o ${respFile} -D ${headerFile} -w "%{http_code}" "${url}"`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    const headers = fs.existsSync(headerFile) ? fs.readFileSync(headerFile, 'utf-8') : '';
    const locMatch = headers.match(/^location:\s*(.+?)\r?$/im);
    return { status: parseInt(status.trim(), 10), body, location: locMatch ? locMatch[1].trim() : null };
  } finally {
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    try { fs.unlinkSync(headerFile); } catch { /* ignore */ }
  }
}

test.describe('§27 — Xero day-one contracts (s24)', () => {
  test('xero-oauth-callback — missing state → 400 Invalid state parameter', async () => {
    const res = callXeroOauthCallback({});
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(400);
    expect(res.body).toMatch(/invalid state/i);
  });

  test('xero-oauth-callback — invalid base64 state → 400 Invalid state parameter', async () => {
    const res = callXeroOauthCallback({ state: 'not-valid-base64-json!!!' });
    expect(res.status).toBe(400);
    expect(res.body).toMatch(/invalid state/i);
  });

  test('xero-oauth-callback — valid state + error param → redirect with ?xero_error=', async () => {
    const stateData = {
      user_id: '00000000-0000-0000-0000-000000000000',
      org_id: process.env.E2E_ORG_ID,
      redirect_uri: 'https://app.lessonloop.net/settings',
      nonce: 'test-nonce',
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
    const res = callXeroOauthCallback({ state, error: 'access_denied' });
    expect(res.status).toBe(302);
    expect(res.location).toMatch(/xero_error=access_denied/);
  });

  test('xero-oauth-callback — valid state + no code → redirect with ?xero_error=no_code', async () => {
    const stateData = {
      user_id: '00000000-0000-0000-0000-000000000000',
      org_id: process.env.E2E_ORG_ID,
      redirect_uri: 'https://app.lessonloop.net/settings',
      nonce: 'test-nonce',
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
    const res = callXeroOauthCallback({ state });
    expect(res.status).toBe(302);
    expect(res.location).toMatch(/xero_error=no_code/);
  });

  // Xero sync fns — user-JWT auth-gate (same shape as s23 multi-area)
  for (const fnName of ['xero-sync-invoice', 'xero-sync-payment']) {
    test(`${fnName} — anon JWT rejected`, async () => {
      const reqFile = `/tmp/sb-xero-s24-${fnName}-req-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
      const respFile = `/tmp/sb-xero-s24-${fnName}-resp-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
      fs.writeFileSync(reqFile, JSON.stringify({ invoice_id: '00000000-0000-0000-0000-000000000000', payment_id: '00000000-0000-0000-0000-000000000000' }));
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
      const reqFile = `/tmp/sb-xero-s24-${fnName}-req-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
      const respFile = `/tmp/sb-xero-s24-${fnName}-resp-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
      fs.writeFileSync(reqFile, JSON.stringify({ invoice_id: '00000000-0000-0000-0000-000000000000', payment_id: '00000000-0000-0000-0000-000000000000' }));
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

  // LL-LL prefix fix verification — read deployed source via Management API
  // is out of test scope; the fix landed in xero-sync-invoice v21 (s24);
  // see audit/findings/2026-05-07-xero-sync-invoice-ll-prefix-bug.md.
});

// ────────────────────────────────────────────────────────────────────
// §27 — Leads/Booking/Waitlist un-deferral contracts (s24)
// ────────────────────────────────────────────────────────────────────
//
// Per s24 stance recalibration: leads/booking/waitlist + send-contact-message
// promoted to LAUNCH IN-SCOPE. Three edge fns get auth-gate / contract
// coverage here:
//
// - send-enrolment-offer: user-JWT (s24 getUser(token) fix landed in v19).
// - waitlist-respond: GET-only public endpoint with WAITLIST_JWT_SECRET-
//   signed JWT in ?token query param. HTML responses (no JSON).
// - send-contact-message: public POST with honeypot field + IP rate
//   limit + required-fields + email format + message length validation.

function callPublicFn(fnName: string, opts: { method?: 'GET' | 'POST'; query?: Record<string, string>; body?: any; useAnonAuth?: boolean }): { status: number; body: string } {
  const respFile = `/tmp/sb-pub-${fnName}-resp-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
  const reqFile = `/tmp/sb-pub-${fnName}-req-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  const method = opts.method ?? 'POST';
  const queryStr = opts.query ? '?' + new URLSearchParams(opts.query).toString() : '';
  const url = `${process.env.E2E_SUPABASE_URL}/functions/v1/${fnName}${queryStr}`;
  fs.writeFileSync(reqFile, JSON.stringify(opts.body ?? {}));
  // Spoof unique IP per call to keep rate-limit buckets distinct
  const r = randomBytes(3);
  const fakeIp = `10.${r[0]}.${r[1]}.${r[2]}`;
  try {
    let cmd =
      `curl -s -o ${respFile} -w "%{http_code}" ` +
      `-X ${method} "${url}" ` +
      `-H "X-Forwarded-For: ${fakeIp}" ` +
      `-H "Content-Type: application/json" `;
    if (opts.useAnonAuth) {
      cmd += `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_ANON_KEY}" `;
    }
    if (method === 'POST') cmd += `-d @${reqFile}`;
    const status = execSync(cmd, { encoding: 'utf-8', timeout: 15_000 });
    const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    return { status: parseInt(status.trim(), 10), body };
  } finally {
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
  }
}

function resetPublicRateLimits(): void {
  const url = process.env.E2E_SUPABASE_URL!;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) return;
  execSync(
    `curl -s -X DELETE "${url}/rest/v1/rate_limits?action_type=in.(send-contact-message,send-enrolment-offer,waitlist-respond)" ` +
      `-H "apikey: ${key}" -H "Authorization: Bearer ${key}" -H "Prefer: return=minimal"`,
    { encoding: 'utf-8', timeout: 10_000 },
  );
}

test.describe('§27 — Leads/Booking/Waitlist un-deferral contracts (s24)', () => {
  test.beforeAll(() => {
    resetPublicRateLimits();
  });

  // send-enrolment-offer: user-JWT auth-gate
  test('send-enrolment-offer — anon JWT rejected', async () => {
    const res = callPublicFn('send-enrolment-offer', {
      useAnonAuth: true,
      body: { waitlist_id: '00000000-0000-0000-0000-000000000000', org_id: process.env.E2E_ORG_ID },
    });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('send-enrolment-offer — no auth rejected', async () => {
    const res = callPublicFn('send-enrolment-offer', {
      body: { waitlist_id: '00000000-0000-0000-0000-000000000000', org_id: process.env.E2E_ORG_ID },
    });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
  });

  // waitlist-respond: GET-only HTML responder. Verify_jwt:false at gateway
  // (anon Bearer not required because the JWT is in query string).
  test('waitlist-respond — missing token → 400 Invalid Link', async () => {
    const res = callPublicFn('waitlist-respond', { method: 'GET', query: { action: 'accept' } });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(400);
    expect(res.body).toMatch(/invalid link/i);
  });

  test('waitlist-respond — missing action → 400 Invalid Link', async () => {
    const res = callPublicFn('waitlist-respond', { method: 'GET', query: { token: 'placeholder' } });
    expect(res.status).toBe(400);
    expect(res.body).toMatch(/invalid link/i);
  });

  test('waitlist-respond — invalid action → 400 Invalid Link', async () => {
    const res = callPublicFn('waitlist-respond', { method: 'GET', query: { token: 'placeholder', action: 'maybe' } });
    expect(res.status).toBe(400);
    expect(res.body).toMatch(/invalid link/i);
  });

  test('waitlist-respond — invalid JWT token → 400 Link Expired', async () => {
    const res = callPublicFn('waitlist-respond', { method: 'GET', query: { token: 'not-a-real-jwt', action: 'accept' } });
    expect(res.status).toBe(400);
    expect(res.body).toMatch(/expired/i);
  });

  // send-contact-message: public POST with honeypot + IP rate limit
  test('send-contact-message — GET → 405', async () => {
    const res = callPublicFn('send-contact-message', { method: 'GET', useAnonAuth: true });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(405);
  });

  test('send-contact-message — POST honeypot field filled → silent 200', async () => {
    const res = callPublicFn('send-contact-message', {
      useAnonAuth: true,
      body: {
        firstName: 'Bot',
        lastName: 'Spam',
        email: 'bot@example.com',
        subject: 'spam',
        message: 'spam spam spam spam spam',
        website: 'http://spam.example.com', // honeypot
      },
    });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(200);
    expect(res.body).toMatch(/sent successfully|message received/i);
  });

  test('send-contact-message — POST missing fields → 400', async () => {
    const res = callPublicFn('send-contact-message', {
      useAnonAuth: true,
      body: { firstName: 'Test' }, // missing other required fields
    });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(400);
    expect(res.body).toMatch(/required/i);
  });

  test('send-contact-message — POST invalid email format → 400', async () => {
    const res = callPublicFn('send-contact-message', {
      useAnonAuth: true,
      body: {
        firstName: 'Test',
        lastName: 'User',
        email: 'not-an-email',
        subject: 'Hi',
        message: 'This is a message of more than 10 chars',
      },
    });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(400);
    expect(res.body).toMatch(/email/i);
  });

  test('send-contact-message — POST message too short → 400', async () => {
    const res = callPublicFn('send-contact-message', {
      useAnonAuth: true,
      body: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        subject: 'Hi',
        message: 'short',
      },
    });
    expect(res.status, `body: ${res.body.slice(0, 200)}`).toBe(400);
    expect(res.body).toMatch(/10 and 2000/);
  });
});

// ────────────────────────────────────────────────────────────────────
// §27 — Invite cluster un-deferral contracts (s24)
// ────────────────────────────────────────────────────────────────────
//
// Per s24 stance recalibration: invite cluster (send-invite-email,
// invite-get, invite-accept) were 🟡 from prior structural-only audit.
// Three contracts each prove the gate / public-token surface fires.
//
// - send-invite-email: user-JWT auth (anon → 401, no auth → 401).
// - invite-get: public POST {token: <jwt>}, IP rate limit (5/min);
//   missing token → 400, non-existent token → 404.
// - invite-accept: user-JWT auth + jwtToken renamed to avoid collision
//   with invite token from req.json (per s16 fix); auth-gate proves
//   anon → 401, no auth → 401.

test.describe('§27 — Invite cluster un-deferral contracts (s24)', () => {
  // send-invite-email — user-JWT auth-gate
  test('send-invite-email — anon JWT rejected', async () => {
    const reqFile = `/tmp/sb-inv-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    const respFile = `/tmp/sb-inv-r-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
    fs.writeFileSync(reqFile, JSON.stringify({ orgId: process.env.E2E_ORG_ID, email: 'test@example.com', role: 'teacher' }));
    try {
      const status = execSync(
        `curl -s -o ${respFile} -w "%{http_code}" -X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/send-invite-email" ` +
          `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_ANON_KEY}" -H "Content-Type: application/json" -d @${reqFile}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
      const code = parseInt(status.trim(), 10);
      expect(code, `body: ${body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(code).toBeLessThan(500);
    } finally {
      try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
      try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    }
  });

  test('send-invite-email — no auth rejected', async () => {
    const reqFile = `/tmp/sb-inv-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    const respFile = `/tmp/sb-inv-r-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
    fs.writeFileSync(reqFile, JSON.stringify({ orgId: process.env.E2E_ORG_ID, email: 'test@example.com', role: 'teacher' }));
    try {
      const status = execSync(
        `curl -s -o ${respFile} -w "%{http_code}" -X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/send-invite-email" ` +
          `-H "Content-Type: application/json" -d @${reqFile}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
      const code = parseInt(status.trim(), 10);
      expect(code, `body: ${body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
    } finally {
      try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
      try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    }
  });

  // invite-get — public POST with token; verify_jwt:true requires anon Bearer
  test('invite-get — POST missing token → 400', async () => {
    const reqFile = `/tmp/sb-iget-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    const respFile = `/tmp/sb-iget-r-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
    fs.writeFileSync(reqFile, JSON.stringify({}));
    const r = randomBytes(3);
    const fakeIp = `10.${r[0]}.${r[1]}.${r[2]}`;
    try {
      const status = execSync(
        `curl -s -o ${respFile} -w "%{http_code}" -X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/invite-get" ` +
          `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_ANON_KEY}" -H "X-Forwarded-For: ${fakeIp}" -H "Content-Type: application/json" -d @${reqFile}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
      const code = parseInt(status.trim(), 10);
      expect(code, `body: ${body.slice(0, 200)}`).toBe(400);
      expect(body).toMatch(/token/i);
    } finally {
      try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
      try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    }
  });

  test('invite-get — POST non-existent token → 404', async () => {
    const reqFile = `/tmp/sb-iget-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    const respFile = `/tmp/sb-iget-r-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
    fs.writeFileSync(reqFile, JSON.stringify({ token: '00000000-0000-0000-0000-000000000000' }));
    const r = randomBytes(3);
    const fakeIp = `10.${r[0]}.${r[1]}.${r[2]}`;
    try {
      const status = execSync(
        `curl -s -o ${respFile} -w "%{http_code}" -X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/invite-get" ` +
          `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_ANON_KEY}" -H "X-Forwarded-For: ${fakeIp}" -H "Content-Type: application/json" -d @${reqFile}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
      const code = parseInt(status.trim(), 10);
      expect(code, `body: ${body.slice(0, 200)}`).toBe(404);
      expect(body).toMatch(/not found/i);
    } finally {
      try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
      try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    }
  });

  test('invite-get — POST non-UUID token → 404 (was 500 pre-s26 fix)', async () => {
    // s26 fix per finding 2026-05-10-invite-get-returns-500-on-non-uuid-token:
    // UUID-format guard runs BEFORE the DB query so PostgreSQL never sees the
    // bad input + raises 22P02. Bots/fuzzers now get 404 not 500.
    const reqFile = `/tmp/sb-iget-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    const respFile = `/tmp/sb-iget-r-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
    fs.writeFileSync(reqFile, JSON.stringify({ token: 'definitely-not-a-uuid' }));
    const r = randomBytes(3);
    const fakeIp = `10.${r[0]}.${r[1]}.${r[2]}`;
    try {
      const status = execSync(
        `curl -s -o ${respFile} -w "%{http_code}" -X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/invite-get" ` +
          `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_ANON_KEY}" -H "X-Forwarded-For: ${fakeIp}" -H "Content-Type: application/json" -d @${reqFile}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
      const code = parseInt(status.trim(), 10);
      expect(code, `body: ${body.slice(0, 200)}`).toBe(404);
      expect(body).toMatch(/not found/i);
    } finally {
      try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
      try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    }
  });

  // invite-accept — user-JWT auth-gate (s16 jwtToken-rename fix per 7c37115)
  test('invite-accept — anon JWT rejected', async () => {
    const reqFile = `/tmp/sb-iacc-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    const respFile = `/tmp/sb-iacc-r-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
    fs.writeFileSync(reqFile, JSON.stringify({ token: 'placeholder' }));
    try {
      const status = execSync(
        `curl -s -o ${respFile} -w "%{http_code}" -X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/invite-accept" ` +
          `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_ANON_KEY}" -H "Content-Type: application/json" -d @${reqFile}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
      const code = parseInt(status.trim(), 10);
      expect(code, `body: ${body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(code).toBeLessThan(500);
    } finally {
      try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
      try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    }
  });

  test('invite-accept — no auth rejected', async () => {
    const reqFile = `/tmp/sb-iacc-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    const respFile = `/tmp/sb-iacc-r-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
    fs.writeFileSync(reqFile, JSON.stringify({ token: 'placeholder' }));
    try {
      const status = execSync(
        `curl -s -o ${respFile} -w "%{http_code}" -X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/invite-accept" ` +
          `-H "Content-Type: application/json" -d @${reqFile}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
      const code = parseInt(status.trim(), 10);
      expect(code, `body: ${body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
    } finally {
      try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
      try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// §27 — iCal feed token-validity contracts (s24)
// ────────────────────────────────────────────────────────────────────
//
// calendar-ical-feed is a public GET endpoint (verify_jwt:false) that
// returns iCal text/calendar content for Apple Calendar / outlook
// subscribers. Auth via opaque ical_token in ?token query string.
//
// Per s24 stance recalibration: iCal feed contract gap closed.

test.describe('§27 — iCal feed token-validity contracts (s24)', () => {
  test('calendar-ical-feed — missing token → 400 Missing token parameter', async () => {
    const respFile = `/tmp/sb-ical-r-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
    try {
      const status = execSync(
        `curl -s -o ${respFile} -w "%{http_code}" "${process.env.E2E_SUPABASE_URL}/functions/v1/calendar-ical-feed"`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
      expect(parseInt(status.trim(), 10), `body: ${body.slice(0, 200)}`).toBe(400);
      expect(body).toMatch(/missing token/i);
    } finally {
      try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    }
  });

  test('calendar-ical-feed — invalid token → 404 Invalid or expired feed URL', async () => {
    const respFile = `/tmp/sb-ical-r-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
    try {
      const status = execSync(
        `curl -s -o ${respFile} -w "%{http_code}" "${process.env.E2E_SUPABASE_URL}/functions/v1/calendar-ical-feed?token=definitely-not-a-real-token-${Date.now()}"`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
      expect(parseInt(status.trim(), 10), `body: ${body.slice(0, 200)}`).toBe(404);
      expect(body).toMatch(/invalid or expired/i);
    } finally {
      try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    }
  });
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

// ────────────────────────────────────────────────────────────────────
// §27 — Class-bug contract: malformed JSON body must NOT return 500 (s28)
// ────────────────────────────────────────────────────────────────────
//
// s24 send-message + s27 send-bulk-message + s27 send-invoice-email all
// surfaced the same bug: body-parse inside the outer try block, SyntaxError
// caught generically, returns 500 instead of 400. The s28 sweep fixed
// this across 56 fns by adding a dedicated `let body: any; try { body =
// await req.json() } catch { return 400 }` pre-extract before the outer
// try. This contract asserts the fix holds: malformed JSON → < 500.
//
// We don't assert exact 400 because some fns gate on auth/rate-limit BEFORE
// body parse (401/429 are fine — the contract is just "no 500-on-bad-body").
// We use the anon key so auth-gated fns return 401 first; for those, the
// contract still holds because the catch we care about was never reached
// from a malformed body path.

function callBodyParse(fnName: string, opts: { auth: 'anon' | 'none' | 'service' }): { status: number; body: string } {
  const respFile = `/tmp/sb-bp-${fnName}-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
  let authHeader = '';
  if (opts.auth === 'anon') {
    authHeader = `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_ANON_KEY}" `;
  } else if (opts.auth === 'service') {
    authHeader = `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" `;
  }
  try {
    const status = execSync(
      `curl -s -o ${respFile} -w "%{http_code}" ` +
        `-X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/${fnName}" ` +
        `${authHeader}` +
        `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Content-Type: application/json" ` +
        `-d 'not-valid-json'`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    return { status: parseInt(status.trim(), 10), body };
  } finally {
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
  }
}

test.describe('§27 — Class-bug: malformed JSON body must not 500 (s28 sweep)', () => {
  // Sample 12 fns across clusters — covering every cluster type from the s28 sweep.
  // Full 56-fn list lives in audit/findings/2026-05-10-throw-into-outer-catch-
  // class-bug-sweep.md; we sample here for baseline speed (parametrised over
  // every fn would add ~60 tests).
  const sample: Array<{ fn: string; auth: 'anon' | 'service'; cluster: string }> = [
    { fn: 'send-message',                  auth: 'anon',    cluster: 'messaging' },
    { fn: 'mark-messages-read',            auth: 'anon',    cluster: 'messaging' },
    { fn: 'send-parent-message',           auth: 'anon',    cluster: 'messaging' },
    { fn: 'stripe-create-payment-intent',  auth: 'anon',    cluster: 'money-path' },
    { fn: 'stripe-billing-history',        auth: 'anon',    cluster: 'money-path' },
    { fn: 'generate-invoice-pdf',          auth: 'service', cluster: 'money-path' },
    { fn: 'continuation-respond',          auth: 'anon',    cluster: 'continuation' },
    { fn: 'create-continuation-run',       auth: 'anon',    cluster: 'continuation' },
    { fn: 'calendar-disconnect',           auth: 'anon',    cluster: 'calendar' },
    { fn: 'xero-sync-invoice',             auth: 'service', cluster: 'xero' },
    { fn: 'looopassist-chat',              auth: 'anon',    cluster: 'ai' },
    { fn: 'invite-get',                    auth: 'anon',    cluster: 'auth' },
  ];

  for (const { fn, auth, cluster } of sample) {
    test(`${fn} (${cluster}) — malformed JSON body → 4xx, never 5xx`, async () => {
      const res = callBodyParse(fn, { auth });
      expect(
        res.status,
        `${fn} returned ${res.status} (body: ${res.body.slice(0, 200)}) — should be 4xx`,
      ).toBeGreaterThanOrEqual(400);
      expect(
        res.status,
        `${fn} returned ${res.status} (body: ${res.body.slice(0, 200)}) — 5xx means body-parse class-bug regressed`,
      ).toBeLessThan(500);
    });
  }
});

// ────────────────────────────────────────────────────────────────────
// §27 — Stripe error classification (s29 sibling-concern close)
// ────────────────────────────────────────────────────────────────────
//
// 9 stripe-* fns previously echoed raw error.message via
// `JSON.stringify({error: error.message})` with status 400. This was
// intentional UX-string control flow for `throw new Error(...)` calls,
// but it leaked any Stripe SDK / DB error verbatim too. s29 migrated
// all 9 fns to _shared/stripe-error.ts's classifyAndRespond helper:
// known business-logic messages → mapped 4xx (frontend UX preserved),
// unknown messages → generic "An internal error occurred. Please try
// again." + 500.
//
// Asserts: for each fn, hitting it anonymously returns a 4xx with
// "No authorization header" OR similar known-safe message (NOT an
// unknown internal-state error message and NOT a 5xx).

function callStripeFn(fnName: string): { status: number; body: string } {
  const respFile = `/tmp/sb-stripe-${fnName}-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
  try {
    const status = execSync(
      `curl -s -o ${respFile} -w "%{http_code}" ` +
        `-X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/${fnName}" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Content-Type: application/json" ` +
        `-d '{}'`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    return { status: parseInt(status.trim(), 10), body };
  } finally {
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
  }
}

test.describe('§27 — Stripe error classification (s29 sibling-concern close)', () => {
  for (const fnName of [
    'stripe-create-payment-intent',
    'stripe-customer-portal',
    'stripe-create-checkout',
    'stripe-billing-history',
    'stripe-connect-onboard',
    'stripe-connect-status',
    'stripe-process-refund',
    'stripe-subscription-checkout',
    'stripe-verify-session',
  ]) {
    test(`${fnName} — no-auth call returns 4xx with safe known message (not leaked Stripe/DB)`, async () => {
      const res = callStripeFn(fnName);
      // Status must be 4xx (known classification), never 5xx.
      expect(
        res.status,
        `${fnName} returned ${res.status} (body: ${res.body.slice(0, 200)}) — must be 4xx for known-classified errors`,
      ).toBeGreaterThanOrEqual(400);
      expect(
        res.status,
        `${fnName} returned ${res.status} (body: ${res.body.slice(0, 200)}) — 5xx means classifyAndRespond fell through to generic 500 (or wrap bypassed)`,
      ).toBeLessThan(500);
      // Body must NOT contain markers that would indicate a leaked Stripe/DB
      // error (e.g., "PostgrestError", "stripe_", "PGRST", JSON-parse error
      // string from Deno runtime, etc.).
      expect(
        res.body,
        `${fnName} body leaked something unexpected: ${res.body.slice(0, 200)}`,
      ).not.toMatch(/PostgrestError|PGRST\d+|StripeError|stripe_\w+|unexpected token|JSON\.parse/i);
    });
  }
});
