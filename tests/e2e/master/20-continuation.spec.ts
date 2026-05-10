/**
 * 20 — Continuation (term continuation)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §20
 *
 * Backend-driven tests for the response submission lifecycle. Setting
 * up a real continuation run via the create-continuation-run edge fn
 * needs a current term with a deadline, a configured next term, and
 * recurring lessons; that's heavier than this spec covers. Instead,
 * we seed a minimal `term_continuation_runs` + `term_continuation_responses`
 * row directly via service-role and exercise the response paths
 * (authed via continuation-respond, public via token URL).
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';
import {
  getOwnerUserId,
  supabaseDelete,
  supabaseInsert,
  supabaseSelect,
} from '../supabase-admin';
import { resetE2ERateLimits } from './_fixtures/stripe-test-helpers';
import { execSync } from 'child_process';
import fs from 'fs';
import { randomBytes } from 'crypto';

const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';

function genTestId() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Deterministic per-testId baseYear for `terms` seeding (s30 fix for
 * audit/findings/2026-05-10-20-7b-seedterms-concurrency-flake.md).
 *
 * Previously each test picked baseYear via `2400 + Math.random() * 500`.
 * With ~6 tests in this file at workers=4, two parallel runs can pick
 * the same baseYear (~1/500 pairwise), causing the second `terms` INSERT
 * to hit the check_term_overlap trigger and return null. The fixture
 * then throws "seedTerms failed".
 *
 * Replacing Math.random with a per-testId hash makes baseYear
 * deterministic for any given testId, so two parallel tests can only
 * collide if they share the exact same testId — which can't happen
 * because genTestId() includes Date.now() at ms precision.
 *
 * 10_000-year window gives effectively zero pairwise collision odds.
 */
function termsBaseYear(testId: string): number {
  let h = 0;
  for (const c of testId) h = (h * 31 + c.charCodeAt(0)) | 0;
  return 2400 + (Math.abs(h) % 10_000);
}

function signInForToken(email: string, password: string): string {
  const result = execSync(
    `curl -s -X POST "${process.env.E2E_SUPABASE_URL}/auth/v1/token?grant_type=password" ` +
      `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" -H "Content-Type: application/json" ` +
      `-d ${JSON.stringify(JSON.stringify({ email, password }))}`,
    { encoding: 'utf-8', timeout: 15_000 },
  );
  const session = JSON.parse(result);
  if (!session.access_token) throw new Error(`signIn failed: ${result.slice(0, 200)}`);
  return session.access_token;
}

function invokeFn(fnName: string, body: Record<string, unknown>, token?: string): { status: number; body: any } {
  const tmp = `/tmp/sb-fn-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  fs.writeFileSync(tmp, JSON.stringify(body));
  try {
    // Public flows (no user JWT) still satisfy verify_jwt by passing the
    // anon key as a bearer token — the same pattern the frontend uses
    // for unauth pages like /respond/continuation.
    const bearer = token || process.env.E2E_SUPABASE_ANON_KEY!;
    const result = execSync(
      `curl -s -w "\\nHTTP:%{http_code}" -X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/${fnName}" ` +
        `-H "Authorization: Bearer ${bearer}" -H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Content-Type: application/json" -d @${tmp}`,
      { encoding: 'utf-8', timeout: 30_000 },
    );
    const m = result.match(/^([\s\S]*)\nHTTP:(\d+)$/);
    const rawBody = m ? m[1] : result;
    const status = m ? Number(m[2]) : 0;
    let parsed: any = rawBody;
    try { parsed = JSON.parse(rawBody); } catch { /* leave as text */ }
    return { status, body: parsed };
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

/**
 * Seed a minimal continuation run + response row. Returns the IDs and
 * the public response_token so a test can drive the unauthed path.
 */
function seedContinuationRunAndResponse(opts: {
  testId: string;
  studentId: string;
  guardianId: string;
}): { runId: string; responseId: string; responseToken: string } {
  const today = new Date();
  const deadline = new Date(today.getTime() + 14 * 24 * 3600_000).toISOString().slice(0, 10);

  const ownerUserId = getOwnerUserId();
  // Use far-future date ranges (year 2400+) so we don't overlap with
  // any existing terms in the test org. The check_term_overlap trigger
  // rejects any current/next term insert that intersects another term's
  // date range. Each test_id gets a unique base year so parallel tests
  // don't collide either (s30: deterministic hash, see termsBaseYear).
  const baseYear = termsBaseYear(opts.testId);
  const currentTermStart = `${baseYear}-01-01`;
  const currentTermEnd = `${baseYear}-04-01`;
  const nextTermStart = `${baseYear}-04-02`;
  const nextTermEnd = `${baseYear}-07-01`;
  const currentTerm = supabaseInsert('terms', {
    org_id: E2E_ORG_ID,
    name: `${opts.testId}_current`,
    start_date: currentTermStart,
    end_date: currentTermEnd,
    created_by: ownerUserId,
  });
  const nextTerm = supabaseInsert('terms', {
    org_id: E2E_ORG_ID,
    name: `${opts.testId}_next`,
    start_date: nextTermStart,
    end_date: nextTermEnd,
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

  // Generate a unique-ish token for the response (production uses
  // gen_random_uuid via DB default, but we set explicitly to drive
  // the public path deterministically).
  const responseToken = `e2e_token_${randomBytes(16).toString('hex')}`;

  const response = supabaseInsert('term_continuation_responses', {
    org_id: E2E_ORG_ID,
    run_id: run.id,
    student_id: opts.studentId,
    guardian_id: opts.guardianId,
    response: 'pending',
    response_token: responseToken,
  });
  if (!response?.id) throw new Error(`seedResponse failed: ${JSON.stringify(response)}`);

  return { runId: run.id, responseId: response.id, responseToken };
}

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.parent);
  // bulk-process-continuation has a 5/hour per-user rate limit
  // (see _shared/rate-limit.ts RATE_LIMITS). §20.7 + §20.7b both
  // hit it as the e2e owner — easy to exhaust during local
  // iteration. Reset all e2e users' rate_limits at file start.
  resetE2ERateLimits();
});

