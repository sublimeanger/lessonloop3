/**
 * Suite-start sweep of stale e2e_* rows in the destination org.
 *
 * 8th-session anti-pattern: 2715 stale e2e_-prefixed students wedged a
 * post-changes baseline (6.8 min / 9 fails vs 3.8 min / 4 fails normal)
 * because per-test cleanup leaks across worker crashes. Per-test
 * cleanupByPrefix only handles the test's own rows; failed/killed
 * tests leak.
 *
 * This globalSetup runs once before any worker starts. It deletes
 * rows that were clearly seeded by tests (prefix-pattern match) but
 * NEVER touches:
 *   - the persistent e2e_*@test.lessonloop.net auth users / their
 *     guardian rows (e2e-parent / e2e-parent2)
 *   - any rows belonging to non-e2e org_ids
 *   - real Lauren / production data (different prefix conventions)
 *
 * Failure mode: if the service-role key is drifted/wrong, this
 * silently fails (each curl returns 401 + we don't throw). The
 * docs at session-start log the row count delta for visibility.
 *
 * Per playwright docs, globalSetup is called once before the worker
 * processes start. It runs in the main Node process — no Playwright
 * browser context.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mirror playwright.config.ts: load .env.test relative to repo root.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.test') });

const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';

// Persistent test-user emails — never sweep these.
const KEEP_GUARDIAN_EMAILS = new Set([
  'e2e-parent@test.lessonloop.net',
  'e2e-parent2@test.lessonloop.net',
]);

interface SweepCounts {
  scope: string;
  before: number;
  after: number;
}

async function sweep(): Promise<void> {
  const url = process.env.E2E_SUPABASE_URL;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('[global-setup] Skipping sweep: E2E_SUPABASE_URL or E2E_SUPABASE_SERVICE_ROLE_KEY missing');
    return;
  }

  const headers = `-H "apikey: ${key}" -H "Authorization: Bearer ${key}"`;
  const start = Date.now();

  // Helper: run a SQL via supabase-admin — but we don't have a SQL RPC,
  // so use PostgREST DELETE per-table with appropriate filters. Each
  // call is fire-and-forget; capture HTTP code only for visibility.
  function postgrestDelete(table: string, filter: string): { ok: boolean; status: number } {
    try {
      const out = execSync(
        `curl -s -o /dev/null -w "%{http_code}" -X DELETE "${url}/rest/v1/${table}?${filter}" ${headers}`,
        { encoding: 'utf-8', timeout: 30_000 },
      );
      const status = Number(out.trim());
      return { ok: status >= 200 && status < 300, status };
    } catch (e: any) {
      return { ok: false, status: 0 };
    }
  }

  function postgrestCount(table: string, filter: string): number {
    try {
      const out = execSync(
        `curl -s -X GET "${url}/rest/v1/${table}?${filter}&select=count" ${headers} -H "Prefer: count=exact" -H "Range: 0-0" -w "\\nCONTENTRANGE:%{header_json}"`,
        { encoding: 'utf-8', timeout: 30_000 },
      );
      // Parse the array length or content-range; simpler: parse the body
      // (which is `[{count: N}]` when ?select=count is used).
      const bodyEnd = out.indexOf('\nCONTENTRANGE:');
      const body = bodyEnd >= 0 ? out.slice(0, bodyEnd) : out;
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed) && parsed[0]?.count != null) return parsed[0].count;
      return 0;
    } catch {
      return 0;
    }
  }

  const orgFilter = `org_id=eq.${E2E_ORG_ID}`;
  const counts: SweepCounts[] = [];

  // Pre-counts for visibility (only the high-impact tables).
  const beforeStudents = postgrestCount('students', `${orgFilter}&or=(first_name.like.e2e_*,last_name.like.e2e_*)`);
  const beforeGuardians = postgrestCount('guardians', `${orgFilter}&or=(email.like.e2e_*,email.like.e2e-*)`);
  const beforeLessons = postgrestCount('lessons', `${orgFilter}&title=like.e2e_*`);
  const beforeInvoices = postgrestCount('invoices', `${orgFilter}&notes=like.e2e_*`);
  const beforeRooms = postgrestCount('rooms', `${orgFilter}&name=like.e2e_*`);

  // ─── Sweep order: child → parent (FK chain) ───────────────────────

  // 1. Lesson dependents: attendance_records, lesson_participants,
  //    on lessons whose title starts with e2e_*.
  // PostgREST doesn't easily express subqueries — use the trailing
  // delete on lessons + cascade via FK (lesson_participants has
  // ON DELETE CASCADE? Let's not assume — sweep dependents directly
  // by org first since e2e_ rows make up the bulk).
  postgrestDelete('attendance_records', `${orgFilter}&cancellation_reason=like.e2e_*`);

  // 2. Guardian dependents (excluding keep-list).
  //    Order: payments → invoice_items → invoices → guardian_payment_preferences →
  //           student_guardians → guardians.
  //    Postgrest .not.in is reliable; but for the "exclude these emails"
  //    filter we need a bigger filter. The keep-list is short enough to
  //    enumerate. Excluded emails = e2e-parent + e2e-parent2.
  const keepList = Array.from(KEEP_GUARDIAN_EMAILS).map(e => `"${e}"`).join(',');

  // Find stale guardian IDs first (one query, capture IDs, use in subsequent filters).
  let staleGuardianIds: string[] = [];
  try {
    const out = execSync(
      `curl -s -X GET "${url}/rest/v1/guardians?${orgFilter}&or=(email.like.e2e_*,email.like.e2e-*)&email=not.in.(${keepList})&select=id" ${headers}`,
      { encoding: 'utf-8', timeout: 30_000 },
    );
    const arr = JSON.parse(out);
    if (Array.isArray(arr)) {
      staleGuardianIds = arr.map((g: any) => g.id).filter(Boolean);
    }
  } catch {
    // ignore
  }

  if (staleGuardianIds.length > 0) {
    // Build chunked .in filters (PostgREST 1024-char-ish limit).
    const chunks: string[][] = [];
    const CHUNK = 50;
    for (let i = 0; i < staleGuardianIds.length; i += CHUNK) {
      chunks.push(staleGuardianIds.slice(i, i + CHUNK));
    }

    for (const chunk of chunks) {
      const inFilter = `(${chunk.join(',')})`;
      // Find invoices for these guardians, capture IDs for invoice_items + payments cleanup.
      let staleInvoiceIds: string[] = [];
      try {
        const out = execSync(
          `curl -s -X GET "${url}/rest/v1/invoices?payer_guardian_id=in.${inFilter}&select=id" ${headers}`,
          { encoding: 'utf-8', timeout: 30_000 },
        );
        const arr = JSON.parse(out);
        if (Array.isArray(arr)) staleInvoiceIds = arr.map((i: any) => i.id).filter(Boolean);
      } catch { /* ignore */ }

      if (staleInvoiceIds.length > 0) {
        const invIn = `(${staleInvoiceIds.join(',')})`;
        postgrestDelete('payments', `invoice_id=in.${invIn}`);
        postgrestDelete('invoice_installments', `invoice_id=in.${invIn}`);
        postgrestDelete('invoice_items', `invoice_id=in.${invIn}`);
        postgrestDelete('invoices', `id=in.${invIn}`);
      }

      postgrestDelete('student_guardians', `guardian_id=in.${inFilter}`);
      postgrestDelete('guardian_payment_preferences', `guardian_id=in.${inFilter}`);
      postgrestDelete('guardians', `id=in.${inFilter}`);
    }
  }

  // 3. Student-pattern sweep (independent of guardians).
  //    students → student_guardians (already swept above for stale guardians,
  //    here for stale students) → lesson_participants → attendance_records →
  //    practice_logs → practice_streaks.
  let staleStudentIds: string[] = [];
  try {
    const out = execSync(
      `curl -s -X GET "${url}/rest/v1/students?${orgFilter}&or=(first_name.like.e2e_*,last_name.like.e2e_*)&select=id" ${headers}`,
      { encoding: 'utf-8', timeout: 30_000 },
    );
    const arr = JSON.parse(out);
    if (Array.isArray(arr)) staleStudentIds = arr.map((s: any) => s.id).filter(Boolean);
  } catch { /* ignore */ }

  if (staleStudentIds.length > 0) {
    const CHUNK = 50;
    for (let i = 0; i < staleStudentIds.length; i += CHUNK) {
      const inFilter = `(${staleStudentIds.slice(i, i + CHUNK).join(',')})`;
      postgrestDelete('attendance_records', `student_id=in.${inFilter}`);
      postgrestDelete('practice_streaks', `student_id=in.${inFilter}`);
      postgrestDelete('practice_logs', `student_id=in.${inFilter}`);
      postgrestDelete('lesson_participants', `student_id=in.${inFilter}`);
      postgrestDelete('student_instruments', `student_id=in.${inFilter}`);
      postgrestDelete('student_guardians', `student_id=in.${inFilter}`);
      postgrestDelete('students', `id=in.${inFilter}`);
    }
  }

  // 4. Direct table sweeps for remaining e2e_-prefixed rows.
  //    These are scoped by org + prefix; safe to delete.
  postgrestDelete('lesson_participants', `org_id=eq.${E2E_ORG_ID}&lesson_id=in.(select id from lessons where title like 'e2e_%')`);
  postgrestDelete('lessons', `${orgFilter}&title=like.e2e_*`);
  postgrestDelete('rooms', `${orgFilter}&name=like.e2e_*`);
  postgrestDelete('message_log', `${orgFilter}&subject=like.e2e_*`);

  const afterStudents = postgrestCount('students', `${orgFilter}&or=(first_name.like.e2e_*,last_name.like.e2e_*)`);
  const afterGuardians = postgrestCount('guardians', `${orgFilter}&or=(email.like.e2e_*,email.like.e2e-*)`);
  const afterLessons = postgrestCount('lessons', `${orgFilter}&title=like.e2e_*`);
  const afterInvoices = postgrestCount('invoices', `${orgFilter}&notes=like.e2e_*`);
  const afterRooms = postgrestCount('rooms', `${orgFilter}&name=like.e2e_*`);

  counts.push({ scope: 'students', before: beforeStudents, after: afterStudents });
  counts.push({ scope: 'guardians', before: beforeGuardians, after: afterGuardians });
  counts.push({ scope: 'lessons', before: beforeLessons, after: afterLessons });
  counts.push({ scope: 'invoices', before: beforeInvoices, after: afterInvoices });
  counts.push({ scope: 'rooms', before: beforeRooms, after: afterRooms });

  const elapsed = Date.now() - start;
  const swept = counts.reduce((sum, c) => sum + Math.max(0, c.before - c.after), 0);
  if (swept > 0 || counts.some(c => c.before > 0)) {
    console.log(`[global-setup] Stale-row sweep done in ${elapsed}ms — ${swept} rows removed:`);
    for (const c of counts) {
      if (c.before > 0 || c.after > 0) {
        console.log(`  ${c.scope}: ${c.before} → ${c.after}`);
      }
    }
  } else {
    console.log(`[global-setup] Stale-row sweep done in ${elapsed}ms — workspace already clean.`);
  }
}

export default async function globalSetup(): Promise<void> {
  // Don't fail the whole suite if sweep errors — log + continue.
  try {
    await sweep();
  } catch (e: any) {
    console.warn(`[global-setup] Sweep error (non-fatal): ${e?.message ?? e}`);
  }
}
