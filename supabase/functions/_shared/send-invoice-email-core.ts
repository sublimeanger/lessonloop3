// Shared core for invoice-email sends. Invoked by both the user-JWT
// wrapper (supabase/functions/send-invoice-email) and the service-role
// wrapper (supabase/functions/send-invoice-email-internal). Each wrapper
// handles its own auth surface then delegates here.
//
// Contract: the wrapper supplies an `authorize` callback that gates on
// the invoice row. Core calls authorize() after fetching the invoice
// and before any rendering or message_log work. A `false` result
// becomes a 403.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, sanitiseFromName } from "./escape-html.ts";

// ─── Types ─────────────────────────────────────────────────────────

export type SendInvoiceSource =
  | "user_manual"
  | "recurring_scheduler"
  | "recurring_manual_run"
  | "parent_portal";

export interface InvoiceRow {
  id: string;
  org_id: string;
  invoice_number: string;
  status: string;
  total_minor: number;
  due_date: string;
  currency_code: string;
  paid_minor: number | null;
  payment_plan_enabled: boolean | null;
  installment_count: number | null;
  payer_guardian:
    | { id: string; full_name: string; email: string }
    | Array<{ id: string; full_name: string; email: string }>
    | null;
  payer_student:
    | { id: string; first_name: string; last_name: string; email: string }
    | Array<{ id: string; first_name: string; last_name: string; email: string }>
    | null;
}

export interface SendInvoiceCoreInput {
  supabaseService: SupabaseClient;
  corsHeaders: Record<string, string>;
  invoiceId: string;
  isReminder?: boolean;
  customMessage?: string;
  preview?: boolean;
  senderUserId: string | null;
  source: SendInvoiceSource;
  skipDebounce?: boolean;
  // Wrapper-supplied auth gate. Invoked AFTER invoice fetch, BEFORE
  // render. Core aborts with 403 if the promise resolves false.
  authorize: (invoice: InvoiceRow) => Promise<boolean>;
  // Frontend URL used in portal links. Defaults to
  // https://app.lessonloop.net when undefined.
  frontendUrl?: string;
}

export interface SendInvoiceCoreResult {
  response: Response;
}

interface InstallmentRow {
  id: string;
  installment_number: number;
  amount_minor: number;
  due_date: string;
  status: string;
}

interface OrgRow {
  name: string | null;
  online_payments_enabled: boolean | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  bank_reference_prefix: string | null;
  logo_url: string | null;
  brand_primary_color: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────

/** Format minor units (pence) to major units with 2 decimal places. */
export function formatMinorAmount(amountMinor: number, currencyCode: string): string {
  const major = amountMinor / 100;
  const symbol =
    currencyCode === "GBP" ? "£" :
    currencyCode === "USD" ? "$" :
    currencyCode === "EUR" ? "€" :
    `${currencyCode} `;
  return `${symbol}${major.toFixed(2)}`;
}

/** Format a date string (YYYY-MM-DD) as DD/MM/YYYY. */
export function formatDateUK(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** Send email via Resend with 3x retry and exponential backoff. */
export async function sendWithRetry(
  resendApiKey: string,
  payload: { from: string; to: string[]; subject: string; html: string },
): Promise<{ ok: boolean; result: unknown }> {
  const maxAttempts = 3;
  const baseDelayMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        return { ok: true, result };
      }

      if (response.status >= 400 && response.status < 500) {
        console.error(`[send-invoice-email-core] Resend returned ${response.status}, not retrying:`, result);
        return { ok: false, result };
      }

      console.warn(`[send-invoice-email-core] Resend attempt ${attempt}/${maxAttempts} failed (${response.status}):`, result);
    } catch (err) {
      console.warn(`[send-invoice-email-core] Resend attempt ${attempt}/${maxAttempts} threw:`, err);
    }

    if (attempt < maxAttempts) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return { ok: false, result: { error: "All retry attempts failed" } };
}

function firstOrSingle<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// ─── Template render ───────────────────────────────────────────────

