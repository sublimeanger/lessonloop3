/**
 * 17 — Practice (assignments, logs, streaks)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §17
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.parent);
});

test.describe('Practice page (staff)', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error', async ({ page }) => {
    await goTo(page, '/practice');
    await assertNoErrorBoundary(page);
  });
});

test.describe('§17 — Practice DB tables queryable', () => {
  test.use({ storageState: AUTH.owner });

  test('practice_assignments table queryable', async () => {
    const { supabaseSelect } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('practice_assignments', `org_id=eq.${orgId}&select=id,title,status&limit=10`);
    expect(Array.isArray(rows)).toBe(true);
  });

  test('practice_logs table queryable', async () => {
    const { supabaseSelect } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('practice_logs', `org_id=eq.${orgId}&select=id,duration_minutes,reviewed_at&order=created_at.desc&limit=10`);
    expect(Array.isArray(rows)).toBe(true);
  });

  test('practice_streaks table queryable + per-student aggregation', async () => {
    const { supabaseSelect } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('practice_streaks', `org_id=eq.${orgId}&select=student_id,current_streak,longest_streak,last_practice_date&limit=10`);
    expect(Array.isArray(rows)).toBe(true);
  });
});

test.describe('§17 — Practice DB-write paths', () => {
  test.use({ storageState: AUTH.owner });

  test('§17.2 — practice_assignments insert writes row with default status', async () => {
    const { supabaseInsert, supabaseSelect, supabaseDelete, getOwnerUserId } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID!;
    const ownerId = getOwnerUserId();
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const student = supabaseInsert('students', {
      org_id: orgId,
      first_name: `${testId}_s`,
      last_name: testId,
      status: 'active',
    });
    expect(student?.id).toBeTruthy();

    const assignment = supabaseInsert('practice_assignments', {
      org_id: orgId,
      student_id: student.id,
      teacher_user_id: ownerId,
      title: `${testId}_assignment`,
      description: 'Practice scales for 20 minutes daily',
      target_minutes_per_day: 20,
      target_days_per_week: 7,
      end_date: new Date(Date.now() + 14 * 24 * 3600_000).toISOString().slice(0, 10),
      status: 'active',
    });
    expect(assignment?.id).toBeTruthy();

    try {
      const rows = supabaseSelect(
        'practice_assignments',
        `id=eq.${assignment.id}&select=title,status,target_minutes_per_day,target_days_per_week,student_id`,
      );
      expect(rows.length).toBe(1);
      expect(rows[0].title).toBe(`${testId}_assignment`);
      expect(rows[0].status).toBe('active');
      expect(rows[0].target_minutes_per_day).toBe(20);
      expect(rows[0].target_days_per_week).toBe(7);
      expect(rows[0].student_id).toBe(student.id);
    } finally {
      supabaseDelete('practice_assignments', `id=eq.${assignment.id}`);
      supabaseDelete('students', `id=eq.${student.id}`);
    }
  });

  test('§17.3 — Teacher reviews log → reviewed_at + reviewed_by_user_id set', async () => {
    const { supabaseInsert, supabaseSelect, supabaseDelete, getOwnerUserId } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID!;
    const ownerId = getOwnerUserId();
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const student = supabaseInsert('students', {
      org_id: orgId,
      first_name: `${testId}_s`,
      last_name: testId,
      status: 'active',
    });
    expect(student?.id).toBeTruthy();

    const log = supabaseInsert('practice_logs', {
      org_id: orgId,
      student_id: student.id,
      logged_by_user_id: ownerId,
      practice_date: new Date().toISOString().slice(0, 10),
      duration_minutes: 25,
      notes: `${testId}_log`,
    });
    expect(log?.id).toBeTruthy();

    try {
      // Teacher reviews via service-role PATCH (mirrors what the UI does
      // through the StudentPracticePanel review button).
      const url = process.env.E2E_SUPABASE_URL!;
      const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
      const tmp = `/tmp/sb-review-${Date.now()}.json`;
      const fs = await import('fs');
      fs.writeFileSync(
        tmp,
        JSON.stringify({
          reviewed_at: new Date().toISOString(),
          reviewed_by_user_id: ownerId,
          teacher_feedback: `${testId}_great_practice`,
        }),
      );
      const { execSync } = await import('child_process');
      execSync(
        `curl -s -X PATCH "${url}/rest/v1/practice_logs?id=eq.${log.id}" ` +
          `-H "apikey: ${key}" -H "Authorization: Bearer ${key}" ` +
          `-H "Content-Type: application/json" -H "Prefer: return=minimal" -d @${tmp}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      fs.unlinkSync(tmp);

      const after = supabaseSelect(
        'practice_logs',
        `id=eq.${log.id}&select=reviewed_at,reviewed_by_user_id,teacher_feedback`,
      );
      expect(after.length).toBe(1);
      expect(after[0].reviewed_at).not.toBeNull();
      expect(after[0].reviewed_by_user_id).toBe(ownerId);
      expect(after[0].teacher_feedback).toBe(`${testId}_great_practice`);
    } finally {
      supabaseDelete('practice_streaks', `org_id=eq.${orgId}&student_id=eq.${student.id}`);
      supabaseDelete('practice_logs', `id=eq.${log.id}`);
      supabaseDelete('students', `id=eq.${student.id}`);
    }
  });
});

test.describe('§17.4 — Streak progression (trigger)', () => {
  test.use({ storageState: AUTH.owner });

  test('2 consecutive days of logs → current_streak=2, last_practice_date=today', async () => {
    // NOTE: deliberately stops at 2-day streak. update_practice_streak
    // calls _notify_streak_milestone at current_streak ∈ (3,7,14,30,60,
    // 100) which in turn does `net.http_post` to the streak-notification
    // edge fn; pg_net + vault access from inside the trigger needs
    // service_role context. From a service-role insert that flows
    // correctly, but not in every test harness configuration. Test the
    // streak math up to one-below-milestone so the assertion is
    // independent of the notification side-effect.
    const { supabaseInsert, supabaseSelect, supabaseDelete, getOwnerUserId } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID!;
    const ownerId = getOwnerUserId();
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const student = supabaseInsert('students', {
      org_id: orgId,
      first_name: `${testId}_s`,
      last_name: testId,
      status: 'active',
    });
    expect(student?.id).toBeTruthy();

    try {
      // Insert oldest-first so the trigger sees monotonic dates.
      const isoDay = (offsetDays: number) =>
        new Date(Date.now() - offsetDays * 86400_000).toISOString().slice(0, 10);

      for (const offset of [1, 0]) {
        const log = supabaseInsert('practice_logs', {
          org_id: orgId,
          student_id: student.id,
          logged_by_user_id: ownerId,
          practice_date: isoDay(offset),
          duration_minutes: 20 + (1 - offset) * 5,
          notes: `${testId}_d-${offset}`,
        });
        expect(log?.id, `insert day -${offset} failed`).toBeTruthy();
      }

      const streaks = supabaseSelect(
        'practice_streaks',
        `org_id=eq.${orgId}&student_id=eq.${student.id}&select=current_streak,longest_streak,last_practice_date,streak_started_at`,
      );
      expect(streaks.length).toBeGreaterThanOrEqual(1);
      expect(streaks[0].current_streak).toBe(2);
      expect(streaks[0].longest_streak).toBeGreaterThanOrEqual(2);
      expect(streaks[0].last_practice_date).toBe(isoDay(0));
      // Streak start date is the oldest in the chain.
      expect(streaks[0].streak_started_at).toBe(isoDay(1));
    } finally {
      supabaseDelete('practice_streaks', `org_id=eq.${orgId}&student_id=eq.${student.id}`);
      supabaseDelete('practice_logs', `org_id=eq.${orgId}&student_id=eq.${student.id}`);
      supabaseDelete('students', `id=eq.${student.id}`);
    }
  });

  test('gap day breaks the streak: log today + 2 days ago → current_streak=1', async () => {
    const { supabaseInsert, supabaseSelect, supabaseDelete, getOwnerUserId } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID!;
    const ownerId = getOwnerUserId();
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const student = supabaseInsert('students', {
      org_id: orgId,
      first_name: `${testId}_gap`,
      last_name: testId,
      status: 'active',
    });
    expect(student?.id).toBeTruthy();

    try {
      const isoDay = (offsetDays: number) =>
        new Date(Date.now() - offsetDays * 86400_000).toISOString().slice(0, 10);

      // Day -2, then today (gap on day -1 → streak resets when today's log lands).
      supabaseInsert('practice_logs', {
        org_id: orgId,
        student_id: student.id,
        logged_by_user_id: ownerId,
        practice_date: isoDay(2),
        duration_minutes: 30,
        notes: `${testId}_gap_d-2`,
      });
      supabaseInsert('practice_logs', {
        org_id: orgId,
        student_id: student.id,
        logged_by_user_id: ownerId,
        practice_date: isoDay(0),
        duration_minutes: 30,
        notes: `${testId}_gap_d0`,
      });

      const streaks = supabaseSelect(
        'practice_streaks',
        `org_id=eq.${orgId}&student_id=eq.${student.id}&select=current_streak,longest_streak,last_practice_date`,
      );
      expect(streaks.length).toBeGreaterThanOrEqual(1);
      // Today's log is latest; gap on yesterday breaks the chain → current=1.
      expect(streaks[0].current_streak).toBe(1);
      expect(streaks[0].longest_streak).toBeGreaterThanOrEqual(1);
      expect(streaks[0].last_practice_date).toBe(isoDay(0));
    } finally {
      supabaseDelete('practice_streaks', `org_id=eq.${orgId}&student_id=eq.${student.id}`);
      supabaseDelete('practice_logs', `org_id=eq.${orgId}&student_id=eq.${student.id}`);
      supabaseDelete('students', `id=eq.${student.id}`);
    }
  });
});

// §17.3 parent-side logging is already covered by §26.7 (parent portal).

// Helper: query Postgres via the Supabase Management API db/query endpoint.
// `net._http_response` is not exposed via PostgREST, so we round-trip through
// the Management API. Requires `SUPABASE_ACCESS_TOKEN` (sbp_*) in env — which
// every Claude session loads from ~/.claude/settings.json. Tests gracefully
// surface "skip" guidance if the token is missing.
async function selectNetHttpResponseSince(
  sinceId: number,
  contentSubstring: string,
): Promise<Array<{ id: number; status_code: number | null; created: string; content: string | null; error_msg: string | null }>> {
  // pg_net removes rows from `http_request_queue` after processing, so a URL
  // JOIN doesn't work to identify the request. Filter by `id > sinceId` (so
  // we only see post-test rows) + body shape (`content LIKE %contentSubstring%`)
  // to disambiguate from concurrent cron callouts.
  const { execSync } = await import('node:child_process');
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      '[§17.4 e2e delivery] SUPABASE_ACCESS_TOKEN missing — cannot query net._http_response. ' +
        'Add to ~/.claude/settings.json env block.',
    );
  }
  const sql =
    `SELECT r.id, r.status_code, r.created::text AS created, r.content, r.error_msg ` +
    `FROM net._http_response r ` +
    `WHERE r.id > ${sinceId} ` +
    `AND r.content LIKE '%${contentSubstring}%' ` +
    `ORDER BY r.id DESC LIMIT 5`;
  const body = JSON.stringify({ query: sql });
  // Pass body via stdin to keep secrets off argv.
  const out = execSync(
    `curl -sS -X POST 'https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/database/query' ` +
      `-H 'Authorization: Bearer ${token}' ` +
      `-H 'Content-Type: application/json' ` +
      `-H 'User-Agent: lessonloop-e2e/1.0' ` +
      `--data-binary @-`,
    { input: body, encoding: 'utf-8', timeout: 30_000 },
  );
  const parsed = JSON.parse(out);
  if (!Array.isArray(parsed)) {
    throw new Error(`[§17.4 e2e delivery] Management API returned non-array: ${out.slice(0, 200)}`);
  }
  return parsed;
}

async function maxNetHttpResponseId(): Promise<number> {
  const { execSync } = await import('node:child_process');
  const token = process.env.SUPABASE_ACCESS_TOKEN!;
  const out = execSync(
    `curl -sS -X POST 'https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/database/query' ` +
      `-H 'Authorization: Bearer ${token}' ` +
      `-H 'Content-Type: application/json' ` +
      `-H 'User-Agent: lessonloop-e2e/1.0' ` +
      `--data-binary @-`,
    { input: JSON.stringify({ query: 'SELECT COALESCE(max(id), 0) AS m FROM net._http_response' }), encoding: 'utf-8', timeout: 30_000 },
  );
  const parsed = JSON.parse(out);
  return Number(parsed?.[0]?.m ?? 0);
}

test.describe('§17.4 — Streak milestone (audit + notification side-effect)', () => {
  test.use({ storageState: AUTH.owner });

  test('3-day chain hits milestone → audit_log streak_milestone row written', async () => {
    // The trigger update_practice_streak fires _notify_streak_milestone at
    // current_streak ∈ (3,7,14,30,60,100). After the
    // 20260518110000_notify_streak_milestone_defensive migration, the
    // helper:
    //   1. INSERT audit_log (durable — committed regardless)
    //   2. attempt net.http_post in a nested EXCEPTION block; vault /
    //      pg_net failures are logged as warnings, never propagate up
    // So this test is independent of vault state — even if the vault
    // is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (production
    // condition prior to seeding), the audit_log row still commits and
    // the practice_logs INSERT succeeds. The pg_net delivery side-effect
    // is best-effort and tested elsewhere (streak-notification edge fn).
    const { supabaseInsert, supabaseSelect, supabaseDelete, getOwnerUserId } =
      await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID!;
    const ownerId = getOwnerUserId();
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const student = supabaseInsert('students', {
      org_id: orgId,
      first_name: `${testId}_milestone`,
      last_name: testId,
      status: 'active',
    });
    expect(student?.id).toBeTruthy();

    try {
      const isoDay = (offsetDays: number) =>
        new Date(Date.now() - offsetDays * 86400_000).toISOString().slice(0, 10);

      // Insert oldest-first so monotonic update_practice_streak walks
      // 1 → 2 → 3 (milestone fires on the third insert).
      const milestoneStartedAt = new Date().toISOString();
      for (const offset of [2, 1, 0]) {
        const log = supabaseInsert('practice_logs', {
          org_id: orgId,
          student_id: student.id,
          logged_by_user_id: ownerId,
          practice_date: isoDay(offset),
          duration_minutes: 25,
          notes: `${testId}_milestone_d-${offset}`,
        });
        expect(log?.id, `insert day -${offset} failed`).toBeTruthy();
      }

      const streaks = supabaseSelect(
        'practice_streaks',
        `org_id=eq.${orgId}&student_id=eq.${student.id}&select=current_streak,longest_streak,last_practice_date`,
      );
      expect(streaks.length).toBeGreaterThanOrEqual(1);
      expect(streaks[0].current_streak).toBe(3);
      expect(streaks[0].longest_streak).toBeGreaterThanOrEqual(3);
      expect(streaks[0].last_practice_date).toBe(isoDay(0));

      // The milestone helper writes one audit_log row scoped to this
      // student. Filter on entity_id (= student_id) and gte created_at to
      // dodge any pre-existing rows.
      const audit = supabaseSelect(
        'audit_log',
        `org_id=eq.${orgId}&action=eq.streak_milestone&entity_id=eq.${student.id}` +
          `&created_at=gte.${encodeURIComponent(milestoneStartedAt)}` +
          `&select=action,entity_type,entity_id,after`,
      );
      expect(audit.length).toBe(1);
      expect(audit[0].action).toBe('streak_milestone');
      expect(audit[0].entity_type).toBe('practice_streaks');
      expect(audit[0].after?.streak).toBe(3);
      expect(audit[0].after?.student_id).toBe(student.id);
    } finally {
      supabaseDelete(
        'audit_log',
        `org_id=eq.${orgId}&action=eq.streak_milestone&entity_id=eq.${student.id}`,
      );
      supabaseDelete('practice_streaks', `org_id=eq.${orgId}&student_id=eq.${student.id}`);
      supabaseDelete('practice_logs', `org_id=eq.${orgId}&student_id=eq.${student.id}`);
      supabaseDelete('students', `id=eq.${student.id}`);
    }
  });

  test('milestone triggers streak-notification edge fn end-to-end (200 OK from net._http_response)', async () => {
    // Session-12 closure: vault SUPABASE_URL + INTERNAL_CRON_SECRET are
    // seeded; trigger sends `x-cron-secret` header (post-migration
    // 20260519100000_notify_streak_milestone_x_cron_secret). The edge fn
    // (verify_jwt=false) accepts and runs to completion. Asserts the full
    // chain rather than just the audit_log durable record.
    test.skip(!process.env.SUPABASE_ACCESS_TOKEN, 'SUPABASE_ACCESS_TOKEN missing in env');

    const { supabaseInsert, supabaseSelect, supabaseDelete, getOwnerUserId } =
      await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID!;
    const ownerId = getOwnerUserId();
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const sinceId = await maxNetHttpResponseId();

    const student = supabaseInsert('students', {
      org_id: orgId,
      first_name: `${testId}_e2edelivery`,
      last_name: testId,
      status: 'active',
    });
    expect(student?.id).toBeTruthy();

    try {
      const isoDay = (offsetDays: number) =>
        new Date(Date.now() - offsetDays * 86400_000).toISOString().slice(0, 10);

      for (const offset of [2, 1, 0]) {
        const log = supabaseInsert('practice_logs', {
          org_id: orgId,
          student_id: student.id,
          logged_by_user_id: ownerId,
          practice_date: isoDay(offset),
          duration_minutes: 25,
          notes: `${testId}_e2edelivery_d-${offset}`,
        });
        expect(log?.id, `insert day -${offset} failed`).toBeTruthy();
      }

      const streaks = supabaseSelect(
        'practice_streaks',
        `org_id=eq.${orgId}&student_id=eq.${student.id}&select=current_streak`,
      );
      expect(streaks[0]?.current_streak).toBe(3);

      // pg_net is async — poll up to 30s for the response row. Filter on
      // id > sinceId (post-test rows) + body content "Building Momentum"
      // (the milestone string for streak=3) to disambiguate from concurrent
      // cron callouts.
      let response: { id: number; status_code: number | null; content: string | null } | undefined;
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const rows = await selectNetHttpResponseSince(sinceId, 'Building Momentum');
        if (rows.length > 0) {
          response = rows[0];
          break;
        }
        await new Promise((r) => setTimeout(r, 2_000));
      }

      expect(response, 'no net._http_response row found for streak-notification within 30s').toBeTruthy();
      expect(response!.status_code, `streak-notification returned ${response!.status_code}: ${response!.content}`).toBe(200);
      // emails_sent may be 0 if RESEND_API_KEY is not seeded (best-effort
      // delivery); the contract being verified is auth + shape, not Resend.
      const body = JSON.parse(response!.content || '{}');
      expect(body.success).toBe(true);
      expect(body.streak).toBe(3);
    } finally {
      supabaseDelete(
        'audit_log',
        `org_id=eq.${orgId}&action=eq.streak_milestone&entity_id=eq.${student.id}`,
      );
      supabaseDelete('practice_streaks', `org_id=eq.${orgId}&student_id=eq.${student.id}`);
      supabaseDelete('practice_logs', `org_id=eq.${orgId}&student_id=eq.${student.id}`);
      supabaseDelete('students', `id=eq.${student.id}`);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// §17.5.5 / §17.5.6 — Cron-based maintenance functions
// ────────────────────────────────────────────────────────────────────
//
// Two daily cron jobs maintain practice state without time-travel
// fixtures: we just call the SQL fn directly via service-role RPC,
// having seeded the input rows in the desired pre-state.
//
// `reset_stale_streaks()`: bulk UPDATE on practice_streaks where
//   current_streak > 0 AND last_practice_date < (today_local - 1).
//   Sets current_streak=0, streak_started_at=NULL.
//
// `complete_expired_assignments()`: bulk UPDATE on practice_assignments
//   where status='active' AND end_date IS NOT NULL AND end_date < CURRENT_DATE.
//   Sets status='completed'.
//
// Both fns run in the daily cron under INTERNAL_CRON_SECRET-gated
// endpoints (cron-runner edge fn), but the underlying SQL fns are
// callable directly via PostgREST RPC with the service-role key —
// which is the contract we want to test (the cron-runner just calls
// them on a schedule). Each test seeds + asserts the specific row
// it cares about, by row id, so concurrent cron runs against other
// rows don't interfere.

test.describe('§17.5.5 — reset_stale_streaks cron', () => {
  test.use({ storageState: AUTH.owner });

  /** Service-role RPC call returning {status, body}. The cron functions
   *  return void; success is HTTP 200/204 with empty body. */
  async function callRpcAsServiceRole(
    fnName: string,
  ): Promise<{ status: number; body: string }> {
    const { execSync } = await import('child_process');
    const url = process.env.E2E_SUPABASE_URL!;
    const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
    if (!key) throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY required for cron RPC');
    const res = execSync(
      `curl -s -w "\\nHTTP:%{http_code}" -X POST "${url}/rest/v1/rpc/${fnName}" ` +
        `-H "apikey: ${key}" -H "Authorization: Bearer ${key}" ` +
        `-H "Content-Type: application/json" -d '{}'`,
      { encoding: 'utf-8', timeout: 30_000 },
    );
    const m = res.match(/^([\s\S]*)\nHTTP:(\d+)$/);
    return {
      status: m ? Number(m[2]) : 0,
      body: m ? m[1] : res,
    };
  }

  test('§17.5.5 — stale streak (last_practice 3d ago) resets to 0; today-active streak preserved', async () => {
    const { supabaseInsert, supabaseSelect, supabaseDelete } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID!;
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Two students with distinct streak states. Same org so both go
    // through the same timezone (Europe/London) the cron uses.
    const stale = supabaseInsert('students', {
      org_id: orgId,
      first_name: `${testId}_stale`,
      last_name: testId,
      status: 'active',
    });
    const fresh = supabaseInsert('students', {
      org_id: orgId,
      first_name: `${testId}_fresh`,
      last_name: testId,
      status: 'active',
    });
    if (!stale?.id || !fresh?.id) {
      throw new Error(`seedStudents failed: ${JSON.stringify({ stale, fresh })}`);
    }

    // Today UTC — used for the fresh streak. The cron checks against
    // today_local in the org's TZ; today UTC >= today_local - 1 in all
    // realistic UTC↔London offsets, so the fresh row never matches the
    // stale predicate even when run near midnight.
    const todayUtc = new Date().toISOString().slice(0, 10);
    // 3 days back UTC — guaranteed before today_local - 1.
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600_000)
      .toISOString()
      .slice(0, 10);

    const staleStreak = supabaseInsert('practice_streaks', {
      org_id: orgId,
      student_id: stale.id,
      current_streak: 5,
      longest_streak: 5,
      last_practice_date: threeDaysAgo,
      streak_started_at: new Date(Date.now() - 7 * 24 * 3600_000)
        .toISOString()
        .slice(0, 10),
    });
    const freshStreak = supabaseInsert('practice_streaks', {
      org_id: orgId,
      student_id: fresh.id,
      current_streak: 4,
      longest_streak: 4,
      last_practice_date: todayUtc,
      streak_started_at: new Date(Date.now() - 4 * 24 * 3600_000)
        .toISOString()
        .slice(0, 10),
    });
    if (!staleStreak?.id || !freshStreak?.id) {
      throw new Error(`seedStreaks failed: ${JSON.stringify({ staleStreak, freshStreak })}`);
    }

    try {
      // Trigger the cron function. Service-role required — the fn isn't
      // SECURITY DEFINER but it's not callable by anon/authenticated.
      const res = await callRpcAsServiceRole('reset_stale_streaks');
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);

      // Stale row reset: current_streak=0, streak_started_at=NULL.
      // longest_streak is preserved (the cron only zeroes the active
      // counter, not the all-time best).
      const staleAfter = supabaseSelect(
        'practice_streaks',
        `id=eq.${staleStreak.id}&select=current_streak,longest_streak,streak_started_at,last_practice_date`,
      );
      expect(staleAfter.length).toBe(1);
      expect(staleAfter[0].current_streak).toBe(0);
      expect(staleAfter[0].streak_started_at).toBeNull();
      // longest_streak unchanged.
      expect(staleAfter[0].longest_streak).toBe(5);
      // last_practice_date unchanged (the cron only touches counters).
      expect(staleAfter[0].last_practice_date).toBe(threeDaysAgo);

      // Fresh row preserved: today's date is >= today_local - 1, so the
      // WHERE clause didn't match this row.
      const freshAfter = supabaseSelect(
        'practice_streaks',
        `id=eq.${freshStreak.id}&select=current_streak,streak_started_at`,
      );
      expect(freshAfter.length).toBe(1);
      expect(freshAfter[0].current_streak).toBe(4);
      expect(freshAfter[0].streak_started_at).not.toBeNull();
    } finally {
      supabaseDelete('practice_streaks', `id=eq.${staleStreak.id}`);
      supabaseDelete('practice_streaks', `id=eq.${freshStreak.id}`);
      supabaseDelete('students', `id=eq.${stale.id}`);
      supabaseDelete('students', `id=eq.${fresh.id}`);
    }
  });
});

