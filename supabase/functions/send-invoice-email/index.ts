import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { escapeHtml } from "../_shared/escape-html.ts";
import { maybeSendSms } from "../_shared/sms-helpers.ts";

// Get frontend URL from environment or use default
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://lessonloop.net";

interface InvoiceEmailRequest {
  invoiceId: string;
  recipientEmail: string;
  recipientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  orgName: string;
  orgId: string;
  isReminder: boolean;
  customMessage?: string;
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

    const {
      invoiceId,
      recipientEmail,
      recipientName,
      invoiceNumber,
      amount,
      dueDate,
      orgName,
      orgId,
      isReminder,
      customMessage,
    }: InvoiceEmailRequest = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch org payment preferences
    const { data: orgPaymentPrefs } = await supabaseService
      .from("organisations")
      .select("online_payments_enabled, bank_account_name, bank_sort_code, bank_account_number, bank_reference_prefix")
      .eq("id", orgId)
      .single();

    const onlinePaymentsEnabled = orgPaymentPrefs?.online_payments_enabled !== false;
    const hasBankDetails = !!(orgPaymentPrefs?.bank_account_name && orgPaymentPrefs?.bank_sort_code && orgPaymentPrefs?.bank_account_number);
    const bankRef = orgPaymentPrefs?.bank_reference_prefix
      ? `${orgPaymentPrefs.bank_reference_prefix}-${invoiceNumber}`
      : invoiceNumber;

    // Build the portal link with invoice ID
    const portalLink = `${FRONTEND_URL}/portal/invoices?invoice=${invoiceId}`;

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
    `.replace(/\s+/g, ' ').trim();

    // Bank details HTML block
    const bankDetailsHtml = hasBankDetails ? `
      <div style="background: #f0f9ff; padding: 16px 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bae6fd;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #0c4a6e;">Bank Transfer Details</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Account Name:</strong> ${escapeHtml(orgPaymentPrefs.bank_account_name)}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Sort Code:</strong> ${escapeHtml(orgPaymentPrefs.bank_sort_code)}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Account Number:</strong> ${escapeHtml(orgPaymentPrefs.bank_account_number)}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Reference:</strong> ${escapeHtml(bankRef)}</p>
      </div>` : "";

    // CTA section based on payment preferences
    const payOnlineCta = onlinePaymentsEnabled ? `
      <p style="text-align: center;">
        <a href="${portalLink}" style="${buttonStyle}">View & Pay Invoice</a>
      </p>
      <p style="font-size: 12px; color: #666;">
        Click the button above to view your invoice and make a payment securely online.
      </p>` : "";

    const bankTransferCta = hasBankDetails && !onlinePaymentsEnabled ? bankDetailsHtml : "";
    const secondaryBankDetails = hasBankDetails && onlinePaymentsEnabled ? `
      <p style="font-size: 13px; color: #666; margin-top: 12px; text-align: center;">Or pay by bank transfer:</p>
      ${bankDetailsHtml}` : "";

    const invoiceDetailsBlock = `
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

    // Log message to message_log
    if (orgId && invoiceId) {
      await supabaseService.from("message_log").insert({
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
        status: resendApiKey ? "pending" : "logged",
      });
    }

    if (!resendApiKey) {
      console.log("Email logged (RESEND_API_KEY not configured):", { to: recipientEmail, subject });
      return new Response(
        JSON.stringify({ success: true, message: "Email logged (Resend not configured)" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${orgName} <billing@lessonloop.net>`,
        to: [recipientEmail],
        subject,
        html: htmlContent,
      }),
    });

    const result = await response.json();
    console.log("Email sent:", result);

    // Update message log status
    if (orgId && invoiceId) {
      await supabaseService
        .from("message_log")
        .update({
          status: response.ok ? "sent" : "failed",
          sent_at: response.ok ? new Date().toISOString() : null,
          error_message: response.ok ? null : JSON.stringify(result),
        })
        .eq("related_id", invoiceId)
        .eq("message_type", isReminder ? "invoice_reminder" : "invoice")
        .order("created_at", { ascending: false })
        .limit(1);
    }

    // SMS notification (complementary to email)
    if (orgId) {
      const { data: guardianData } = await supabaseService
        .from("guardians")
        .select("id, phone, user_id, full_name, sms_opted_in")
        .eq("email", recipientEmail)
        .eq("org_id", orgId)
        .maybeSingle();

      if (guardianData?.phone) {
        const smsPrefKey = isReminder ? "sms_invoice_reminders" : "sms_payment_receipts";
        const smsBody = isReminder
          ? `${orgName}: Reminder — Invoice ${invoiceNumber} for ${amount} is due ${dueDate}.`
          : `${orgName}: Invoice ${invoiceNumber} for ${amount}, due ${dueDate}. View in your portal.`;
        await maybeSendSms(supabaseService, {
          orgId,
          guardianId: guardianData.id,
          guardianPhone: guardianData.phone,
          guardianEmail: recipientEmail,
          guardianUserId: guardianData.user_id,
          guardianName: guardianData.full_name,
          guardianSmsOptedIn: guardianData.sms_opted_in,
          smsPrefKey,
          relatedId: invoiceId,
          messageType: isReminder ? "invoice_reminder_sms" : "invoice_sms",
          body: smsBody,
        });
      }
    }

    return new Response(JSON.stringify(result), {
      status: response.ok ? 200 : 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-invoice-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
