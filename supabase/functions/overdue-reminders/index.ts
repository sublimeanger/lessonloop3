import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml } from "../_shared/escape-html.ts";
import { isNotificationEnabled } from "../_shared/check-notification-pref.ts";
import { validateCronAuth } from "../_shared/cron-auth.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://lessonloop.net";

serve(async (req) => {
  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let remindersSent = 0;
    const errors: string[] = [];

    // ── STANDARD INVOICE REMINDERS ─────────────────────────────
    console.log("Starting overdue invoice reminder check...");

    const { data: overdueInvoices, error: invoicesError } = await supabase
      .from("invoices")
      .select(`
        id, invoice_number, total_minor, currency_code, due_date, org_id, payment_plan_enabled,
        organisation:organisations!inner(name, overdue_reminder_days),
        payer_guardian:guardians(id, full_name, email, user_id),
        payer_student:students(id, first_name, last_name)
      `)
      .eq("status", "overdue");

    if (invoicesError) {
      throw new Error(`Failed to fetch overdue invoices: ${invoicesError.message}`);
    }

    for (const invoice of overdueInvoices || []) {
      try {
        // Skip invoices with active payment plans — they get installment-level reminders
        if ((invoice as any).payment_plan_enabled) continue;

        const result = await processInvoiceReminder(supabase, invoice, today, resendApiKey);
        if (result === "sent") remindersSent++;
      } catch (err: any) {
        errors.push(`Invoice ${(invoice as any).invoice_number}: ${err.message}`);
      }
    }

    // ── INSTALLMENT REMINDERS ──────────────────────────────────
    console.log("Starting overdue installment reminder check...");

    const { data: overdueInstallments, error: installError } = await supabase
      .from("invoice_installments")
      .select(`
        id, installment_number, amount_minor, due_date, invoice_id,
        invoice:invoices!inner (
          id, invoice_number, total_minor, currency_code, org_id, status,
          paid_minor, installment_count,
          organisation:organisations!inner(name, overdue_reminder_days),
          payer_guardian:guardians(id, full_name, email, user_id)
        )
      `)
      .eq("status", "overdue")
      .not("invoice.status", "in", "(void,paid)");

    if (installError) {
      console.error("Failed to fetch overdue installments:", installError.message);
    }

    for (const installment of overdueInstallments || []) {
      try {
        const result = await processInstallmentReminder(supabase, installment, today, resendApiKey);
        if (result === "sent") remindersSent++;
      } catch (err: any) {
        errors.push(`Installment ${(installment as any).id}: ${err.message}`);
      }
    }

    console.log(`Overdue reminder job complete. Sent: ${remindersSent}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({ success: true, sent: remindersSent, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Overdue reminders error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
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

async function shouldSkipGuardian(
  supabase: any, orgId: string, guardian: any, relatedId: string, messageType: string, today: Date
): Promise<boolean> {
  if (!guardian?.email) return true;

  // Check notification prefs
  if (guardian.user_id) {
    const enabled = await isNotificationEnabled(supabase, orgId, guardian.user_id, "email_invoice_reminders");
    if (!enabled) {
      console.log(`Guardian ${guardian.email} has invoice reminders disabled, skipping`);
      return true;
    }
  }

  // Deduplicate — already sent today?
  const { data: existing } = await supabase
    .from("message_log")
    .select("id")
    .eq("related_id", relatedId)
    .eq("message_type", messageType)
    .gte("created_at", today.toISOString())
    .limit(1);

  if (existing && existing.length > 0) return true;
  return false;
}

async function logAndSend(
  supabase: any, resendApiKey: string | undefined,
  opts: { orgId: string; orgName: string; subject: string; html: string; recipientEmail: string; recipientName: string; guardianId: string; relatedId: string; messageType: string }
): Promise<boolean> {
  const status = resendApiKey ? "pending" : "logged";

  const { error: logError } = await supabase.from("message_log").insert({
    org_id: opts.orgId,
    channel: "email",
    subject: opts.subject,
    body: opts.html,
    sender_user_id: null,
    recipient_email: opts.recipientEmail,
    recipient_name: opts.recipientName,
    recipient_type: "guardian",
    recipient_id: opts.guardianId,
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
        from: `${opts.orgName} <billing@lessonloop.net>`,
        to: [opts.recipientEmail],
        subject: opts.subject,
        html: opts.html,
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
      console.error(`Email send failed for ${opts.recipientEmail}:`, result);
      return false;
    }
  }

  return true;
}

// ── INVOICE REMINDER ───────────────────────────────────────

async function processInvoiceReminder(supabase: any, invoice: any, today: Date, resendApiKey: string | undefined): Promise<string> {
  const org = invoice.organisation;
  const reminderDays: number[] = org?.overdue_reminder_days || [7, 14, 30];
  const daysOverdue = calcDaysOverdue(invoice.due_date, today);

  if (!reminderDays.includes(daysOverdue)) return "skip";

  const guardian = invoice.payer_guardian;
  if (await shouldSkipGuardian(supabase, invoice.org_id, guardian, invoice.id, "overdue_reminder", today)) return "skip";

  const orgName = org?.name || "LessonLoop";
  const amount = formatCurrency(invoice.total_minor, invoice.currency_code);
  const portalLink = `${FRONTEND_URL}/portal/invoices?invoice=${invoice.id}`;
  const urgencyLevel = daysOverdue >= 30 ? "urgent" : daysOverdue >= 14 ? "important" : "friendly";

  const subject = urgencyLevel === "urgent"
    ? `⚠️ URGENT: Invoice ${invoice.invoice_number} is ${daysOverdue} days overdue`
    : urgencyLevel === "important"
    ? `Important: Invoice ${invoice.invoice_number} requires attention`
    : `Reminder: Invoice ${invoice.invoice_number} is overdue`;

  const accentColor = urgencyLevel === "urgent" ? "#dc2626" : "#2563eb";
  const bgColor = urgencyLevel === "urgent" ? "#fef2f2" : "#f5f5f5";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: ${accentColor}; margin-bottom: 20px;">
        Payment ${urgencyLevel === "urgent" ? "Urgently Required" : "Reminder"}
      </h1>
      <p>Dear ${escapeHtml(guardian.full_name)},</p>
      <p>Invoice <strong>${escapeHtml(invoice.invoice_number)}</strong> is now <strong>${daysOverdue} days overdue</strong>.</p>
      <div style="background: ${bgColor}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${accentColor};">
        <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${escapeHtml(invoice.invoice_number)}</p>
        <p style="margin: 5px 0;"><strong>Amount Due:</strong> ${escapeHtml(amount)}</p>
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
    recipientEmail: guardian.email, recipientName: guardian.full_name,
    guardianId: guardian.id, relatedId: invoice.id, messageType: "overdue_reminder",
  });

  if (sent) {
    console.log(`Sent ${daysOverdue}-day reminder for invoice ${invoice.invoice_number} to ${guardian.email}`);
    return "sent";
  }
  return "error";
}

// ── INSTALLMENT REMINDER ───────────────────────────────────

async function processInstallmentReminder(supabase: any, installment: any, today: Date, resendApiKey: string | undefined): Promise<string> {
  const invoice = installment.invoice;
  const org = invoice.organisation;
  const guardian = invoice.payer_guardian;
  const reminderDays: number[] = org?.overdue_reminder_days || [7, 14, 30];
  const daysOverdue = calcDaysOverdue(installment.due_date, today);

  if (!reminderDays.includes(daysOverdue)) return "skip";
  if (await shouldSkipGuardian(supabase, invoice.org_id, guardian, installment.id, "installment_reminder", today)) return "skip";

  const orgName = org?.name || "LessonLoop";
  const installmentAmount = formatCurrency(installment.amount_minor, invoice.currency_code);
  const totalRemaining = formatCurrency((invoice.total_minor - (invoice.paid_minor || 0)), invoice.currency_code);

  const subject = `Payment reminder: Installment ${installment.installment_number} of ${invoice.installment_count} — ${invoice.invoice_number}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Payment Plan Reminder</h1>
      <p>Dear ${escapeHtml(guardian.full_name)},</p>
      <p>Installment <strong>${installment.installment_number} of ${invoice.installment_count}</strong>
         for invoice <strong>${escapeHtml(invoice.invoice_number)}</strong>
         is now <strong>${daysOverdue} days overdue</strong>.</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <p style="margin: 5px 0;"><strong>Installment amount:</strong> ${escapeHtml(installmentAmount)}</p>
        <p style="margin: 5px 0;"><strong>Due date:</strong> ${formatDateGB(installment.due_date)}</p>
        <p style="margin: 5px 0;"><strong>Remaining balance:</strong> ${escapeHtml(totalRemaining)}</p>
      </div>
      <p style="text-align: center;">
        <a href="${FRONTEND_URL}/portal/invoices?invoice=${invoice.id}"
           style="display:inline-block;background-color:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">
          Pay Now
        </a>
      </p>
      <p style="font-size:12px;color:#666;">If you have already made this payment, please disregard this email.</p>
      <p>Thank you,<br>${escapeHtml(orgName)}</p>
    </div>`;

  const sent = await logAndSend(supabase, resendApiKey, {
    orgId: invoice.org_id, orgName, subject, html,
    recipientEmail: guardian.email, recipientName: guardian.full_name,
    guardianId: guardian.id, relatedId: installment.id, messageType: "installment_reminder",
  });

  if (sent) {
    console.log(`Sent ${daysOverdue}-day installment reminder (#${installment.installment_number}) for ${invoice.invoice_number} to ${guardian.email}`);
    return "sent";
  }
  return "error";
}
