import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml } from "../_shared/escape-html.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://lessonloop.net";

interface ReceiptRequest {
  paymentId: string;
  invoiceId: string;
  orgId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // This function is called server-side from the webhook — no CORS needed
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Verify this is called with the service role key (server-side only)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.includes(supabaseServiceKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { paymentId, invoiceId, orgId }: ReceiptRequest = await req.json();

    if (!paymentId || !invoiceId || !orgId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch payment details
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id, amount_minor, method, provider, provider_reference, paid_at")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      console.error("Payment not found:", paymentError);
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, invoice_number, total_minor, paid_minor, status, due_date, payer_guardian_id, payer_student_id")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      console.error("Invoice not found:", invoiceError);
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch org details
    const { data: org, error: orgError } = await supabase
      .from("organisations")
      .select("id, name, currency_code")
      .eq("id", orgId)
      .single();

    if (orgError || !org) {
      console.error("Organisation not found:", orgError);
      return new Response(JSON.stringify({ error: "Organisation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch payer details and email
    let recipientEmail: string | null = null;
    let recipientName = "Customer";
    let payerUserId: string | null = null;

    if (invoice.payer_guardian_id) {
      const { data: guardian } = await supabase
        .from("guardians")
        .select("full_name, email, user_id")
        .eq("id", invoice.payer_guardian_id)
        .single();
      if (guardian) {
        recipientName = guardian.full_name || "Customer";
        recipientEmail = guardian.email;
        payerUserId = guardian.user_id;
      }
    } else if (invoice.payer_student_id) {
      const { data: student } = await supabase
        .from("students")
        .select("first_name, last_name, email, user_id")
        .eq("id", invoice.payer_student_id)
        .single();
      if (student) {
        recipientName = `${student.first_name} ${student.last_name}`.trim();
        recipientEmail = student.email;
        payerUserId = student.user_id;
      }
    }

    if (!recipientEmail) {
      console.log("No recipient email found for receipt — skipping");
      return new Response(JSON.stringify({ success: true, message: "No recipient email" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check notification preferences — respect opt-out
    if (payerUserId) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("email_payment_receipts")
        .eq("user_id", payerUserId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (prefs && prefs.email_payment_receipts === false) {
        console.log("Recipient opted out of payment receipts — skipping");
        return new Response(JSON.stringify({ success: true, message: "Receipt opted out" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Format currency
    const currency = org.currency_code || "GBP";
    const formatAmount = (minor: number) => {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(minor / 100);
    };

    const amountPaid = formatAmount(payment.amount_minor);
    const remainingBalance = Math.max(0, (invoice.total_minor || 0) - (invoice.paid_minor || 0));
    const remainingFormatted = formatAmount(remainingBalance);
    const isPaidInFull = remainingBalance <= 0 || invoice.status === "paid";

    // Format payment method
    let paymentMethod = "Online payment";
    if (payment.method === "card") {
      paymentMethod = "Card payment";
    } else if (payment.method === "bacs_debit") {
      paymentMethod = "Bank transfer";
    }

    // Format date
    const paidDate = payment.paid_at
      ? new Date(payment.paid_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

    const portalLink = `${FRONTEND_URL}/portal/invoices?invoice=${invoiceId}`;

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

    const subject = `Payment Receipt — ${invoice.invoice_number}`;

    const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333; margin-bottom: 20px;">Payment Receipt</h1>
      <p>Dear ${escapeHtml(recipientName)},</p>
      <p>Thank you for your payment. Here is your receipt:</p>

      <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bbf7d0;">
        <p style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: #16a34a;">${escapeHtml(amountPaid)}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Invoice:</strong> ${escapeHtml(invoice.invoice_number)}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Payment Method:</strong> ${escapeHtml(paymentMethod)}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Date:</strong> ${escapeHtml(paidDate)}</p>
        ${payment.provider_reference ? `<p style="margin: 5px 0; font-size: 12px; color: #666;"><strong>Reference:</strong> ${escapeHtml(payment.provider_reference)}</p>` : ""}
      </div>

      ${isPaidInFull
        ? `<div style="background: #f0fdf4; padding: 12px 16px; border-radius: 6px; margin: 16px 0; text-align: center;">
            <p style="margin: 0; color: #16a34a; font-weight: 600;">✓ Invoice paid in full</p>
          </div>`
        : `<div style="background: #fff7ed; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 0; font-size: 14px;"><strong>Remaining balance:</strong> ${escapeHtml(remainingFormatted)}</p>
          </div>`
      }

      <p style="text-align: center;">
        <a href="${portalLink}" style="${buttonStyle}">View Invoice</a>
      </p>

      <p style="font-size: 12px; color: #666; margin-top: 20px;">
        This receipt was generated automatically. If you have any questions, please contact ${escapeHtml(org.name)}.
      </p>
      <p>Thank you,<br>${escapeHtml(org.name)}</p>
    </div>`;

    // Log to message_log
    await supabase.from("message_log").insert({
      org_id: orgId,
      channel: "email",
      subject,
      body: htmlContent,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      recipient_type: invoice.payer_guardian_id ? "guardian" : "student",
      related_id: invoiceId,
      message_type: "payment_receipt",
      status: resendApiKey ? "pending" : "logged",
    });

    if (!resendApiKey) {
      console.log("Receipt logged (RESEND_API_KEY not configured):", { to: recipientEmail, subject });
      return new Response(
        JSON.stringify({ success: true, message: "Receipt logged (Resend not configured)" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${org.name} <billing@lessonloop.net>`,
        to: [recipientEmail],
        subject,
        html: htmlContent,
      }),
    });

    const result = await response.json();
    console.log("Receipt email sent:", result);

    // Update message log status
    await supabase
      .from("message_log")
      .update({
        status: response.ok ? "sent" : "failed",
        sent_at: response.ok ? new Date().toISOString() : null,
        error_message: response.ok ? null : JSON.stringify(result),
      })
      .eq("related_id", invoiceId)
      .eq("message_type", "payment_receipt")
      .order("created_at", { ascending: false })
      .limit(1);

    return new Response(JSON.stringify(result), {
      status: response.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-payment-receipt:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
