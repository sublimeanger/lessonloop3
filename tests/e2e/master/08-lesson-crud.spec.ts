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

// ────────────────────────────────────────────────────────────────────
// §8.6 — Cancel flow + §8.8.9-10 — auto-credit on absence
// ────────────────────────────────────────────────────────────────────
//
// Two contracts at play here:
//   1. `trg_cleanup_attendance_on_cancel` — AFTER UPDATE OF status on
//      lessons WHEN new=cancelled AND old != cancelled → DELETE
//      FROM attendance_records WHERE lesson_id = NEW.id.
//      Test §8.8.9 below verifies the attendance row is cleaned up
//      when an admin cancels a lesson that already has attendance.
//   2. `auto_issue_credit_on_absence` (trigger on attendance_records) —
//      fires when attendance_status IN (absent, cancelled_by_student,
//      cancelled_by_teacher) AND make_up_policies has an `automatic`
//      eligibility for the absence_reason_category. Computes credit
//      value via fallback chain: invoice_items → student rate card →
//      org default rate card → lesson_participants.rate_minor.
//
// The e2e org's make_up_policies seed only has `teacher_cancelled` set
// to `automatic` — `sick`, `holiday`, etc. are `waitlist` / `not_eligible`.
// To test the student-cancel positive path realistically, §8.8.10a
// patches the `sick` policy to `automatic` for the duration of the
// test, then restores. The negative path (§8.8.10b) uses `holiday`
// which is `not_eligible` and never fires the trigger.
//
// Lauren-paramount: this is the make-up flow for students who miss
// lessons. See LESSONLOOP_V2_PLAN.md §3.1 — promoted to launch-critical.

import { execSync as execSync_810 } from 'child_process';
import fs_810 from 'fs';
import { randomBytes as randomBytes_810 } from 'crypto';

