import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { escapeHtml } from "../_shared/escape-html.ts";

// Get frontend URL from environment or use default
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

interface InvoiceEmailRequest {
  invoiceId: string;
  isReminder: boolean;
  customMessage?: string;
}

/** Format minor units (pence) to major units with 2 decimal places */
function formatMinorAmount(amountMinor: number, currencyCode: string): string {
  const major = amountMinor / 100;
  const symbol = currencyCode === "GBP" ? "£" : currencyCode === "USD" ? "$" : currencyCode === "EUR" ? "€" : `${currencyCode} `;
  return `${symbol}${major.toFixed(2)}`;
}

/** Format a date string (YYYY-MM-DD) as DD/MM/YYYY */
function formatDateUK(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** Send email via Resend with 3x retry and exponential backoff */
async function sendWithRetry(
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

      // Don't retry on 4xx client errors (bad request, auth, etc.)
      if (response.status >= 400 && response.status < 500) {
        console.error(`[send-invoice-email] Resend returned ${response.status}, not retrying:`, result);
        return { ok: false, result };
      }

      // 5xx — retry
      console.warn(`[send-invoice-email] Resend attempt ${attempt}/${maxAttempts} failed (${response.status}):`, result);
    } catch (err) {
      console.warn(`[send-invoice-email] Resend attempt ${attempt}/${maxAttempts} threw:`, err);
    }

    if (attempt < maxAttempts) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return { ok: false, result: { error: "All retry attempts failed" } };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(user.id, "send-invoice-email");
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult);
    }

    const { invoiceId, isReminder, customMessage }: InvoiceEmailRequest = await req.json();

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoiceId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // ── INV-H2 FIX: Fetch invoice from DB (server-side source of truth) ──
    const { data: invoice, error: invoiceError } = await supabaseService
      .from("invoices")
      .select(`
        id, org_id, invoice_number, status, total_minor, due_date,
        currency_code, paid_minor, payment_plan_enabled, installment_count,
        payer_guardian:guardians!payer_guardian_id(full_name, email),
        payer_student:students!payer_student_id(first_name, last_name, email)
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── INV-H1 FIX: Verify caller belongs to the invoice's org ──
    const { data: membership } = await supabaseService
      .from("org_memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("org_id", invoice.org_id)
      .eq("status", "active")
      .in("role", ["owner", "admin", "finance"])
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── INV-H2 FIX: Status guard — don't send paid or voided invoices ──
    if (invoice.status === "paid" || invoice.status === "void") {
      return new Response(
        JSON.stringify({ error: `Cannot send a ${invoice.status} invoice` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Derive all email fields from DB data (not client-supplied) ──
    const orgId = invoice.org_id;

    // Resolve recipient from DB
    const payerRaw = invoice.payer_guardian as unknown;
    const payer = (Array.isArray(payerRaw) ? payerRaw[0] : payerRaw) as { full_name: string; email: string } | null;
    const payerStudentRaw = invoice.payer_student as unknown;
    const payerStudent = (Array.isArray(payerStudentRaw) ? payerStudentRaw[0] : payerStudentRaw) as { first_name: string; last_name: string; email: string } | null;

    const recipientEmail = payer?.email || payerStudent?.email || null;
    const recipientName = payer?.full_name ||
      (payerStudent ? `${payerStudent.first_name} ${payerStudent.last_name}`.trim() : "Customer");

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "No email address found for the invoice payer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const invoiceNumber = invoice.invoice_number;
    const outstandingMinor = invoice.total_minor - (invoice.paid_minor || 0);
    const amount = formatMinorAmount(outstandingMinor, invoice.currency_code);
    const dueDate = formatDateUK(invoice.due_date);

    // Fetch installments if payment plan is enabled
    let installments: any[] = [];
    if (invoice.payment_plan_enabled) {
      const { data: instData } = await supabaseService
        .from("invoice_installments")
        .select("id, installment_number, amount_minor, due_date, status")
        .eq("invoice_id", invoiceId)
        .order("installment_number", { ascending: true });
      installments = instData || [];
    }

    // Fetch org details (name + payment preferences)
    const { data: org } = await supabaseService
      .from("organisations")
      .select("name, online_payments_enabled, bank_account_name, bank_sort_code, bank_account_number, bank_reference_prefix")
      .eq("id", orgId)
      .single();

    const orgName = org?.name || "Your Academy";
    const onlinePaymentsEnabled = org?.online_payments_enabled !== false;
    const hasBankDetails = !!(org?.bank_account_name && org?.bank_sort_code && org?.bank_account_number);
    const bankRef = org?.bank_reference_prefix
      ? `${org.bank_reference_prefix}-${invoiceNumber}`
      : invoiceNumber;

    // Build the portal link — for payment plans, link to first unpaid installment
    const firstUnpaidInstallment = installments.find((i: any) => i.status === "pending" || i.status === "overdue");
    const portalLink = firstUnpaidInstallment
      ? `${FRONTEND_URL}/portal/invoices?invoice=${invoiceId}&installment=${firstUnpaidInstallment.id}&action=pay`
      : `${FRONTEND_URL}/portal/invoices?invoice=${invoiceId}&action=pay`;

    const subject = isReminder
      ? `Payment Reminder: Invoice ${invoiceNumber}`
      : `Invoice ${invoiceNumber} from ${orgName}`;

    // Shared button styles
    const buttonStyle = `
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    `.replace(/\s+/g, " ").trim();

    // Bank details HTML block
    const bankDetailsHtml = hasBankDetails
      ? `
      <div style="background: #f0f9ff; padding: 16px 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bae6fd;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #0c4a6e;">Bank Transfer Details</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Account Name:</strong> ${escapeHtml(org!.bank_account_name)}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Sort Code:</strong> ${escapeHtml(org!.bank_sort_code)}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Account Number:</strong> ${escapeHtml(org!.bank_account_number)}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Reference:</strong> ${escapeHtml(bankRef)}</p>
      </div>`
      : "";

    // CTA section based on payment preferences
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

    // Build installment schedule HTML if payment plan is active
    const installmentScheduleHtml = installments.length > 0
      ? `
      <p style="margin: 12px 0 8px; font-weight: 600;">Payment plan: ${installments.length} installments</p>
      ${firstUnpaidInstallment ? `<p style="margin: 4px 0 12px; font-size: 16px; color: #2563eb; font-weight: 600;">Next payment due: ${formatMinorAmount(firstUnpaidInstallment.amount_minor, invoice.currency_code)} on ${formatDateUK(firstUnpaidInstallment.due_date)}</p>` : ""}
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
          ${installments.map((inst: any) => {
            const instAmount = formatMinorAmount(inst.amount_minor, invoice.currency_code);
            const instDue = formatDateUK(inst.due_date);
            const statusLabel = inst.status === "paid" ? "Paid" : inst.status === "overdue" ? "Overdue" : inst.status === "void" ? "Voided" : "Pending";
            const statusColor = inst.status === "paid" ? "#16a34a" : inst.status === "overdue" ? "#dc2626" : "#666";
            const isUnpaid = inst.status === "pending" || inst.status === "overdue";
            const payLink = isUnpaid && onlinePaymentsEnabled
              ? `<a href="${FRONTEND_URL}/portal/invoices?invoice=${invoiceId}&installment=${inst.id}&action=pay" style="color: #2563eb; font-weight: 600; text-decoration: none;">Pay Now</a>`
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
        <p style="margin: 5px 0;"><strong>Amount Due:</strong> ${escapeHtml(amount)}</p>
        <p style="margin: 5px 0;"><strong>Due Date:</strong> ${escapeHtml(dueDate)}</p>
      </div>`;

    const htmlContent = isReminder
      ? `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
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

    // Log message to message_log and capture the row ID for deterministic status update
    let logEntryId: string | null = null;
    const { data: logEntry, error: logError } = await supabaseService
      .from("message_log")
      .insert({
        org_id: orgId,
        channel: "email",
        subject,
        body: htmlContent,
        sender_user_id: user.id,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        recipient_type: "guardian",
        related_id: invoiceId,
        message_type: isReminder ? "invoice_reminder" : "invoice",
        status: "pending",
      })
      .select("id")
      .single();

    if (logError) {
      console.warn("[send-invoice-email] message_log insert failed:", logError.message);
    } else {
      logEntryId = logEntry.id;
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      // Update log status to "logged" (no email provider configured)
      if (logEntryId) {
        await supabaseService.from("message_log").update({ status: "logged" }).eq("id", logEntryId);
      }
      console.log("Email logged (RESEND_API_KEY not configured):", { to: recipientEmail, subject });
      return new Response(
        JSON.stringify({ success: true, message: "Email logged (Resend not configured)" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // ── INV-H3 FIX: Send with 3x retry and exponential backoff ──
    const { ok: emailSent, result } = await sendWithRetry(resendApiKey, {
      from: `${orgName} <billing@lessonloop.net>`,
      to: [recipientEmail],
      subject,
      html: htmlContent,
    });

    // Update message log status by primary key (deterministic)
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
      console.error("[send-invoice-email] All retry attempts failed:", result);
      return new Response(
        JSON.stringify({ error: "Failed to send email after 3 attempts. Please try again." }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // ── INV-H2 FIX: Update status to 'sent' server-side after successful send ──
    if (invoice.status === "draft") {
      const { error: statusError } = await supabaseService
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", invoiceId)
        .eq("status", "draft"); // Conditional update — only if still draft

      if (statusError) {
        console.warn("[send-invoice-email] Failed to update invoice status to sent:", statusError.message);
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-invoice-email] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
