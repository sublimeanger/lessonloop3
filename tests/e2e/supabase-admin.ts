/**
 * Supabase admin cleanup helper for E2E tests.
 * Uses curl via child_process (same pattern as auth.setup.ts)
 * to delete test records matching a prefix, scoped by org_id.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import { randomBytes } from 'crypto';

/** Generate a unique tmpfile suffix that won't collide across parallel workers. */
const uniqueSuffix = () => `${Date.now()}-${randomBytes(8).toString('hex')}`;

const SUPABASE_URL = process.env.E2E_SUPABASE_URL
  || process.env.SUPABASE_URL
  || 'https://xmrhmxizpslhtkibqyfy.supabase.co';
const SUPABASE_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY
  || '';
if (!SUPABASE_ANON_KEY) {
  throw new Error('[supabase-admin] E2E_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY) must be set in .env.test');
}

/**
 * Service-role key for RLS-bypassing writes. When present, factory
 * functions (seedStudent, seedLesson, etc.) use this instead of the
 * test-owner JWT — necessary because direct table inserts on org-scoped
 * tables are RLS-blocked even for owners (writes go through RPCs in
 * production code; tests need raw inserts for speed).
 *
 * If absent, factories fall back to owner-JWT writes (which work for
 * RPCs like `create_invoice_with_items` but fail on raw table inserts).
 */
const SUPABASE_SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || '';

/** Returns service-role bearer when available, else falls back to owner JWT. */
function getWriteAuth(): { token: string; isServiceRole: boolean } {
  if (SUPABASE_SERVICE_ROLE_KEY) {
    return { token: SUPABASE_SERVICE_ROLE_KEY, isServiceRole: true };
  }
  return { token: getOwnerToken(), isServiceRole: false };
}

/** Cache the owner's access token for the session */
let ownerAccessToken: string | null = null;

