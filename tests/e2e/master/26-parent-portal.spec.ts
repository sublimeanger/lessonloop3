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
} from '../supabase-admin';

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

// Other §26 fixmes left for next session — most are UI-heavy (drawer
// confirmations, Stripe Elements iframe, native app NativePaymentNotice)
// or rely on data the e2e seed doesn't currently provide (multi-child
// parent for child filter, active continuation run, message threads).
// Backend-driven gap-fillers remaining: §26.10 compose new thread +
// notify-internal-message, §26.12/§26.13 continuation response
// (authed + public token).
