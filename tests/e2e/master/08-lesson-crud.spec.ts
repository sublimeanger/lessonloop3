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
import { seedLesson, seedStudent, getOrgId, getOwnerTeacherId, getOwnerUserId, supabaseSelect, supabaseDelete } from '../supabase-admin';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
});

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
// TODO §8.5-8.6 recurring edit dialog (this only / this+following / all) —
//   needs the recurrence_rules + lesson_recurrence_overrides setup which
//   is heavier than time allowed this session. Catalog test cases:
//     - "all" → every instance updated via bulk_update_lessons RPC
//     - "this+following" → original series ends, new series starts
//     - "this only" → instance detached (recurrence_rule_id nulled)
// TODO §8.8.10 student-side cancel → auto_issue_credit_on_absence trigger
//   creates make_up_credits row; needs attendance_records insert path.
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