function getOwnerToken(): string {
  if (ownerAccessToken) return ownerAccessToken;

  const email = process.env.E2E_OWNER_EMAIL || 'e2e-owner@test.lessonloop.net';
  const password = process.env.E2E_OWNER_PASSWORD || 'TestPass123!';

  const payload = JSON.stringify({ email, password });
  const tmpFile = `/tmp/sb-admin-login-${uniqueSuffix()}.json`;
  fs.writeFileSync(tmpFile, payload);

  try {
    const result = execSync(
      `curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" ` +
      `-H "apikey: ${SUPABASE_ANON_KEY}" ` +
      `-H "Content-Type: application/json" ` +
      `-d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 30_000 },
    );
    const session = JSON.parse(result);
    if (!session.access_token) {
      throw new Error(`Admin login failed: ${JSON.stringify(session)}`);
    }
    ownerAccessToken = session.access_token;
    return ownerAccessToken;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/**
 * Execute a Supabase PostgREST DELETE via curl.
 * Returns true on success, false on failure (best-effort).
 */
export function supabaseDelete(table: string, query: string): boolean {
  const { token, isServiceRole } = getWriteAuth();
  const apikey = isServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  try {
    execSync(
      `curl -s -X DELETE "${SUPABASE_URL}/rest/v1/${table}?${query}" ` +
      `-H "apikey: ${apikey}" ` +
      `-H "Authorization: Bearer ${token}" ` +
      `-H "Content-Type: application/json" ` +
      `-H "Prefer: return=minimal"`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a Supabase PostgREST SELECT via curl.
 * Returns parsed JSON array or empty array on failure.
 */
export function supabaseSelect(table: string, query: string): any[] {
  const token = getOwnerToken();
  try {
    const result = execSync(
      `curl -s "${SUPABASE_URL}/rest/v1/${table}?${query}" ` +
      `-H "apikey: ${SUPABASE_ANON_KEY}" ` +
      `-H "Authorization: Bearer ${token}" ` +
      `-H "Content-Type: application/json"`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    return JSON.parse(result);
  } catch {
    return [];
  }
}

/**
 * Execute a Supabase PostgREST INSERT via curl.
 * Returns parsed JSON result or null on failure.
 */
export function supabaseInsert(table: string, payload: Record<string, unknown>): any {
  // Use service-role for writes when available (RLS-bypassing). Falls back
  // to owner-JWT for environments without service-role configured.
  const { token, isServiceRole } = getWriteAuth();
  const apikey = isServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  const data = JSON.stringify(payload);
  const tmpFile = `/tmp/sb-insert-${uniqueSuffix()}.json`;
  fs.writeFileSync(tmpFile, data);
  try {
    const result = execSync(
      `curl -s -X POST "${SUPABASE_URL}/rest/v1/${table}" ` +
      `-H "apikey: ${apikey}" ` +
      `-H "Authorization: Bearer ${token}" ` +
      `-H "Content-Type: application/json" ` +
      `-H "Prefer: return=representation" ` +
      `-d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed[0] : parsed;
  } catch {
    return null;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/**
 * Get the org_id for the test organisation.
 * Cached after first call.
 */
let cachedOrgId: string | null = null;
export function getOrgId(): string {
  if (cachedOrgId) return cachedOrgId;
  const orgs = supabaseSelect('organisations', 'name=eq.E2E%20Test%20Academy&select=id&limit=1');
  if (orgs.length > 0) {
    cachedOrgId = orgs[0].id;
  }
  return cachedOrgId || '';
}

/**
 * Clean up test records matching a testId prefix.
 * All deletes are org_id scoped for safety.
 * Best-effort — failures don't throw.
 */
export function cleanupTestData(testId: string): void {
  const orgId = getOrgId();
  if (!orgId) return;

  const encodedPrefix = encodeURIComponent(`%${testId}%`);

  // Order matters: delete dependent records first (FK constraints)
  const tables: Array<{ table: string; nameCol: string }> = [
    { table: 'attendance_records', nameCol: '' },
    { table: 'lesson_participants', nameCol: '' },
    { table: 'invoice_items', nameCol: '' },
    { table: 'payments', nameCol: '' },
    { table: 'resource_shares', nameCol: '' },
    { table: 'student_guardians', nameCol: '' },
    { table: 'student_instruments', nameCol: '' },
    { table: 'student_teacher_assignments', nameCol: '' },
    { table: 'message_log', nameCol: 'subject' },
    { table: 'resources', nameCol: 'title' },
    { table: 'practice_assignments', nameCol: 'title' },
    { table: 'practice_logs', nameCol: '' },
    { table: 'invoices', nameCol: 'notes' },
    { table: 'lessons', nameCol: 'title' },
    { table: 'leads', nameCol: 'contact_name' },
    { table: 'guardians', nameCol: 'full_name' },
    { table: 'students', nameCol: 'first_name' },
    { table: 'teachers', nameCol: 'display_name' },
    { table: 'locations', nameCol: 'name' },
    { table: 'rooms', nameCol: 'name' },
  ];

  for (const { table, nameCol } of tables) {
    if (nameCol) {
      // Delete by name column containing testId, scoped to org
      supabaseDelete(table, `org_id=eq.${orgId}&${nameCol}=like.${encodedPrefix}`);
    }
  }

  // For tables without a name column, delete by related records
  // (handled by cascading deletes or left as orphans — acceptable for test cleanup)
}

/**
 * Delete a specific student by ID (and their dependent records).
 */
export function deleteStudentById(studentId: string): void {
  const orgId = getOrgId();
  if (!orgId || !studentId) return;

  // Delete dependent records first
  supabaseDelete('attendance_records', `org_id=eq.${orgId}&student_id=eq.${studentId}`);
  supabaseDelete('lesson_participants', `org_id=eq.${orgId}&student_id=eq.${studentId}`);
  supabaseDelete('student_guardians', `org_id=eq.${orgId}&student_id=eq.${studentId}`);
  supabaseDelete('student_instruments', `org_id=eq.${orgId}&student_id=eq.${studentId}`);
  supabaseDelete('student_teacher_assignments', `org_id=eq.${orgId}&student_id=eq.${studentId}`);
  supabaseDelete('resource_shares', `org_id=eq.${orgId}&student_id=eq.${studentId}`);
  supabaseDelete('students', `org_id=eq.${orgId}&id=eq.${studentId}`);
}

/**
 * Delete a specific lesson by ID (and dependent records).
 */
export function deleteLessonById(lessonId: string): void {
  const orgId = getOrgId();
  if (!orgId || !lessonId) return;

  supabaseDelete('attendance_records', `org_id=eq.${orgId}&lesson_id=eq.${lessonId}`);
  supabaseDelete('lesson_participants', `org_id=eq.${orgId}&lesson_id=eq.${lessonId}`);
  supabaseDelete('lessons', `org_id=eq.${orgId}&id=eq.${lessonId}`);
}

/**
 * Delete a specific invoice by ID (and dependent records).
 */
export function deleteInvoiceById(invoiceId: string): void {
  const orgId = getOrgId();
  if (!orgId || !invoiceId) return;

  supabaseDelete('payments', `org_id=eq.${orgId}&invoice_id=eq.${invoiceId}`);
  supabaseDelete('invoice_items', `org_id=eq.${orgId}&invoice_id=eq.${invoiceId}`);
  supabaseDelete('invoices', `org_id=eq.${orgId}&id=eq.${invoiceId}`);
}

/**
 * Delete a specific lead by ID.
 */
export function deleteLeadById(leadId: string): void {
  const orgId = getOrgId();
  if (!orgId || !leadId) return;

  supabaseDelete('leads', `org_id=eq.${orgId}&id=eq.${leadId}`);
}

/**
 * Delete a specific teacher by ID.
 */
export function deleteTeacherById(teacherId: string): void {
  const orgId = getOrgId();
  if (!orgId || !teacherId) return;

  supabaseDelete('student_teacher_assignments', `org_id=eq.${orgId}&teacher_id=eq.${teacherId}`);
  supabaseDelete('teachers', `org_id=eq.${orgId}&id=eq.${teacherId}`);
}

/**
 * Delete a specific location by ID (and rooms).
 */
export function deleteLocationById(locationId: string): void {
  const orgId = getOrgId();
  if (!orgId || !locationId) return;

  supabaseDelete('rooms', `org_id=eq.${orgId}&location_id=eq.${locationId}`);
  supabaseDelete('locations', `org_id=eq.${orgId}&id=eq.${locationId}`);
}

/**
 * Delete message_log entries matching a subject prefix.
 */
export function deleteMessagesBySubject(subjectPrefix: string): void {
  const orgId = getOrgId();
  if (!orgId) return;

  const encoded = encodeURIComponent(`%${subjectPrefix}%`);
  supabaseDelete('message_log', `org_id=eq.${orgId}&subject=like.${encoded}`);
}

/**
 * Delete a resource by ID.
 */
export function deleteResourceById(resourceId: string): void {
  const orgId = getOrgId();
  if (!orgId || !resourceId) return;

  supabaseDelete('resource_shares', `org_id=eq.${orgId}&resource_id=eq.${resourceId}`);
  supabaseDelete('resources', `org_id=eq.${orgId}&id=eq.${resourceId}`);
}

/**
 * Call a Supabase RPC function via curl.
 * Returns parsed JSON result.
 */
export function supabaseRpc(fnName: string, params: Record<string, unknown>): unknown {
  const token = getOwnerToken();
  const payload = JSON.stringify(params);
  const tmpFile = `/tmp/sb-rpc-${uniqueSuffix()}.json`;
  fs.writeFileSync(tmpFile, payload);
  try {
    const result = execSync(
      `curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/${fnName}" ` +
      `-H "apikey: ${SUPABASE_ANON_KEY}" ` +
      `-H "Authorization: Bearer ${token}" ` +
      `-H "Content-Type: application/json" ` +
      `-H "Prefer: return=representation" ` +
      `-d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 30_000 },
    );
    return JSON.parse(result);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/**
 * Create a test invoice via the RPC function (bypasses UI form).
 * Returns { id, invoice_number, total_minor }.
 */
export function createTestInvoice(opts: {
  dueDate: string;
  payerGuardianId?: string;
  payerStudentId?: string;
  notes?: string;
  items: Array<{ description: string; quantity: number; unit_price_minor: number }>;
}): { id: string; invoice_number: string; total_minor: number } {
  const orgId = getOrgId();
  if (!orgId) throw new Error('No org ID found');

  const result = supabaseRpc('create_invoice_with_items', {
    _org_id: orgId,
    _due_date: opts.dueDate,
    _payer_guardian_id: opts.payerGuardianId ?? null,
    _payer_student_id: opts.payerStudentId ?? null,
    _notes: opts.notes ?? null,
    _credit_ids: [],
    _items: opts.items,
  });
  return result as { id: string; invoice_number: string; total_minor: number };
}

/**
 * Get first guardian ID for the test org.
 */
export function getFirstGuardianId(): string {
  const orgId = getOrgId();
  if (!orgId) return '';
  const guardians = supabaseSelect('guardians', `org_id=eq.${orgId}&deleted_at=is.null&select=id&limit=1&order=full_name`);
  return guardians.length > 0 ? guardians[0].id : '';
}

// ════════════════════════════════════════════════════════════════
// FACTORIES (per PLAYWRIGHT_MASTER_CATALOG.md §1.5)
// ════════════════════════════════════════════════════════════════
// Deterministic seeders for `e2e_*`-prefixed test data, used in
// `test.beforeAll` blocks. All factories return the inserted row's
// id so the test can reference it; cleanup is via cleanupByPrefix.
//
// Convention: every name field starts with the testId prefix
// (e.g. `e2e_${Date.now()}_lesson1`) so cleanup can sweep by prefix.

const E2E_PREFIX = 'e2e_';

export interface SeedStudentOpts {
  testId: string;
  firstName?: string;
  lastName?: string;
  status?: 'active' | 'inactive';
  withGuardian?: boolean;
  guardianEmail?: string;
  instrumentId?: string;
}

/** Insert a student. If `withGuardian`, also seeds a guardian + student_guardians link. */
export function seedStudent(opts: SeedStudentOpts): { studentId: string; guardianId?: string } {
  const orgId = getOrgId();
  if (!orgId) throw new Error('seedStudent: No org ID');

  const student = supabaseInsert('students', {
    org_id: orgId,
    first_name: opts.firstName ?? `${E2E_PREFIX}${opts.testId}_first`,
    last_name: opts.lastName ?? `${E2E_PREFIX}${opts.testId}_last`,
    status: opts.status ?? 'active',
  });
  if (!student?.id) throw new Error('seedStudent: insert failed');

  let guardianId: string | undefined;
  if (opts.withGuardian) {
    const guardian = supabaseInsert('guardians', {
      org_id: orgId,
      full_name: `${E2E_PREFIX}${opts.testId} Guardian`,
      email: opts.guardianEmail ?? `${E2E_PREFIX}${opts.testId}@test.lessonloop.net`,
    });
    if (guardian?.id) {
      guardianId = guardian.id;
      supabaseInsert('student_guardians', {
        org_id: orgId,
        student_id: student.id,
        guardian_id: guardianId,
        relationship: 'guardian', // enum: mother|father|guardian|other
        is_primary_payer: true,
      });
    }
  }

  if (opts.instrumentId) {
    supabaseInsert('student_instruments', {
      org_id: orgId,
      student_id: student.id,
      instrument_id: opts.instrumentId,
      status: 'current',
    });
  }

  return { studentId: student.id, guardianId };
}

export interface SeedLessonOpts {
  testId: string;
  teacherId: string;
  createdBy: string; // user_id
  studentIds?: string[];
  startAt?: string;
  durationMins?: number;
  status?: 'scheduled' | 'completed' | 'cancelled';
  title?: string;
}

/** Insert a lesson + lesson_participants for each student. */
export function seedLesson(opts: SeedLessonOpts): { lessonId: string } {
  const orgId = getOrgId();
  if (!orgId) throw new Error('seedLesson: No org ID');

  const startAt = opts.startAt ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const durMs = (opts.durationMins ?? 30) * 60 * 1000;
  const endAt = new Date(new Date(startAt).getTime() + durMs).toISOString();

  const lesson = supabaseInsert('lessons', {
    org_id: orgId,
    teacher_id: opts.teacherId,
    created_by: opts.createdBy,
    start_at: startAt,
    end_at: endAt,
    status: opts.status ?? 'scheduled',
    title: opts.title ?? `${E2E_PREFIX}${opts.testId}_lesson`,
  });
  if (!lesson?.id) throw new Error('seedLesson: insert failed');

  for (const studentId of opts.studentIds ?? []) {
    supabaseInsert('lesson_participants', {
      org_id: orgId,
      lesson_id: lesson.id,
      student_id: studentId,
    });
  }

  return { lessonId: lesson.id };
}

export interface SeedInvoiceOpts {
  testId: string;
  payerGuardianId?: string;
  payerStudentId?: string;
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  dueDate?: string;
  items?: Array<{ description: string; quantity: number; unit_price_minor: number }>;
}

/**
 * Update invoice status via direct service-role PATCH on PostgREST.
 *
 * The catalog references an `update_invoice_status(_invoice_id, _status)`
 * RPC; that function doesn't exist in the schema (only the
 * `enforce_invoice_status_transition` trigger does). Earlier versions
 * of this file called the missing RPC via `supabaseRpc` — the call
 * silently failed (PGRST202 returned as JSON, not thrown), leaving
 * test invoices stuck in `draft` and breaking every Stripe flow that
 * requires `status in ('sent', 'overdue')`.
 *
 * This helper goes through PostgREST PATCH using the service-role
 * key. The trigger validates the transition; invalid moves still
 * raise. Service-role bypasses RLS but NOT triggers (by design).
 */
export function patchInvoiceStatus(invoiceId: string, status: string): boolean {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('patchInvoiceStatus: E2E_SUPABASE_SERVICE_ROLE_KEY required');
  }
  const tmpFile = `/tmp/sb-patch-status-${uniqueSuffix()}.json`;
  fs.writeFileSync(tmpFile, JSON.stringify({ status }));
  try {
    const result = execSync(
      `curl -s -X PATCH "${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoiceId}" ` +
      `-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" ` +
      `-H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" ` +
      `-H "Content-Type: application/json" ` +
      `-H "Prefer: return=minimal" ` +
      `-d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    // PostgREST returns empty body on success with Prefer: return=minimal.
    // Any body content here is the trigger's exception payload.
    if (result.trim().length > 0 && result.trim().startsWith('{')) {
      const err = JSON.parse(result);
      if (err.message || err.code) {
        throw new Error(`patchInvoiceStatus(${invoiceId}, ${status}) rejected: ${result}`);
      }
    }
    return true;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/** Insert an invoice via the RPC (uses create_invoice_with_items). */
export function seedInvoice(opts: SeedInvoiceOpts): { invoiceId: string; invoiceNumber: string } {
  const orgId = getOrgId();
  if (!orgId) throw new Error('seedInvoice: No org ID');

  const result = createTestInvoice({
    dueDate: opts.dueDate ?? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    payerGuardianId: opts.payerGuardianId,
    payerStudentId: opts.payerStudentId,
    notes: `${E2E_PREFIX}${opts.testId}_invoice`,
    items: opts.items ?? [
      { description: `${E2E_PREFIX}${opts.testId}_item`, quantity: 1, unit_price_minor: 5000 },
    ],
  });

  // Default status from create_invoice_with_items is 'draft'. PATCH if
  // caller wants a different status. Goes through enforce_invoice_status
  // _transition trigger — invalid moves throw.
  if (opts.status && opts.status !== 'draft') {
    patchInvoiceStatus(result.id, opts.status);
  }

  return { invoiceId: result.id, invoiceNumber: result.invoice_number };
}

export interface SeedLeadOpts {
  testId: string;
  contactName?: string;
  contactEmail?: string;
  source?: string;
  stage?: 'enquiry' | 'contacted' | 'trial_booked' | 'trial_completed' | 'enrolled' | 'lost';
}

/** Insert a lead. */
export function seedLead(opts: SeedLeadOpts): { leadId: string } {
  const orgId = getOrgId();
  if (!orgId) throw new Error('seedLead: No org ID');

  const lead = supabaseInsert('leads', {
    org_id: orgId,
    contact_name: opts.contactName ?? `${E2E_PREFIX}${opts.testId} Lead`,
    contact_email: opts.contactEmail ?? `${E2E_PREFIX}${opts.testId}.lead@test.lessonloop.net`,
    source: opts.source ?? 'manual',
    stage: opts.stage ?? 'enquiry',
  });
  if (!lead?.id) throw new Error('seedLead: insert failed');
  return { leadId: lead.id };
}

/**
 * Sweep all test rows tagged with the given testId prefix from this org.
 * Best-effort — failures don't throw.
 *
 * Most factories prefix the row's name/notes/title field with `e2e_${testId}`,
 * so this can find them by like-pattern. Order matters: child tables first.
 */
export function cleanupByPrefix(testId: string): void {
  const orgId = getOrgId();
  if (!orgId) return;
  const prefix = encodeURIComponent(`%${E2E_PREFIX}${testId}%`);

  // Order: dependent rows first (FK constraints), then parents.
  const sweeps: Array<[string, string]> = [
    ['lesson_participants', `org_id=eq.${orgId}&lesson_id=in.(select id from lessons where title ilike '${E2E_PREFIX}${testId}%')`],
    ['attendance_records', `org_id=eq.${orgId}`],
    ['student_guardians', `org_id=eq.${orgId}&student_id=in.(select id from students where first_name ilike '${E2E_PREFIX}${testId}%')`],
    ['lessons', `org_id=eq.${orgId}&title=like.${prefix}`],
    ['invoices', `org_id=eq.${orgId}&notes=like.${prefix}`],
    ['students', `org_id=eq.${orgId}&first_name=like.${prefix}`],
    ['guardians', `org_id=eq.${orgId}&full_name=like.${prefix}`],
    ['leads', `org_id=eq.${orgId}&contact_name=like.${prefix}`],
  ];

  for (const [table, query] of sweeps) {
    supabaseDelete(table, query);
  }
}

/**
 * Create a throwaway auth user via the admin API.
 * Returns { userId, email, password } so the test can sign in.
 *
 * Useful for tests that need a fresh user (onboarding wizard,
 * email-not-confirmed gate, account-delete, etc.). Always call
 * `deleteThrowawayUser(userId)` in afterEach to clean up.
 */
export interface ThrowawayUserOpts {
  emailPrefix?: string;
  password?: string;
  emailConfirmed?: boolean;
  hasCompletedOnboarding?: boolean;
}

export function createThrowawayUser(opts: ThrowawayUserOpts = {}): {
  userId: string;
  email: string;
  password: string;
} {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('createThrowawayUser: E2E_SUPABASE_SERVICE_ROLE_KEY required');
  }
  const prefix = opts.emailPrefix || 'e2e-throwaway';
  const stamp = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  const email = `${prefix}-${stamp}@test.lessonloop.net`;
  const password = opts.password || 'ThrowawayPass123!';
  const emailConfirmed = opts.emailConfirmed !== false; // default true

  const tmpFile = `/tmp/sb-throwaway-${stamp}.json`;
  fs.writeFileSync(
    tmpFile,
    JSON.stringify({
      email,
      password,
      email_confirm: emailConfirmed,
      user_metadata: { full_name: 'E2E Throwaway' },
    })
  );

  try {
    const result = execSync(
      `curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" ` +
        `-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" ` +
        `-H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" ` +
        `-H "Content-Type: application/json" ` +
        `-d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
    const parsed = JSON.parse(result);
    if (!parsed.id) {
      throw new Error(`createThrowawayUser failed: ${JSON.stringify(parsed)}`);
    }

    // Optionally update profile.has_completed_onboarding via direct SQL-ish
    if (opts.hasCompletedOnboarding === false) {
      // The `handle_new_user` trigger will create profile with has_completed=false
      // by default. Nothing to do.
    }

    return { userId: parsed.id, email, password };
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  }
}

/** Delete a throwaway user via admin API. Idempotent. */
export function deleteThrowawayUser(userId: string): void {
  if (!SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    execSync(
      `curl -s -X DELETE "${SUPABASE_URL}/auth/v1/admin/users/${userId}" ` +
        `-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" ` +
        `-H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
  } catch {
    /* ignore */
  }
}

/**
 * Sign in as a specific user (typically a throwaway one), and write
 * an ephemeral storage-state file. Returns the path to the file so a
 * test can do `test.use({ storageState: path })`.
 *
 * Caller is responsible for cleanup via fs.unlinkSync.
 */
export function signInAndWriteStorageState(
  email: string,
  password: string
): string {
  const tmpFile = `/tmp/sb-throwaway-login-${Date.now()}-${randomBytes(8).toString('hex')}.json`;
  const payloadFile = `/tmp/sb-throwaway-payload-${Date.now()}-${randomBytes(8).toString('hex')}.json`;
  fs.writeFileSync(payloadFile, JSON.stringify({ email, password }));

  try {
    const result = execSync(
      `curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" ` +
        `-H "apikey: ${SUPABASE_ANON_KEY}" ` +
        `-H "Content-Type: application/json" ` +
        `-d @${payloadFile}`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
    const session = JSON.parse(result);
    if (!session.access_token) {
      throw new Error(`signInAndWriteStorageState failed: ${JSON.stringify(session)}`);
    }
    const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
    const baseURL = process.env.E2E_BASE_URL || 'https://app.lessonloop.net';
    const state = {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [
            { name: `sb-${projectRef}-auth-token`, value: JSON.stringify(session) },
          ],
        },
      ],
    };
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2));
    return tmpFile;
  } finally {
    try {
      fs.unlinkSync(payloadFile);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Get user_id of the test owner from profiles.
 * Cached after first call.
 */
let cachedOwnerUserId: string | null = null;
export function getOwnerUserId(): string {
  if (cachedOwnerUserId) return cachedOwnerUserId;
  const ownerEmail = process.env.E2E_OWNER_EMAIL || 'e2e-owner@test.lessonloop.net';
  const profiles = supabaseSelect(
    'profiles',
    `email=eq.${encodeURIComponent(ownerEmail)}&select=id&limit=1`
  );
  if (profiles.length > 0) {
    cachedOwnerUserId = profiles[0].id;
  }
  return cachedOwnerUserId || '';
}

/**
 * Get teacher_id for the e2e-owner user (frequently needed in seedLesson).
 * Looks up by user_id (teacher.email is often null when teacher was
 * auto-linked via membership).
 */
let cachedOwnerTeacherId: string | null = null;
export function getOwnerTeacherId(): string {
  if (cachedOwnerTeacherId) return cachedOwnerTeacherId;
  const orgId = getOrgId();
  const userId = getOwnerUserId();
  if (!orgId || !userId) return '';
  const teachers = supabaseSelect(
    'teachers',
    `org_id=eq.${orgId}&user_id=eq.${userId}&select=id&limit=1`
  );
  if (teachers.length > 0) {
    cachedOwnerTeacherId = teachers[0].id;
  }
  return cachedOwnerTeacherId || '';
}
