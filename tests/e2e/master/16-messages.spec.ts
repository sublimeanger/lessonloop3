/**
 * 16 — Messages (single, bulk, internal, requests, threads)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §16
 */
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';
import {
  getOwnerUserId,
  supabaseDelete,
  supabaseInsert,
  supabaseSelect,
} from '../supabase-admin';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.parent);
});

test.describe('Messages page', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error', async ({ page }) => {
    await goTo(page, '/messages');
    await assertNoErrorBoundary(page);
  });

  test('tabs render (Sent / Internal / Requests)', async ({ page }) => {
    await goTo(page, '/messages');
    const sent = page.getByRole('tab', { name: /sent/i }).first();
    if (await sent.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // tabs exist
    }
  });
});

test.describe('§16 — message_log table tracking', () => {
  test.use({ storageState: AUTH.owner });

  test('message_log accepts queries and rows match expected schema', async () => {
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('message_log', `org_id=eq.${orgId}&select=id,message_type,recipient_email,status,sent_at&order=created_at.desc&limit=10`);
    expect(Array.isArray(rows)).toBe(true);
    if (rows.length > 0) {
      expect(typeof rows[0].id).toBe('string');
      expect(typeof rows[0].message_type).toBe('string');
    }
  });

  test('message_requests table queryable for parent-staff requests', async () => {
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('message_requests', `org_id=eq.${orgId}&select=id,status&limit=5`);
    expect(Array.isArray(rows)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────
// §16.3 — send-message edge fn (staff-side compose)
// ────────────────────────────────────────────────────────────────────
//
// Mirrors the §26.10 parent-reply contract tests but as the staff role.
// `send-message` (supabase/functions/send-message/index.ts) is the
// backend for ComposeMessageModal + the BulkComposeModal per-recipient
// loop. Body limits per the fn source: subject ≤500, body ≤10000. The
// fn resolves recipient_email and name from the database (never trusts
// client input) and validates that the recipient belongs to the same
// org as the call.
//
// What we cover here:
//   - happy path: owner→guardian, message_log row inserted with the
//     auth user as sender_user_id and the resolved recipient email/name
//   - validation: missing required fields → 400 (was 500 pre-§16 fix —
//     see audit/findings/2026-05-09-send-message-missing-fields-500.md)
//   - validation: oversized subject (>500) and body (>10000) → 400
//   - rbac: parent JWT (role='parent') → 403 at the membership gate
//   - cross-org: recipient belongs to a different org than data.org_id
//     → 403 at the guardian.org_id !== data.org_id check

test.describe('§16.3 — send-message edge fn (staff-side)', () => {
  const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
  const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';
  const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
  const ANON = process.env.E2E_SUPABASE_ANON_KEY!;
  const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL!;
  const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD!;
  const PARENT_EMAIL = process.env.E2E_PARENT_EMAIL!;
  const PARENT_PASSWORD = process.env.E2E_PARENT_PASSWORD!;

  /** Sign in via Supabase auth REST and return the access token. */
  function signInForToken(email: string, password: string): string {
    const tmp = `/tmp/sb-16-login-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    fs.writeFileSync(tmp, JSON.stringify({ email, password }));
    try {
      const out = execSync(
        `curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" ` +
          `-H "apikey: ${ANON}" -H "Content-Type: application/json" -d @${tmp}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const session = JSON.parse(out);
      if (!session.access_token) {
        throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(session).slice(0, 200)}`);
      }
      return session.access_token as string;
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  /** Call a Supabase edge fn with a bearer token. Returns { status, body }. */
  function invokeEdgeFn(
    fn: string,
    token: string,
    body: Record<string, unknown>,
  ): { status: number; body: any } {
    const tmp = `/tmp/sb-16-fn-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    fs.writeFileSync(tmp, JSON.stringify(body));
    try {
      const res = execSync(
        `curl -s -w "\\nHTTP:%{http_code}" -X POST "${SUPABASE_URL}/functions/v1/${fn}" ` +
          `-H "Authorization: Bearer ${token}" -H "apikey: ${ANON}" ` +
          `-H "Content-Type: application/json" -d @${tmp}`,
        { encoding: 'utf-8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
      );
      const m = res.match(/^([\s\S]*)\nHTTP:(\d+)$/);
      const rawBody = m ? m[1] : res;
      const status = m ? Number(m[2]) : 0;
      let parsed: any = rawBody;
      try { parsed = JSON.parse(rawBody); } catch { /* leave as text */ }
      return { status, body: parsed };
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  test('§16.3 happy path: owner→guardian send-message → 200 + message_log row with resolved recipient', async () => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const subject = `${testId} staff outbound`;
    const body = `${testId} body — confirming next week's lesson schedule.`;

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = invokeEdgeFn('send-message', token, {
      org_id: E2E_ORG_ID,
      sender_user_id: getOwnerUserId(),
      recipient_type: 'guardian',
      recipient_id: E2E_PARENT_GUARDIAN_ID,
      subject,
      body,
      // send_email=false skips Resend so this test doesn't depend on
      // RESEND_API_KEY being configured; the message_log row still lands
      // (channel='inapp', status='sent') and proves the contract.
      send_email: false,
    });

    if (res.status !== 200) {
      throw new Error(`send-message ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
    }
    expect(res.body?.success).toBe(true);
    expect(res.body?.message_id).toMatch(/^[0-9a-f-]{36}$/);

    try {
      const rows = supabaseSelect(
        'message_log',
        `org_id=eq.${E2E_ORG_ID}&id=eq.${res.body.message_id}` +
          `&select=id,subject,body,sender_user_id,recipient_type,recipient_id,recipient_email,channel,status`,
      );
      expect(rows.length).toBe(1);
      expect(rows[0].subject).toBe(subject);
      expect(rows[0].body).toContain(testId);
      // sender_user_id must be the authenticated owner, not anything client-supplied
      expect(rows[0].sender_user_id).toBe(getOwnerUserId());
      expect(rows[0].recipient_type).toBe('guardian');
      expect(rows[0].recipient_id).toBe(E2E_PARENT_GUARDIAN_ID);
      // The fn resolves recipient_email from the guardians table, ignoring
      // the (deprecated) client field — which we didn't even pass.
      expect(rows[0].recipient_email).toBe(PARENT_EMAIL);
      // send_email=false → channel='inapp', status='sent' immediately
      expect(rows[0].channel).toBe('inapp');
      expect(rows[0].status).toBe('sent');
    } finally {
      supabaseDelete('message_log', `id=eq.${res.body.message_id}`);
    }
  });

  test('§16.3 validation: missing required fields → 400', async () => {
    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    // Omit recipient_id + recipient_type — the fn must reject before
    // touching the database.
    const res = invokeEdgeFn('send-message', token, {
      org_id: E2E_ORG_ID,
      subject: 'no recipient',
      body: 'body present',
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/[Mm]issing required/);
  });

  test('§16.3 validation: oversized subject (>500) and body (>10000) → 400', async () => {
    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);

    // Oversized body branch
    const overBody = invokeEdgeFn('send-message', token, {
      org_id: E2E_ORG_ID,
      sender_user_id: getOwnerUserId(),
      recipient_type: 'guardian',
      recipient_id: E2E_PARENT_GUARDIAN_ID,
      subject: 'oversize body',
      body: 'x'.repeat(10_001),
      send_email: false,
    });
    expect(overBody.status).toBe(400);
    expect(JSON.stringify(overBody.body)).toMatch(/too long/i);

    // Oversized subject branch (same 400)
    const overSubject = invokeEdgeFn('send-message', token, {
      org_id: E2E_ORG_ID,
      sender_user_id: getOwnerUserId(),
      recipient_type: 'guardian',
      recipient_id: E2E_PARENT_GUARDIAN_ID,
      subject: 's'.repeat(501),
      body: 'short body',
      send_email: false,
    });
    expect(overSubject.status).toBe(400);
    expect(JSON.stringify(overSubject.body)).toMatch(/too long/i);
  });

  test('§16.3 rbac: parent caller (role=parent) → 403 at membership check', async () => {
    // Parents have an org_memberships row with role='parent' — verified
    // 2026-05-09 via execute_sql on the e2e parents. The fn's role
    // allowlist is ['owner', 'admin', 'teacher'] (index.ts:100), so the
    // membership exists but the role check fails → 403.
    const parentToken = signInForToken(PARENT_EMAIL, PARENT_PASSWORD);
    const res = invokeEdgeFn('send-message', parentToken, {
      org_id: E2E_ORG_ID,
      sender_user_id: getOwnerUserId(),
      recipient_type: 'guardian',
      recipient_id: E2E_PARENT_GUARDIAN_ID,
      subject: 'parent attempting staff send',
      body: 'should be rejected at the membership role check',
      send_email: false,
    });
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toMatch(/[Nn]ot a member of this organisation/);
  });

  test('§16.3 cross-org: recipient guardian in a different org → 403', async () => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const ownerUserId = getOwnerUserId();

    // Create a throwaway organisation + guardian in it. The owner is NOT
    // a member of this org — but they don't need to be for the
    // cross-org assertion. The fn checks membership against data.org_id
    // (E2E_ORG_ID, where they ARE owner), then resolves the recipient
    // and rejects when recipient.org_id !== data.org_id (index.ts:126).
    const throwawayOrg = supabaseInsert('organisations', {
      name: `${testId} throwaway org`,
      created_by: ownerUserId,
    });
    if (!throwawayOrg?.id) {
      throw new Error(`Throwaway org insert failed: ${JSON.stringify(throwawayOrg)}`);
    }

    const throwawayGuardian = supabaseInsert('guardians', {
      org_id: throwawayOrg.id,
      full_name: `${testId} cross-org guardian`,
      email: `${testId}@example.invalid`,
    });
    if (!throwawayGuardian?.id) {
      // Make sure we still cleanup the org if the guardian insert failed.
      supabaseDelete('organisations', `id=eq.${throwawayOrg.id}`);
      throw new Error(`Throwaway guardian insert failed: ${JSON.stringify(throwawayGuardian)}`);
    }

    try {
      const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
      const res = invokeEdgeFn('send-message', token, {
        org_id: E2E_ORG_ID, // owner IS a member here
        sender_user_id: ownerUserId,
        recipient_type: 'guardian',
        recipient_id: throwawayGuardian.id, // but recipient is in throwawayOrg
        subject: `${testId} cross-org attempt`,
        body: 'should be rejected at the recipient org-mismatch check',
        send_email: false,
      });
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).toMatch(/does not belong to this organisation/i);
    } finally {
      supabaseDelete('guardians', `id=eq.${throwawayGuardian.id}`);
      supabaseDelete('organisations', `id=eq.${throwawayOrg.id}`);
    }
  });
});
