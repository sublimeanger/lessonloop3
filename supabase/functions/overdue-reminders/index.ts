import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, sanitiseFromName } from "../_shared/escape-html.ts";
import { isNotificationEnabled } from "../_shared/check-notification-pref.ts";
import { validateCronAuth } from "../_shared/cron-auth.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

serve(async (req) => {
  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase: any = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let remindersSent = 0;
    const errors: string[] = [];
    // ── STANDARD INVOICE REMINDERS ─────────────────────────────
    // Note: status transitions (pending→overdue) are handled by the dedicated
    // installment-overdue-check and invoice-overdue-check cron functions (FIN-H7)
    console.log("Starting overdue invoice reminder check...");

    const { data: overdueInvoices, error: invoicesError } = await supabase
      .from("invoices")
      .select(`
        id, invoice_number, total_minor, paid_minor, currency_code, due_date, org_id, payment_plan_enabled,
        organisation:organisations!inner(name, overdue_reminder_days, logo_url, brand_primary_color),
        payer_guardian:guardians(id, full_name, email, user_id),
        payer_student:students(id, first_name, last_name, email)
      `)
      .eq("status", "overdue");

    if (invoicesError) {
      throw new Error(`Failed to fetch overdue invoices: ${invoicesError.message}`);
    }

    for (const invoice of overdueInvoices || []) {
      try {
        // Skip invoices with active payment plans — they get installment-level reminders
        if (invoice.payment_plan_enabled) continue;

        const result = await processInvoiceReminder(supabase, invoice, today, resendApiKey);
        if (result === "sent") remindersSent++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Invoice ${invoice.invoice_number}: ${msg}`);
      }
    }

    // ── INSTALLMENT REMINDERS ──────────────────────────────────
    console.log("Starting overdue installment reminder check...");

    // Include partially_paid installments too — reminder logic in
    // processInstallmentReminder computes daysOverdue from due_date; a
    // partially_paid installment with a future due_date is naturally skipped,
    // while one with a past due_date is reminded about with its outstanding
    // (not installment) amount.
    const { data: overdueInstallments, error: installError } = await supabase
      .from("invoice_installments")
      .select(`
        id, installment_number, amount_minor, due_date, invoice_id,
        invoice:invoices!inner (
          id, invoice_number, total_minor, currency_code, org_id, status,
          paid_minor, installment_count,
          organisation:organisations!inner(name, overdue_reminder_days, logo_url, brand_primary_color),
          payer_guardian:guardians(id, full_name, email, user_id),
          payer_student:students(id, first_name, last_name, email)
        )
      `)
      .in("status", ["overdue", "partially_paid"])
      .not("invoice.status", "in", "(void,paid)");

    if (installError) {
      console.error("Failed to fetch overdue installments:", installError.message);
    }

    for (const installment of overdueInstallments || []) {
      try {
        const result = await processInstallmentReminder(supabase, installment, today, resendApiKey);
        if (result === "sent") remindersSent++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Installment ${installment.id}: ${msg}`);
      }
    }

    console.log(`Overdue reminder job complete. Sent: ${remindersSent}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({ success: true, sent: remindersSent, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Overdue reminders error:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// ── HELPERS ────────────────────────────────────────────────

function calcDaysOverdue(dueDateStr: string, today: Date): number {
  const d = new Date(dueDateStr);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function formatCurrency(minor: number, code: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: code || "GBP" }).format(minor / 100);
}

function formatDateGB(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function buildBrandedHeader(orgName: string, logoUrl: string | null, brandColor: string): string {
  return logoUrl
    ? `<div style="border-bottom: 3px solid ${brandColor}; padding-bottom: 16px; margin-bottom: 20px;">
        <img src="${logoUrl}" alt="${escapeHtml(orgName)}" style="max-height: 60px;" />
      </div>`
    : `<div style="border-bottom: 3px solid ${brandColor}; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: ${brandColor};">${escapeHtml(orgName)}</h2>
      </div>`;
}

interface ResolvedRecipient {
  email: string;
  name: string;
  type: "guardian" | "student";
  id: string;
  /** Only populated for guardian recipients — students don't have user_id
      for notification_preferences. */
  userId: string | null;
}

// J7-F1: resolve reminder recipient — guardian first, then student
// fallback. Returns null when neither is reachable (skip). Mirrors the
// J6-F8 pattern from installment-upcoming-reminder (commit e63d6e80).
function resolveRecipient(
  guardian: { id: string; full_name: string; email: string; user_id: string | null } | null,
  student: { id: string; first_name: string; last_name: string; email: string } | null,
): ResolvedRecipient | null {
  if (guardian?.email) {
    return {
      email: guardian.email,
      name: guardian.full_name,
      type: "guardian",
      id: guardian.id,
      userId: guardian.user_id,
    };
  }
  if (student?.email) {
    return {
      email: student.email,
      name: `${student.first_name} ${student.last_name}`.trim(),
      type: "student",
      id: student.id,
      userId: null,
    };
  }
  return null;
}

// deno-lint-ignore no-explicit-any
async function checkRecipientNotifEnabled(
  supabase: any, orgId: string, recipient: ResolvedRecipient,
): Promise<boolean> {
  // Only guardians have user_id for notification_preferences. Students
  // without a user_id always receive (no prefs to check).
  if (recipient.type === "guardian" && recipient.userId) {
    const enabled = await isNotificationEnabled(supabase, orgId, recipient.userId, "email_invoice_reminders");
    if (!enabled) {
      console.log(`${recipient.type} ${recipient.email} has invoice reminders disabled, skipping`);
      return false;
    }
  }
  return true;
}

/**
 * J7-F3: lifetime tier lookup. Has any reminder of this tier been
 * successfully sent (or is pending) for this entity? Filter excludes
 * status='failed' — a failed send didn't reach the parent, so the
 * tier is still owed. Tier-reminders are once-per-lifetime per entity
 * per tier (unlike the prior same-day dedup which was time-windowed).
 *
 * message_type uses a dynamic suffix `${baseType}_d${tier}` so this
 * helper works for any org's overdue_reminder_days array, not just
 * the default [7, 14, 30].
 */
// deno-lint-ignore no-explicit-any
async function hasTierReminderBeenSent(
  supabase: any,
  entityId: string,
  tier: number,
  baseType: "overdue_reminder" | "installment_reminder",
): Promise<boolean> {
  const { data } = await supabase
    .from("message_log")
    .select("id")
    .eq("related_id", entityId)
    .eq("message_type", `${baseType}_d${tier}`)
    .in("status", ["sent", "pending"])
    .limit(1);
  return !!(data && data.length > 0);
}

/**
 * J7-F3: given a reminder-days cadence and current daysOverdue,
 * return the highest tier that is eligible to fire now AND has not
 * yet been successfully sent. Returns null if nothing owed.
 *
 * Firing highest-missing-only (not all missing) avoids spamming a
 * parent with back-to-back tier-7 + tier-14 after a long outage.
 * The most escalated relevant tier wins.
 */
// deno-lint-ignore no-explicit-any
async function pickFiringTier(
  supabase: any,
  entityId: string,
  daysOverdue: number,
  reminderDays: number[],
  baseType: "overdue_reminder" | "installment_reminder",
): Promise<number | null> {
  const eligibleTiers = reminderDays
    .filter((d) => daysOverdue >= d)
    .sort((a, b) => b - a); // highest first
  for (const tier of eligibleTiers) {
    if (!(await hasTierReminderBeenSent(supabase, entityId, tier, baseType))) {
      return tier;
    }
  }
  return null;
}

// deno-lint-ignore no-explicit-any
async function logAndSend(
  supabase: any, resendApiKey: string | undefined,
  opts: { orgId: string; orgName: string; subject: string; html: string; recipient: ResolvedRecipient; relatedId: string; messageType: string }
): Promise<boolean> {
  const status = resendApiKey ? "pending" : "logged";

  const { error: logError } = await supabase.from("message_log").insert({
    org_id: opts.orgId,
    channel: "email",
    subject: opts.subject,
    body: opts.html,
    sender_user_id: null,
    recipient_email: opts.recipient.email,
    recipient_name: opts.recipient.name,
    recipient_type: opts.recipient.type,
    recipient_id: opts.recipient.id,
    related_id: opts.relatedId,
    message_type: opts.messageType,
    status,
  });

  if (logError) console.error(`Failed to log message:`, logError);

  if (resendApiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${sanitiseFromName(opts.orgName)} <billing@lessonloop.net>`,
        to: [opts.recipient.email],
        subject: opts.subject,
        html: opts.html,
        headers: {
          'List-Unsubscribe': `<${FRONTEND_URL}/portal/settings?tab=notifications>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });

    const result = await response.json();

    await supabase
      .from("message_log")
      .update({
        status: response.ok ? "sent" : "failed",
        sent_at: response.ok ? new Date().toISOString() : null,
        error_message: response.ok ? null : JSON.stringify(result),
      })
      .eq("related_id", opts.relatedId)
      .eq("message_type", opts.messageType)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!response.ok) {
      console.error(`Email send failed for ${opts.recipient.email}:`, result);
      return false;
    }
  }

  return true;
}

// ── INVOICE REMINDER ───────────────────────────────────────

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  total_minor: number;
  paid_minor: number | null;
  currency_code: string;
  due_date: string;
  org_id: string;
  payment_plan_enabled: boolean | null;
  organisation: { name: string; overdue_reminder_days: number[] | null; logo_url: string | null; brand_primary_color: string | null } | null;
  payer_guardian: { id: string; full_name: string; email: string; user_id: string | null } | null;
  payer_student: { id: string; first_name: string; last_name: string; email: string } | null;
}

// deno-lint-ignore no-explicit-any
async function processInvoiceReminder(supabase: any, invoice: OverdueInvoice, today: Date, resendApiKey: string | undefined): Promise<string> {
  const org = invoice.organisation;
  const reminderDays: number[] = org?.overdue_reminder_days || [7, 14, 30];
  const daysOverdue = calcDaysOverdue(invoice.due_date, today);

  // J7-F1: student-payer fallback. Student-payer invoices previously
  // received no overdue reminder when no guardian email was on file.
  const recipient = resolveRecipient(invoice.payer_guardian, invoice.payer_student);
  if (!recipient) return "skip";
  if (!(await checkRecipientNotifEnabled(supabase, invoice.org_id, recipient))) return "skip";

  // J7-F3: tier-based cadence catch-up. Fire the highest eligible
  // tier that hasn't already been sent for this invoice. Handles
  // missed cron days (outage / deploy downtime) without duplicating
  // — exact-day match logic is gone.
  const firingTier = await pickFiringTier(supabase, invoice.id, daysOverdue, reminderDays, "overdue_reminder");
  if (firingTier === null) return "skip";

  const orgName = org?.name || "LessonLoop";
  const brandColor = org?.brand_primary_color || "#2563eb";
  const logoUrl = org?.logo_url || null;
  const remainingMinor = invoice.total_minor - (invoice.paid_minor || 0);
  const amount = formatCurrency(remainingMinor, invoice.currency_code);
  const portalLink = `${FRONTEND_URL}/portal/invoices?invoice=${invoice.id}&action=pay`;
  // Urgency keyed to tier (not daysOverdue) so a tier-7 catch-up on
  // day 9 stays "friendly" rather than flipping tone by accident.
  const urgencyLevel = firingTier >= 30 ? "urgent" : firingTier >= 14 ? "important" : "friendly";

  const subject = urgencyLevel === "urgent"
    ? `⚠️ URGENT: Invoice ${invoice.invoice_number} is ${daysOverdue} days overdue`
    : urgencyLevel === "important"
    ? `Important: Invoice ${invoice.invoice_number} requires attention`
    : `Reminder: Invoice ${invoice.invoice_number} is overdue`;

  const accentColor = urgencyLevel === "urgent" ? "#dc2626" : brandColor;
  const bgColor = urgencyLevel === "urgent" ? "#fef2f2" : "#f5f5f5";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${buildBrandedHeader(orgName, logoUrl, brandColor)}
      <h1 style="color: ${accentColor}; margin-bottom: 20px;">
        Payment ${urgencyLevel === "urgent" ? "Urgently Required" : "Reminder"}
      </h1>
      <p>Dear ${escapeHtml(recipient.name)},</p>
      <p>Invoice <strong>${escapeHtml(invoice.invoice_number)}</strong> is now <strong>${daysOverdue} days overdue</strong>.</p>
      <div style="background: ${bgColor}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${accentColor};">
        <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${escapeHtml(invoice.invoice_number)}</p>
        ${(invoice.paid_minor || 0) > 0
          ? `<p style="margin: 5px 0;"><strong>Total:</strong> ${escapeHtml(formatCurrency(invoice.total_minor, invoice.currency_code))}</p>
        <p style="margin: 5px 0;"><strong>Paid:</strong> ${escapeHtml(formatCurrency(invoice.paid_minor || 0, invoice.currency_code))}</p>
        <p style="margin: 5px 0; font-weight: 600;"><strong>Remaining:</strong> ${escapeHtml(amount)}</p>`
          : `<p style="margin: 5px 0;"><strong>Amount Due:</strong> ${escapeHtml(amount)}</p>`}
        <p style="margin: 5px 0;"><strong>Original Due Date:</strong> ${formatDateGB(invoice.due_date)}</p>
        <p style="margin: 5px 0; color: ${urgencyLevel === "urgent" ? "#dc2626" : "#666"};"><strong>Days Overdue:</strong> ${daysOverdue}</p>
      </div>
      ${urgencyLevel === "urgent"
        ? "<p style='color: #dc2626;'><strong>Please pay this invoice immediately to avoid any disruption to lessons.</strong></p>"
        : "<p>Please settle this invoice at your earliest convenience.</p>"
      }
      <p style="text-align: center;">
        <a href="${portalLink}" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;margin:20px 0;">Pay Now</a>
      </p>
      <p style="font-size: 12px; color: #666;">If you have already made payment, please disregard this email. Payments may take 1-2 business days to process.</p>
      <p>Thank you,<br>${escapeHtml(orgName)}</p>
    </div>`;

  const sent = await logAndSend(supabase, resendApiKey, {
    orgId: invoice.org_id, orgName, subject, html,
    recipient, relatedId: invoice.id, messageType: `overdue_reminder_d${firingTier}`,
  });

  if (sent) {
    console.log(`Sent tier-${firingTier} (${daysOverdue} days actual) reminder for invoice ${invoice.invoice_number} to ${recipient.email}`);
    return "sent";
  }
  return "error";
}

// ── INSTALLMENT REMINDER ───────────────────────────────────

interface OverdueInstallment {
  id: string;
  installment_number: number;
  amount_minor: number;
  due_date: string;
  invoice_id: string;
  invoice: {
    id: string;
    invoice_number: string;
    total_minor: number;
    currency_code: string;
    org_id: string;
    status: string;
    paid_minor: number | null;
    installment_count: number | null;
    organisation: { name: string; overdue_reminder_days: number[] | null; logo_url: string | null; brand_primary_color: string | null } | null;
    payer_guardian: { id: string; full_name: string; email: string; user_id: string | null } | null;
    payer_student: { id: string; first_name: string; last_name: string; email: string } | null;
  };
}

// deno-lint-ignore no-explicit-any
async function processInstallmentReminder(supabase: any, installment: OverdueInstallment, today: Date, resendApiKey: string | undefined): Promise<string> {
  const invoice = installment.invoice;
  const org = invoice.organisation;
  // J7-F1: student-payer fallback (mirrors J6-F8 for installment-upcoming).
  const recipient = resolveRecipient(invoice.payer_guardian, invoice.payer_student);
  if (!recipient) return "skip";
  if (!(await checkRecipientNotifEnabled(supabase, invoice.org_id, recipient))) return "skip";

  const reminderDays: number[] = org?.overdue_reminder_days || [7, 14, 30];
  const daysOverdue = calcDaysOverdue(installment.due_date, today);

  // J7-F3: tier-based cadence catch-up, same gate as invoice path.
  // Installment copy stays tone-neutral (F12 filed — urgency tiers
  // not applied to plan-installment reminders this journey).
  const firingTier = await pickFiringTier(supabase, installment.id, daysOverdue, reminderDays, "installment_reminder");
  if (firingTier === null) return "skip";

  const orgName = org?.name || "LessonLoop";
  const brandColor = org?.brand_primary_color || "#2563eb";
  const logoUrl = org?.logo_url || null;

  // Outstanding on this installment = amount_minor minus net prior payments
  // (after refunds). For fully-pending installments this equals amount_minor;
  // for partially_paid it's the remainder. Reminder always shows the real
  // outstanding to avoid the pre-A3 contradiction where a parent who paid £30
  // of £50 still received "£50 overdue" emails.
  const { data: priorPayments } = await supabase
    .from("payments")
    .select("id, amount_minor")
    .eq("installment_id", installment.id);
  const priorIds = (priorPayments || []).map((p: { id: string }) => p.id);
  let priorRefunded = 0;
  if (priorIds.length > 0) {
    const { data: priorRefundRows } = await supabase
      .from("refunds")
      .select("amount_minor")
      .in("payment_id", priorIds)
      .eq("status", "succeeded");
    priorRefunded = (priorRefundRows || []).reduce((s: number, r: { amount_minor: number }) => s + r.amount_minor, 0);
  }
  const priorApplied = (priorPayments || []).reduce((s: number, p: { amount_minor: number }) => s + p.amount_minor, 0) - priorRefunded;
  const outstandingMinor = Math.max(0, installment.amount_minor - priorApplied);
  if (outstandingMinor <= 0) return "skip";
  const outstandingLabel = formatCurrency(outstandingMinor, invoice.currency_code);
  const isPartial = priorApplied > 0;
  const amountLineLabel = isPartial ? "Outstanding on this installment" : "Installment amount";
  const paidSoFarLine = isPartial
    ? `<p style="margin: 5px 0;"><strong>Already paid on this installment:</strong> ${escapeHtml(formatCurrency(priorApplied, invoice.currency_code))}</p>`
    : "";
  const totalRemaining = formatCurrency((invoice.total_minor - (invoice.paid_minor || 0)), invoice.currency_code);

  const subject = `Payment reminder: Installment ${installment.installment_number} of ${invoice.installment_count} — ${invoice.invoice_number}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${buildBrandedHeader(orgName, logoUrl, brandColor)}
      <h1 style="color: #333;">Payment Plan Reminder</h1>
      <p>Dear ${escapeHtml(recipient.name)},</p>
      <p>Installment <strong>${installment.installment_number} of ${invoice.installment_count}</strong>
         for invoice <strong>${escapeHtml(invoice.invoice_number)}</strong>
         is now <strong>${daysOverdue} days overdue</strong>.</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${brandColor};">
        <p style="margin: 5px 0;"><strong>${amountLineLabel}:</strong> ${escapeHtml(outstandingLabel)}</p>
        ${paidSoFarLine}
        <p style="margin: 5px 0;"><strong>Due date:</strong> ${formatDateGB(installment.due_date)}</p>
        <p style="margin: 5px 0;"><strong>Remaining balance on invoice:</strong> ${escapeHtml(totalRemaining)}</p>
      </div>
      <p style="text-align: center;">
        <a href="${FRONTEND_URL}/portal/invoices?invoice=${invoice.id}&installment=${installment.id}&action=pay"
           style="display:inline-block;background-color:${brandColor};color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">
          Pay Now
        </a>
      </p>
      <p style="font-size:12px;color:#666;">If you have already made this payment, please disregard this email.</p>
      <p>Thank you,<br>${escapeHtml(orgName)}</p>
    </div>`;

  const sent = await logAndSend(supabase, resendApiKey, {
    orgId: invoice.org_id, orgName, subject, html,
    recipient, relatedId: installment.id, messageType: `installment_reminder_d${firingTier}`,
  });

  if (sent) {
    console.log(`Sent tier-${firingTier} (${daysOverdue} days actual) installment reminder (#${installment.installment_number}) for ${invoice.invoice_number} to ${recipient.email}`);
    return "sent";
  }
  return "error";
}
