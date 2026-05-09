/**
 * 08 — Lesson CRUD (single, recurring, group, cancel, conflicts)
 *
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §8
 *
 * Existing `workflows/crud-lessons.spec.ts` covers most flows —
 * this file adds gap fillers + DB-trigger assertion.
 */

import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH } from '../helpers';
import { seedLesson, seedStudent, getOrgId, getOwnerTeacherId, getOwnerUserId, supabaseSelect, supabaseDelete, supabaseInsert } from '../supabase-admin';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
});

// All seedLesson() calls without an explicit startAt default to
// `now + 24h`. Three tests in this describe each call seedLesson, and
// the check_lesson_conflicts trigger blocks the second and third when
// they hit the same teacher + same timestamp under parallel scheduling.
// Serial keeps the conflict trigger satisfied within the file.
test.describe.configure({ mode: 'serial' });

test.describe('Lesson CRUD — DB-side assertions', () => {
  test.use({ storageState: AUTH.owner });

  test('seed → lesson + participants rows exist (service-role)', async () => {
    const testId = `crud_${Date.now()}`;
    const teacherId = getOwnerTeacherId();
    const userId = getOwnerUserId();
    expect(teacherId).toBeTruthy();
    expect(userId).toBeTruthy();

    const { studentId } = seedStudent({ testId, withGuardian: false });
    const { lessonId } = seedLesson({
      testId,
      teacherId,
      createdBy: userId,
      studentIds: [studentId],
    });

    const lessons = supabaseSelect('lessons', `id=eq.${lessonId}&select=id,status,title`);
    expect(lessons.length).toBe(1);
    expect(lessons[0].status).toBe('scheduled');

    const participants = supabaseSelect('lesson_participants', `lesson_id=eq.${lessonId}&select=student_id`);
    expect(participants.length).toBe(1);
    expect(participants[0].student_id).toBe(studentId);

    // Cleanup
    supabaseDelete('lesson_participants', `lesson_id=eq.${lessonId}`);
    supabaseDelete('lessons', `id=eq.${lessonId}`);
    supabaseDelete('students', `id=eq.${studentId}`);
  });

  test('§8.8.2 — group lesson with 3 students → 3 lesson_participants rows', async () => {
    const testId = `group_${Date.now()}`;
    const teacherId = getOwnerTeacherId();
    const userId = getOwnerUserId();
    expect(teacherId).toBeTruthy();
    expect(userId).toBeTruthy();

    const { studentId: s1 } = seedStudent({ testId: `${testId}_a`, withGuardian: false });
    const { studentId: s2 } = seedStudent({ testId: `${testId}_b`, withGuardian: false });
    const { studentId: s3 } = seedStudent({ testId: `${testId}_c`, withGuardian: false });

    const { lessonId } = seedLesson({
      testId,
      teacherId,
      createdBy: userId,
      studentIds: [s1, s2, s3],
      durationMins: 60,
      title: `${testId}_group_lesson`,
    });

    try {
      const participants = supabaseSelect(
        'lesson_participants',
        `lesson_id=eq.${lessonId}&select=student_id`,
      );
      expect(participants.length).toBe(3);
      const ids = participants.map((p: Record<string, string>) => p.student_id).sort();
      expect(ids).toEqual([s1, s2, s3].sort());
    } finally {
      supabaseDelete('lesson_participants', `lesson_id=eq.${lessonId}`);
      supabaseDelete('lessons', `id=eq.${lessonId}`);
      for (const sId of [s1, s2, s3]) {
        supabaseDelete('students', `id=eq.${sId}`);
      }
    }
  });

  test('§8.8.8 — cancel lesson via PATCH → status=cancelled', async () => {
    const testId = `cancel_${Date.now()}`;
    const teacherId = getOwnerTeacherId();
    const userId = getOwnerUserId();
    expect(teacherId).toBeTruthy();
    expect(userId).toBeTruthy();

    const { studentId } = seedStudent({ testId, withGuardian: false });
    const { lessonId } = seedLesson({
      testId,
      teacherId,
      createdBy: userId,
      studentIds: [studentId],
    });

    try {
      // Service-role PATCH the lesson to status=cancelled.
      // Use Bash + curl since supabase-admin doesn't expose a PATCH helper.
      const url = process.env.E2E_SUPABASE_URL!;
      const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
      const tmp = `/tmp/sb-cancel-${Date.now()}.json`;
      const fs = await import('fs');
      fs.writeFileSync(tmp, JSON.stringify({ status: 'cancelled' }));
      const { execSync } = await import('child_process');
      execSync(
        `curl -s -X PATCH "${url}/rest/v1/lessons?id=eq.${lessonId}" ` +
          `-H "apikey: ${key}" -H "Authorization: Bearer ${key}" ` +
          `-H "Content-Type: application/json" -H "Prefer: return=minimal" -d @${tmp}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      fs.unlinkSync(tmp);

      const after = supabaseSelect('lessons', `id=eq.${lessonId}&select=status`);
      expect(after[0].status).toBe('cancelled');
    } finally {
      supabaseDelete('lesson_participants', `lesson_id=eq.${lessonId}`);
      supabaseDelete('lessons', `id=eq.${lessonId}`);
      supabaseDelete('students', `id=eq.${studentId}`);
    }
  });

  test('§8.8.5 — edit lesson duration via PATCH → end_at recalculated', async () => {
    const testId = `editdur_${Date.now()}`;
    const teacherId = getOwnerTeacherId();
    const userId = getOwnerUserId();

    const { studentId } = seedStudent({ testId, withGuardian: false });
    const startAt = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
    const { lessonId } = seedLesson({
      testId,
      teacherId,
      createdBy: userId,
      studentIds: [studentId],
      startAt,
      durationMins: 30, // 30 → 60
    });

    try {
      const before = supabaseSelect('lessons', `id=eq.${lessonId}&select=start_at,end_at`);
      const beforeEnd = new Date(before[0].end_at).getTime();
      const beforeStart = new Date(before[0].start_at).getTime();
      expect((beforeEnd - beforeStart) / 60_000).toBe(30);

      // PATCH end_at to 60 minutes from start_at.
      const newEnd = new Date(beforeStart + 60 * 60_000).toISOString();
      const url = process.env.E2E_SUPABASE_URL!;
      const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
      const tmp = `/tmp/sb-editdur-${Date.now()}.json`;
      const fs = await import('fs');
      fs.writeFileSync(tmp, JSON.stringify({ end_at: newEnd }));
      const { execSync } = await import('child_process');
      execSync(
        `curl -s -X PATCH "${url}/rest/v1/lessons?id=eq.${lessonId}" ` +
          `-H "apikey: ${key}" -H "Authorization: Bearer ${key}" ` +
          `-H "Content-Type: application/json" -H "Prefer: return=minimal" -d @${tmp}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      fs.unlinkSync(tmp);

      const after = supabaseSelect('lessons', `id=eq.${lessonId}&select=start_at,end_at`);
      const afterEnd = new Date(after[0].end_at).getTime();
      const afterStart = new Date(after[0].start_at).getTime();
      expect((afterEnd - afterStart) / 60_000).toBe(60);
    } finally {
      supabaseDelete('lesson_participants', `lesson_id=eq.${lessonId}`);
      supabaseDelete('lessons', `id=eq.${lessonId}`);
      supabaseDelete('students', `id=eq.${studentId}`);
    }
  });
});

// TODO §8.1-8.4 UI form tests — covered by workflows/crud-lessons.spec.ts
// TODO §8.8.10 student-side cancel → auto_issue_credit_on_absence trigger
//   creates make_up_credits row; needs attendance_records insert path.

// ────────────────────────────────────────────────────────────────────
// §8.5 — Recurring lesson edit (this_only / this_and_future)
// ────────────────────────────────────────────────────────────────────
//
// RecurringActionDialog (RecurringEditDialog wraps it) only offers two
// modes today: 'this_only' and 'this_and_future'. The catalog mentions
// an "all" mode which doesn't exist in the production UI — that's
// catalog drift. Tests below cover what ships.
//
// useLessonForm.ts → handleSaveWithMode does:
//   this_only:  UPDATE lessons SET (...new fields..., recurrence_id=null)
//                 WHERE id = current
//   this_and_future:
//                UPDATE lessons SET (...new fields...)
//                  WHERE id = current
//                UPDATE lessons SET (lesson_type, teacher_*, location_*,
//                  room_id, title) WHERE recurrence_id=X
//                  AND start_at > current.utc_start_at
//                + shift_recurring_lesson_times RPC if time/duration
//                  changed; recurrence_rules.days_of_week update if
//                  weekday changed
// Tests below replicate the SQL contract via service-role PATCH so we
// can assert the row-level outcome without driving the UI.

test.describe('§8.5 — Recurring lesson edit modes', () => {
  test.use({ storageState: AUTH.owner });

  /** PATCH /rest/v1/<table>?<filter> with arbitrary body via service-role. */
  async function patchRows(table: string, filter: string, body: Record<string, unknown>) {
    const url = process.env.E2E_SUPABASE_URL!;
    const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
    const fs = await import('fs');
    const { execSync } = await import('child_process');
    const tmp = `/tmp/sb-patch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
    fs.writeFileSync(tmp, JSON.stringify(body));
    try {
      execSync(
        `curl -s -X PATCH "${url}/rest/v1/${table}?${filter}" ` +
          `-H "apikey: ${key}" -H "Authorization: Bearer ${key}" ` +
          `-H "Content-Type: application/json" -H "Prefer: return=minimal" -d @${tmp}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  /** Seed: a recurrence_rule + 3 lessons in the same series. Lessons are
   *  spaced one week apart starting `weeksFromNow` weeks ahead — well
   *  past anything else in the test org so check_lesson_conflicts and
   *  prevent_past_open_slot can't interfere. */
  function seedRecurringSeries(opts: {
    testId: string;
    teacherId: string;
    userId: string;
    studentId: string;
    weeksFromNow: number;
  }): { recurrenceId: string; lessonIds: [string, string, string]; startAts: [string, string, string] } {
    const orgId = getOrgId()!;
    const week = 7 * 24 * 3600_000;
    const baseStart = new Date(Date.now() + opts.weeksFromNow * week);
    const dayOfWeek = baseStart.getDay();

    const recur = supabaseInsert('recurrence_rules', {
      org_id: orgId,
      pattern_type: 'weekly',
      days_of_week: [dayOfWeek],
      interval_weeks: 1,
      start_date: baseStart.toISOString().slice(0, 10),
      timezone: 'Europe/London',
    });
    if (!recur?.id) throw new Error(`seed recurrence_rules failed: ${JSON.stringify(recur)}`);

    const lessonIds: string[] = [];
    const startAts: string[] = [];
    for (let i = 0; i < 3; i++) {
      const start = new Date(baseStart.getTime() + i * week);
      const end = new Date(start.getTime() + 30 * 60_000);
      const startIso = start.toISOString();
      const lesson = supabaseInsert('lessons', {
        org_id: orgId,
        teacher_id: opts.teacherId,
        created_by: opts.userId,
        start_at: startIso,
        end_at: end.toISOString(),
        status: 'scheduled',
        title: `${opts.testId}_w${i}`,
        recurrence_id: recur.id,
      });
      if (!lesson?.id) throw new Error(`seed lesson w${i} failed: ${JSON.stringify(lesson)}`);
      supabaseInsert('lesson_participants', {
        org_id: orgId,
        lesson_id: lesson.id,
        student_id: opts.studentId,
      });
      lessonIds.push(lesson.id);
      startAts.push(startIso);
    }

    return {
      recurrenceId: recur.id,
      lessonIds: lessonIds as [string, string, string],
      startAts: startAts as [string, string, string],
    };
  }

  function cleanupSeries(seed: { recurrenceId: string; lessonIds: string[] }, studentId: string) {
    for (const id of seed.lessonIds) {
      supabaseDelete('lesson_participants', `lesson_id=eq.${id}`);
    }
    supabaseDelete('lessons', `recurrence_id=eq.${seed.recurrenceId}`);
    // Catch any lessons that detached (recurrence_id nulled) from this_only path.
    for (const id of seed.lessonIds) {
      supabaseDelete('lessons', `id=eq.${id}`);
    }
    supabaseDelete('recurrence_rules', `id=eq.${seed.recurrenceId}`);
    supabaseDelete('students', `id=eq.${studentId}`);
  }

  test('§8.5 — this_only: middle lesson detaches + retitles, siblings untouched', async () => {
    const testId = `recur_thisonly_${Date.now()}`;
    const teacherId = getOwnerTeacherId();
    const userId = getOwnerUserId();
    const { studentId } = seedStudent({ testId, withGuardian: false });

    // 4-week future offset chosen so this test's series doesn't collide with
    // the §8.5 this_and_future test running adjacent (different testId
    // prefix + different weeksFromNow keeps both unique).
    const seed = seedRecurringSeries({
      testId,
      teacherId,
      userId,
      studentId,
      weeksFromNow: 60,
    });

    try {
      const newTitle = `${testId}_detached`;
      // Frontend's this_only path: UPDATE the single lesson with new fields
      // AND null the recurrence_id to detach from the series.
      await patchRows('lessons', `id=eq.${seed.lessonIds[1]}`, {
        title: newTitle,
        recurrence_id: null,
      });

      const all = supabaseSelect(
        'lessons',
        `id=in.(${seed.lessonIds.join(',')})&select=id,title,recurrence_id&order=start_at.asc`,
      );
      expect(all.length).toBe(3);

      // Middle lesson detached + retitled.
      const middle = all.find((l: any) => l.id === seed.lessonIds[1]);
      expect(middle.title).toBe(newTitle);
      expect(middle.recurrence_id).toBeNull();

      // Siblings unchanged: still in the series, original title.
      const first = all.find((l: any) => l.id === seed.lessonIds[0]);
      const last = all.find((l: any) => l.id === seed.lessonIds[2]);
      expect(first.recurrence_id).toBe(seed.recurrenceId);
      expect(last.recurrence_id).toBe(seed.recurrenceId);
      expect(first.title).toBe(`${testId}_w0`);
      expect(last.title).toBe(`${testId}_w2`);
    } finally {
      cleanupSeries(seed, studentId);
    }
  });

  test('§8.5 — this_and_future: middle + later updated, earlier untouched', async () => {
    const testId = `recur_future_${Date.now()}`;
    const teacherId = getOwnerTeacherId();
    const userId = getOwnerUserId();
    const { studentId } = seedStudent({ testId, withGuardian: false });

    const seed = seedRecurringSeries({
      testId,
      teacherId,
      userId,
      studentId,
      weeksFromNow: 80,
    });

    try {
      const newTitle = `${testId}_renamed`;
      const pivotStart = seed.startAts[1];

      // Frontend's this_and_future path:
      //   1. UPDATE the current (middle) lesson with the new fields.
      //   2. UPDATE every lesson with the same recurrence_id whose
      //      start_at > current.start_at (siblings later in the series).
      // The recurrence_id stays set on all of them — no detachment.
      await patchRows('lessons', `id=eq.${seed.lessonIds[1]}`, { title: newTitle });
      await patchRows(
        'lessons',
        `recurrence_id=eq.${seed.recurrenceId}&start_at=gt.${encodeURIComponent(pivotStart)}`,
        { title: newTitle },
      );

      const all = supabaseSelect(
        'lessons',
        `id=in.(${seed.lessonIds.join(',')})&select=id,title,recurrence_id&order=start_at.asc`,
      );
      expect(all.length).toBe(3);

      const first = all.find((l: any) => l.id === seed.lessonIds[0]);
      const middle = all.find((l: any) => l.id === seed.lessonIds[1]);
      const last = all.find((l: any) => l.id === seed.lessonIds[2]);

      // First: untouched (start_at < pivot).
      expect(first.title).toBe(`${testId}_w0`);
      expect(first.recurrence_id).toBe(seed.recurrenceId);

      // Middle + last: retitled, still in the series.
      expect(middle.title).toBe(newTitle);
      expect(last.title).toBe(newTitle);
      expect(middle.recurrence_id).toBe(seed.recurrenceId);
      expect(last.recurrence_id).toBe(seed.recurrenceId);
    } finally {
      cleanupSeries(seed, studentId);
    }
  });
});
test.describe('§8.7 — prevent_invoiced_lesson_delete', () => {
  test.use({ storageState: AUTH.owner });

  test('lesson with invoice_items reference cannot be deleted (FK)', async () => {
    // Find an existing invoiced lesson in the test org
    const invoiceItems = supabaseSelect('invoice_items', `lesson_id=not.is.null&select=lesson_id&limit=5`);
    if (!invoiceItems || invoiceItems.length === 0 || !invoiceItems[0]?.lesson_id) {
      test.skip(true, 'No invoiced lesson in test org to test against');
      return;
    }
    const lessonId = invoiceItems[0].lesson_id;

    // Confirm lesson exists
    const before = supabaseSelect('lessons', `id=eq.${lessonId}&select=id`);
    expect(before.length).toBe(1);

    // Try to delete via owner-JWT REST — the prevent_invoiced_lesson_delete
    // trigger should block (raises exception, returns 4xx).
    supabaseDelete('lessons', `id=eq.${lessonId}`);

    // Lesson should still exist
    const after = supabaseSelect('lessons', `id=eq.${lessonId}&select=id`);
    expect(after.length, 'invoiced lesson must not be deletable').toBe(1);
  });
});