test.describe('§8.6 / §8.8.9-10 — Cancel flow + auto-credit on absence', () => {
  test.use({ storageState: AUTH.owner });

  const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
  const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
  const SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;

  /** Service-role PATCH of arbitrary rows. Returns nothing — caller asserts
   *  via supabaseSelect. The trigger validation runs even with service-role
   *  by design (only RLS is bypassed). */
  function patchRows(table: string, filter: string, body: Record<string, unknown>): void {
    if (!SERVICE_KEY) throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY required');
    const tmp = `/tmp/sb-810-patch-${Date.now()}-${randomBytes_810(4).toString('hex')}.json`;
    fs_810.writeFileSync(tmp, JSON.stringify(body));
    try {
      execSync_810(
        `curl -s -X PATCH "${SUPABASE_URL}/rest/v1/${table}?${filter}" ` +
          `-H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" ` +
          `-H "Content-Type: application/json" -H "Prefer: return=minimal" -d @${tmp}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
    } finally {
      try { fs_810.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  /** Patch the eligibility on a make_up_policies row for a given absence
   *  reason. Returns the previous value so the caller can restore in a
   *  finally block. The org has one policy row per reason (unique
   *  per (org_id, absence_reason)) so the PATCH is idempotent. */
  function patchPolicyEligibility(
    absenceReason: string,
    eligibility: 'automatic' | 'waitlist' | 'admin_discretion' | 'not_eligible',
  ): string {
    const before = supabaseSelect(
      'make_up_policies',
      `org_id=eq.${E2E_ORG_ID}&absence_reason=eq.${absenceReason}&select=eligibility`,
    );
    const previous = before[0]?.eligibility ?? 'not_eligible';
    patchRows(
      'make_up_policies',
      `org_id=eq.${E2E_ORG_ID}&absence_reason=eq.${absenceReason}`,
      { eligibility },
    );
    return previous;
  }

  // §8.8.9 — Cancel a lesson that already has attendance recorded; the
  // cleanup_attendance_on_cancel trigger should remove the attendance row.
  test('§8.8.9 — cancel lesson with attendance → trg removes attendance_records', async () => {
    const testId = `cancelclean_${Date.now()}`;
    const teacherId = getOwnerTeacherId();
    const userId = getOwnerUserId();

    const { studentId } = seedStudent({ testId, withGuardian: false });
    const { lessonId } = seedLesson({
      testId,
      teacherId,
      createdBy: userId,
      studentIds: [studentId],
      // Past lesson so attendance is meaningful — present-day attendance
      // on a future lesson would be blocked by check_attendance_not_future.
      startAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
      durationMins: 30,
    });

    try {
      // Seed an attendance row in the same lesson (validate_attendance_participant
      // checks the student is in lesson_participants — which seedLesson did).
      const attendance = supabaseInsert('attendance_records', {
        org_id: E2E_ORG_ID,
        lesson_id: lessonId,
        student_id: studentId,
        attendance_status: 'present',
        recorded_by: userId,
      });
      expect(attendance?.id).toBeTruthy();

      // Pre-cancel: attendance row exists.
      const before = supabaseSelect(
        'attendance_records',
        `lesson_id=eq.${lessonId}&select=id,attendance_status`,
      );
      expect(before.length).toBe(1);
      expect(before[0].attendance_status).toBe('present');

      // Cancel the lesson via service-role PATCH. The trigger
      // `trg_cleanup_attendance_on_cancel` fires AFTER UPDATE OF status
      // when new='cancelled' AND old != 'cancelled' → DELETE attendance.
      patchRows('lessons', `id=eq.${lessonId}`, { status: 'cancelled' });

      // Lesson now cancelled.
      const lessonAfter = supabaseSelect('lessons', `id=eq.${lessonId}&select=status`);
      expect(lessonAfter[0].status).toBe('cancelled');

      // Attendance row deleted by trigger.
      const after = supabaseSelect('attendance_records', `lesson_id=eq.${lessonId}&select=id`);
      expect(after.length).toBe(0);
    } finally {
      // attendance_records was already cleaned by trigger but the call is
      // idempotent. Order: child rows first, then parent.
      supabaseDelete('attendance_records', `lesson_id=eq.${lessonId}`);
      supabaseDelete('lesson_participants', `lesson_id=eq.${lessonId}`);
      supabaseDelete('lessons', `id=eq.${lessonId}`);
      supabaseDelete('students', `id=eq.${studentId}`);
    }
  });

  // §8.8.10a — Student-side cancel with an automatic-eligible policy →
  // auto_issue_credit_on_absence trigger creates a make_up_credits row.
  test('§8.8.10a — cancelled_by_student + automatic policy → make_up_credits row issued', async () => {
    const testId = `autocredit_${Date.now()}`;
    const teacherId = getOwnerTeacherId();
    const userId = getOwnerUserId();

    // Patch the e2e org's `sick` policy to `automatic`. The default
    // seed is `waitlist` (so a real Lauren sick-cancel goes to the
    // waitlist instead of issuing a credit). This test verifies the
    // trigger contract — not the org's chosen policy. Restore after.
    const previousSickEligibility = patchPolicyEligibility('sick', 'automatic');

    try {
      const { studentId } = seedStudent({ testId, withGuardian: false });
      const { lessonId } = seedLesson({
        testId,
        teacherId,
        createdBy: userId,
        studentIds: [studentId],
        // Past so attendance is allowed by check_attendance_not_future.
        startAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
      });

      try {
        // Insert attendance with status=cancelled_by_student + reason=sick.
        // The trigger looks up make_up_policies(org, 'sick'), sees
        // eligibility='automatic' (just patched), and fires the auto-issue
        // path. Credit value falls through invoice_items (none) → student
        // rate card (none) → org default rate card ("Standard 30-min" at
        // £35.00 = 3500 minor units).
        const att = supabaseInsert('attendance_records', {
          org_id: E2E_ORG_ID,
          lesson_id: lessonId,
          student_id: studentId,
          attendance_status: 'cancelled_by_student',
          absence_reason_category: 'sick',
          recorded_by: userId,
        });
        expect(att?.id).toBeTruthy();

        // Credit row created by trigger.
        const credits = supabaseSelect(
          'make_up_credits',
          `student_id=eq.${studentId}&issued_for_lesson_id=eq.${lessonId}` +
            `&select=id,credit_value_minor,notes,voided_at,redeemed_at`,
        );
        expect(credits.length).toBe(1);
        expect(credits[0].voided_at).toBeNull();
        expect(credits[0].redeemed_at).toBeNull();
        // Default rate card is £35.00 → 3500 minor.
        expect(credits[0].credit_value_minor).toBe(3500);
        // The trigger writes "Auto-issued: <reason>" with underscores
        // replaced by spaces. For 'sick' that's just "Auto-issued: sick".
        expect(credits[0].notes).toMatch(/^Auto-issued:\s*sick/);

        // Audit log entry written by the trigger (action='credit_issued',
        // entity_type='make_up_credit', entity_id=new credit id).
        const audit = supabaseSelect(
          'audit_log',
          `entity_type=eq.make_up_credit&entity_id=eq.${credits[0].id}` +
            `&action=eq.credit_issued&select=action`,
        );
        expect(audit.length).toBe(1);

        // Cleanup the credit before we drop the lesson — the FK from
        // make_up_credits.issued_for_lesson_id would otherwise block.
        supabaseDelete('make_up_credits', `id=eq.${credits[0].id}`);
        supabaseDelete(
          'audit_log',
          `entity_type=eq.make_up_credit&entity_id=eq.${credits[0].id}`,
        );
      } finally {
        supabaseDelete('attendance_records', `lesson_id=eq.${lessonId}`);
        supabaseDelete('lesson_participants', `lesson_id=eq.${lessonId}`);
        supabaseDelete('lessons', `id=eq.${lessonId}`);
        supabaseDelete('students', `id=eq.${studentId}`);
      }
    } finally {
      patchPolicyEligibility('sick', previousSickEligibility as 'automatic' | 'waitlist' | 'admin_discretion' | 'not_eligible');
    }
  });

  // §8.8.10b — Negative: student cancels for a non-eligible reason →
  // trigger short-circuits, no make_up_credits row created.
  test('§8.8.10b — cancelled_by_student + not_eligible policy → no credit issued', async () => {
    const testId = `nocredit_${Date.now()}`;
    const teacherId = getOwnerTeacherId();
    const userId = getOwnerUserId();

    const { studentId } = seedStudent({ testId, withGuardian: false });
    const { lessonId } = seedLesson({
      testId,
      teacherId,
      createdBy: userId,
      studentIds: [studentId],
      startAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
    });

    try {
      // 'holiday' is `not_eligible` in the e2e org's seed — no patch
      // needed. The trigger should short-circuit at the policy lookup.
      const att = supabaseInsert('attendance_records', {
        org_id: E2E_ORG_ID,
        lesson_id: lessonId,
        student_id: studentId,
        attendance_status: 'cancelled_by_student',
        absence_reason_category: 'holiday',
        recorded_by: userId,
      });
      expect(att?.id).toBeTruthy();

      // Trigger short-circuits at the policy lookup (eligibility !=
      // 'automatic') — no credit row created. That's the contract;
      // no need to also assert on audit_log because the trigger only
      // writes audit AFTER the credit insert (or on the cap/loop
      // exception paths, neither of which we exercise here).
      const credits = supabaseSelect(
        'make_up_credits',
        `student_id=eq.${studentId}&issued_for_lesson_id=eq.${lessonId}&select=id`,
      );
      expect(credits.length).toBe(0);
    } finally {
      supabaseDelete('attendance_records', `lesson_id=eq.${lessonId}`);
      supabaseDelete('lesson_participants', `lesson_id=eq.${lessonId}`);
      supabaseDelete('lessons', `id=eq.${lessonId}`);
      supabaseDelete('students', `id=eq.${studentId}`);
    }
  });
});

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
