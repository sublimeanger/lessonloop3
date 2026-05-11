/**
 * Centralised invoice → recipient resolver.
 *
 * Resolves the email + name a billing notification (reminder, receipt,
 * dispute notice, manual chase) should be sent to for a given invoice.
 *
 * Priority order:
 *   1. Direct guardian payer (`invoice.payer_guardian_id` → guardian.email)
 *   2. Direct student payer with their own email (`invoice.payer_student_id` → student.email)
 *   3. Fallback: student payer → primary-payer guardian via `student_guardians`
 *      (is_primary_payer = true AND receives_billing = true). Covers the common
 *      music-academy case of a minor student paying via parent — `payer_student_id`
 *      is technically valid but the student has no email of their own.
 *
 * Shared by:
 *   - `looopassist-execute` / send_invoice_reminders + send_bulk_reminders
 *   - `overdue-reminders` cron
 *   - any future ad-hoc invoice notification path
 *
 * Pass the invoice with the canonical SELECT shape (see `INVOICE_RECIPIENT_SELECT`
 * below). The resolver is pure — no DB calls — so callers control query cost.
 *
 * Returns `null` when no recipient email is reachable; callers SHOULD distinguish
 * this from a successful zero-row case rather than silently treating it as success.
 *
 * Filed under s38 audit: "Email resolution is shallow" + "send_invoice_reminders
 * and send_bulk_reminders are 90% copy-paste" — this is the centralisation.
 */

export const INVOICE_RECIPIENT_SELECT = `
  id, invoice_number, total_minor, paid_minor, due_date, status, currency_code,
  payer_guardian_id, payer_student_id,
  payer_guardian:guardians!invoices_payer_guardian_id_fkey(id, full_name, email, user_id),
  payer_student:students!invoices_payer_student_id_fkey(
    id, first_name, last_name, email,
    student_guardians(
      is_primary_payer, receives_billing,
      guardian:guardians(id, full_name, email, user_id)
    )
  )
` as const;

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  total_minor: number;
  paid_minor?: number | null;
  due_date: string;
  status: string;
  currency_code?: string;
  payer_guardian_id?: string | null;
  payer_student_id?: string | null;
  // PostgREST returns to-one joins as object OR single-element array depending on cardinality.
  payer_guardian?: GuardianRow | GuardianRow[] | null;
  payer_student?: StudentRow | StudentRow[] | null;
}

interface GuardianRow {
  id: string;
  full_name: string;
  email: string | null;
  user_id?: string | null;
}

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  student_guardians?: StudentGuardianLink[];
}

interface StudentGuardianLink {
  is_primary_payer: boolean | null;
  receives_billing: boolean | null;
  guardian: GuardianRow | GuardianRow[] | null;
}

export type RecipientResolution =
  | {
      ok: true;
      email: string;
      name: string;
      recipientType: 'guardian' | 'student';
      recipientId: string;
      /** Auth user_id if the recipient has a portal account. Use for notification-pref checks. */
      userId: string | null;
      // 'direct_guardian' | 'direct_student' | 'student_to_primary_guardian'
      source: 'direct_guardian' | 'direct_student' | 'student_to_primary_guardian';
    }
  | {
      ok: false;
      reason: 'no_email_on_file' | 'no_payer';
    };

function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function resolveInvoiceRecipient(invoice: InvoiceRow): RecipientResolution {
  const directGuardian = first(invoice.payer_guardian);
  const directStudent = first(invoice.payer_student);

  // 1. Direct guardian payer with an email.
  if (directGuardian?.email) {
    return {
      ok: true,
      email: directGuardian.email,
      name: directGuardian.full_name || 'Customer',
      recipientType: 'guardian',
      recipientId: directGuardian.id,
      userId: directGuardian.user_id ?? null,
      source: 'direct_guardian',
    };
  }

  // 2. Direct student payer with their own email.
  if (directStudent?.email) {
    return {
      ok: true,
      email: directStudent.email,
      name: `${directStudent.first_name} ${directStudent.last_name}`.trim() || 'Customer',
      recipientType: 'student',
      recipientId: directStudent.id,
      userId: null,
      source: 'direct_student',
    };
  }

  // 3. Fallback: student payer with no email of their own → primary-payer guardian
  //    via student_guardians link (must opt-in to receives_billing).
  if (directStudent) {
    const fallback = (directStudent.student_guardians || [])
      .filter((sg) => sg.is_primary_payer && sg.receives_billing)
      .map((sg) => first(sg.guardian))
      .find((g): g is GuardianRow => !!g?.email);

    if (fallback) {
      return {
        ok: true,
        email: fallback.email!,
        name: fallback.full_name || 'Customer',
        recipientType: 'guardian',
        recipientId: fallback.id,
        userId: fallback.user_id ?? null,
        source: 'student_to_primary_guardian',
      };
    }
  }

  if (!directGuardian && !directStudent) {
    return { ok: false, reason: 'no_payer' };
  }
  return { ok: false, reason: 'no_email_on_file' };
}
