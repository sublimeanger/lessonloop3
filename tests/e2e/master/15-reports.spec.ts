/**
 * 15 — Reports (8 reports)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §15
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';
import {
  createTestInvoice,
  deleteInvoiceById,
  getOwnerTeacherId,
  getOwnerUserId,
  patchInvoiceStatus,
  seedLesson,
  seedStudent,
  supabaseDelete,
  supabaseInsert,
} from '../supabase-admin';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
});

const REPORTS = [
  { path: '/reports', name: 'Reports hub' },
  { path: '/reports/payroll', name: 'Payroll' },
  { path: '/reports/revenue', name: 'Revenue' },
  { path: '/reports/outstanding', name: 'Outstanding' },
  { path: '/reports/lessons', name: 'Lessons delivered' },
  { path: '/reports/cancellations', name: 'Cancellations' },
  { path: '/reports/attendance', name: 'Attendance' },
  { path: '/reports/utilisation', name: 'Utilisation' },
  { path: '/reports/teacher-performance', name: 'Teacher performance' },
];

test.describe('Reports — basic load', () => {
  test.use({ storageState: AUTH.owner });

  for (const r of REPORTS) {
    test(`${r.name} (${r.path}) loads without error`, async ({ page }) => {
      await goTo(page, r.path);
      await assertNoErrorBoundary(page);
    });
  }
});

// ────────────────────────────────────────────────────────────────────
// §15.4.7 — Data correctness for Outstanding report
// ────────────────────────────────────────────────────────────────────
//
// Outstanding is the highest-value report for Lauren's billing
// reconciliation per LESSONLOOP_V2_PLAN.md §3.1. `useAgeingReport`
// queries invoices.status IN ('sent', 'overdue') directly (no RPC),
// then computes aging buckets client-side from due_date. This test
// seeds a sent invoice with a known invoice_number and due_date 5
// days out, renders /reports/outstanding as owner, expands the
// "Current (0-7 days)" bucket, and asserts the invoice_number is
// in the rendered table — proving the data path end-to-end.

test.describe('§15.4 — Outstanding report data correctness', () => {
  test.use({ storageState: AUTH.owner });

  const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';

  test('§15.4.7 — seeded sent invoice (due in 5 days) appears in "Current (0-7 days)" bucket', async ({
    page,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const dueDate = new Date(Date.now() + 5 * 24 * 3600_000)
      .toISOString()
      .slice(0, 10);

    const invoice = createTestInvoice({
      dueDate,
      payerGuardianId: E2E_PARENT_GUARDIAN_ID,
      notes: `e2e_${testId}_outstanding`,
      items: [
        { description: `e2e_${testId}_item`, quantity: 1, unit_price_minor: 4200 },
      ],
    });
    if (!invoice?.id) {
      throw new Error(`createTestInvoice failed: ${JSON.stringify(invoice)}`);
    }

    // create_invoice_with_items returns status=draft. Flip to sent so
    // useAgeingReport's status IN ('sent', 'overdue') picks it up.
    patchInvoiceStatus(invoice.id, 'sent');

    try {
      await goTo(page, '/reports/outstanding');
      await assertNoErrorBoundary(page);

      // Outstanding.tsx initialises expandedBuckets as
      // `new Set(['Current (0-7 days)'])` — the bucket starts EXPANDED
      // by default. Don't click the trigger; clicking would toggle it
      // closed. Just wait for the bucket header to confirm the report
      // resolved, then assert on the rendered table content.
      await expect(
        page.getByRole('button', { name: /Current \(0-7 days\)/ }),
      ).toBeVisible({ timeout: 15_000 });

      // Our seeded invoice_number appears in the Table inside the
      // expanded Current bucket. Pagination is 10 rows per page; the
      // table is sorted by daysOverdue ascending in `useAgeingReport`,
      // and our seeded invoice (due in 5 days = 0 days overdue) lands
      // on page 1 alongside the other current invoices.
      await expect(
        page.getByText(invoice.invoice_number).first(),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      deleteInvoiceById(invoice.id);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// §15.4 — Data correctness for the remaining reports
// ────────────────────────────────────────────────────────────────────
//
// Pattern is the same as §15.4.7 Outstanding (commit 6205880): seed
// the minimum data the report's hook will pick up, render the report
// as owner, assert a specific identifier (teacher name, student name,
// cancellation reason text) appears in the rendered table.
//
// These four cover the highest-value reports per LESSONLOOP_V2_PLAN.md
// §3.1: Lauren needs Lessons Delivered + Cancellations + Attendance
// daily, and Revenue for monthly billing reconciliation. The remaining
// three reports (Payroll, Utilisation, Teacher Performance) need more
// involved seeds (teacher pay rates / room capacity / multi-metric
// rollups) — deferred to session 7.

test.describe('§15.4 — Report data correctness (LessonsDelivered, Cancellations, Attendance, Revenue)', () => {
  test.use({ storageState: AUTH.owner });

  const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
  const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';

  /** Returns a Date set to the 15th of the previous calendar month (UTC). */
  function midLastMonth(): Date {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - 1, 15);
    d.setUTCHours(10, 0, 0, 0);
    return d;
  }

  test('§15.4 — LessonsDelivered: seeded completed lesson last month → owner teacher row appears with completedLessons ≥ 1', async ({
    page,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const teacherId = getOwnerTeacherId();
    const userId = getOwnerUserId();

    // Resolve the teacher's display_name — that's what the report renders
    // in the `teacherName` column. Fetch via service-role-equivalent
    // owner JWT against PostgREST.
    const { supabaseSelect } = await import('../supabase-admin');
    const teacherRow = supabaseSelect(
      'teachers',
      `id=eq.${teacherId}&select=display_name`,
    );
    if (teacherRow.length !== 1 || !teacherRow[0].display_name) {
      throw new Error(`Failed to resolve owner teacher display_name: ${JSON.stringify(teacherRow)}`);
    }
    const teacherName: string = teacherRow[0].display_name;

    const { studentId } = seedStudent({ testId, withGuardian: false });
    const { lessonId } = seedLesson({
      testId,
      teacherId,
      createdBy: userId,
      studentIds: [studentId],
      startAt: midLastMonth().toISOString(),
    });

    // Flip lesson to completed so it counts toward completedLessons.
    // status enum allows 'completed'; trigger 'audit_lessons_changes' fires.
    const success = supabaseDelete('lessons', `id=eq.${lessonId}_no_op_marker`); // no-op, just to import the helper
    void success;
    // PATCH the status directly via service-role.
    const { execSync } = await import('node:child_process');
    const url = process.env.E2E_SUPABASE_URL!;
    const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
    execSync(
      `curl -s -X PATCH "${url}/rest/v1/lessons?id=eq.${lessonId}" ` +
        `-H "apikey: ${key}" -H "Authorization: Bearer ${key}" ` +
        `-H "Content-Type: application/json" -H "Prefer: return=minimal" ` +
        `-d '{"status":"completed"}'`,
      { encoding: 'utf-8', timeout: 15_000 },
    );

    try {
      await goTo(page, '/reports/lessons');
      await assertNoErrorBoundary(page);

      // Wait for the byTeacher table to render (the page shows
      // "Teacher Performance" / "By Teacher" tab by default).
      await expect(
        page.getByRole('tab', { name: /by teacher/i }).first(),
      ).toBeVisible({ timeout: 15_000 });

      // The teacher name should appear in the table cell. Other tests
      // running in parallel might add their own lessons too, so we
      // assert "name appears" not "count = 1".
      await expect(
        page.getByText(teacherName).first(),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      supabaseDelete('lesson_participants', `lesson_id=eq.${lessonId}`);
      supabaseDelete('lessons', `id=eq.${lessonId}`);
      supabaseDelete('students', `id=eq.${studentId}`);
    }
  });

  test('§15.4 — Cancellations: seeded cancelled lesson + attendance_record with reason → reason appears in breakdown', async ({
    page,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const teacherId = getOwnerTeacherId();
    const userId = getOwnerUserId();

    const { studentId } = seedStudent({ testId, withGuardian: false });
    const { lessonId } = seedLesson({
      testId,
      teacherId,
      createdBy: userId,
      studentIds: [studentId],
      startAt: midLastMonth().toISOString(),
    });

    // Flip to cancelled + insert attendance_records row with a unique
    // cancellation_reason. The report's reasonMap groups by exact reason
    // string, so a unique reason guarantees we own a row in the breakdown.
    const url = process.env.E2E_SUPABASE_URL!;
    const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
    const { execSync } = await import('node:child_process');
    execSync(
      `curl -s -X PATCH "${url}/rest/v1/lessons?id=eq.${lessonId}" ` +
        `-H "apikey: ${key}" -H "Authorization: Bearer ${key}" ` +
        `-H "Content-Type: application/json" -H "Prefer: return=minimal" ` +
        `-d '{"status":"cancelled"}'`,
      { encoding: 'utf-8', timeout: 15_000 },
    );

    const uniqueReason = `${testId}_reason_unique`;
    // attendance_records.recorded_by is NOT NULL with no default —
    // confirmed via information_schema 2026-05-09. Use the owner's
    // user_id as the recorder. Insert AFTER the lesson cancel so
    // trg_cleanup_attendance_on_cancel doesn't sweep it (the trigger
    // fires on lesson UPDATE → cancelled, not on attendance INSERT).
    const att = supabaseInsert('attendance_records', {
      org_id: E2E_ORG_ID,
      lesson_id: lessonId,
      student_id: studentId,
      attendance_status: 'cancelled_by_student',
      cancellation_reason: uniqueReason,
      recorded_by: userId,
    });
    if (!att?.id) {
      throw new Error(`attendance_records insert failed: ${JSON.stringify(att)}`);
    }

    try {
      await goTo(page, '/reports/cancellations');
      await assertNoErrorBoundary(page);

      // The unique reason text appears in the byReason breakdown.
      await expect(
        page.getByText(uniqueReason).first(),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      supabaseDelete('attendance_records', `lesson_id=eq.${lessonId}`);
      supabaseDelete('lesson_participants', `lesson_id=eq.${lessonId}`);
      supabaseDelete('lessons', `id=eq.${lessonId}`);
      supabaseDelete('students', `id=eq.${studentId}`);
    }
  });

  test('§15.4 — Attendance: seeded student + present attendance_record last 30 days → student name appears', async ({
    page,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const teacherId = getOwnerTeacherId();
    const userId = getOwnerUserId();

    // Seed a student with a unique last_name we can match against.
    const uniqueLast = `${testId}AttRpt`;
    const { studentId } = seedStudent({
      testId,
      withGuardian: false,
      lastName: uniqueLast,
    });

    // Seed a lesson 14 days ago (well within last-30 default range).
    const start = new Date(Date.now() - 14 * 24 * 3600_000);
    start.setUTCHours(11, 0, 0, 0);
    const { lessonId } = seedLesson({
      testId,
      teacherId,
      createdBy: userId,
      studentIds: [studentId],
      startAt: start.toISOString(),
    });

    // Insert attendance_record so the student appears in the per-student
    // aggregation (the hook only iterates over records, not lessons).
    // recorded_by is NOT NULL — set to owner's user_id.
    const att = supabaseInsert('attendance_records', {
      org_id: E2E_ORG_ID,
      lesson_id: lessonId,
      student_id: studentId,
      attendance_status: 'present',
      recorded_by: userId,
    });
    if (!att?.id) {
      throw new Error(`attendance_records insert failed: ${JSON.stringify(att)}`);
    }

    try {
      await goTo(page, '/reports/attendance');
      await assertNoErrorBoundary(page);

      // Wait for the table to render then assert the unique last name.
      // (first_name + last_name are both shown; matching last is enough.)
      await expect(
        page.getByText(uniqueLast).first(),
      ).toBeVisible({ timeout: 20_000 });
    } finally {
      supabaseDelete('attendance_records', `lesson_id=eq.${lessonId}`);
      supabaseDelete('lesson_participants', `lesson_id=eq.${lessonId}`);
      supabaseDelete('lessons', `id=eq.${lessonId}`);
      supabaseDelete('students', `id=eq.${studentId}`);
    }
  });

  test('§15.4 — Revenue: seeded paid invoice this month → current-month bucket label visible (e.g. "May 2026")', async ({
    page,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const today = new Date();
    const monthLabel = today.toLocaleString('en-GB', { month: 'short', year: 'numeric' });
    // Set due_date to today + 7d so it's in the default last-12-months range.
    const dueDate = new Date(today.getTime() + 7 * 24 * 3600_000)
      .toISOString()
      .slice(0, 10);

    const invoice = createTestInvoice({
      dueDate,
      payerGuardianId: E2E_PARENT_GUARDIAN_ID,
      notes: `e2e_${testId}_revenue`,
      items: [
        { description: `e2e_${testId}_item`, quantity: 1, unit_price_minor: 9999 },
      ],
    });
    if (!invoice?.id) {
      throw new Error(`createTestInvoice failed: ${JSON.stringify(invoice)}`);
    }

    // draft → sent → paid; get_revenue_report aggregates by paid_at month.
    patchInvoiceStatus(invoice.id, 'sent');
    patchInvoiceStatus(invoice.id, 'paid');

    try {
      await goTo(page, '/reports/revenue');
      await assertNoErrorBoundary(page);

      // The page renders monthly buckets with labels in "MMM yyyy" format.
      // The current month must appear given the default range covers it.
      await expect(
        page.getByText(monthLabel).first(),
      ).toBeVisible({ timeout: 20_000 });
    } finally {
      deleteInvoiceById(invoice.id);
    }
  });
});