test.describe('§20 — Continuation page (UI smoke)', () => {
  test.use({ storageState: AUTH.owner });

  test('owner /continuation renders without error', async ({ page }) => {
    await goTo(page, '/continuation');
    await assertNoErrorBoundary(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('§20 — Response submission', () => {
  // Within-file serial because each test creates a continuation run + terms
  // for the same e2e org; concurrent inserts of overlapping date ranges
  // can hit unique constraints on (org_id, name).
  test.describe.configure({ mode: 'serial' });

  test('§20.1 — authed parent submits response via continuation-respond → response="continuing"', async () => {
    const testId = genTestId();

    const student = supabaseInsert('students', {
      org_id: E2E_ORG_ID,
      first_name: `${testId}_student`,
      last_name: testId,
      status: 'active',
    });
    expect(student?.id).toBeTruthy();

    supabaseInsert('student_guardians', {
      org_id: E2E_ORG_ID,
      student_id: student.id,
      guardian_id: E2E_PARENT_GUARDIAN_ID,
      relationship: 'guardian',
      is_primary_payer: true,
    });

    const seeded = seedContinuationRunAndResponse({
      testId,
      studentId: student.id,
      guardianId: E2E_PARENT_GUARDIAN_ID,
    });

    try {
      const parentToken = signInForToken(
        process.env.E2E_PARENT_EMAIL!,
        process.env.E2E_PARENT_PASSWORD!,
      );
      const res = invokeFn(
        'continuation-respond',
        {
          run_id: seeded.runId,
          student_id: student.id,
          response: 'continuing',
        },
        parentToken,
      );
      expect(res.status).toBe(200);

      // Response row should reflect the new state.
      const after = supabaseSelect(
        'term_continuation_responses',
        `id=eq.${seeded.responseId}&select=response,response_at,response_method`,
      );
      expect(after.length).toBe(1);
      expect(after[0].response).toBe('continuing');
      expect(after[0].response_at).not.toBeNull();
      // response_method comes back as 'portal' for authed flow.
      expect(['portal', 'authenticated']).toContain(after[0].response_method);
    } finally {
      // Cleanup: response → run → terms → linkage → student
      supabaseDelete('term_continuation_responses', `id=eq.${seeded.responseId}`);
      supabaseDelete('term_continuation_runs', `id=eq.${seeded.runId}`);
      supabaseDelete(
        'terms',
        `org_id=eq.${E2E_ORG_ID}&name=like.${encodeURIComponent(`${testId}%`)}`,
      );
      supabaseDelete(
        'student_guardians',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
      );
      supabaseDelete('students', `org_id=eq.${E2E_ORG_ID}&id=eq.${student.id}`);
    }
  });

  test('§20.2 — public token URL submits response without auth', async () => {
    const testId = genTestId();

    const student = supabaseInsert('students', {
      org_id: E2E_ORG_ID,
      first_name: `${testId}_student`,
      last_name: testId,
      status: 'active',
    });
    expect(student?.id).toBeTruthy();

    supabaseInsert('student_guardians', {
      org_id: E2E_ORG_ID,
      student_id: student.id,
      guardian_id: E2E_PARENT_GUARDIAN_ID,
      relationship: 'guardian',
      is_primary_payer: true,
    });

    const seeded = seedContinuationRunAndResponse({
      testId,
      studentId: student.id,
      guardianId: E2E_PARENT_GUARDIAN_ID,
    });

    try {
      // Public path — NO auth header.
      const res = invokeFn('continuation-respond', {
        token: seeded.responseToken,
        response: 'withdrawing',
        withdrawal_reason: 'moving',
        withdrawal_notes: `${testId}_test_notes`,
      });
      expect(res.status).toBe(200);

      const after = supabaseSelect(
        'term_continuation_responses',
        `id=eq.${seeded.responseId}&select=response,response_method,withdrawal_reason,withdrawal_notes`,
      );
      expect(after.length).toBe(1);
      expect(after[0].response).toBe('withdrawing');
      expect(after[0].withdrawal_reason).toBe('moving');
      expect(after[0].withdrawal_notes).toBe(`${testId}_test_notes`);
      // Public token path → response_method='email_link' (matches the
      // edge fn's hardcoded value when token-based).
      expect(after[0].response_method).toBe('email_link');
    } finally {
      supabaseDelete('term_continuation_responses', `id=eq.${seeded.responseId}`);
      supabaseDelete('term_continuation_runs', `id=eq.${seeded.runId}`);
      supabaseDelete(
        'terms',
        `org_id=eq.${E2E_ORG_ID}&name=like.${encodeURIComponent(`${testId}%`)}`,
      );
      supabaseDelete(
        'student_guardians',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
      );
      supabaseDelete('students', `org_id=eq.${E2E_ORG_ID}&id=eq.${student.id}`);
    }
  });

  test('§20.3 — invalid token → 4xx (no row mutation)', async () => {
    const res = invokeFn('continuation-respond', {
      token: 'definitely_not_a_real_token_xyz123',
      response: 'continuing',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    // Body should mention "not found" / "invalid" / "expired"
    expect(JSON.stringify(res.body)).toMatch(/not found|invalid|expired|token/i);
  });
});

// ────────────────────────────────────────────────────────────────────
// §20.4 — create-continuation-run (the run-creation backend)
// ────────────────────────────────────────────────────────────────────
//
// The catalog calls for "Create run with N students → N response rows"
// but §20 was previously deferred because the create flow needs more
// scaffolding than the response side: terms (non-overlapping, in
// far-future to avoid the check_term_overlap trigger), an active
// student linked to the e2e parent's guardian as primary_payer, a
// recurrence_rules row, a lesson with recurrence_id set inside the
// current term, and a lesson_participants link. Once that's seeded,
// `action: "create"` produces:
//   - one term_continuation_runs row with status='draft' (NOT 'sent';
//     'sent' is reached via `action: "send"` after Resend dispatch)
//   - one term_continuation_responses row per student with response='pending'
//   - lesson_summary populated from recurrence_rules.days_of_week +
//     rate_cards lookup
//
// We assert on the row count + the run status + the response's
// pending state. The next test (§20.5) covers process_deadline.

test.describe('§20.4 — create-continuation-run (run-creation backend)', () => {
  // Force serial — each test seeds terms in the same e2e org, and
  // check_term_overlap rejects intersecting date ranges. Far-future
  // dates plus a per-test base year prevent collisions, but parallel
  // workers can still race the (org_id, name) unique constraint.
  test.describe.configure({ mode: 'serial' });

  /** Seed terms + student + recurring lesson, but NOT a continuation
   *  run — the test under exercise creates that. Returns IDs + cleanup. */
  function seedTermsStudentAndRecurringLesson(opts: { testId: string }): {
    currentTermId: string;
    nextTermId: string;
    studentId: string;
    recurrenceId: string;
    lessonId: string;
    cleanup: () => void;
  } {
    const ownerUserId = getOwnerUserId();
    // Same robust per-test baseYear scheme as seedContinuationRunAndResponse.
    const baseYear = termsBaseYear(opts.testId);
    const currentStart = `${baseYear}-01-01`;
    const currentEnd = `${baseYear}-04-01`;
    const nextStart = `${baseYear}-04-02`;
    const nextEnd = `${baseYear}-07-01`;

    const currentTerm = supabaseInsert('terms', {
      org_id: E2E_ORG_ID,
      name: `${opts.testId}_current`,
      start_date: currentStart,
      end_date: currentEnd,
      created_by: ownerUserId,
    });
    const nextTerm = supabaseInsert('terms', {
      org_id: E2E_ORG_ID,
      name: `${opts.testId}_next`,
      start_date: nextStart,
      end_date: nextEnd,
      created_by: ownerUserId,
    });
    if (!currentTerm?.id || !nextTerm?.id) {
      throw new Error(`seedTerms failed: ${JSON.stringify({ currentTerm, nextTerm })}`);
    }

    // Active student linked to e2e parent's guardian (primary payer)
    const student = supabaseInsert('students', {
      org_id: E2E_ORG_ID,
      first_name: `${opts.testId}_student`,
      last_name: opts.testId,
      status: 'active',
    });
    if (!student?.id) {
      throw new Error(`seedStudent failed: ${JSON.stringify(student)}`);
    }
    supabaseInsert('student_guardians', {
      org_id: E2E_ORG_ID,
      student_id: student.id,
      guardian_id: E2E_PARENT_GUARDIAN_ID,
      relationship: 'guardian',
      is_primary_payer: true,
    });

    // Recurrence rule: weekly Tuesdays, starting 2 weeks into current term.
    // days_of_week is a smallint[]; 2 = Tuesday.
    const recurrence = supabaseInsert('recurrence_rules', {
      org_id: E2E_ORG_ID,
      start_date: `${baseYear}-01-15`,
      pattern_type: 'weekly',
      days_of_week: [2],
      interval_weeks: 1,
    });
    if (!recurrence?.id) {
      throw new Error(`seedRecurrence failed: ${JSON.stringify(recurrence)}`);
    }

    // One lesson in current term with recurrence_id set. The create-run
    // hook only needs ONE existing lesson per recurrence to count it as
    // a continuing recurring engagement; it computes next-term lesson
    // count from days_of_week + the next term's date range.
    const lesson = supabaseInsert('lessons', {
      org_id: E2E_ORG_ID,
      start_at: `${baseYear}-01-15T10:00:00Z`,
      end_at: `${baseYear}-01-15T10:30:00Z`,
      title: `${opts.testId}_lesson`,
      created_by: ownerUserId,
      status: 'scheduled',
      recurrence_id: recurrence.id,
    });
    if (!lesson?.id) {
      throw new Error(`seedLesson failed: ${JSON.stringify(lesson)}`);
    }
    supabaseInsert('lesson_participants', {
      org_id: E2E_ORG_ID,
      lesson_id: lesson.id,
      student_id: student.id,
    });

    return {
      currentTermId: currentTerm.id,
      nextTermId: nextTerm.id,
      studentId: student.id,
      recurrenceId: recurrence.id,
      lessonId: lesson.id,
      cleanup: () => {
        // Order matters — child rows first.
        supabaseDelete(
          'term_continuation_responses',
          `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
        );
        supabaseDelete(
          'term_continuation_runs',
          `org_id=eq.${E2E_ORG_ID}&current_term_id=eq.${currentTerm.id}`,
        );
        supabaseDelete('lesson_participants', `lesson_id=eq.${lesson.id}`);
        supabaseDelete('lessons', `id=eq.${lesson.id}`);
        supabaseDelete('recurrence_rules', `id=eq.${recurrence.id}`);
        supabaseDelete(
          'student_guardians',
          `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
        );
        supabaseDelete('students', `id=eq.${student.id}`);
        supabaseDelete(
          'terms',
          `org_id=eq.${E2E_ORG_ID}&id=in.(${currentTerm.id},${nextTerm.id})`,
        );
      },
    };
  }

  test('§20.4 — action="create" happy path: 1 active student with recurring lesson → run + 1 response row created', async () => {
    const testId = genTestId();
    const seeded = seedTermsStudentAndRecurringLesson({ testId });
    const ownerToken = signInForToken(
      process.env.E2E_OWNER_EMAIL!,
      process.env.E2E_OWNER_PASSWORD!,
    );

    try {
      const noticeDeadline = new Date(Date.now() + 21 * 24 * 3600_000)
        .toISOString()
        .slice(0, 10);

      const res = invokeFn(
        'create-continuation-run',
        {
          action: 'create',
          org_id: E2E_ORG_ID,
          current_term_id: seeded.currentTermId,
          next_term_id: seeded.nextTermId,
          notice_deadline: noticeDeadline,
          assumed_continuing: false,
          reminder_schedule: [7, 3, 1],
        },
        ownerToken,
      );
      if (res.status !== 200) {
        throw new Error(
          `create-continuation-run create ${res.status}: ${JSON.stringify(res.body).slice(0, 400)}`,
        );
      }

      // Response shape: { run_id, total_students, summary, preview, skipped_students }
      expect(res.body?.run_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body?.total_students).toBe(1);
      // Summary tallies 1 pending response.
      expect(res.body?.summary?.total_students).toBe(1);
      expect(res.body?.summary?.pending).toBe(1);
      expect(res.body?.summary?.confirmed).toBe(0);

      // DB invariants — the run row exists in draft status.
      const runs = supabaseSelect(
        'term_continuation_runs',
        `id=eq.${res.body.run_id}&select=id,status,current_term_id,next_term_id,assumed_continuing`,
      );
      expect(runs.length).toBe(1);
      expect(runs[0].status).toBe('draft');
      expect(runs[0].assumed_continuing).toBe(false);
      expect(runs[0].current_term_id).toBe(seeded.currentTermId);
      expect(runs[0].next_term_id).toBe(seeded.nextTermId);

      // Exactly one response row for our seeded student in pending state.
      const responses = supabaseSelect(
        'term_continuation_responses',
        `run_id=eq.${res.body.run_id}&select=id,student_id,guardian_id,response,response_token,lesson_summary,next_term_fee_minor`,
      );
      expect(responses.length).toBe(1);
      expect(responses[0].student_id).toBe(seeded.studentId);
      expect(responses[0].guardian_id).toBe(E2E_PARENT_GUARDIAN_ID);
      expect(responses[0].response).toBe('pending');
      // response_token is generated server-side (uuid via DB default).
      expect(responses[0].response_token).toBeTruthy();
      // lesson_summary should contain at least one lesson entry derived
      // from our recurrence_rules row.
      expect(Array.isArray(responses[0].lesson_summary)).toBe(true);
      expect(responses[0].lesson_summary.length).toBe(1);
      expect(responses[0].lesson_summary[0].recurrence_id).toBe(seeded.recurrenceId);
    } finally {
      seeded.cleanup();
    }
  });

  test('§20.4 — action="create" RBAC: parent JWT (role=parent) → 403', async () => {
    const testId = genTestId();
    const seeded = seedTermsStudentAndRecurringLesson({ testId });
    try {
      const parentToken = signInForToken(
        process.env.E2E_PARENT_EMAIL!,
        process.env.E2E_PARENT_PASSWORD!,
      );
      const res = invokeFn(
        'create-continuation-run',
        {
          action: 'create',
          org_id: E2E_ORG_ID,
          current_term_id: seeded.currentTermId,
          next_term_id: seeded.nextTermId,
          notice_deadline: new Date(Date.now() + 14 * 24 * 3600_000)
            .toISOString()
            .slice(0, 10),
        },
        parentToken,
      );
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).toMatch(/[Nn]ot authorised/);
    } finally {
      seeded.cleanup();
    }
  });

  test('§20.4 — action="create" validation: missing current_term_id/next_term_id/notice_deadline → 400', async () => {
    const ownerToken = signInForToken(
      process.env.E2E_OWNER_EMAIL!,
      process.env.E2E_OWNER_PASSWORD!,
    );
    const res = invokeFn(
      'create-continuation-run',
      { action: 'create', org_id: E2E_ORG_ID },
      ownerToken,
    );
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/required/i);
  });
});

// ────────────────────────────────────────────────────────────────────
// §20.5 — process_deadline (auto-mark non-respondents)
// ────────────────────────────────────────────────────────────────────
//
// When a run's notice_deadline passes, admin (or cron) calls
// process_deadline. Pending responses are flipped to either:
//   - assumed_continuing (when run.assumed_continuing=true)
//   - no_response       (when run.assumed_continuing=false)
// The run itself flips to status='deadline_passed' + deadline_passed_at.
// Audit log row lands.
//
// We test both branches in run-scoped form (action="process_deadline"
// with run_id). The cron-style path (process_deadline with no run_id +
// service-role auth) is structurally similar but not exercised here —
// the run-scoped path proves the same logic.

test.describe('§20.5 — process_deadline', () => {
  test.describe.configure({ mode: 'serial' });

  /** Seed run + 1 pending response, with run.assumed_continuing
   *  controllable. The run starts at status='sent' so the
   *  process_deadline status guard passes. */
  function seedRunWithPendingResponse(opts: {
    testId: string;
    assumedContinuing: boolean;
  }): {
    runId: string;
    responseId: string;
    studentId: string;
    cleanup: () => void;
  } {
    const ownerUserId = getOwnerUserId();
    const baseYear = termsBaseYear(opts.testId);

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

    const student = supabaseInsert('students', {
      org_id: E2E_ORG_ID,
      first_name: `${opts.testId}_student`,
      last_name: opts.testId,
      status: 'active',
    });
    if (!student?.id) throw new Error(`seedStudent failed: ${JSON.stringify(student)}`);

    // Deadline already passed (yesterday) so the run is logically overdue.
    const deadline = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10);

    const run = supabaseInsert('term_continuation_runs', {
      org_id: E2E_ORG_ID,
      current_term_id: currentTerm.id,
      next_term_id: nextTerm.id,
      notice_deadline: deadline,
      reminder_schedule: [7, 3, 1],
      assumed_continuing: opts.assumedContinuing,
      status: 'sent',
      created_by: ownerUserId,
    });
    if (!run?.id) throw new Error(`seedRun failed: ${JSON.stringify(run)}`);

    const response = supabaseInsert('term_continuation_responses', {
      org_id: E2E_ORG_ID,
      run_id: run.id,
      student_id: student.id,
      guardian_id: E2E_PARENT_GUARDIAN_ID,
      response: 'pending',
    });
    if (!response?.id) throw new Error(`seedResponse failed: ${JSON.stringify(response)}`);

    return {
      runId: run.id,
      responseId: response.id,
      studentId: student.id,
      cleanup: () => {
        supabaseDelete('term_continuation_responses', `id=eq.${response.id}`);
        supabaseDelete('term_continuation_runs', `id=eq.${run.id}`);
        supabaseDelete('students', `id=eq.${student.id}`);
        supabaseDelete(
          'terms',
          `org_id=eq.${E2E_ORG_ID}&id=in.(${currentTerm.id},${nextTerm.id})`,
        );
      },
    };
  }

  test('§20.5a — process_deadline with assumed_continuing=true → pending flips to "assumed_continuing"', async () => {
    const testId = genTestId();
    const seeded = seedRunWithPendingResponse({ testId, assumedContinuing: true });
    const ownerToken = signInForToken(
      process.env.E2E_OWNER_EMAIL!,
      process.env.E2E_OWNER_PASSWORD!,
    );

    try {
      const res = invokeFn(
        'create-continuation-run',
        {
          action: 'process_deadline',
          org_id: E2E_ORG_ID,
          run_id: seeded.runId,
        },
        ownerToken,
      );
      if (res.status !== 200) {
        throw new Error(
          `process_deadline ${res.status}: ${JSON.stringify(res.body).slice(0, 400)}`,
        );
      }

      // Response row flipped.
      const after = supabaseSelect(
        'term_continuation_responses',
        `id=eq.${seeded.responseId}&select=response,response_method,response_at`,
      );
      expect(after.length).toBe(1);
      expect(after[0].response).toBe('assumed_continuing');
      expect(after[0].response_method).toBe('auto_deadline');
      expect(after[0].response_at).not.toBeNull();

      // Run row flipped.
      const runRows = supabaseSelect(
        'term_continuation_runs',
        `id=eq.${seeded.runId}&select=status,deadline_passed_at`,
      );
      expect(runRows[0].status).toBe('deadline_passed');
      expect(runRows[0].deadline_passed_at).not.toBeNull();
    } finally {
      seeded.cleanup();
    }
  });

  test('§20.5b — process_deadline with assumed_continuing=false → pending flips to "no_response"', async () => {
    const testId = genTestId();
    const seeded = seedRunWithPendingResponse({ testId, assumedContinuing: false });
    const ownerToken = signInForToken(
      process.env.E2E_OWNER_EMAIL!,
      process.env.E2E_OWNER_PASSWORD!,
    );

    try {
      const res = invokeFn(
        'create-continuation-run',
        {
          action: 'process_deadline',
          org_id: E2E_ORG_ID,
          run_id: seeded.runId,
        },
        ownerToken,
      );
      if (res.status !== 200) {
        throw new Error(
          `process_deadline ${res.status}: ${JSON.stringify(res.body).slice(0, 400)}`,
        );
      }

      const after = supabaseSelect(
        'term_continuation_responses',
        `id=eq.${seeded.responseId}&select=response,response_method`,
      );
      expect(after[0].response).toBe('no_response');
      expect(after[0].response_method).toBe('auto_deadline');

      const runRows = supabaseSelect(
        'term_continuation_runs',
        `id=eq.${seeded.runId}&select=status`,
      );
      expect(runRows[0].status).toBe('deadline_passed');
    } finally {
      seeded.cleanup();
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// §20.7 — bulk-process-continuation (confirmed → extend + materialise)
// ────────────────────────────────────────────────────────────────────
//
// `bulk-process-continuation` is the server-side replacement for the
// in-browser useBulkProcessContinuation loop (eliminates token
// expiry + partial-process-on-tab-close risks). For a 'continuing' /
// 'assumed_continuing' response, it:
//   1. Extends recurrence_rules.end_date to next_term_end_date
//   2. Calls materialise_continuation_lessons RPC to insert real lesson
//      rows in the new date range
//   3. Marks response.is_processed=true + processed_at=now
//   4. If all responses processed → flips run.status='completed'
//
// We exercise the confirmed branch with one student. The 'withdrawing'
// branch routes through process-term-adjustment + cleanup_withdrawal_credits
// — separate complexity, deferred to a future session.

test.describe('§20.7 — bulk-process-continuation (confirmed flow)', () => {
  test.describe.configure({ mode: 'serial' });

  test('§20.7 — process_type="confirmed" extends recurrence + materialises lessons + marks response processed + run completed', async () => {
    const testId = genTestId();
    const ownerUserId = getOwnerUserId();
    const baseYear = termsBaseYear(testId);
    const currentStart = `${baseYear}-01-01`;
    const currentEnd = `${baseYear}-04-01`;
    const nextStart = `${baseYear}-04-02`;
    const nextEnd = `${baseYear}-04-30`; // 4 weeks of next term — small to keep materialisation fast

    // Terms (non-overlapping, far-future to avoid existing-term collisions)
    const currentTerm = supabaseInsert('terms', {
      org_id: E2E_ORG_ID,
      name: `${testId}_current`,
      start_date: currentStart,
      end_date: currentEnd,
      created_by: ownerUserId,
    });
    const nextTerm = supabaseInsert('terms', {
      org_id: E2E_ORG_ID,
      name: `${testId}_next`,
      start_date: nextStart,
      end_date: nextEnd,
      created_by: ownerUserId,
    });
    if (!currentTerm?.id || !nextTerm?.id) {
      throw new Error(`seedTerms failed: ${JSON.stringify({ currentTerm, nextTerm })}`);
    }

    const student = supabaseInsert('students', {
      org_id: E2E_ORG_ID,
      first_name: `${testId}_student`,
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

    // Recurrence ending at current term end — bulk-process check
    // `rec.end_date < body.next_term_end_date` triggers extension only
    // when end_date is set + is before next term end.
    const recurrence = supabaseInsert('recurrence_rules', {
      org_id: E2E_ORG_ID,
      start_date: `${baseYear}-01-15`,
      end_date: currentEnd,
      pattern_type: 'weekly',
      days_of_week: [3], // Wednesday
      interval_weeks: 1,
    });
    if (!recurrence?.id) {
      throw new Error(`seedRecurrence failed: ${JSON.stringify(recurrence)}`);
    }

    // One existing lesson in current term (not strictly needed for the
    // bulk-process path, but mirrors real data shape).
    const existingLesson = supabaseInsert('lessons', {
      org_id: E2E_ORG_ID,
      start_at: `${baseYear}-01-15T10:00:00Z`,
      end_at: `${baseYear}-01-15T10:30:00Z`,
      title: `${testId}_existing_lesson`,
      created_by: ownerUserId,
      status: 'scheduled',
      recurrence_id: recurrence.id,
    });
    supabaseInsert('lesson_participants', {
      org_id: E2E_ORG_ID,
      lesson_id: existingLesson.id,
      student_id: student.id,
    });

    // Continuation run + response with response='continuing' (skipping
    // the email/parent-response chain — bulk-process operates on the
    // already-decided response state). lesson_summary mirrors what
    // create-continuation-run would have written.
    const noticeDeadline = new Date(Date.now() + 7 * 24 * 3600_000)
      .toISOString()
      .slice(0, 10);
    const run = supabaseInsert('term_continuation_runs', {
      org_id: E2E_ORG_ID,
      current_term_id: currentTerm.id,
      next_term_id: nextTerm.id,
      notice_deadline: noticeDeadline,
      reminder_schedule: [7],
      assumed_continuing: false,
      status: 'sent',
      created_by: ownerUserId,
    });
    if (!run?.id) throw new Error(`seedRun failed: ${JSON.stringify(run)}`);

    const response = supabaseInsert('term_continuation_responses', {
      org_id: E2E_ORG_ID,
      run_id: run.id,
      student_id: student.id,
      guardian_id: E2E_PARENT_GUARDIAN_ID,
      response: 'continuing',
      response_at: new Date().toISOString(),
      response_method: 'portal',
      lesson_summary: [
        {
          recurrence_id: recurrence.id,
          day: 'Wednesday',
          time: '10:00',
          teacher_id: null,
          teacher_name: null,
          duration_mins: 30,
          rate_minor: 3000,
          lessons_next_term: 4,
        },
      ],
    });
    if (!response?.id) throw new Error(`seedResponse failed: ${JSON.stringify(response)}`);

    const ownerToken = signInForToken(
      process.env.E2E_OWNER_EMAIL!,
      process.env.E2E_OWNER_PASSWORD!,
    );

    try {
      const res = invokeFn(
        'bulk-process-continuation',
        {
          action: 'process',
          org_id: E2E_ORG_ID,
          run_id: run.id,
          next_term_start_date: nextStart,
          next_term_end_date: nextEnd,
          process_type: 'confirmed',
        },
        ownerToken,
      );
      if (res.status !== 200) {
        throw new Error(
          `bulk-process-continuation ${res.status}: ${JSON.stringify(res.body).slice(0, 400)}`,
        );
      }

      // Response shape: { processedCount, extendedCount, withdrawnCount,
      // lessonsCreated, conflictWarnings }
      expect(res.body?.processedCount).toBe(1);
      expect(res.body?.extendedCount).toBe(1);
      expect(res.body?.withdrawnCount).toBe(0);
      // lessonsCreated should be > 0 — 4 Wednesdays in our 4-week next term.
      expect(res.body?.lessonsCreated).toBeGreaterThan(0);

      // Recurrence end_date extended to next_term_end_date.
      const recAfter = supabaseSelect(
        'recurrence_rules',
        `id=eq.${recurrence.id}&select=end_date`,
      );
      expect(recAfter[0].end_date).toBe(nextEnd);

      // Response marked processed.
      const respAfter = supabaseSelect(
        'term_continuation_responses',
        `id=eq.${response.id}&select=is_processed,processed_at`,
      );
      expect(respAfter[0].is_processed).toBe(true);
      expect(respAfter[0].processed_at).not.toBeNull();

      // Run flipped to completed (only one response, all processed).
      const runAfter = supabaseSelect(
        'term_continuation_runs',
        `id=eq.${run.id}&select=status,completed_at`,
      );
      expect(runAfter[0].status).toBe('completed');
      expect(runAfter[0].completed_at).not.toBeNull();

      // New lessons exist in next-term date range tied to the same recurrence.
      const newLessons = supabaseSelect(
        'lessons',
        `org_id=eq.${E2E_ORG_ID}&recurrence_id=eq.${recurrence.id}` +
          `&start_at=gte.${nextStart}T00:00:00Z` +
          `&start_at=lte.${nextEnd}T23:59:59Z&select=id`,
      );
      expect(newLessons.length).toBeGreaterThan(0);
    } finally {
      // Clean up everything (newly-materialised lessons + their participants
      // included in the recurrence_id-scoped delete).
      supabaseDelete(
        'lesson_participants',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
      );
      supabaseDelete('lessons', `org_id=eq.${E2E_ORG_ID}&recurrence_id=eq.${recurrence.id}`);
      supabaseDelete('term_continuation_responses', `id=eq.${response.id}`);
      supabaseDelete('term_continuation_runs', `id=eq.${run.id}`);
      supabaseDelete('recurrence_rules', `id=eq.${recurrence.id}`);
      supabaseDelete(
        'student_guardians',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
      );
      supabaseDelete('students', `id=eq.${student.id}`);
      supabaseDelete(
        'terms',
        `org_id=eq.${E2E_ORG_ID}&id=in.(${currentTerm.id},${nextTerm.id})`,
      );
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// §20.7b — bulk-process-continuation (WITHDRAWALS flow)
// ────────────────────────────────────────────────────────────────────
//
// 10th-session pickup. The withdrawal branch was deferred sessions
// 7+8+9 because it routes through TWO additional layers:
//   * process-term-adjustment edge fn (preview → confirm)
//   * cleanup_withdrawal_credits RPC (voids unredeemed credits +
//     cancels waitlist entries + audit_log)
//
// Flow validated by this test:
//   1. Owner POST bulk-process-continuation with process_type='withdrawals'
//   2. Fn iterates responses where response='withdrawing'
//   3. For each lesson_summary item, calls process-term-adjustment
//      action='preview' (creates draft term_adjustments row with all
//      financials computed)
//   4. Then calls action='confirm' which:
//      - cancels remaining scheduled lessons in the recurrence
//      - caps recurrence_rule.end_date to (effective_date - 1)
//      - generates credit note invoice (is_credit_note=true, negative)
//      - flips term_adjustment.status='draft' → 'confirmed'
//   5. Calls cleanup_withdrawal_credits(_student_id, _org_id,
//      _effective_date) RPC — voids matching make_up_credits,
//      cancels make_up_waitlist entries, writes audit_log row
//      action='withdrawal_cleanup'.
//   6. Updates response.term_adjustment_id + is_processed=true
//   7. Marks run.status='completed' if all responses processed
//
// Recurrence shape: the recurrence MUST extend into next_term so
// process-term-adjustment finds remaining lessons to cancel
// (preview's `start_at >= effective_date` filter where effective_date
// = next_term_start). This is the opposite of §20.7 confirmed flow
// which has recurrence ending at current_term_end and EXTENDS it.

test.describe('§20.7b — bulk-process-continuation (withdrawals flow)', () => {
  test.describe.configure({ mode: 'serial' });

  test('§20.7b — process_type="withdrawals" cancels remaining lessons + creates credit note + cleanup_withdrawal_credits audit log', async () => {
    const testId = genTestId();
    const ownerUserId = getOwnerUserId();
    const baseYear = termsBaseYear(testId);
    const currentStart = `${baseYear}-01-01`;
    const currentEnd = `${baseYear}-04-01`;
    const nextStart = `${baseYear}-04-02`;
    const nextEnd = `${baseYear}-04-30`;

    // Terms
    const currentTerm = supabaseInsert('terms', {
      org_id: E2E_ORG_ID,
      name: `${testId}_current`,
      start_date: currentStart,
      end_date: currentEnd,
      created_by: ownerUserId,
    });
    const nextTerm = supabaseInsert('terms', {
      org_id: E2E_ORG_ID,
      name: `${testId}_next`,
      start_date: nextStart,
      end_date: nextEnd,
      created_by: ownerUserId,
    });
    if (!currentTerm?.id || !nextTerm?.id) {
      throw new Error(`seedTerms failed: ${JSON.stringify({ currentTerm, nextTerm })}`);
    }

    // Student linked to e2e parent guardian as primary payer (so credit
    // note generation finds the payer via student_guardians lookup).
    const student = supabaseInsert('students', {
      org_id: E2E_ORG_ID,
      first_name: `${testId}_student`,
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

    // Recurrence extending INTO next term — so process-term-adjustment
    // finds lessons to cancel. This is the opposite of §20.7's confirmed
    // recurrence which ends at current_term_end.
    const recurrence = supabaseInsert('recurrence_rules', {
      org_id: E2E_ORG_ID,
      start_date: `${baseYear}-01-15`,
      end_date: nextEnd,
      pattern_type: 'weekly',
      days_of_week: [3], // Wednesday
      interval_weeks: 1,
    });
    if (!recurrence?.id) {
      throw new Error(`seedRecurrence failed: ${JSON.stringify(recurrence)}`);
    }

    // Two scheduled lessons in next_term (Wednesdays). process-term-
    // adjustment.preview filters .gte('start_at', effective_date) so
    // both should be picked up.
    // Pick an actual Wednesday inside the 4-week next term window.
    // Apr 2400 has Wednesdays — easy to compute by floor + 7-day stride.
    const nextStartDate = new Date(`${nextStart}T00:00:00Z`);
    while (nextStartDate.getUTCDay() !== 3) {
      nextStartDate.setUTCDate(nextStartDate.getUTCDate() + 1);
    }
    const lessonDates = [0, 7].map((days) => {
      const d = new Date(nextStartDate);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    });

    const lessons: Array<{ id: string }> = [];
    for (const date of lessonDates) {
      const lesson = supabaseInsert('lessons', {
        org_id: E2E_ORG_ID,
        start_at: `${date}T10:00:00Z`,
        end_at: `${date}T10:30:00Z`,
        title: `${testId}_lesson_${date}`,
        created_by: ownerUserId,
        status: 'scheduled',
        recurrence_id: recurrence.id,
      });
      if (!lesson?.id) throw new Error(`seedLesson failed: ${JSON.stringify(lesson)}`);
      lessons.push({ id: lesson.id });
      supabaseInsert('lesson_participants', {
        org_id: E2E_ORG_ID,
        lesson_id: lesson.id,
        student_id: student.id,
      });
    }

    // Run + response (response='withdrawing'). lesson_summary mirrors
    // what create-continuation-run would have written when the parent
    // chose Withdraw.
    const run = supabaseInsert('term_continuation_runs', {
      org_id: E2E_ORG_ID,
      current_term_id: currentTerm.id,
      next_term_id: nextTerm.id,
      notice_deadline: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      reminder_schedule: [7],
      assumed_continuing: false,
      status: 'sent',
      created_by: ownerUserId,
    });
    if (!run?.id) throw new Error(`seedRun failed: ${JSON.stringify(run)}`);

    const response = supabaseInsert('term_continuation_responses', {
      org_id: E2E_ORG_ID,
      run_id: run.id,
      student_id: student.id,
      guardian_id: E2E_PARENT_GUARDIAN_ID,
      response: 'withdrawing',
      withdrawal_reason: 'moving',
      response_at: new Date().toISOString(),
      response_method: 'portal',
      lesson_summary: [
        {
          recurrence_id: recurrence.id,
          day: 'Wednesday',
          time: '10:00',
          teacher_id: null,
          teacher_name: null,
          duration_mins: 30,
          rate_minor: 3000,
          lessons_next_term: lessons.length,
        },
      ],
    });
    if (!response?.id) throw new Error(`seedResponse failed: ${JSON.stringify(response)}`);

    // Capture audit_log "withdrawal_cleanup" rows-before count so we
    // can assert the cleanup_withdrawal_credits RPC fired its row.
    const beforeAudit = supabaseSelect(
      'audit_log',
      `org_id=eq.${E2E_ORG_ID}&action=eq.withdrawal_cleanup&entity_id=eq.${student.id}&select=id`,
    );

    const ownerToken = signInForToken(
      process.env.E2E_OWNER_EMAIL!,
      process.env.E2E_OWNER_PASSWORD!,
    );

    let creditNoteInvoiceId: string | null = null;
    let termAdjustmentId: string | null = null;

    try {
      const res = invokeFn(
        'bulk-process-continuation',
        {
          action: 'process',
          org_id: E2E_ORG_ID,
          run_id: run.id,
          next_term_start_date: nextStart,
          next_term_end_date: nextEnd,
          process_type: 'withdrawals',
        },
        ownerToken,
      );
      if (res.status !== 200) {
        throw new Error(
          `bulk-process-continuation ${res.status}: ${JSON.stringify(res.body).slice(0, 400)}`,
        );
      }

      // Response shape: { processedCount, extendedCount, withdrawnCount,
      // lessonsCreated, conflictWarnings }. For withdrawals,
      // extendedCount=0 (no extension), withdrawnCount=1.
      expect(res.body?.processedCount).toBe(1);
      expect(res.body?.extendedCount).toBe(0);
      expect(res.body?.withdrawnCount).toBe(1);
      // lessonsCreated only counts day_change new lessons; withdrawal
      // creates 0.
      expect(res.body?.lessonsCreated || 0).toBe(0);

      // Response marked processed + has term_adjustment_id linking back.
      const respAfter = supabaseSelect(
        'term_continuation_responses',
        `id=eq.${response.id}&select=is_processed,processed_at,term_adjustment_id`,
      );
      expect(respAfter[0].is_processed).toBe(true);
      expect(respAfter[0].processed_at).not.toBeNull();
      expect(respAfter[0].term_adjustment_id).not.toBeNull();
      termAdjustmentId = respAfter[0].term_adjustment_id;

      // term_adjustments row exists with status=confirmed, type=withdrawal.
      const adj = supabaseSelect(
        'term_adjustments',
        `id=eq.${termAdjustmentId}&select=adjustment_type,status,credit_note_invoice_id,cancelled_lesson_ids,lesson_rate_minor,lessons_difference,adjustment_amount_minor`,
      );
      expect(adj.length).toBe(1);
      expect(adj[0].adjustment_type).toBe('withdrawal');
      expect(adj[0].status).toBe('confirmed');
      expect(adj[0].lessons_difference).toBe(lessons.length);
      // adjustment_amount_minor = lessons_difference × lesson_rate_minor.
      // findRateForDuration falls back to first rate card if no
      // student.default_rate_card_id; org's "Standard 30-min" rate.
      expect(adj[0].adjustment_amount_minor).toBeGreaterThan(0);
      expect(Array.isArray(adj[0].cancelled_lesson_ids)).toBe(true);
      expect(adj[0].cancelled_lesson_ids.length).toBe(lessons.length);
      creditNoteInvoiceId = adj[0].credit_note_invoice_id;

      // Lessons cancelled.
      for (const l of lessons) {
        const lAfter = supabaseSelect(
          'lessons',
          `id=eq.${l.id}&select=status,cancellation_reason`,
        );
        expect(lAfter[0].status).toBe('cancelled');
        expect(lAfter[0].cancellation_reason).toBe('Term adjustment');
      }

      // Recurrence.end_date capped to (effective_date - 1).
      const recAfter = supabaseSelect(
        'recurrence_rules',
        `id=eq.${recurrence.id}&select=end_date`,
      );
      const expectedEnd = new Date(`${nextStart}T00:00:00Z`);
      expectedEnd.setUTCDate(expectedEnd.getUTCDate() - 1);
      expect(recAfter[0].end_date).toBe(expectedEnd.toISOString().slice(0, 10));

      // Credit note invoice (is_credit_note=true, total_minor < 0,
      // adjustment_id pointing back at our adjustment).
      expect(creditNoteInvoiceId).not.toBeNull();
      const cn = supabaseSelect(
        'invoices',
        `id=eq.${creditNoteInvoiceId}&select=is_credit_note,status,total_minor,subtotal_minor,adjustment_id,payer_guardian_id`,
      );
      expect(cn[0].is_credit_note).toBe(true);
      expect(cn[0].total_minor).toBeLessThan(0);
      expect(cn[0].subtotal_minor).toBeLessThan(0);
      expect(cn[0].adjustment_id).toBe(termAdjustmentId);
      expect(cn[0].payer_guardian_id).toBe(E2E_PARENT_GUARDIAN_ID);

      // cleanup_withdrawal_credits RPC fired — audit_log row
      // action='withdrawal_cleanup' for our student.
      const afterAudit = supabaseSelect(
        'audit_log',
        `org_id=eq.${E2E_ORG_ID}&action=eq.withdrawal_cleanup&entity_id=eq.${student.id}&select=id,after`,
      );
      expect(afterAudit.length).toBe(beforeAudit.length + 1);
      // The newly-added row is the last one (created_at default now()).
      // afterAudit may not be ordered, but length delta is sufficient.

      // Run status — only one response, all processed → completed.
      const runAfter = supabaseSelect(
        'term_continuation_runs',
        `id=eq.${run.id}&select=status`,
      );
      expect(runAfter[0].status).toBe('completed');
    } finally {
      // Cleanup order: invoice_items → invoices (credit note) →
      // attendance_records → lesson_participants → lessons →
      // term_continuation_responses → term_continuation_runs →
      // term_adjustments → recurrence_rules → student_guardians →
      // students → terms.
      if (creditNoteInvoiceId) {
        supabaseDelete('invoice_items', `invoice_id=eq.${creditNoteInvoiceId}`);
        supabaseDelete('invoices', `id=eq.${creditNoteInvoiceId}`);
      }
      supabaseDelete(
        'lesson_participants',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
      );
      supabaseDelete('lessons', `org_id=eq.${E2E_ORG_ID}&recurrence_id=eq.${recurrence.id}`);
      supabaseDelete('term_continuation_responses', `id=eq.${response.id}`);
      supabaseDelete('term_continuation_runs', `id=eq.${run.id}`);
      if (termAdjustmentId) {
        supabaseDelete('term_adjustments', `id=eq.${termAdjustmentId}`);
      }
      supabaseDelete('recurrence_rules', `id=eq.${recurrence.id}`);
      supabaseDelete(
        'student_guardians',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
      );
      supabaseDelete('students', `id=eq.${student.id}`);
      supabaseDelete(
        'terms',
        `org_id=eq.${E2E_ORG_ID}&id=in.(${currentTerm.id},${nextTerm.id})`,
      );
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// §20.8 — Delete continuation run
// ────────────────────────────────────────────────────────────────────
//
// Catalog §20.1 case 8 ("Delete run with no responses → succeeds")
// and case 9 ("Delete run with responses → blocks or warns"). The
// "blocks or warns" framing in the catalog is aspirational —
// useDeleteContinuationRun (src/hooks/useTermContinuation.ts:743)
// just calls a direct PostgREST DELETE on term_continuation_runs
// without any pre-flight check. The
// term_continuation_responses_run_id_fkey FK has ON DELETE CASCADE
// (verified via pg_constraint readback 2026-05-09), so responses
// are silently cascade-deleted. Our test asserts the actual
// behaviour: cascade deletion, NOT block/warn.

test.describe('§20.8 — Delete continuation run', () => {
  test.describe.configure({ mode: 'serial' });

  test('§20.8a — delete run with no responses → row gone, no error', async () => {
    const testId = genTestId();
    const ownerUserId = getOwnerUserId();
    const baseYear = termsBaseYear(testId);

    const currentTerm = supabaseInsert('terms', {
      org_id: E2E_ORG_ID,
      name: `${testId}_current`,
      start_date: `${baseYear}-01-01`,
      end_date: `${baseYear}-04-01`,
      created_by: ownerUserId,
    });
    const nextTerm = supabaseInsert('terms', {
      org_id: E2E_ORG_ID,
      name: `${testId}_next`,
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
      notice_deadline: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      reminder_schedule: [7],
      assumed_continuing: false,
      status: 'draft',
      created_by: ownerUserId,
    });
    if (!run?.id) throw new Error(`seedRun failed: ${JSON.stringify(run)}`);

    try {
      // Delete via owner-JWT PostgREST (mirrors useDeleteContinuationRun
      // hook). org_id eq + id eq scoping matches the hook exactly.
      const ownerJwt = JSON.parse(
        fs.readFileSync('tests/e2e/.auth/owner.json', 'utf-8'),
      ).origins[0].localStorage[0].value;
      const session = JSON.parse(ownerJwt);
      const status = execSync(
        `curl -s -o /tmp/sb-delete-${testId}.txt -w "%{http_code}" ` +
          `-X DELETE "${process.env.E2E_SUPABASE_URL}/rest/v1/term_continuation_runs?id=eq.${run.id}&org_id=eq.${E2E_ORG_ID}" ` +
          `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
          `-H "Authorization: Bearer ${session.access_token}"`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      try { fs.unlinkSync(`/tmp/sb-delete-${testId}.txt`); } catch { /* ignore */ }
      expect(parseInt(status.trim(), 10)).toBeGreaterThanOrEqual(200);
      expect(parseInt(status.trim(), 10)).toBeLessThan(300);

      // Row gone.
      const after = supabaseSelect(
        'term_continuation_runs',
        `id=eq.${run.id}&select=id`,
      );
      expect(after.length).toBe(0);
    } finally {
      // run already deleted; just clean up terms.
      supabaseDelete(
        'terms',
        `org_id=eq.${E2E_ORG_ID}&id=in.(${currentTerm.id},${nextTerm.id})`,
      );
    }
  });

  test('§20.8b — delete run with responses → cascade deletes responses (catalog "blocks or warns" not enforced)', async () => {
    const testId = genTestId();
    const student = supabaseInsert('students', {
      org_id: E2E_ORG_ID,
      first_name: `${testId}_student`,
      last_name: testId,
      status: 'active',
    });
    if (!student?.id) throw new Error(`seedStudent failed: ${JSON.stringify(student)}`);

    const seeded = seedContinuationRunAndResponse({
      testId,
      studentId: student.id,
      guardianId: E2E_PARENT_GUARDIAN_ID,
    });

    try {
      // Confirm response exists pre-delete.
      const before = supabaseSelect(
        'term_continuation_responses',
        `id=eq.${seeded.responseId}&select=id`,
      );
      expect(before.length).toBe(1);

      const ownerJwt = JSON.parse(
        fs.readFileSync('tests/e2e/.auth/owner.json', 'utf-8'),
      ).origins[0].localStorage[0].value;
      const session = JSON.parse(ownerJwt);
      const status = execSync(
        `curl -s -o /tmp/sb-delete-${testId}.txt -w "%{http_code}" ` +
          `-X DELETE "${process.env.E2E_SUPABASE_URL}/rest/v1/term_continuation_runs?id=eq.${seeded.runId}&org_id=eq.${E2E_ORG_ID}" ` +
          `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
          `-H "Authorization: Bearer ${session.access_token}"`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      try { fs.unlinkSync(`/tmp/sb-delete-${testId}.txt`); } catch { /* ignore */ }
      expect(parseInt(status.trim(), 10)).toBeGreaterThanOrEqual(200);
      expect(parseInt(status.trim(), 10)).toBeLessThan(300);

      // Run row gone.
      const runAfter = supabaseSelect(
        'term_continuation_runs',
        `id=eq.${seeded.runId}&select=id`,
      );
      expect(runAfter.length).toBe(0);

      // Response cascade-deleted via FK ON DELETE CASCADE.
      const respAfter = supabaseSelect(
        'term_continuation_responses',
        `id=eq.${seeded.responseId}&select=id`,
      );
      expect(respAfter.length).toBe(0);
    } finally {
      // Sweep terms (run + response already deleted).
      supabaseDelete(
        'term_continuation_responses',
        `id=eq.${seeded.responseId}`,
      );
      supabaseDelete('term_continuation_runs', `id=eq.${seeded.runId}`);
      supabaseDelete('students', `id=eq.${student.id}`);
      supabaseDelete(
        'terms',
        `org_id=eq.${E2E_ORG_ID}&name=like.${encodeURIComponent(`${testId}_%`)}`,
      );
    }
  });
});
