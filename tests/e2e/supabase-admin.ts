/**
 * Supabase admin cleanup helper for E2E tests.
 * Uses curl via child_process (same pattern as auth.setup.ts)
 * to delete test records matching a prefix, scoped by org_id.
 */
import { execSync } from 'child_process';
import fs from 'fs';

const SUPABASE_URL = 'https://ximxgnkpcswbvfrkkmjq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpbXhnbmtwY3N3YnZmcmtrbWpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NTI4MDcsImV4cCI6MjA4NDQyODgwN30.cA56tVd1UVtwEKGBwXajOpm-gLmCeD_QUzoMwiX8d0M';

/** Cache the owner's access token for the session */
let ownerAccessToken: string | null = null;

function getOwnerToken(): string {
  if (ownerAccessToken) return ownerAccessToken;

  const email = process.env.E2E_OWNER_EMAIL || 'e2e-owner@test.lessonloop.net';
  const password = process.env.E2E_OWNER_PASSWORD || 'TestPass123!';

  const payload = JSON.stringify({ email, password });
  const tmpFile = `/tmp/sb-admin-login-${Date.now()}.json`;
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
function supabaseDelete(table: string, query: string): boolean {
  const token = getOwnerToken();
  try {
    execSync(
      `curl -s -X DELETE "${SUPABASE_URL}/rest/v1/${table}?${query}" ` +
      `-H "apikey: ${SUPABASE_ANON_KEY}" ` +
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
  const tmpFile = `/tmp/sb-rpc-${Date.now()}.json`;
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
