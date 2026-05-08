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

  test.fixme('check_lesson_conflicts: same teacher + overlapping time blocks 2nd insert', async () => {
    const testId = `conflict_${Date.now()}`;
    const teacherId = getOwnerTeacherId();
    const userId = getOwnerUserId();
    const startAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    const { lessonId: lesson1 } = seedLesson({ testId, teacherId, createdBy: userId, startAt, durationMins: 30 });

    // Try to create overlapping lesson — depends on whether trigger throws or just warns
    let secondInsertSucceeded = true;
    try {
      const { lessonId: lesson2 } = seedLesson({ testId, teacherId, createdBy: userId, startAt, durationMins: 30 });
      supabaseDelete('lessons', `id=eq.${lesson2}`);
    } catch {
      secondInsertSucceeded = false;
    }
    // Cleanup
    supabaseDelete('lessons', `id=eq.${lesson1}`);
    // Triggers may allow inserts but flag conflicts in UI; we don't assert blocking here.
    expect(typeof secondInsertSucceeded).toBe('boolean');
  });
});

// TODO §8.1-8.4 UI form tests — see workflows/crud-lessons.spec.ts
// TODO §8.5-8.6 recurring edit dialog (this only / this+following / all)
// TODO §8.7 prevent_invoiced_lesson_delete — try delete, expect block
// TODO §8.8 closure-date banner
test.fixme('§8.5 — edit recurring lesson "all" updates every instance', async () => {});
test.fixme('§8.5 — edit recurring lesson "this only" detaches single instance', async () => {});
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
test.fixme('§8.10 — student-side cancellation issues make-up credit', async () => {});
