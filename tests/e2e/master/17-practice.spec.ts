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
//
// §17.4 streak milestone (3/7/14/30/60/100-day) cannot be exercised
// end-to-end today: production has a missing-vault-secret bug.
// `_notify_streak_milestone` calls `net.http_post(url := (SELECT
// decrypted_secret FROM vault.decrypted_secrets WHERE name =
// 'SUPABASE_URL'))`, but `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
// have never been seeded into the vault — only `INTERNAL_CRON_SECRET`
// is present. The SELECT returns NULL, pg_net's `http_request_queue`
// rejects the null URL with `null value in column "url" violates
// not-null constraint` (sqlstate 23502), the trigger errors, and the
// underlying `practice_logs` INSERT rolls back. Net effect: any user
// who logs a 3rd, 7th, 14th, 30th, 60th, or 100th consecutive day
// gets a 500 instead of a successful save.
//
// Two ways to fix:
//   1. Seed the vault: `vault.create_secret('https://...supabase.co',
//      'SUPABASE_URL')` + same for `SUPABASE_SERVICE_ROLE_KEY`. Migration
//      drops in alongside `20260303180000_streak_milestone_webhook.sql`.
//   2. Wrap the `net.http_post` call in a BEGIN/EXCEPTION/END so vault
//      or queue failures don't roll back the user action; audit_log
//      remains the durable record. Defensive against future pg_net
//      outages too.
//
// Once one of those lands, the test below should pass without changes:
//   – seed 3 consecutive days
//   – assert current_streak=3
//   – assert audit_log has one streak_milestone row with after->>'streak'='3'

// §17.5 cron-based tests (reset_stale_streaks,
// complete_expired_assignments) need time-travel or scheduled-trigger
// fixtures — left as TODO alongside other cron work in §5/§7/§19.
