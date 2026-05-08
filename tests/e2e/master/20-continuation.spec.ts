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
import { execSync } from 'child_process';
import fs from 'fs';
import { randomBytes } from 'crypto';

const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';

function genTestId() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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
  // don't collide either.
  const baseYear = 2400 + (Math.abs(opts.testId.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0)) % 50);
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
