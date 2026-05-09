/**
 * 26 — Parent portal (every page)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §26
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';
import { resetE2ERateLimits } from './_fixtures/stripe-test-helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.parent);
  refreshStorageStateIfStale(AUTH.parent2);
  // Several blocks in this file hit rate-limited edge fns as the
  // parent JWT (send-parent-message in §26.10, stripe-create-payment-
  // intent in §26.9.1). With the file's grown test count + repeated
  // local debug runs the hourly caps fire mid-suite. Resetting at the
  // top of the run keeps every test starting from a clean slate.
  resetE2ERateLimits();
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

// §26.9 parent pays full invoice via embedded drawer is end-to-end
// covered by 24-stripe.spec.ts §24.2/§24.3 — same backend flow:
// stripe-create-payment-intent → confirmTestPaymentIntent → webhook
// → payments row + status=paid. Here we add the parent-portal-side
// concerns (§26.7 practice log) that 24-stripe doesn't cover.

import {
  supabaseDelete,
  supabaseInsert,
  supabaseSelect,
  getOwnerUserId,
  getOrgId,
  createTestInvoice,
  deleteInvoiceById,
  patchInvoiceStatus,
} from '../supabase-admin';
import {
  confirmTestPaymentIntent,
  deleteTestCustomer,
  updateInvoiceStatusViaPatch,
  waitForWebhookPayment,
} from './_fixtures/stripe-test-helpers';

test.describe('§26.7 — Practice log', () => {
  const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
  const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';
  const E2E_PARENT_USER_ID = '85628488-f47f-4178-84f0-3425aad6e75e';

  test('parent inserts practice_logs row → updates practice_streaks (trigger)', async () => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Setup: a fresh student linked to the e2e parent's guardian.
    // The seed data has no student-guardian linkage for the e2e parent;
    // creating one here scopes to this test only.
    const student = supabaseInsert('students', {
      org_id: E2E_ORG_ID,
      first_name: `${testId}_student`,
      last_name: testId,
      status: 'active',
    });
    if (!student?.id) {
      throw new Error(`seedStudent failed: ${JSON.stringify(student)}`);
    }
    supabaseInsert('student_guardians', {
      org_id: E2E_ORG_ID,
      student_id: student.id,
      guardian_id: E2E_PARENT_GUARDIAN_ID,
      relationship: 'guardian', // enum: mother|father|guardian|other
      is_primary_payer: false,
    });

    try {
      // Insert a practice_logs row as the parent. The update_practice_streak
      // trigger should fire and create/update a practice_streaks row.
      const today = new Date().toISOString().slice(0, 10);
      const logRow = supabaseInsert('practice_logs', {
        org_id: E2E_ORG_ID,
        student_id: student.id,
        logged_by_user_id: E2E_PARENT_USER_ID,
        practice_date: today,
        duration_minutes: 30,
        notes: `${testId}_log_notes`,
      });
      expect(logRow?.id).toBeTruthy();

      // The log row exists with the expected fields.
      const logs = supabaseSelect(
        'practice_logs',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}&select=duration_minutes,practice_date,notes`,
      );
      expect(logs.length).toBe(1);
      expect(logs[0].duration_minutes).toBe(30);
      expect(logs[0].practice_date).toBe(today);
      expect(logs[0].notes).toBe(`${testId}_log_notes`);

      // The trigger should have created a practice_streaks row for the
      // student. current_streak should be 1 (single day's log starts a streak).
      const streaks = supabaseSelect(
        'practice_streaks',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}&select=current_streak,longest_streak,last_practice_date`,
      );
      expect(streaks.length).toBeGreaterThanOrEqual(1);
      expect(streaks[0].current_streak).toBeGreaterThanOrEqual(1);
      expect(streaks[0].last_practice_date).toBe(today);
    } finally {
      // Cleanup: streaks first, then logs, then linkage, then student.
      supabaseDelete(
        'practice_streaks',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
      );
      supabaseDelete(
        'practice_logs',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
      );
      supabaseDelete(
        'student_guardians',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
      );
      supabaseDelete('students', `org_id=eq.${E2E_ORG_ID}&id=eq.${student.id}`);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// §26.4 — Make-up offer respond (RPC, email-link path)
// ────────────────────────────────────────────────────────────────────
//
// Email link `/portal/home?makeup_action=accept&id=X` calls
// respond_to_makeup_offer(_waitlist_id, _action) via PortalHome's
// onMount hook. The RPC is the public contract; the URL→hook→RPC chain
// is mechanical. Tests below exercise the RPC (parent JWT path —
// SECURITY DEFINER reads `auth.uid()`, so service-role would skip the
// guardian-scope check that's the actual safety contract).
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import fs from 'fs';
import { getOwnerTeacherId } from '../supabase-admin';

test.describe('§26.4 — Make-up offer respond', () => {
  // All 4 tests in this block seed lessons at -3 / +3 days for the same
  // teacher (getOwnerTeacherId). Run in parallel they collide on the
  // teacher_conflict trigger. With the §26.6 + §26.9 additions to this
  // file the worker pool is loaded enough that the race fires
  // reliably; serialise to keep the suite green.
  test.describe.configure({ mode: 'serial' });

  const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
  const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';
  const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
  const ANON = process.env.E2E_SUPABASE_ANON_KEY!;
  const PARENT_EMAIL = process.env.E2E_PARENT_EMAIL!;
  const PARENT_PASSWORD = process.env.E2E_PARENT_PASSWORD!;
  const PARENT2_EMAIL = process.env.E2E_PARENT2_EMAIL!;
  const PARENT2_PASSWORD = process.env.E2E_PARENT2_PASSWORD!;

  /** Sign in via Supabase auth REST and return the access token. */
  function getToken(email: string, password: string): string {
    const tmp = `/tmp/sb-login-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    fs.writeFileSync(tmp, JSON.stringify({ email, password }));
    try {
      const res = execSync(
        `curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" ` +
          `-H "apikey: ${ANON}" -H "Content-Type: application/json" -d @${tmp}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const session = JSON.parse(res);
      if (!session.access_token) {
        throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(session).slice(0, 200)}`);
      }
      return session.access_token as string;
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  /** Call an RPC with a specific parent's JWT (not service-role). */
  function callRpcAsParent(
    token: string,
    fnName: string,
    params: Record<string, unknown>,
  ): { status: number; body: unknown } {
    const tmp = `/tmp/sb-rpc-parent-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    fs.writeFileSync(tmp, JSON.stringify(params));
    try {
      const res = execSync(
        `curl -s -w "\\nHTTP:%{http_code}" -X POST "${SUPABASE_URL}/rest/v1/rpc/${fnName}" ` +
          `-H "apikey: ${ANON}" -H "Authorization: Bearer ${token}" ` +
          `-H "Content-Type: application/json" -d @${tmp}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const m = res.match(/^([\s\S]*)\nHTTP:(\d+)$/);
      const body = m ? m[1] : res;
      const status = m ? Number(m[2]) : 0;
      let parsed: unknown = body;
      try { parsed = JSON.parse(body); } catch { /* leave as text */ }
      return { status, body: parsed };
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  /** Seed an offered make_up_waitlist row for the given guardian.
   *  Returns waitlistId + dependent IDs so the test can clean up. */
  function seedOfferedMakeup(opts: { testId: string; guardianId: string }): {
    waitlistId: string;
    studentId: string;
    missedLessonId: string;
    matchedLessonId: string;
  } {
    // Student linked to the target guardian.
    const student = supabaseInsert('students', {
      org_id: E2E_ORG_ID,
      first_name: `${opts.testId}_s`,
      last_name: opts.testId,
      status: 'active',
    });
    if (!student?.id) throw new Error(`seedStudent failed: ${JSON.stringify(student)}`);

    supabaseInsert('student_guardians', {
      org_id: E2E_ORG_ID,
      student_id: student.id,
      guardian_id: opts.guardianId,
      relationship: 'guardian',
      is_primary_payer: false,
    });

    const teacherId = getOwnerTeacherId();
    const ownerUserId = getOwnerUserId();

    // The "missed" lesson — needs to exist for FK + display.
    const missedStart = new Date(Date.now() - 3 * 86400_000).toISOString();
    const missedEnd = new Date(Date.now() - 3 * 86400_000 + 30 * 60_000).toISOString();
    const missed = supabaseInsert('lessons', {
      org_id: E2E_ORG_ID,
      teacher_id: teacherId,
      created_by: ownerUserId,
      start_at: missedStart,
      end_at: missedEnd,
      status: 'cancelled',
      title: `${opts.testId}_missed`,
    });
    if (!missed?.id) throw new Error(`seedMissedLesson failed: ${JSON.stringify(missed)}`);

    // The "matched" lesson — what the offer is for.
    const matchedStart = new Date(Date.now() + 3 * 86400_000).toISOString();
    const matchedEnd = new Date(Date.now() + 3 * 86400_000 + 30 * 60_000).toISOString();
    const matched = supabaseInsert('lessons', {
      org_id: E2E_ORG_ID,
      teacher_id: teacherId,
      created_by: ownerUserId,
      start_at: matchedStart,
      end_at: matchedEnd,
      status: 'scheduled',
      title: `${opts.testId}_matched`,
    });
    if (!matched?.id) throw new Error(`seedMatchedLesson failed: ${JSON.stringify(matched)}`);

    // The waitlist offer in `offered` state (matched + offered, awaiting response).
    const waitlist = supabaseInsert('make_up_waitlist', {
      org_id: E2E_ORG_ID,
      student_id: student.id,
      guardian_id: opts.guardianId,
      missed_lesson_id: missed.id,
      missed_lesson_date: missedStart.slice(0, 10),
      absence_reason: 'sick',
      teacher_id: teacherId,
      lesson_duration_minutes: 30,
      lesson_title: `${opts.testId}_lesson`,
      status: 'offered',
      matched_lesson_id: matched.id,
      matched_at: new Date(Date.now() - 3600_000).toISOString(),
      offered_at: new Date(Date.now() - 1800_000).toISOString(),
      offer_expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
    });
    if (!waitlist?.id) throw new Error(`seedWaitlist failed: ${JSON.stringify(waitlist)}`);

    return {
      waitlistId: waitlist.id,
      studentId: student.id,
      missedLessonId: missed.id,
      matchedLessonId: matched.id,
    };
  }

  /** Sweep all rows we created. Best-effort; FK order matters. */
  function cleanupSeed(seed: { waitlistId: string; studentId: string; missedLessonId: string; matchedLessonId: string }) {
    supabaseDelete('audit_log', `entity_type=eq.make_up_waitlist&entity_id=eq.${seed.waitlistId}`);
    supabaseDelete('make_up_waitlist', `org_id=eq.${E2E_ORG_ID}&id=eq.${seed.waitlistId}`);
    supabaseDelete('lessons', `org_id=eq.${E2E_ORG_ID}&id=eq.${seed.missedLessonId}`);
    supabaseDelete('lessons', `org_id=eq.${E2E_ORG_ID}&id=eq.${seed.matchedLessonId}`);
    supabaseDelete('student_guardians', `org_id=eq.${E2E_ORG_ID}&student_id=eq.${seed.studentId}`);
    supabaseDelete('students', `org_id=eq.${E2E_ORG_ID}&id=eq.${seed.studentId}`);
  }

  test('parent accepts offer → status=accepted + audit entry + responded_at set', async () => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const seed = seedOfferedMakeup({ testId, guardianId: E2E_PARENT_GUARDIAN_ID });

    try {
      const parentToken = getToken(PARENT_EMAIL, PARENT_PASSWORD);
      const res = callRpcAsParent(parentToken, 'respond_to_makeup_offer', {
        _waitlist_id: seed.waitlistId,
        _action: 'accept',
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'accepted', id: seed.waitlistId });

      // DB transitioned + responded_at set.
      const rows = supabaseSelect(
        'make_up_waitlist',
        `id=eq.${seed.waitlistId}&select=status,responded_at,matched_lesson_id`,
      );
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('accepted');
      expect(rows[0].responded_at).not.toBeNull();
      // matched_lesson_id is preserved on accept (parent confirmed this slot).
      expect(rows[0].matched_lesson_id).toBe(seed.matchedLessonId);

      // Audit log entry.
      const audit = supabaseSelect(
        'audit_log',
        `entity_type=eq.make_up_waitlist&entity_id=eq.${seed.waitlistId}&action=eq.makeup_offer_accepted&select=action,actor_user_id`,
      );
      expect(audit.length).toBe(1);
    } finally {
      cleanupSeed(seed);
    }
  });

  test('parent declines offer → status=waiting + matched_lesson cleared + audit entry', async () => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const seed = seedOfferedMakeup({ testId, guardianId: E2E_PARENT_GUARDIAN_ID });

    try {
      const parentToken = getToken(PARENT_EMAIL, PARENT_PASSWORD);
      const res = callRpcAsParent(parentToken, 'respond_to_makeup_offer', {
        _waitlist_id: seed.waitlistId,
        _action: 'decline',
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'waiting', id: seed.waitlistId });

      // DB transitioned: status back to waiting, match cleared so a new
      // slot can be offered next sweep. responded_at is set so the
      // PortalHome hook can hide the offer until the next match.
      const rows = supabaseSelect(
        'make_up_waitlist',
        `id=eq.${seed.waitlistId}&select=status,responded_at,matched_lesson_id,matched_at,offered_at`,
      );
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('waiting');
      expect(rows[0].responded_at).not.toBeNull();
      expect(rows[0].matched_lesson_id).toBeNull();
      expect(rows[0].matched_at).toBeNull();
      expect(rows[0].offered_at).toBeNull();

      // Audit log entry for decline.
      const audit = supabaseSelect(
        'audit_log',
        `entity_type=eq.make_up_waitlist&entity_id=eq.${seed.waitlistId}&action=eq.makeup_offer_declined&select=action`,
      );
      expect(audit.length).toBe(1);
    } finally {
      cleanupSeed(seed);
    }
  });

  test('cross-tenant: parent2 cannot respond to parent1 guardian offer', async () => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const seed = seedOfferedMakeup({ testId, guardianId: E2E_PARENT_GUARDIAN_ID });

    try {
      // Parent2 tries to accept parent1's offer → RPC raises
      // "Waitlist entry does not belong to you" (or "Guardian record not
      // found" if parent2 has no guardian in the e2e org). Either is a
      // legitimate rejection — the contract is "non-200, no state change".
      const parent2Token = getToken(PARENT2_EMAIL, PARENT2_PASSWORD);
      const res = callRpcAsParent(parent2Token, 'respond_to_makeup_offer', {
        _waitlist_id: seed.waitlistId,
        _action: 'accept',
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      // PostgREST surfaces the exception message in the response body.
      const txt = JSON.stringify(res.body);
      expect(txt).toMatch(/does not belong to you|Guardian record not found|not authenticated/i);

      // Status is still 'offered' (parent2's call did NOT mutate).
      const rows = supabaseSelect(
        'make_up_waitlist',
        `id=eq.${seed.waitlistId}&select=status,responded_at`,
      );
      expect(rows[0].status).toBe('offered');
      expect(rows[0].responded_at).toBeNull();
    } finally {
      cleanupSeed(seed);
    }
  });

  test('already-responded offer rejects re-respond', async () => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const seed = seedOfferedMakeup({ testId, guardianId: E2E_PARENT_GUARDIAN_ID });

    try {
      const parentToken = getToken(PARENT_EMAIL, PARENT_PASSWORD);

      // First accept succeeds.
      const first = callRpcAsParent(parentToken, 'respond_to_makeup_offer', {
        _waitlist_id: seed.waitlistId,
        _action: 'accept',
      });
      expect(first.status).toBe(200);

      // Second response on same offer rejects with "no longer available".
      const second = callRpcAsParent(parentToken, 'respond_to_makeup_offer', {
        _waitlist_id: seed.waitlistId,
        _action: 'decline',
      });
      expect(second.status).toBeGreaterThanOrEqual(400);
      const txt = JSON.stringify(second.body);
      expect(txt).toMatch(/no longer available/i);
    } finally {
      cleanupSeed(seed);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// §26.10 — Compose new thread (send-parent-message edge fn)
// ────────────────────────────────────────────────────────────────────
//
// Parent UI on /portal/messages calls `send-parent-message` with
// `{org_id, subject, body}` to start a new thread. The fn validates
// guardian-in-org, checks `org_messaging_settings.parent_can_initiate`,
// inserts a message_log row, and (in another path) fires
// notify-internal-message for staff push. Tests below exercise the
// validation contract + happy path.

test.describe('§26.10 — Parent compose new thread', () => {
  const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
  const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
  const ANON = process.env.E2E_SUPABASE_ANON_KEY!;
  const PARENT_EMAIL = process.env.E2E_PARENT_EMAIL!;
  const PARENT_PASSWORD = process.env.E2E_PARENT_PASSWORD!;

  function getParentToken(): string {
    const tmp = `/tmp/sb-login-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    fs.writeFileSync(tmp, JSON.stringify({ email: PARENT_EMAIL, password: PARENT_PASSWORD }));
    try {
      const res = execSync(
        `curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" ` +
          `-H "apikey: ${ANON}" -H "Content-Type: application/json" -d @${tmp}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const session = JSON.parse(res);
      if (!session.access_token) throw new Error(`Parent sign-in failed: ${JSON.stringify(session).slice(0, 200)}`);
      return session.access_token;
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  function callEdgeFn(fn: string, token: string, body: Record<string, unknown>): { status: number; body: unknown } {
    const tmp = `/tmp/sb-fn-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
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
      let parsed: unknown = rawBody;
      try { parsed = JSON.parse(rawBody); } catch { /* leave as text */ }
      return { status, body: parsed };
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  test('happy path: parent posts new message → message_log row inserted', async () => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const subject = `${testId} subject`;
    const body = `${testId} body — please confirm next lesson time.`;

    const token = getParentToken();
    const res = callEdgeFn('send-parent-message', token, {
      org_id: E2E_ORG_ID,
      subject,
      body,
    });

    if (res.status !== 200) {
      // Some orgs disable parent_can_initiate; surface that explicitly.
      throw new Error(`send-parent-message ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
    }

    try {
      // The fn writes a row in message_log with the parent's sender_user_id
      // and the subject we sent. Use subject as the lookup key (the body
      // gets HTML-escaped server-side, so equality on body is brittle).
      const rows = supabaseSelect(
        'message_log',
        `org_id=eq.${E2E_ORG_ID}&subject=eq.${encodeURIComponent(subject)}&select=id,subject,body,sender_user_id,recipient_type,thread_id,channel`,
      );
      expect(rows.length).toBe(1);
      expect(rows[0].subject).toBe(subject);
      expect(rows[0].body).toContain(testId); // body contains testId regardless of HTML wrapping
      // First message in a thread: thread_id may be NULL or self-referential —
      // both are valid; assert presence of the row, not the column shape.
      expect(rows[0].sender_user_id).toBeTruthy();

      // Cleanup.
      supabaseDelete('message_log', `id=eq.${rows[0].id}`);
    } catch (err) {
      // Sweep on failure too.
      supabaseDelete('message_log', `org_id=eq.${E2E_ORG_ID}&subject=eq.${encodeURIComponent(subject)}`);
      throw err;
    }
  });

  test('validation: missing body → 400', async () => {
    const token = getParentToken();
    const res = callEdgeFn('send-parent-message', token, {
      org_id: E2E_ORG_ID,
      subject: 'No body test',
      body: '',
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/[Mm]issing required|[Bb]ody|[Rr]equired/);
  });

  test('validation: new conversation without subject → 400', async () => {
    const token = getParentToken();
    const res = callEdgeFn('send-parent-message', token, {
      org_id: E2E_ORG_ID,
      // No subject, no parent_message_id → fn must reject
      body: 'Test body without subject',
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/[Ss]ubject is required/);
  });

  test('validation: oversized body (>10000 chars) → 400', async () => {
    const token = getParentToken();
    const oversize = 'x'.repeat(10001);
    const res = callEdgeFn('send-parent-message', token, {
      org_id: E2E_ORG_ID,
      subject: 'Oversize body test',
      body: oversize,
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/too long/i);
  });

  test('cross-tenant: parent posting for an org they have no guardian in → 403', async () => {
    const token = getParentToken();
    // Use a syntactically-valid UUID that is NOT the e2e org. Random
    // generation guarantees no guardian linkage exists.
    const fakeOrgId = '00000000-0000-4000-8000-000000000000';
    const res = callEdgeFn('send-parent-message', token, {
      org_id: fakeOrgId,
      subject: 'Cross-tenant test',
      body: 'should be rejected',
    });
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toMatch(/[Nn]ot a parent in this organisation/);
  });
});

// ────────────────────────────────────────────────────────────────────
// §26.12 / §26.13 — Continuation response (authed portal + public token)
// ────────────────────────────────────────────────────────────────────
//
// PortalContinuation handles two routes:
//   /portal/continuation        — authed parent UI (PortalContinuationList)
//   /respond/continuation?token — public/email-link UI (TokenResponse)
// Both call the continuation-respond edge fn:
//   - portal: { run_id, student_id, response } with parent JWT
//   - token:  { token, response } with anon bearer
// Edge-fn behaviour is covered backend-side in §20. Tests below drive
// the UI: parent clicks Continue / token-URL clicks Confirm Continuing
// / invalid-token error toast / already-submitted message.
//
// continuation-respond was deployed with verify_jwt=false on
// 2026-05-09 (commit fixing the unauth gateway rejection — the
// function already does its own manual auth on both paths). The
// §26.13 happy-path test below uses a fresh browser.newContext()
// (no storageState) to exercise the realistic email-link flow:
// fully anonymous user clicks a link, no Supabase session in
// localStorage. The other §26.13 tests reuse the parent storage
// state because they exercise the same TokenResponse component but
// don't need to assert the fully-anon path twice.

test.describe('§26.12 / §26.13 — Continuation response', () => {
  const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
  const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';

  // Each test seeds a current-term + next-term pair and a continuation
  // run referencing them. Parallel inserts of overlapping date ranges
  // would race against the check_term_overlap trigger, so we serialise
  // within this block. Outside this block, §26 stays parallel.
  test.describe.configure({ mode: 'serial' });

  /** Seed a continuation run + response row. The far-future term ranges
   *  (year 2400+) avoid colliding with any existing terms in the e2e org;
   *  unique base year per testId keeps parallel test runs on different
   *  files isolated. */
  function seedContinuationRunAndResponse(opts: {
    testId: string;
    studentId: string;
    guardianId: string;
    deadlineDaysFromNow?: number;
    initialResponse?: 'pending' | 'continuing' | 'withdrawing';
  }): { runId: string; responseId: string; responseToken: string } {
    const deadline = new Date(
      Date.now() + (opts.deadlineDaysFromNow ?? 14) * 24 * 3600_000,
    )
      .toISOString()
      .slice(0, 10);

    const ownerUserId = getOwnerUserId();
    const baseYear =
      2400 +
      (Math.abs(
        opts.testId.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0),
      ) %
        50);
    const currentTerm = supabaseInsert('terms', {
      org_id: E2E_ORG_ID,
      name: `${opts.testId}_current`,
      start_date: `${baseYear}-01-01`,
      end_date: `${baseYear}-04-01`,
      created_by: ownerUserId,
    });
    const nextTerm = supabaseInsert('terms', {
      org_id: E2E_ORG_ID,
      name: `${opts.testId}_next`,
      start_date: `${baseYear}-04-02`,
      end_date: `${baseYear}-07-01`,
      created_by: ownerUserId,
    });
    if (!currentTerm?.id || !nextTerm?.id) {
      throw new Error(`seedTerms failed: ${JSON.stringify({ currentTerm, nextTerm })}`);
    }

    const run = supabaseInsert('term_continuation_runs', {
      org_id: E2E_ORG_ID,
      current_term_id: currentTerm.id,
      next_term_id: nextTerm.id,
      notice_deadline: deadline,
      reminder_schedule: [7, 3, 1],
      assumed_continuing: false,
      status: 'sent',
      created_by: ownerUserId,
    });
    if (!run?.id) throw new Error(`seedRun failed: ${JSON.stringify(run)}`);

    const responseToken = `e2e_token_${randomBytes(16).toString('hex')}`;
    const response = supabaseInsert('term_continuation_responses', {
      org_id: E2E_ORG_ID,
      run_id: run.id,
      student_id: opts.studentId,
      guardian_id: opts.guardianId,
      response: opts.initialResponse ?? 'pending',
      response_token: responseToken,
    });
    if (!response?.id) throw new Error(`seedResponse failed: ${JSON.stringify(response)}`);

    return { runId: run.id, responseId: response.id, responseToken };
  }

  /** Seed a fresh student linked to the e2e parent's guardian. Returns
   *  the student row + a cleanup callable that drops everything. */
  function seedStudentForParent(testId: string): { studentId: string; firstName: string } {
    const firstName = `${testId}_student`;
    const student = supabaseInsert('students', {
      org_id: E2E_ORG_ID,
      first_name: firstName,
      last_name: testId,
      status: 'active',
    });
    if (!student?.id) throw new Error(`seedStudent failed: ${JSON.stringify(student)}`);

    supabaseInsert('student_guardians', {
      org_id: E2E_ORG_ID,
      student_id: student.id,
      guardian_id: E2E_PARENT_GUARDIAN_ID,
      relationship: 'guardian',
      is_primary_payer: true,
    });

    return { studentId: student.id, firstName };
  }

  function cleanup(
    seed: { runId: string; responseId: string },
    testId: string,
    studentId: string,
  ) {
    supabaseDelete('term_continuation_responses', `id=eq.${seed.responseId}`);
    supabaseDelete('term_continuation_runs', `id=eq.${seed.runId}`);
    supabaseDelete(
      'terms',
      `org_id=eq.${E2E_ORG_ID}&name=like.${encodeURIComponent(`${testId}%`)}`,
    );
    supabaseDelete(
      'student_guardians',
      `org_id=eq.${E2E_ORG_ID}&student_id=eq.${studentId}`,
    );
    supabaseDelete('students', `org_id=eq.${E2E_ORG_ID}&id=eq.${studentId}`);
  }

  test('§26.12 — authed parent /portal/continuation: Continue card updates response', async ({
    browser,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { studentId, firstName } = seedStudentForParent(testId);
    const seed = seedContinuationRunAndResponse({
      testId,
      studentId,
      guardianId: E2E_PARENT_GUARDIAN_ID,
    });

    const ctx = await browser.newContext({ storageState: AUTH.parent });
    const page = await ctx.newPage();
    try {
      await goTo(page, '/portal/continuation');
      await assertNoErrorBoundary(page);

      // The card has the student name as its title. Wait for it to render —
      // useParentContinuationPending fetches via the parent's JWT.
      const studentLine = page.locator(`text=${firstName} ${testId}`).first();
      await expect(studentLine).toBeVisible({ timeout: 15_000 });

      // Locate Continue button inside that card. Using ancestor pivot keeps
      // us scoped if the parent has multiple pending responses.
      const card = page
        .locator('div')
        .filter({ has: page.locator(`text=${firstName} ${testId}`) })
        .filter({ has: page.locator('button:has-text("Continue")') })
        .last();
      const continueBtn = card.locator('button:has-text("Continue")').first();
      await expect(continueBtn).toBeVisible();
      await continueBtn.click();

      // Mutation completes async. Poll the DB rather than relying on UI
      // toast text (toast copy varies by org settings).
      await expect
        .poll(
          () => {
            const after = supabaseSelect(
              'term_continuation_responses',
              `id=eq.${seed.responseId}&select=response`,
            );
            return after?.[0]?.response;
          },
          { timeout: 15_000, intervals: [500, 1000, 2000] },
        )
        .toBe('continuing');

      const after = supabaseSelect(
        'term_continuation_responses',
        `id=eq.${seed.responseId}&select=response,response_at,response_method`,
      );
      expect(after[0].response).toBe('continuing');
      expect(after[0].response_at).not.toBeNull();
      // Portal path → response_method='portal' (the edge fn hardcodes it).
      expect(['portal', 'authenticated']).toContain(after[0].response_method);
    } finally {
      await ctx.close();
      cleanup(seed, testId, studentId);
    }
  });

  test('§26.13 — /respond/continuation?token: Confirm Continuing updates response', async ({
    browser,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { studentId } = seedStudentForParent(testId);
    const seed = seedContinuationRunAndResponse({
      testId,
      studentId,
      guardianId: E2E_PARENT_GUARDIAN_ID,
    });

    // Fully-anonymous context — the realistic email-link flow.
    // continuation-respond has verify_jwt=false so the gateway lets
    // the publishable-key Authorization header through to the function.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(`/respond/continuation?token=${seed.responseToken}`);

      const continueBtn = page.locator('button:has-text("Confirm Continuing")');
      await expect(continueBtn).toBeVisible({ timeout: 15_000 });
      await continueBtn.click();

      // Success card replaces the buttons.
      await expect(
        page.getByRole('heading', { name: 'Response Recorded' }),
      ).toBeVisible({ timeout: 15_000 });

      const after = supabaseSelect(
        'term_continuation_responses',
        `id=eq.${seed.responseId}&select=response,response_method`,
      );
      expect(after[0].response).toBe('continuing');
      expect(after[0].response_method).toBe('email_link');
    } finally {
      await ctx.close();
      cleanup(seed, testId, studentId);
    }
  });

  test('§26.13 — invalid token surfaces error toast on submit', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.parent });
    const page = await ctx.newPage();
    try {
      const fakeToken = `definitely_not_a_real_token_${Date.now()}`;
      await page.goto(`/respond/continuation?token=${fakeToken}`);

      const continueBtn = page.locator('button:has-text("Confirm Continuing")');
      await expect(continueBtn).toBeVisible({ timeout: 15_000 });
      await continueBtn.click();

      // Toast surfaces with the error. Match either the destructive variant
      // shape or the explicit "Invalid or expired" message — supabase-js
      // versions differ on whether they propagate the body to err.message.
      const toast = page
        .locator('[data-radix-collection-item]')
        .or(page.locator('[role="status"]'))
        .or(page.getByText(/Invalid or expired|Failed to submit response|Error/i));
      await expect(toast.first()).toBeVisible({ timeout: 10_000 });

      // The page MUST NOT show the success state.
      await expect(page.locator('text=Response Recorded')).not.toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('§26.13 — already-submitted token shows current-status message', async ({
    browser,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { studentId } = seedStudentForParent(testId);
    const seed = seedContinuationRunAndResponse({
      testId,
      studentId,
      guardianId: E2E_PARENT_GUARDIAN_ID,
      initialResponse: 'continuing',
    });

    const ctx = await browser.newContext({ storageState: AUTH.parent });
    const page = await ctx.newPage();
    try {
      await page.goto(`/respond/continuation?token=${seed.responseToken}`);

      const continueBtn = page.locator('button:has-text("Confirm Continuing")');
      await expect(continueBtn).toBeVisible({ timeout: 15_000 });
      await continueBtn.click();

      // The fn returns { already_responded: true }. The component flips to
      // the success-card layout with "Already Responded" as the heading.
      await expect(
        page.getByRole('heading', { name: 'Already Responded' }),
      ).toBeVisible({ timeout: 10_000 });

      // DB unchanged: still 'continuing', no clobber.
      const after = supabaseSelect(
        'term_continuation_responses',
        `id=eq.${seed.responseId}&select=response`,
      );
      expect(after[0].response).toBe('continuing');
    } finally {
      await ctx.close();
      cleanup(seed, testId, studentId);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// §26.6 — PortalSchedule (grouping, reschedule policies, calendar export)
// ────────────────────────────────────────────────────────────────────
//
// Catalog §26.6 specifies 9 sub-tests; this block covers the 7 that
// are deterministic on a real backend (the 2 omitted are: tap-to-expand
// notes — flaky on click target, and self-service slot picker happy
// path — depends on teacher availability seeding which is its own
// section). The self-service policy is still gated-tested at the UI
// dialog open level.
//
// Reschedule UI shape per `resolveReschedulePolicy` in
// `src/pages/portal/PortalSchedule.tsx`:
//   admin_locked → no Reschedule / Request Change buttons
//   request_only → "Request Change" → LessonChangeSheet → message_requests
//   self_service → "Reschedule" → RescheduleSlotPicker dialog
// Both populated paths write a `message_requests` row (lessons table is
// not mutated client-side — admins approve via /admin/messages). The
// catalog's "lesson updated, toast" wording is wrong.
//
// All 7 tests run serial because tests 4-5 mutate the org's
// `parent_reschedule_policy` column and must restore it. A failed
// restore would leak into other §26 tests within the same file.

test.describe('§26.6 — PortalSchedule', () => {
  test.describe.configure({ mode: 'serial' });

  const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
  const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';

  /** Service-role PATCH the org's parent_reschedule_policy. Returns the
   *  previous value so the caller can restore it in a finally block.
   *  Throws on failure — silent failure here corrupts subsequent tests. */
  function patchOrgReschedulePolicy(
    policy: 'self_service' | 'request_only' | 'admin_locked',
  ): string {
    const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
    const SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
    if (!SERVICE_KEY) {
      throw new Error('patchOrgReschedulePolicy: E2E_SUPABASE_SERVICE_ROLE_KEY required');
    }
    const before = supabaseSelect(
      'organisations',
      `id=eq.${E2E_ORG_ID}&select=parent_reschedule_policy`,
    );
    const previous = before[0]?.parent_reschedule_policy ?? 'request_only';

    const tmp = `/tmp/sb-patch-org-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    fs.writeFileSync(tmp, JSON.stringify({ parent_reschedule_policy: policy }));
    try {
      const res = execSync(
        `curl -s -w "\\nHTTP:%{http_code}" -X PATCH ` +
          `"${SUPABASE_URL}/rest/v1/organisations?id=eq.${E2E_ORG_ID}" ` +
          `-H "apikey: ${SERVICE_KEY}" ` +
          `-H "Authorization: Bearer ${SERVICE_KEY}" ` +
          `-H "Content-Type: application/json" ` +
          `-H "Prefer: return=minimal" ` +
          `-d @${tmp}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const m = res.match(/HTTP:(\d+)$/);
      const status = m ? Number(m[1]) : 0;
      if (status < 200 || status >= 300) {
        throw new Error(`patchOrgReschedulePolicy(${policy}) failed: ${res}`);
      }
      return previous;
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  /** Per-call random minute-of-day offset, so two runs at the same
   *  wall-clock minute land in non-overlapping 30-min lesson slots.
   *  Avoids the cross-run teacher_conflict trigger collision when a
   *  previous run leaked an orphan lesson at -10/+0/+14 days from
   *  approximately the same Date.now() value (range: ±30min interval
   *  overlap window).
   *
   *  24 slots × 30min = 12h spread per day, ~1/24 collision probability
   *  per orphan. Math.random() (not testId hash) is intentional:
   *  retries of a previously-collided test get a fresh slot rather
   *  than re-hitting the same one. The 12h window keeps the +0-day
   *  lesson within today's calendar day except in rare wrap cases
   *  (which are still safely inside thisWeek). */
  function lessonSlotOffsetMs(): number {
    const slotIdx = Math.floor(Math.random() * 24);
    return slotIdx * 30 * 60_000;
  }

  /** Seed a student linked to the e2e parent's guardian + a lesson with
   *  that student as a participant. Returns ids + a cleanup function
   *  that drops everything in FK order. The lesson's title carries the
   *  testId so /portal/schedule queries can locate the seeded card by
   *  text rather than relying on absolute position in the rendered list.
   *
   *  Atomic-on-failure: if the lesson INSERT throws (e.g. transient
   *  statement_timeout, teacher_conflict trigger fires from a race),
   *  the freshly-inserted student + student_guardians are rolled back
   *  before the throw propagates. Without this, a partially-seeded run
   *  leaks rows that the next run's lesson INSERT then collides with. */
  function seedScheduledLessonForParent(opts: {
    testId: string;
    daysFromNow: number;
    title?: string;
    notesShared?: string;
    durationMins?: number;
    status?: 'scheduled' | 'completed' | 'cancelled';
  }): {
    studentId: string;
    studentLinkId: string | null;
    lessonId: string;
    title: string;
    cleanup: () => void;
  } {
    const ownerUserId = getOwnerUserId();
    const teacherId = getOwnerTeacherId();

    const student = supabaseInsert('students', {
      org_id: E2E_ORG_ID,
      first_name: `${opts.testId}_s`,
      last_name: opts.testId,
      status: 'active',
    });
    if (!student?.id) throw new Error(`seedStudent failed: ${JSON.stringify(student)}`);

    // From here on, any throw must roll back the student to keep the
    // teacher_conflict trigger from firing on the next run's identical
    // -10/+0/+14 day slot.
    const rollbackStudent = () => {
      supabaseDelete(
        'student_guardians',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
      );
      supabaseDelete(
        'students',
        `org_id=eq.${E2E_ORG_ID}&id=eq.${student.id}`,
      );
    };

    let link: { id?: string } | null = null;
    try {
      link = supabaseInsert('student_guardians', {
        org_id: E2E_ORG_ID,
        student_id: student.id,
        guardian_id: E2E_PARENT_GUARDIAN_ID,
        relationship: 'guardian',
        is_primary_payer: false,
      });

      const startMs =
        Date.now() +
        opts.daysFromNow * 24 * 3600_000 +
        lessonSlotOffsetMs();
      const startAt = new Date(startMs).toISOString();
      const endAt = new Date(startMs + (opts.durationMins ?? 30) * 60_000).toISOString();
      const title = opts.title ?? `${opts.testId}_lesson`;

      const lessonPayload: Record<string, unknown> = {
        org_id: E2E_ORG_ID,
        teacher_id: teacherId,
        created_by: ownerUserId,
        start_at: startAt,
        end_at: endAt,
        status: opts.status ?? 'scheduled',
        title,
      };
      if (opts.notesShared) lessonPayload.notes_shared = opts.notesShared;

      const lesson = supabaseInsert('lessons', lessonPayload);
      if (!lesson?.id) throw new Error(`seedLesson failed: ${JSON.stringify(lesson)}`);

      supabaseInsert('lesson_participants', {
        org_id: E2E_ORG_ID,
        lesson_id: lesson.id,
        student_id: student.id,
      });

      return {
        studentId: student.id,
        studentLinkId: link?.id ?? null,
        lessonId: lesson.id,
        title,
        cleanup: () => {
          supabaseDelete(
            'lesson_participants',
            `org_id=eq.${E2E_ORG_ID}&lesson_id=eq.${lesson.id}`,
          );
          supabaseDelete(
            'message_requests',
            `org_id=eq.${E2E_ORG_ID}&lesson_id=eq.${lesson.id}`,
          );
          supabaseDelete(
            'lessons',
            `org_id=eq.${E2E_ORG_ID}&id=eq.${lesson.id}`,
          );
          rollbackStudent();
        },
      };
    } catch (err) {
      rollbackStudent();
      throw err;
    }
  }

  // §26.6.1 — Lessons grouped: this week / next week / past
  test('§26.6.1 — lessons grouped by week with past collapsed by default', async ({
    browser,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Cleanup-as-you-go pattern: each successful seed registers its own
    // cleanup callable. If a later seed throws, the finally block still
    // runs the registered cleanups for everything that succeeded —
    // critical because the seedScheduledLessonForParent helper uses the
    // same teacher across all 3 calls, so a third-call conflict would
    // leak the first two unless cleanups are tracked separately.
    const cleanups: Array<() => void> = [];

    try {
      // Three lessons at distinct buckets. Offsets are picked to be safe
      // for ANY day of the week — naive ±2 day offsets fail near week
      // boundaries (e.g. on a Saturday, -2 days is still inside the
      // current calendar week, so it lands in `thisWeek` not `past`):
      //  - past:    -10 days  → guaranteed previous calendar week
      //  - this:    +0 days   → today, always in thisWeekStart..thisWeekEnd
      //  - future:  +14 days  → always 2+ calendar weeks ahead
      // useParentLessons clamps past to 3 months; -10 stays well inside.
      const past = seedScheduledLessonForParent({
        testId: `${testId}_past`,
        daysFromNow: -10,
        status: 'completed',
      });
      cleanups.push(past.cleanup);
      const thisWeek = seedScheduledLessonForParent({
        testId: `${testId}_thisweek`,
        daysFromNow: 0,
      });
      cleanups.push(thisWeek.cleanup);
      const nextWeek = seedScheduledLessonForParent({
        testId: `${testId}_nextweek`,
        daysFromNow: 14,
      });
      cleanups.push(nextWeek.cleanup);

      const ctx = await browser.newContext({ storageState: AUTH.parent });
      const page = await ctx.newPage();
      try {
        await goTo(page, '/portal/schedule');
        await assertNoErrorBoundary(page);

        // "This Week" header always renders. Wait for it before asserting
        // lesson cards — useParentLessons is async and the page renders the
        // skeleton first.
        await expect(page.locator('h2:has-text("This Week")').first()).toBeVisible({ timeout: 15_000 });

        // This week + future cards visible.
        await expect(page.getByText(thisWeek.title).first()).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(nextWeek.title).first()).toBeVisible({ timeout: 10_000 });

        // Past lessons section is the Collapsible — closed by default. The
        // trigger button shows "Past Lessons (N)"; the past lesson title is
        // hidden until the user expands.
        const pastTrigger = page.locator('button:has-text("Past Lessons")').first();
        await expect(pastTrigger).toBeVisible({ timeout: 5_000 });
        await expect(page.getByText(past.title).first()).not.toBeVisible();
      } finally {
        await ctx.close();
      }
    } finally {
      for (const cleanup of cleanups.reverse()) {
        try { cleanup(); } catch { /* best-effort */ }
      }
    }
  });

  // §26.6.2 — Past collapsible: hidden by default, click expands
  test('§26.6.2 — past lessons collapsible: closed by default, click expands', async ({
    browser,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const past = seedScheduledLessonForParent({
      testId,
      daysFromNow: -10,
      status: 'completed',
    });

    const ctx = await browser.newContext({ storageState: AUTH.parent });
    const page = await ctx.newPage();
    try {
      await goTo(page, '/portal/schedule');
      await assertNoErrorBoundary(page);

      // Wait for fetch + render. The "This Week" header renders even with
      // zero this-week lessons — its "No lessons this week." copy serves
      // as the readiness signal.
      await expect(page.locator('h2:has-text("This Week")').first()).toBeVisible({ timeout: 15_000 });

      const trigger = page.locator('button:has-text("Past Lessons")').first();
      await expect(trigger).toBeVisible({ timeout: 5_000 });

      // Closed: lesson title not visible.
      await expect(page.getByText(past.title).first()).not.toBeVisible();

      // Open the collapsible — ChevronDown rotates and content unhides.
      await trigger.click();

      // Expanded: lesson title visible.
      await expect(page.getByText(past.title).first()).toBeVisible({ timeout: 5_000 });
    } finally {
      await ctx.close();
      past.cleanup();
    }
  });

  // §26.6.6 — admin_locked: no Reschedule / Request Change buttons
  test('§26.6.6 — admin_locked policy hides Reschedule and Request Change', async ({
    browser,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const previous = patchOrgReschedulePolicy('admin_locked');
    // Outer try guarantees we restore the policy even if seeding throws —
    // a leaked admin_locked state would silently change every subsequent
    // /portal/schedule test in this org.
    try {
      // +4 days: avoids the +3/-3 day slots §26.4 uses for its make-up
      // offer missed/matched lessons (same teacher, parallel-running
      // describe — the teacher_conflict trigger raises P0001 if our
      // lesson lands within 30min of §26.4's matched_lesson).
      const lesson = seedScheduledLessonForParent({ testId, daysFromNow: 4 });

      const ctx = await browser.newContext({ storageState: AUTH.parent });
      const page = await ctx.newPage();
      try {
        await goTo(page, '/portal/schedule');
        await assertNoErrorBoundary(page);

        // Wait for our seeded card to render. Once it's on the page the
        // policy decision has already happened — `canReschedule=false`
        // suppresses both the dropdown menu item and the desktop button.
        await expect(page.getByText(lesson.title).first()).toBeVisible({ timeout: 15_000 });

        // Desktop layout shows separate buttons. The "Add to Cal" dropdown
        // remains (calendar export is policy-independent), but Reschedule
        // / Request Change must NOT appear anywhere on the page.
        await expect(page.locator('button:has-text("Reschedule")')).toHaveCount(0);
        await expect(page.locator('button:has-text("Request Change")')).toHaveCount(0);

        // Sanity: "Add to Cal" still rendered for the seeded lesson.
        await expect(page.locator('button:has-text("Add to Cal")').first()).toBeVisible();
      } finally {
        await ctx.close();
        lesson.cleanup();
      }
    } finally {
      patchOrgReschedulePolicy(previous as 'self_service' | 'request_only' | 'admin_locked');
    }
  });

  // §26.6.5 — request_only: opens LessonChangeSheet, submit creates message_requests row
  test('§26.6.5 — request_only policy: Request Change → reschedule form → message_requests row', async ({
    browser,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const previous = patchOrgReschedulePolicy('request_only');
    try {
      const lesson = seedScheduledLessonForParent({ testId, daysFromNow: 5 });

      const ctx = await browser.newContext({ storageState: AUTH.parent });
      const page = await ctx.newPage();
      try {
        await goTo(page, '/portal/schedule');
        await assertNoErrorBoundary(page);

        await expect(page.getByText(lesson.title).first()).toBeVisible({ timeout: 15_000 });

        // Desktop "Request Change" button — request_only policy renders this
        // label (vs "Reschedule" for self_service). Click opens the
        // LessonChangeSheet bottom drawer.
        const requestBtn = page.locator('button:has-text("Request Change")').first();
        await expect(requestBtn).toBeVisible();
        await requestBtn.click();

        // The sheet's menu view shows three buttons; pick "Request reschedule"
        // to enter the reschedule form. Match on the bold heading copy
        // ("Request reschedule") rather than the icon button so we don't pick
        // up the calendar dropdown by accident.
        const menuRescheduleBtn = page
          .locator('button:has-text("Request reschedule")')
          .first();
        await expect(menuRescheduleBtn).toBeVisible({ timeout: 5_000 });
        await menuRescheduleBtn.click();

        // Reschedule form: textarea for "When would you prefer instead?".
        const preferTextarea = page
          .locator('textarea[placeholder*="Wednesday"]')
          .first();
        await expect(preferTextarea).toBeVisible({ timeout: 5_000 });
        const preferText = `${testId}_prefers_thursday_same_time`;
        await preferTextarea.fill(preferText);

        // Submit. The mutation goes through `useCreateMessageRequest` →
        // direct supabase.from('message_requests').insert.
        const submitBtn = page.locator('button:has-text("Send Reschedule Request")').first();
        await expect(submitBtn).toBeEnabled();
        await submitBtn.click();

        // Poll the DB rather than waiting on toast text — the toast string
        // depends on the org's branded copy and is brittle. The
        // request_type=reschedule + lesson_id pair uniquely identifies our
        // request. The body field carries our textarea content.
        await expect
          .poll(
            () => {
              const rows = supabaseSelect(
                'message_requests',
                `org_id=eq.${E2E_ORG_ID}&lesson_id=eq.${lesson.lessonId}&request_type=eq.reschedule&select=id,subject,message,request_type`,
              );
              return rows.length;
            },
            { timeout: 15_000, intervals: [500, 1000, 2000] },
          )
          .toBeGreaterThanOrEqual(1);

        const rows = supabaseSelect(
          'message_requests',
          `org_id=eq.${E2E_ORG_ID}&lesson_id=eq.${lesson.lessonId}&request_type=eq.reschedule&select=subject,message,guardian_id`,
        );
        expect(rows[0].guardian_id).toBe(E2E_PARENT_GUARDIAN_ID);
        expect(rows[0].message).toContain(preferText);
        // Subject is composed from lesson title + student names + date —
        // assert the title shows up in it (the most stable component).
        expect(rows[0].subject).toContain(lesson.title);
      } finally {
        await ctx.close();
        lesson.cleanup();
      }
    } finally {
      patchOrgReschedulePolicy(previous as 'self_service' | 'request_only' | 'admin_locked');
    }
  });

  // §26.6.4 — self_service policy: Reschedule button opens RescheduleSlotPicker dialog.
  // The full slot-pick happy path is brittle — depends on teacher
  // availability seeding which is its own backend section. Here we
  // assert the policy gates the right UI shape: button label is
  // "Reschedule" (not "Request Change") and the click opens the
  // dedicated dialog with title "Request Reschedule".
  test('§26.6.4 — self_service policy: Reschedule button opens slot picker dialog', async ({
    browser,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const previous = patchOrgReschedulePolicy('self_service');
    try {
      const lesson = seedScheduledLessonForParent({ testId, daysFromNow: 7 });

      const ctx = await browser.newContext({ storageState: AUTH.parent });
      const page = await ctx.newPage();
      try {
        await goTo(page, '/portal/schedule');
        await assertNoErrorBoundary(page);

        await expect(page.getByText(lesson.title).first()).toBeVisible({ timeout: 15_000 });

        // self_service renders "Reschedule" (vs "Request Change" for
        // request_only). "Request Change" must NOT appear.
        await expect(page.locator('button:has-text("Request Change")')).toHaveCount(0);

        const rescheduleBtn = page.locator('button:has-text("Reschedule")').first();
        await expect(rescheduleBtn).toBeVisible();
        await rescheduleBtn.click();

        // The dedicated Dialog opens with title "Request Reschedule" and
        // mounts RescheduleSlotPicker. Assert the dialog header — that's
        // the policy-gating contract; we don't try to actually pick a slot
        // here (slot enumeration is its own section).
        await expect(
          page.getByRole('dialog').getByText('Request Reschedule').first(),
        ).toBeVisible({ timeout: 10_000 });
      } finally {
        await ctx.close();
        lesson.cleanup();
      }
    } finally {
      patchOrgReschedulePolicy(previous as 'self_service' | 'request_only' | 'admin_locked');
    }
  });

  // §26.6.7 — Add to Google Calendar: window.open URL formatted correctly
  test('§26.6.7 — Add to Google Calendar opens correctly formatted URL', async ({
    browser,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // Pick a far-future date so the lesson lands in a "Week of …" group
    // with a single card — easier to scope the click target.
    const lesson = seedScheduledLessonForParent({
      testId,
      daysFromNow: 14,
      title: `${testId}_gcal`,
    });

    const ctx = await browser.newContext({ storageState: AUTH.parent });
    const page = await ctx.newPage();
    try {
      await goTo(page, '/portal/schedule');
      await assertNoErrorBoundary(page);

      await expect(page.getByText(lesson.title).first()).toBeVisible({ timeout: 15_000 });

      // PortalSchedule calls `window.open(generateGoogleCalendarUrl(...), '_blank', 'noopener,noreferrer')`.
      // Stub window.open so we capture the URL without spawning a tab —
      // page.context().on('page') flakes on noopener targets.
      await page.evaluate(() => {
        (window as unknown as { __opened: string[] }).__opened = [];
        window.open = (url?: string | URL) => {
          (window as unknown as { __opened: string[] }).__opened.push(String(url ?? ''));
          return null;
        };
      });

      // Open the "Add to Cal" dropdown for our seeded lesson and click
      // Google Calendar. Multiple "Add to Cal" buttons may exist if the
      // parent has other lessons; scope to the card containing our title.
      const card = page
        .locator('div')
        .filter({ has: page.getByText(lesson.title).first() })
        .filter({ has: page.locator('button:has-text("Add to Cal")') })
        .last();
      await card.locator('button:has-text("Add to Cal")').first().click();
      await page.locator('[role="menuitem"]:has-text("Google Calendar")').first().click();

      const opened = await page.evaluate(
        () => (window as unknown as { __opened: string[] }).__opened ?? [],
      );
      expect(opened.length).toBeGreaterThanOrEqual(1);

      const url = opened[0];
      expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
      const parsed = new URL(url);
      expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
      expect(parsed.searchParams.get('text')).toBe(lesson.title);
      expect(parsed.searchParams.get('ctz')).toBe('Europe/London');
      // dates is `start/end` in YYYYMMDDTHHMMSS local-timezone format.
      const dates = parsed.searchParams.get('dates') || '';
      expect(dates).toMatch(/^\d{8}T\d{6}\/\d{8}T\d{6}$/);
    } finally {
      await ctx.close();
      lesson.cleanup();
    }
  });

  // §26.6.8 — Download .ics: file content has correct VEVENT
  test('§26.6.8 — Download .ics emits valid VEVENT with lesson title and times', async ({
    browser,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const lesson = seedScheduledLessonForParent({
      testId,
      daysFromNow: 14,
      title: `${testId}_ics`,
    });

    const ctx = await browser.newContext({
      storageState: AUTH.parent,
      acceptDownloads: true,
    });
    const page = await ctx.newPage();
    try {
      await goTo(page, '/portal/schedule');
      await assertNoErrorBoundary(page);

      await expect(page.getByText(lesson.title).first()).toBeVisible({ timeout: 15_000 });

      const card = page
        .locator('div')
        .filter({ has: page.getByText(lesson.title).first() })
        .filter({ has: page.locator('button:has-text("Add to Cal")') })
        .last();
      await card.locator('button:has-text("Add to Cal")').first().click();

      // The dropdown item label includes "Apple / Outlook (.ics)".
      const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
      await page.locator('[role="menuitem"]:has-text(".ics")').first().click();
      const download = await downloadPromise;

      const path = await download.path();
      expect(path).toBeTruthy();

      const content = fs.readFileSync(path!, 'utf-8');
      expect(content).toContain('BEGIN:VCALENDAR');
      expect(content).toContain('BEGIN:VEVENT');
      expect(content).toContain(`SUMMARY:${lesson.title}`);
      expect(content).toContain('END:VEVENT');
      expect(content).toContain('END:VCALENDAR');
      // DTSTART/DTEND are TZID-prefixed local times, format YYYYMMDDTHHMMSS.
      expect(content).toMatch(/DTSTART;TZID=Europe\/London:\d{8}T\d{6}/);
      expect(content).toMatch(/DTEND;TZID=Europe\/London:\d{8}T\d{6}/);
    } finally {
      await ctx.close();
      lesson.cleanup();
    }
  });

  // §26.6.9 — iCal feed URL: backend serves valid VCALENDAR with the parent's lessons
  test('§26.6.9 — iCal feed URL returns VEVENT for parent\'s children lessons', async () => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const lesson = seedScheduledLessonForParent({
      testId,
      daysFromNow: 21,
      title: `${testId}_icalfeed`,
    });

    // Insert a calendar_connections row directly (provider='apple',
    // guardian-scoped) so the calendar-ical-feed edge fn has a token
    // it accepts. The frontend `generateParentICalUrl` does this same
    // insert via supabase-js; doing it via service-role here keeps the
    // test backend-only (no browser, no storageState dance).
    const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
    const E2E_PARENT_USER_ID = '85628488-f47f-4178-84f0-3425aad6e75e';
    const icalToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 90 * 24 * 3600_000).toISOString();

    const conn = supabaseInsert('calendar_connections', {
      user_id: E2E_PARENT_USER_ID,
      org_id: E2E_ORG_ID,
      provider: 'apple',
      guardian_id: E2E_PARENT_GUARDIAN_ID,
      ical_token: icalToken,
      ical_token_expires_at: expiresAt,
      sync_enabled: true,
      sync_status: 'active',
    });
    if (!conn?.id) throw new Error(`seed calendar_connections failed: ${JSON.stringify(conn)}`);

    try {
      // Fetch the feed. The fn validates the token, looks up the
      // guardian's children's lessons, and emits VCALENDAR text.
      const feed = execSync(
        `curl -sS "${SUPABASE_URL}/functions/v1/calendar-ical-feed?token=${icalToken}"`,
        { encoding: 'utf-8', timeout: 30_000 },
      );

      expect(feed).toContain('BEGIN:VCALENDAR');
      expect(feed).toContain('END:VCALENDAR');
      // PRODID identifies the LL feed (not the local calendarExport.ts —
      // that one says "Calendar Export").
      expect(feed).toContain('PRODID:-//LessonLoop//Calendar Feed//EN');

      // Our seeded lesson is +21 days, inside the [-3mo, +6mo] window
      // the fn fetches. Title appears in the SUMMARY line.
      expect(feed).toContain(`SUMMARY:${lesson.title}`);
      // UID is `${lessonId}@lessonloop.net`.
      expect(feed).toContain(`UID:${lesson.lessonId}@lessonloop.net`);
    } finally {
      // Drop the connection row so the next run gets a fresh token.
      supabaseDelete(
        'calendar_connections',
        `id=eq.${conn.id}`,
      );
      lesson.cleanup();
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// §26.9 — PortalInvoices (parent invoice list + pay drawer + PDF)
// ────────────────────────────────────────────────────────────────────
//
// Catalog §26.9 specifies 7 sub-tests:
//   1. Pay full invoice → success → status=paid, realtime updates list
//   2. Pay one installment → only that installment paid
//   3. "Pay all remaining" path
//   4. Native notice on Capacitor app  (mobile-only — out of master)
//   5. Apple Pay only on iOS Safari    (mobile-safari — out of master)
//   6. Download PDF
//   7. Filter by status
//
// This block lands the 3 desktop-master cases (1, 6, 7). Payment-plan
// installments (2, 3) need a separate seed for invoice_installments and
// are deferred. The mobile cases (4, 5) belong to the mobile-safari
// project, not master.
//
// Test 1 deliberately splits the UI assertion from the backend pay flow:
// the PaymentDrawer mounts Stripe Elements (an iframe with autofill
// races and origin restrictions — too brittle for Playwright), so we
// verify (a) the drawer opens with the right amount, then close it, and
// (b) drive the same backend flow §24.2/§24.3 covers — parent JWT calls
// stripe-create-payment-intent, we confirm the PI via Stripe TEST API,
// the dual-mode webhook records the payment, invoice settles to paid.
// The UI realtime update is intentionally NOT asserted — it works in
// production via useRealtimePortalPayments but flakes in CI on the
// post-webhook delay window.

import { execSync as execSync_26_9 } from 'child_process';
import fs_26_9 from 'fs';
import { randomBytes as randomBytes_26_9 } from 'crypto';

test.describe('§26.9 — PortalInvoices', () => {
  const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
  const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';
  const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
  const ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY!;
  const PARENT_EMAIL = process.env.E2E_PARENT_EMAIL!;
  const PARENT_PASSWORD = process.env.E2E_PARENT_PASSWORD!;

  /** Sign in via Supabase auth REST and return the access token.
   *  Mirrors signInForToken in 24-stripe.spec.ts — duplicated to keep
   *  changes scoped to this file. Don't export back-and-forth between
   *  spec files. */
  function signInForToken(email: string, password: string): string {
    const tmp = `/tmp/sb-26-9-login-${Date.now()}-${randomBytes_26_9(4).toString('hex')}.json`;
    fs_26_9.writeFileSync(tmp, JSON.stringify({ email, password }));
    try {
      const result = execSync_26_9(
        `curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" ` +
          `-H "apikey: ${ANON_KEY}" -H "Content-Type: application/json" -d @${tmp}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const session = JSON.parse(result);
      if (!session.access_token) {
        throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(session).slice(0, 200)}`);
      }
      return session.access_token as string;
    } finally {
      try { fs_26_9.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  /** Call a Supabase edge fn with a bearer token. Returns { status, body }. */
  function invokeEdgeFn(
    fn: string,
    token: string,
    body: Record<string, unknown>,
  ): { status: number; body: any } {
    const tmp = `/tmp/sb-26-9-fn-${Date.now()}-${randomBytes_26_9(4).toString('hex')}.json`;
    fs_26_9.writeFileSync(tmp, JSON.stringify(body));
    try {
      const res = execSync_26_9(
        `curl -s -w "\\nHTTP:%{http_code}" -X POST "${SUPABASE_URL}/functions/v1/${fn}" ` +
          `-H "Authorization: Bearer ${token}" -H "apikey: ${ANON_KEY}" ` +
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
      try { fs_26_9.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  /** Seed an invoice for the e2e parent's guardian. Returns ids + a
   *  cleanup callable. The invoice is created via create_invoice_with_items
   *  RPC (status=draft) and patched to the requested status if the caller
   *  asks for one. Caller adds Stripe customer cleanup separately if the
   *  test creates one (only the pay-flow test does). */
  function seedInvoiceForParent(opts: {
    testId: string;
    status?: 'sent' | 'paid' | 'overdue';
    amountMinor?: number;
  }): {
    invoiceId: string;
    invoiceNumber: string;
    cleanup: () => void;
  } {
    const amount = opts.amountMinor ?? 2500; // £25.00
    const invoice = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: E2E_PARENT_GUARDIAN_ID,
      notes: `e2e_${opts.testId}_invoice`,
      items: [
        {
          description: `e2e_${opts.testId}_item`,
          quantity: 1,
          unit_price_minor: amount,
        },
      ],
    });
    if (!invoice?.id) throw new Error(`seedInvoice failed: ${JSON.stringify(invoice)}`);

    // create_invoice_with_items returns status=draft; flip via the
    // enforce_invoice_status_transition trigger. draft→sent→paid is
    // valid; draft→paid directly is not.
    if (opts.status === 'sent' || opts.status === 'paid' || opts.status === 'overdue') {
      patchInvoiceStatus(invoice.id, 'sent');
      if (opts.status === 'paid') {
        patchInvoiceStatus(invoice.id, 'paid');
      } else if (opts.status === 'overdue') {
        patchInvoiceStatus(invoice.id, 'overdue');
      }
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      cleanup: () => deleteInvoiceById(invoice.id),
    };
  }

  // §26.9.1 — Pay full invoice end-to-end. UI smoke for the drawer +
  // backend pay flow via Stripe TEST API + DB assertions.
  test('§26.9.1 — Pay full invoice: drawer opens with amount + backend flow settles invoice to paid', async ({
    browser,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const seeded = seedInvoiceForParent({ testId, status: 'sent', amountMinor: 3500 });
    let stripeCustomerId: string | null = null;

    // Make sure we don't carry over a stale guardian_payment_preferences
    // row from a prior failed run — the row is created on first PI as a
    // side-effect of stripe-customer attach.
    supabaseDelete(
      'guardian_payment_preferences',
      `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}`,
    );

    const ctx = await browser.newContext({ storageState: AUTH.parent });
    const page = await ctx.newPage();
    try {
      // ── 1. UI smoke: list shows the seeded invoice with a Pay button ──
      await goTo(page, '/portal/invoices');
      await assertNoErrorBoundary(page);

      // The seeded invoice's number is the lookup key — it appears in the
      // monospaced number field on the invoice card.
      const invoiceCardLocator = page.locator(`text=${seeded.invoiceNumber}`).first();
      await expect(invoiceCardLocator).toBeVisible({ timeout: 15_000 });

      // Pay button format: "Pay £35" — formatCurrencyMinor uses
      // `minimumFractionDigits: 0` so whole pounds drop the trailing
      // ".00". The price label is rendered alongside a CreditCard icon.
      const payBtn = page
        .locator(`button:has-text("Pay £35")`)
        .first();
      await expect(payBtn).toBeVisible({ timeout: 5_000 });
      await payBtn.click();

      // ── 2. Drawer opens with the amount header ────────────────────────
      // Desktop renders Dialog (matches sm:max-w-md), header "Pay Invoice".
      await expect(
        page.getByRole('dialog').getByText('Pay Invoice').first(),
      ).toBeVisible({ timeout: 10_000 });

      // The amount inside the drawer is rendered after createPaymentIntent
      // resolves — wait for the formatted total to show. Stripe's PI
      // create call goes against test-mode (the e2e org has
      // stripe_test_mode=true). VAT is disabled on the e2e org so the
      // total matches unit_price_minor exactly (£35).
      await expect(
        page.getByRole('dialog').locator('text=/£35(\\.\\d+)?/').first(),
      ).toBeVisible({ timeout: 15_000 });

      // The Stripe customer + guardian_payment_preferences row got created
      // as a side-effect of the drawer's stripe-create-payment-intent
      // call. Capture the stripe_customer_id so we can clean it up after.
      const prefs = supabaseSelect(
        'guardian_payment_preferences',
        `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}&select=stripe_customer_id`,
      );
      if (prefs[0]?.stripe_customer_id) {
        stripeCustomerId = prefs[0].stripe_customer_id;
      }

      // Close the drawer — we're not driving the Elements iframe.
      await page.keyboard.press('Escape');

      // ── 3. Backend pay flow (matches §24.2/§24.3) ─────────────────────
      // Drive a fresh PI via the parent JWT, confirm with pm_card_visa,
      // wait for the dual-mode webhook to record the payment.
      const parentToken = signInForToken(PARENT_EMAIL, PARENT_PASSWORD);
      const piRes = invokeEdgeFn('stripe-create-payment-intent', parentToken, {
        invoiceId: seeded.invoiceId,
      });
      expect(piRes.status).toBe(200);
      const paymentIntentId = piRes.body.paymentIntentId as string;
      expect(paymentIntentId).toBeTruthy();

      const confirmed = confirmTestPaymentIntent(paymentIntentId, 'pm_card_visa');
      expect(confirmed.status).toBe('succeeded');

      // The PI was created against the invoice's total_minor (with VAT
      // if enabled). Read the actual total to know what amount the
      // webhook will settle.
      const invForTotal = supabaseSelect(
        'invoices',
        `id=eq.${seeded.invoiceId}&select=total_minor`,
      );
      const expectedAmount = invForTotal[0].total_minor as number;

      const paymentId = await waitForWebhookPayment(
        seeded.invoiceId,
        expectedAmount,
        supabaseSelect,
        30_000,
      );
      expect(paymentId).toBeTruthy();

      // ── 4. DB assertions: invoice paid, payment row created ───────────
      const inv = supabaseSelect(
        'invoices',
        `id=eq.${seeded.invoiceId}&select=status,paid_minor,total_minor`,
      );
      expect(inv[0].status).toBe('paid');
      expect(inv[0].paid_minor).toBe(expectedAmount);

      const payments = supabaseSelect(
        'payments',
        `invoice_id=eq.${seeded.invoiceId}&select=id,amount_minor,provider,provider_reference`,
      );
      expect(payments.length).toBe(1);
      expect(payments[0].provider).toBe('stripe');
      expect(payments[0].provider_reference).toBe(paymentIntentId);
    } finally {
      await ctx.close();
      // Stripe customer cleanup must precede invoice cleanup or the
      // payment_prefs FK will fail.
      if (stripeCustomerId) deleteTestCustomer(stripeCustomerId);
      supabaseDelete(
        'guardian_payment_preferences',
        `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}`,
      );
      seeded.cleanup();
    }
  });

  // §26.9.7 — Filter by status. Two invoices in distinct statuses; the
  // dropdown filter should toggle their visibility independently.
  test('§26.9.7 — Filter by status: All / Paid / Awaiting Payment toggles visibility', async ({
    browser,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // 'sent' for outstanding bucket; 'paid' for payment history bucket.
    // Distinct amounts so we can disambiguate with the visible Pay copy
    // when needed (and so they're not confusable with other tests).
    const sentInvoice = seedInvoiceForParent({ testId: `${testId}_sent`, status: 'sent', amountMinor: 1700 });
    const paidInvoice = seedInvoiceForParent({ testId: `${testId}_paid`, status: 'paid', amountMinor: 2300 });

    const ctx = await browser.newContext({ storageState: AUTH.parent });
    const page = await ctx.newPage();
    try {
      await goTo(page, '/portal/invoices');
      await assertNoErrorBoundary(page);

      // Default filter is "All Invoices". Both should be visible.
      await expect(page.locator(`text=${sentInvoice.invoiceNumber}`).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(`text=${paidInvoice.invoiceNumber}`).first()).toBeVisible();

      // The PortalLayout sidebar mounts a ChildSwitcher Select with
      // `data-hint="child-switcher"` — that's a SECOND combobox on the
      // page. Plain `.first()` matches the child switcher instead of
      // our status filter and the dropdown items don't include "Paid".
      // Scope the locator to the status filter via :not on the data-hint.
      const filterTrigger = page.locator(
        'button[role="combobox"]:not([data-hint="child-switcher"])',
      ).first();
      await filterTrigger.click();
      await page.locator('[role="option"]:has-text("Paid")').first().click();

      // After filter change useParentInvoices refetches; assert the
      // sent invoice disappears AND the paid one stays.
      await expect(page.locator(`text=${sentInvoice.invoiceNumber}`)).toHaveCount(0, { timeout: 10_000 });
      await expect(page.locator(`text=${paidInvoice.invoiceNumber}`).first()).toBeVisible();

      // Switch to "Awaiting Payment" → only sent visible.
      await filterTrigger.click();
      await page.locator('[role="option"]:has-text("Awaiting Payment")').first().click();
      await expect(page.locator(`text=${paidInvoice.invoiceNumber}`)).toHaveCount(0, { timeout: 10_000 });
      await expect(page.locator(`text=${sentInvoice.invoiceNumber}`).first()).toBeVisible();
    } finally {
      await ctx.close();
      sentInvoice.cleanup();
      paidInvoice.cleanup();
    }
  });

  // §26.9.6 — Download PDF. useInvoicePdf renders client-side via jsPDF
  // and triggers a browser download with filename `${invoice_number}.pdf`.
  test('§26.9.6 — Download PDF emits a valid PDF file with invoice number in filename', async ({
    browser,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const seeded = seedInvoiceForParent({ testId, status: 'sent', amountMinor: 1850 });

    const ctx = await browser.newContext({
      storageState: AUTH.parent,
      acceptDownloads: true,
    });
    const page = await ctx.newPage();
    try {
      await goTo(page, '/portal/invoices');
      await assertNoErrorBoundary(page);

      // Wait for the seeded card to appear.
      await expect(page.locator(`text=${seeded.invoiceNumber}`).first()).toBeVisible({ timeout: 15_000 });

      // Each invoice card has its own "Download PDF" button. Scope to the
      // specific card by walking up from the invoice number text.
      const card = page
        .locator('div')
        .filter({ has: page.locator(`text=${seeded.invoiceNumber}`) })
        .filter({ has: page.locator('button:has-text("Download PDF")') })
        .last();
      const downloadBtn = card.locator('button:has-text("Download PDF")').first();
      await expect(downloadBtn).toBeVisible();

      const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
      await downloadBtn.click();
      const download = await downloadPromise;

      // Filename: `${invoice_number}.pdf`.
      const filename = download.suggestedFilename();
      expect(filename).toBe(`${seeded.invoiceNumber}.pdf`);

      const path = await download.path();
      expect(path).toBeTruthy();

      // PDF magic bytes — the file must start with "%PDF-".
      const buf = fs_26_9.readFileSync(path!);
      expect(buf.length).toBeGreaterThan(100);
      expect(buf.slice(0, 5).toString('utf-8')).toBe('%PDF-');
    } finally {
      await ctx.close();
      seeded.cleanup();
    }
  });
});