export async function buildInvoiceEmailHtml(args: {
  supabaseService: SupabaseClient;
  invoice: InvoiceRow;
  isReminder: boolean;
  customMessage?: string;
  frontendUrl: string;
}): Promise<{
  htmlContent: string;
  subject: string;
  recipientEmail: string;
  recipientName: string;
  recipientType: "guardian" | "student" | null;
  recipientId: string | null;
  orgName: string;
}> {
  const { supabaseService, invoice, isReminder, customMessage, frontendUrl } = args;

  const payer = firstOrSingle(invoice.payer_guardian);
  const payerStudent = firstOrSingle(invoice.payer_student);

  const recipientEmail = payer?.email || payerStudent?.email || "";
  const recipientName = payer?.full_name ||
    (payerStudent ? `${payerStudent.first_name} ${payerStudent.last_name}`.trim() : "Customer");
  const recipientType: "guardian" | "student" | null =
    payer ? "guardian" : payerStudent ? "student" : null;
  const recipientId = payer?.id || payerStudent?.id || null;

  const invoiceNumber = invoice.invoice_number;
  const outstandingMinor = invoice.total_minor - (invoice.paid_minor || 0);
  const amount = formatMinorAmount(outstandingMinor, invoice.currency_code);
  const dueDate = formatDateUK(invoice.due_date);

  let installments: InstallmentRow[] = [];
  if (invoice.payment_plan_enabled) {
    const { data: instData } = await supabaseService
      .from("invoice_installments")
      .select("id, installment_number, amount_minor, due_date, status")
      .eq("invoice_id", invoice.id)
      .order("installment_number", { ascending: true });
    installments = (instData as InstallmentRow[] | null) || [];
  }

  const { data: orgData } = await supabaseService
    .from("organisations")
    .select("name, online_payments_enabled, bank_account_name, bank_sort_code, bank_account_number, bank_reference_prefix, logo_url, brand_primary_color")
    .eq("id", invoice.org_id)
    .single();
  const org = orgData as OrgRow | null;

  const orgName = org?.name || "Your Academy";
  const onlinePaymentsEnabled = org?.online_payments_enabled !== false;
  const brandColor = org?.brand_primary_color || "#2563eb";
  const logoUrl = org?.logo_url || null;
  const hasBankDetails = !!(org?.bank_account_name && org?.bank_sort_code && org?.bank_account_number);
  const bankRef = org?.bank_reference_prefix
    ? `${org.bank_reference_prefix}-${invoiceNumber}`
    : invoiceNumber;

  const firstUnpaidInstallment = installments.find((i) => i.status === "pending" || i.status === "overdue");
  const portalLink = firstUnpaidInstallment
    ? `${frontendUrl}/portal/invoices?invoice=${invoice.id}&installment=${firstUnpaidInstallment.id}&action=pay`
    : `${frontendUrl}/portal/invoices?invoice=${invoice.id}&action=pay`;

  const subject = isReminder
    ? `Payment Reminder: Invoice ${invoiceNumber}`
    : `Invoice ${invoiceNumber} from ${orgName}`;

  const buttonStyle = `
    display: inline-block;
    background-color: ${brandColor};
    color: #ffffff;
    padding: 12px 24px;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    margin: 20px 0;
  `.replace(/\s+/g, " ").trim();

  const bankDetailsHtml = hasBankDetails
    ? `
    <div style="background: #f0f9ff; padding: 16px 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bae6fd;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #0c4a6e;">Bank Transfer Details</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Account Name:</strong> ${escapeHtml(org!.bank_account_name!)}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Sort Code:</strong> ${escapeHtml(org!.bank_sort_code!)}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Account Number:</strong> ${escapeHtml(org!.bank_account_number!)}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Reference:</strong> ${escapeHtml(bankRef)}</p>
    </div>`
    : "";

  const ctaLabel = installments.length > 0 && firstUnpaidInstallment
    ? "View Invoice & Pay First Installment"
    : "View & Pay Invoice";
  const ctaSubtext = installments.length > 0 && firstUnpaidInstallment
    ? `Click the button above to view your invoice and pay installment ${firstUnpaidInstallment.installment_number} (${formatMinorAmount(firstUnpaidInstallment.amount_minor, invoice.currency_code)}) securely online.`
    : "Click the button above to view your invoice and make a payment securely online.";
  const payOnlineCta = onlinePaymentsEnabled
    ? `
    <p style="text-align: center;">
      <a href="${portalLink}" style="${buttonStyle}">${ctaLabel}</a>
    </p>
    <p style="font-size: 12px; color: #666;">
      ${ctaSubtext}
    </p>`
    : "";

  const bankTransferCta = hasBankDetails && !onlinePaymentsEnabled ? bankDetailsHtml : "";
  const secondaryBankDetails = hasBankDetails && onlinePaymentsEnabled
    ? `
    <p style="font-size: 13px; color: #666; margin-top: 12px; text-align: center;">Or pay by bank transfer:</p>
    ${bankDetailsHtml}`
    : "";

  const installmentScheduleHtml = installments.length > 0
    ? `
    <p style="margin: 12px 0 8px; font-weight: 600;">Payment plan: ${installments.length} installments</p>
    ${firstUnpaidInstallment ? `<p style="margin: 4px 0 12px; font-size: 16px; color: ${brandColor}; font-weight: 600;">Next payment due: ${formatMinorAmount(firstUnpaidInstallment.amount_minor, invoice.currency_code)} on ${formatDateUK(firstUnpaidInstallment.due_date)}</p>` : ""}
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="border-bottom: 2px solid #ddd;">
          <th style="text-align: left; padding: 6px 8px;">Installment</th>
          <th style="text-align: left; padding: 6px 8px;">Amount</th>
          <th style="text-align: left; padding: 6px 8px;">Due Date</th>
          <th style="text-align: left; padding: 6px 8px;">Status</th>
          <th style="text-align: left; padding: 6px 8px;">Pay Link</th>
        </tr>
      </thead>
      <tbody>
        ${installments.map((inst) => {
          const instAmount = formatMinorAmount(inst.amount_minor, invoice.currency_code);
          const instDue = formatDateUK(inst.due_date);
          const statusLabel = inst.status === "paid" ? "Paid" : inst.status === "overdue" ? "Overdue" : inst.status === "void" ? "Voided" : "Pending";
          const statusColor = inst.status === "paid" ? "#16a34a" : inst.status === "overdue" ? "#dc2626" : "#666";
          const isUnpaid = inst.status === "pending" || inst.status === "overdue";
          const payLink = isUnpaid && onlinePaymentsEnabled
            ? `<a href="${frontendUrl}/portal/invoices?invoice=${invoice.id}&installment=${inst.id}&action=pay" style="color: ${brandColor}; font-weight: 600; text-decoration: none;">Pay Now</a>`
            : inst.status === "paid" ? '<span style="color: #16a34a;">&#10003;</span>' : "—";
          return `<tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 8px;">Installment ${inst.installment_number}</td>
            <td style="padding: 6px 8px;">${escapeHtml(instAmount)}</td>
            <td style="padding: 6px 8px;">${escapeHtml(instDue)}</td>
            <td style="padding: 6px 8px; color: ${statusColor};">${statusLabel}</td>
            <td style="padding: 6px 8px;">${payLink}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`
    : "";

  const invoiceDetailsBlock = installments.length > 0
    ? `
    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${escapeHtml(invoiceNumber)}</p>
      <p style="margin: 5px 0;"><strong>Total:</strong> ${escapeHtml(formatMinorAmount(invoice.total_minor, invoice.currency_code))}</p>
      ${installmentScheduleHtml}
    </div>`
    : `
    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${escapeHtml(invoiceNumber)}</p>
      ${(invoice.paid_minor || 0) > 0
        ? `<p style="margin: 5px 0;"><strong>Total:</strong> ${escapeHtml(formatMinorAmount(invoice.total_minor, invoice.currency_code))}</p>
      <p style="margin: 5px 0;"><strong>Paid:</strong> ${escapeHtml(formatMinorAmount(invoice.paid_minor || 0, invoice.currency_code))}</p>
      <p style="margin: 5px 0; font-weight: 600;"><strong>Remaining:</strong> ${escapeHtml(amount)}</p>`
        : `<p style="margin: 5px 0;"><strong>Amount Due:</strong> ${escapeHtml(amount)}</p>`}
      <p style="margin: 5px 0;"><strong>Due Date:</strong> ${escapeHtml(dueDate)}</p>
    </div>`;

  const brandedHeader = logoUrl
    ? `<div style="border-bottom: 3px solid ${brandColor}; padding-bottom: 16px; margin-bottom: 20px;">
        <img src="${logoUrl}" alt="${escapeHtml(orgName)}" style="max-height: 60px;" />
      </div>`
    : `<div style="border-bottom: 3px solid ${brandColor}; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: ${brandColor};">${escapeHtml(orgName)}</h2>
      </div>`;

  const htmlContent = isReminder
    ? `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${brandedHeader}
        <h1 style="color: #333; margin-bottom: 20px;">Payment Reminder</h1>
        <p>Dear ${escapeHtml(recipientName)},</p>
        <p>This is a friendly reminder that payment for the following invoice is due:</p>
        ${invoiceDetailsBlock}
        ${customMessage ? `<p>${escapeHtml(customMessage)}</p>` : ""}
        ${payOnlineCta}
        ${bankTransferCta}
        ${secondaryBankDetails}
        <p>Thank you,<br>${escapeHtml(orgName)}</p>
      </div>`
    : `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${brandedHeader}
        <h1 style="color: #333; margin-bottom: 20px;">Invoice ${escapeHtml(invoiceNumber)}</h1>
        <p>Dear ${escapeHtml(recipientName)},</p>
        <p>Please find below the details of your invoice:</p>
        ${invoiceDetailsBlock}
        ${customMessage ? `<p>${escapeHtml(customMessage)}</p>` : ""}
        ${payOnlineCta}
        ${bankTransferCta}
        ${secondaryBankDetails}
        <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
        <p>Thank you for your business,<br>${escapeHtml(orgName)}</p>
      </div>`;

  return {
    htmlContent,
    subject,
    recipientEmail,
    recipientName,
    recipientType,
    recipientId,
    orgName,
  };
}

// ─── Public entry ──────────────────────────────────────────────────

const DEFAULT_FRONTEND_URL = "https://app.lessonloop.net";

export async function sendInvoiceEmailCore(
  input: SendInvoiceCoreInput,
): Promise<SendInvoiceCoreResult> {
  const {
    supabaseService,
    corsHeaders,
    invoiceId,
    isReminder = false,
    customMessage,
    preview = false,
    senderUserId,
    source,
    skipDebounce = false,
    authorize,
  } = input;
  const frontendUrl = input.frontendUrl ?? Deno.env.get("FRONTEND_URL") ?? DEFAULT_FRONTEND_URL;

  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // ── Fetch invoice ────────────────────────────────────────────────
  const { data: invoiceData, error: invoiceError } = await supabaseService
    .from("invoices")
    .select(`
      id, org_id, invoice_number, status, total_minor, due_date,
      currency_code, paid_minor, payment_plan_enabled, installment_count,
      payer_guardian:guardians!payer_guardian_id(id, full_name, email),
      payer_student:students!payer_student_id(id, first_name, last_name, email)
    `)
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoiceData) {
    return { response: json(404, { error: "Invoice not found" }) };
  }

  const invoice = invoiceData as unknown as InvoiceRow;

  // ── Wrapper-supplied auth gate ───────────────────────────────────
  const authorised = await authorize(invoice);
  if (!authorised) {
    return { response: json(403, { error: "Not authorized" }) };
  }

  // ── Status guard ─────────────────────────────────────────────────
  if (invoice.status === "paid" || invoice.status === "void") {
    return {
      response: json(400, { error: `Cannot send a ${invoice.status} invoice` }),
    };
  }

  // ── 5-minute idempotency debounce ────────────────────────────────
  const debounceWindowMs = 5 * 60 * 1000;
  const debounceCutoff = new Date(Date.now() - debounceWindowMs).toISOString();
  const expectedMessageType = isReminder ? "invoice_reminder" : "invoice";

  let recentSendInfo: { sentWithinDebounce: boolean; secondsAgo?: number; humanAgo?: string } = {
    sentWithinDebounce: false,
  };

  if (!skipDebounce) {
    const { data: recentSends, error: debounceError } = await supabaseService
      .from("message_log")
      .select("id, created_at, status")
      .eq("org_id", invoice.org_id)
      .eq("related_id", invoiceId)
      .eq("message_type", expectedMessageType)
      .eq("status", "sent")
      .gte("created_at", debounceCutoff)
      .limit(1);

    if (debounceError) {
      console.warn("[send-invoice-email-core] Idempotency check failed, proceeding:", debounceError.message);
    } else if (recentSends && recentSends.length > 0) {
      const lastSent = new Date(recentSends[0].created_at);
      const secondsAgo = Math.floor((Date.now() - lastSent.getTime()) / 1000);
      const minutesAgo = Math.floor(secondsAgo / 60);
      const humanAgo = minutesAgo > 0 ? `${minutesAgo} minute${minutesAgo === 1 ? "" : "s"} ago` : `${secondsAgo} seconds ago`;
      recentSendInfo = { sentWithinDebounce: true, secondsAgo, humanAgo };

      if (!preview) {
        return {
          response: json(409, {
            error: `This ${isReminder ? "reminder" : "invoice"} was already sent ${humanAgo}. Please wait a few minutes before resending.`,
            already_sent: true,
          }),
        };
      }
    }
  }

  // ── Template render ──────────────────────────────────────────────
  const {
    htmlContent,
    subject,
    recipientEmail,
    recipientName,
    recipientType,
    recipientId,
    orgName,
  } = await buildInvoiceEmailHtml({
    supabaseService,
    invoice,
    isReminder,
    customMessage,
    frontendUrl,
  });

  if (!recipientEmail) {
    return {
      response: json(400, { error: "No email address found for the invoice payer" }),
    };
  }

  // ── Preview short-circuit (before message_log insert) ────────────
  if (preview) {
    return {
      response: json(200, {
        preview: true,
        html: htmlContent,
        subject,
        recipientEmail,
        recipientName,
        recentSendInfo,
      }),
    };
  }

  // ── message_log insert ───────────────────────────────────────────
  let logEntryId: string | null = null;
  const { data: logEntry, error: logError } = await supabaseService
    .from("message_log")
    .insert({
      org_id: invoice.org_id,
      channel: "email",
      subject,
      body: htmlContent,
      sender_user_id: senderUserId,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      recipient_type: recipientType,
      recipient_id: recipientId,
      related_id: invoiceId,
      message_type: expectedMessageType,
      status: "pending",
      source,
    })
    .select("id")
    .single();

  if (logError) {
    console.warn("[send-invoice-email-core] message_log insert failed:", logError.message);
  } else {
    logEntryId = logEntry.id;
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    if (logEntryId) {
      await supabaseService.from("message_log").update({ status: "logged" }).eq("id", logEntryId);
    }
    console.log("Email logged (RESEND_API_KEY not configured):", { to: recipientEmail, subject });
    return {
      response: json(200, { success: true, message: "Email logged (Resend not configured)" }),
    };
  }

  // ── Resend send with retry ───────────────────────────────────────
  const { ok: emailSent, result } = await sendWithRetry(resendApiKey, {
    from: `${sanitiseFromName(orgName)} <billing@lessonloop.net>`,
    to: [recipientEmail],
    subject,
    html: htmlContent,
  });

  if (logEntryId) {
    await supabaseService
      .from("message_log")
      .update({
        status: emailSent ? "sent" : "failed",
        sent_at: emailSent ? new Date().toISOString() : null,
        error_message: emailSent ? null : JSON.stringify(result),
      })
      .eq("id", logEntryId);
  }

  if (!emailSent) {
    console.error("[send-invoice-email-core] All retry attempts failed:", result);
    return {
      response: json(502, {
        error: "Failed to send email after 3 attempts. Please try again.",
      }),
    };
  }

  // ── Invoice status transition draft → sent ───────────────────────
  if (invoice.status === "draft") {
    const { error: statusError } = await supabaseService
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", invoiceId)
      .eq("status", "draft");

    if (statusError) {
      console.warn("[send-invoice-email-core] Failed to update invoice status to sent:", statusError.message);
    }
  }

  return { response: json(200, result) };
}
