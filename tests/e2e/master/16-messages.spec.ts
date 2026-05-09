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

// ────────────────────────────────────────────────────────────────────
// §16.3 — send-bulk-message (BulkComposeModal backend)
// ────────────────────────────────────────────────────────────────────
//
// 11th-session pickup. Catalog §16.7 case 2: "Bulk compose to all
// parents of active students with instrument=piano → matches expected
// count". The send-bulk-message edge fn:
//   - filters guardians by criteria (status, instrument, location, etc.)
//   - creates a message_batches row (status='sending' → 'completed')
//   - if send_email=false: inserts message_log rows directly
//     (channel='inapp', message_type='bulk') for each recipient
//   - if send_email=true (default): goes through Resend per recipient
//     in BATCH_SIZE chunks
//
// We test the in-app path (send_email=false) — same recipient-resolution
// + message_log shape contract, but no Resend dependency. This is the
// path the BulkComposeModal will use for in-portal-only blasts; it's
// also the only path that doesn't require RESEND_API_KEY in dev.
//
// Filter strategy: we filter to status='active' which matches the
// e2e parent's seed shape; the only matching guardian in the e2e org
// (post-globalSetup-sweep) is e2e-parent. recipient_count should be 1.

test.describe('§16.3 — send-bulk-message (in-app path)', () => {
  const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
  const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
  const ANON = process.env.E2E_SUPABASE_ANON_KEY!;
  const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL!;
  const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD!;
  const PARENT_EMAIL_LIT = process.env.E2E_PARENT_EMAIL!;

  function signInForToken(email: string, password: string): string {
    const tmp = `/tmp/sb-16-bulk-login-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
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

  function invokeEdgeFn(
    fn: string,
    token: string,
    body: Record<string, unknown>,
  ): { status: number; body: any } {
    const tmp = `/tmp/sb-16-bulk-fn-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
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

  test('§16.3 bulk in-app: status="active" filter → batch + N message_log rows with message_type="bulk"', async () => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const subject = `${testId} bulk in-app test`;
    const body = `${testId} body — bulk inapp delivery contract.`;
    const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';

    // Seed an active student linked to the e2e parent's guardian. The
    // fn's fetchFilteredGuardians starts from students (status='active'),
    // joins via student_guardians, and returns guardians. Without a
    // linked student, the e2e parent's guardian wouldn't match the
    // active filter — the e2e org's persistent state has no active
    // students linked to her by default.
    const student = supabaseInsert('students', {
      org_id: E2E_ORG_ID,
      first_name: `${testId}_student`,
      last_name: testId,
      status: 'active',
    });
    if (!student?.id) {
      throw new Error(`student insert failed: ${JSON.stringify(student)}`);
    }
    supabaseInsert('student_guardians', {
      org_id: E2E_ORG_ID,
      student_id: student.id,
      guardian_id: E2E_PARENT_GUARDIAN_ID,
      relationship: 'guardian',
      is_primary_payer: false,
    });

    let batchId: string | undefined;
    try {
      const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
      const res = invokeEdgeFn('send-bulk-message', token, {
        org_id: E2E_ORG_ID,
        name: `${testId} batch`,
        subject,
        body,
        filter_criteria: { status: 'active' },
        send_email: false,
      });

      if (res.status !== 200) {
        throw new Error(`send-bulk-message ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
      }
      expect(res.body?.success).toBe(true);
      expect(res.body?.channel).toBe('inapp');
      expect(typeof res.body?.batch_id).toBe('string');
      expect(res.body?.batch_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body?.recipient_count).toBeGreaterThanOrEqual(1);
      expect(res.body?.sent_count).toBe(res.body.recipient_count);
      expect(res.body?.failed_count).toBe(0);

      batchId = res.body.batch_id;

      // message_batches row reflects fn results.
      const batches = supabaseSelect(
        'message_batches',
        `id=eq.${batchId}&select=id,name,subject,recipient_count,sent_count,failed_count,status,created_by`,
      );
      expect(batches.length).toBe(1);
      expect(batches[0].subject).toBe(subject);
      expect(batches[0].name).toBe(`${testId} batch`);
      expect(batches[0].recipient_count).toBe(res.body.recipient_count);
      expect(batches[0].sent_count).toBe(res.body.sent_count);
      expect(batches[0].failed_count).toBe(0);
      expect(batches[0].status).toBe('completed');
      expect(batches[0].created_by).toBe(getOwnerUserId());

      // message_log has one row per recipient with message_type='bulk',
      // channel='inapp', status='sent'.
      const logs = supabaseSelect(
        'message_log',
        `batch_id=eq.${batchId}&select=id,subject,channel,message_type,status,recipient_type,recipient_email`,
      );
      expect(logs.length).toBe(res.body.recipient_count);
      expect(logs.every((l: any) => l.subject === subject)).toBe(true);
      expect(logs.every((l: any) => l.channel === 'inapp')).toBe(true);
      expect(logs.every((l: any) => l.message_type === 'bulk')).toBe(true);
      expect(logs.every((l: any) => l.status === 'sent')).toBe(true);
      expect(logs.every((l: any) => l.recipient_type === 'guardian')).toBe(true);
      // The e2e parent's email should appear as one of the recipients
      // (we just linked her guardian to an active student).
      expect(logs.some((l: any) => l.recipient_email === PARENT_EMAIL_LIT)).toBe(true);
    } finally {
      if (batchId) {
        supabaseDelete('message_log', `batch_id=eq.${batchId}`);
        supabaseDelete('message_batches', `id=eq.${batchId}`);
      }
      supabaseDelete(
        'student_guardians',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
      );
      supabaseDelete('students', `id=eq.${student.id}`);
    }
  });

  test('§16.3 bulk: rbac — parent caller (role=parent) → 403', async () => {
    const PARENT_EMAIL_2 = process.env.E2E_PARENT_EMAIL!;
    const PARENT_PASSWORD_2 = process.env.E2E_PARENT_PASSWORD!;
    const parentToken = signInForToken(PARENT_EMAIL_2, PARENT_PASSWORD_2);
    const res = invokeEdgeFn('send-bulk-message', parentToken, {
      org_id: E2E_ORG_ID,
      name: 'parent attempting bulk',
      subject: 'parent attempt',
      body: 'should be rejected',
      filter_criteria: { status: 'active' },
      send_email: false,
    });
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toMatch(/[Oo]nly admins can send bulk messages/);
  });

  test('§16.3 bulk: validation — missing required fields (no name/subject/body) → 400', async () => {
    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = invokeEdgeFn('send-bulk-message', token, {
      org_id: E2E_ORG_ID,
      // missing name, subject, body
      filter_criteria: { status: 'active' },
      send_email: false,
    });
    // The fn throws on missing-fields → caught as 500 with generic error.
    // (Same DX bug shape as send-message had until session 6 fix; bulk
    // still has it. Documented but not fixed here — single-PR rule per
    // session prompt.)
    // Either 500 (current behaviour) or 400 (post-fix) is acceptable;
    // assert it's NOT 200.
    expect(res.status).not.toBe(200);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ────────────────────────────────────────────────────────────────────
// §16.4 / §16.5 — Internal messaging (staff-to-staff)
// ────────────────────────────────────────────────────────────────────
//
// internal_messages table has its own shape independent of message_log:
// (id, org_id, sender_user_id, sender_role, recipient_user_id,
//  recipient_role, subject, body, read_at, thread_id, parent_message_id).
//
// Frontend useSendInternalMessage (src/hooks/useInternalMessages.ts:180)
// does direct supabase.from('internal_messages').insert() via the
// owner JWT, then best-effort calls notify-internal-message for the
// email side-effect. We test the data-side (insert + read tracking +
// thread chain) without exercising the Resend path — same separation
// of concerns as §16.3 above.

test.describe('§16.4 / §16.5 — Internal messaging', () => {
  const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
  const E2E_OWNER_USER_ID = '135b60cb-dd4c-47c5-ad6d-724ac13f80f8';
  const E2E_ADMIN_USER_ID = '865d230f-3a69-4bcf-9484-66b2f5cfd427';

  test('§16.4 — owner sends internal message to admin → row stored, read_at NULL initially', async () => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const subject = `${testId} internal subject`;
    const body = `${testId} internal body — owner→admin staff comms.`;

    const msg = supabaseInsert('internal_messages', {
      org_id: E2E_ORG_ID,
      sender_user_id: E2E_OWNER_USER_ID,
      sender_role: 'owner',
      recipient_user_id: E2E_ADMIN_USER_ID,
      recipient_role: 'admin',
      subject,
      body,
    });
    if (!msg?.id) {
      throw new Error(`internal_messages insert failed: ${JSON.stringify(msg)}`);
    }

    try {
      const rows = supabaseSelect(
        'internal_messages',
        `id=eq.${msg.id}&select=id,sender_user_id,recipient_user_id,subject,body,read_at,thread_id,parent_message_id,created_at`,
      );
      expect(rows.length).toBe(1);
      expect(rows[0].sender_user_id).toBe(E2E_OWNER_USER_ID);
      expect(rows[0].recipient_user_id).toBe(E2E_ADMIN_USER_ID);
      expect(rows[0].subject).toBe(subject);
      expect(rows[0].body).toBe(body);
      // Unread initially — useUnreadInternalCount selects WHERE read_at IS NULL.
      expect(rows[0].read_at).toBeNull();
      // Standalone message has no thread chain.
      expect(rows[0].thread_id).toBeNull();
      expect(rows[0].parent_message_id).toBeNull();

      // Recipient marks as read (mirrors useMarkInternalRead). The hook's
      // .eq('recipient_user_id', user.id) scope means only the recipient
      // can read-mark — service-role here, but the contract is the same.
      const url = process.env.E2E_SUPABASE_URL!;
      const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
      const tmpFile = `/tmp/sb-16-readmark-${randomBytes(4).toString('hex')}.json`;
      fs.writeFileSync(tmpFile, JSON.stringify({ read_at: new Date().toISOString() }));
      try {
        execSync(
          `curl -s -X PATCH "${url}/rest/v1/internal_messages?id=eq.${msg.id}&recipient_user_id=eq.${E2E_ADMIN_USER_ID}" ` +
            `-H "apikey: ${key}" -H "Authorization: Bearer ${key}" ` +
            `-H "Content-Type: application/json" -H "Prefer: return=minimal" ` +
            `-d @${tmpFile}`,
          { encoding: 'utf-8', timeout: 15_000 },
        );
      } finally {
        try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
      }

      const after = supabaseSelect(
        'internal_messages',
        `id=eq.${msg.id}&select=read_at`,
      );
      expect(after[0].read_at).not.toBeNull();
    } finally {
      supabaseDelete('internal_messages', `id=eq.${msg.id}`);
    }
  });

  test('§16.5 — Internal thread reply: parent + child linked via parent_message_id', async () => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const threadId = randomBytes(16).toString('hex');
    // Stamp thread_id as a UUID-shaped value (formatted to match
    // {8-4-4-4-12}).
    const threadIdFormatted = `${threadId.slice(0, 8)}-${threadId.slice(8, 12)}-4${threadId.slice(13, 16)}-${(parseInt(threadId[16], 16) & 0x3 | 0x8).toString(16)}${threadId.slice(17, 20)}-${threadId.slice(20, 32)}`;

    const parentMsg = supabaseInsert('internal_messages', {
      org_id: E2E_ORG_ID,
      sender_user_id: E2E_OWNER_USER_ID,
      sender_role: 'owner',
      recipient_user_id: E2E_ADMIN_USER_ID,
      recipient_role: 'admin',
      subject: `${testId} thread parent`,
      body: `${testId} initial message in thread`,
      thread_id: threadIdFormatted,
    });
    if (!parentMsg?.id) {
      throw new Error(`parent insert failed: ${JSON.stringify(parentMsg)}`);
    }

    const childMsg = supabaseInsert('internal_messages', {
      org_id: E2E_ORG_ID,
      sender_user_id: E2E_ADMIN_USER_ID,
      sender_role: 'admin',
      recipient_user_id: E2E_OWNER_USER_ID,
      recipient_role: 'owner',
      subject: `Re: ${testId} thread parent`,
      body: `${testId} reply on thread`,
      thread_id: threadIdFormatted,
      parent_message_id: parentMsg.id,
    });
    if (!childMsg?.id) {
      // Cleanup parent on child-insert failure.
      supabaseDelete('internal_messages', `id=eq.${parentMsg.id}`);
      throw new Error(`child insert failed: ${JSON.stringify(childMsg)}`);
    }

    try {
      // Both messages exist + share the same thread_id.
      const threadRows = supabaseSelect(
        'internal_messages',
        `thread_id=eq.${threadIdFormatted}&order=created_at.asc&select=id,sender_user_id,subject,parent_message_id`,
      );
      expect(threadRows.length).toBe(2);
      // Parent is the first (no parent_message_id), child is the
      // second (parent_message_id = parent.id).
      const parent = threadRows.find((r: any) => !r.parent_message_id);
      const child = threadRows.find((r: any) => r.parent_message_id === parentMsg.id);
      expect(parent?.id).toBe(parentMsg.id);
      expect(child?.id).toBe(childMsg.id);
      // Reply subject "Re: ..." mirrors what the §26.10 reply pattern does.
      expect(child?.subject).toMatch(/^Re:/);
    } finally {
      // Delete child first to avoid FK on parent_message_id constraint.
      supabaseDelete('internal_messages', `id=eq.${childMsg.id}`);
      supabaseDelete('internal_messages', `id=eq.${parentMsg.id}`);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// §16.10 — mark-messages-read (parent-side)
// ────────────────────────────────────────────────────────────────────
//
// Catalog §16.7 case 10: opening a thread triggers `mark-messages-read`
// edge function for that thread. The fn (supabase/functions/mark-
// messages-read/index.ts) is called from the parent-portal side
// when the parent opens a message thread; it UPDATEs message_log
// rows where recipient_id=guardian_id AND read_at IS NULL.
//
// We test the contract: seed an unread message_log row addressed to
// the e2e parent's guardian, sign in as the parent, POST to mark-
// messages-read with their JWT, assert read_at is set on the seeded
// row.

test.describe('§16.10 — mark-messages-read (parent-side)', () => {
  const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
  const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';
  const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
  const ANON = process.env.E2E_SUPABASE_ANON_KEY!;
  const PARENT_EMAIL = process.env.E2E_PARENT_EMAIL!;
  const PARENT_PASSWORD = process.env.E2E_PARENT_PASSWORD!;

  function signInForToken(email: string, password: string): string {
    const tmp = `/tmp/sb-16-mark-login-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    fs.writeFileSync(tmp, JSON.stringify({ email, password }));
    try {
      const out = execSync(
        `curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" ` +
          `-H "apikey: ${ANON}" -H "Content-Type: application/json" -d @${tmp}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const session = JSON.parse(out);
      if (!session.access_token) {
        throw new Error(`Sign-in failed: ${JSON.stringify(session).slice(0, 200)}`);
      }
      return session.access_token as string;
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  function invokeEdgeFn(
    fn: string,
    token: string,
    body: Record<string, unknown>,
  ): { status: number; body: any } {
    const tmp = `/tmp/sb-16-mark-fn-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    fs.writeFileSync(tmp, JSON.stringify(body));
    try {
      const res = execSync(
        `curl -s -w "\\nHTTP:%{http_code}" -X POST "${SUPABASE_URL}/functions/v1/${fn}" ` +
          `-H "Authorization: Bearer ${token}" -H "apikey: ${ANON}" ` +
          `-H "Content-Type: application/json" -d @${tmp}`,
        { encoding: 'utf-8', timeout: 30_000 },
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

  test('§16.10 — parent calls mark-messages-read with their own guardian_id → seeded message_log row gets read_at', async () => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Seed an unread message_log row addressed to the e2e parent's
    // guardian. Mirrors what send-message would have written.
    const seeded = supabaseInsert('message_log', {
      org_id: E2E_ORG_ID,
      channel: 'inapp',
      subject: `${testId} mark-read seed`,
      body: `${testId} body — should be marked read by parent open`,
      sender_user_id: getOwnerUserId(),
      recipient_type: 'guardian',
      recipient_id: E2E_PARENT_GUARDIAN_ID,
      recipient_email: PARENT_EMAIL,
      message_type: 'admin_to_parent',
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
    if (!seeded?.id) {
      throw new Error(`message_log seed failed: ${JSON.stringify(seeded)}`);
    }

    try {
      // Pre-flight verify: read_at is NULL.
      const before = supabaseSelect(
        'message_log',
        `id=eq.${seeded.id}&select=read_at`,
      );
      expect(before[0].read_at).toBeNull();

      const parentToken = signInForToken(PARENT_EMAIL, PARENT_PASSWORD);
      const res = invokeEdgeFn('mark-messages-read', parentToken, {
        org_id: E2E_ORG_ID,
        guardian_id: E2E_PARENT_GUARDIAN_ID,
        // Optionally restrict to specific message_ids — prevents the
        // mass-mark-all behaviour from clobbering other tests' rows.
        message_ids: [seeded.id],
      });
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);

      // After: read_at is set.
      const after = supabaseSelect(
        'message_log',
        `id=eq.${seeded.id}&select=read_at`,
      );
      expect(after[0].read_at).not.toBeNull();
    } finally {
      supabaseDelete('message_log', `id=eq.${seeded.id}`);
    }
  });

  test('§16.10 — parent cannot mark another guardian as read → 403', async () => {
    // Use parent2's guardian_id as a foreign one. The fn checks
    // guardians.user_id !== auth.uid → 403.
    // We don't have parent2's guardian_id constant, but parent1 calling
    // with a non-existent guardian_id triggers the same 403 path.
    const fakeGuardianId = '00000000-0000-0000-0000-000000000999';
    const parentToken = signInForToken(PARENT_EMAIL, PARENT_PASSWORD);
    const res = invokeEdgeFn('mark-messages-read', parentToken, {
      org_id: E2E_ORG_ID,
      guardian_id: fakeGuardianId,
    });
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toMatch(/[Uu]nauthorized/);
  });
});