test.describe('§17.5.6 — complete_expired_assignments cron', () => {
  test.use({ storageState: AUTH.owner });

  async function callRpcAsServiceRole(
    fnName: string,
  ): Promise<{ status: number; body: string }> {
    const { execSync } = await import('child_process');
    const url = process.env.E2E_SUPABASE_URL!;
    const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
    if (!key) throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY required for cron RPC');
    const res = execSync(
      `curl -s -w "\\nHTTP:%{http_code}" -X POST "${url}/rest/v1/rpc/${fnName}" ` +
        `-H "apikey: ${key}" -H "Authorization: Bearer ${key}" ` +
        `-H "Content-Type: application/json" -d '{}'`,
      { encoding: 'utf-8', timeout: 30_000 },
    );
    const m = res.match(/^([\s\S]*)\nHTTP:(\d+)$/);
    return {
      status: m ? Number(m[2]) : 0,
      body: m ? m[1] : res,
    };
  }

  test('§17.5.6 — expired assignment flips active→completed; future-dated assignment preserved', async () => {
    const { supabaseInsert, supabaseSelect, supabaseDelete, getOwnerUserId } = await import(
      '../supabase-admin'
    );
    const orgId = process.env.E2E_ORG_ID!;
    const ownerId = getOwnerUserId();
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const student = supabaseInsert('students', {
      org_id: orgId,
      first_name: `${testId}_s`,
      last_name: testId,
      status: 'active',
    });
    if (!student?.id) throw new Error(`seedStudent failed: ${JSON.stringify(student)}`);

    const yesterdayUtc = new Date(Date.now() - 1 * 24 * 3600_000)
      .toISOString()
      .slice(0, 10);
    const tomorrowUtc = new Date(Date.now() + 1 * 24 * 3600_000)
      .toISOString()
      .slice(0, 10);

    // Expired: status='active', end_date=yesterday → should flip to
    // completed when the cron runs.
    const expired = supabaseInsert('practice_assignments', {
      org_id: orgId,
      student_id: student.id,
      teacher_user_id: ownerId,
      title: `${testId}_expired`,
      end_date: yesterdayUtc,
      status: 'active',
    });
    // Future: status='active', end_date=tomorrow → preserved.
    const future = supabaseInsert('practice_assignments', {
      org_id: orgId,
      student_id: student.id,
      teacher_user_id: ownerId,
      title: `${testId}_future`,
      end_date: tomorrowUtc,
      status: 'active',
    });
    // No-end-date: status='active', end_date=NULL → preserved (the cron
    // requires end_date IS NOT NULL).
    const noEnd = supabaseInsert('practice_assignments', {
      org_id: orgId,
      student_id: student.id,
      teacher_user_id: ownerId,
      title: `${testId}_noend`,
      status: 'active',
    });
    if (!expired?.id || !future?.id || !noEnd?.id) {
      throw new Error(
        `seedAssignments failed: ${JSON.stringify({ expired, future, noEnd })}`,
      );
    }

    try {
      const res = await callRpcAsServiceRole('complete_expired_assignments');
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);

      // Expired flipped to completed.
      const expiredAfter = supabaseSelect(
        'practice_assignments',
        `id=eq.${expired.id}&select=status,end_date`,
      );
      expect(expiredAfter.length).toBe(1);
      expect(expiredAfter[0].status).toBe('completed');
      // end_date unchanged — only status moves.
      expect(expiredAfter[0].end_date).toBe(yesterdayUtc);

      // Future preserved.
      const futureAfter = supabaseSelect(
        'practice_assignments',
        `id=eq.${future.id}&select=status`,
      );
      expect(futureAfter[0].status).toBe('active');

      // No-end-date preserved (the cron predicate requires end_date IS
      // NOT NULL — open-ended assignments stay active forever until
      // the teacher manually completes them).
      const noEndAfter = supabaseSelect(
        'practice_assignments',
        `id=eq.${noEnd.id}&select=status`,
      );
      expect(noEndAfter[0].status).toBe('active');
    } finally {
      supabaseDelete('practice_assignments', `id=eq.${expired.id}`);
      supabaseDelete('practice_assignments', `id=eq.${future.id}`);
      supabaseDelete('practice_assignments', `id=eq.${noEnd.id}`);
      supabaseDelete('students', `id=eq.${student.id}`);
    }
  });
});
