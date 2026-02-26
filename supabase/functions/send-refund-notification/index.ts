import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml } from "../_shared/escape-html.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

interface RefundNotificationRequest {
  refundId?: string;
  paymentId: string;
  invoiceId: string;
  orgId: string;
  amountMinor: number;
  currencyCode: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Verify service-role caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.includes(supabaseServiceKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const {
      paymentId,
      invoiceId,
      orgId,
      amountMinor,
      currencyCode,
    }: RefundNotificationRequest = await req.json();

    if (!paymentId || !invoiceId || !orgId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured — skipping refund notification");
      return new Response(JSON.stringify({ success: true, message: "Email not configured" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invoice details
    const { data: invoice } = await supabase
      .from("invoices")
      .select("invoice_number, payer_guardian_id, payer_student_id")
      .eq("id", invoiceId)
      .single();

    if (!invoice) {
      console.log("Invoice not found for refund notification");
      return new Response(JSON.stringify({ success: true, message: "Invoice not found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch org details
    const { data: org } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", orgId)
      .single();

    // Resolve recipient
    let recipientEmail: string | null = null;
    let recipientName = "Customer";

    if (invoice.payer_guardian_id) {
      const { data: guardian } = await supabase
        .from("guardians")
        .select("full_name, email")
        .eq("id", invoice.payer_guardian_id)
        .single();
      if (guardian) {
        recipientName = guardian.full_name || "Customer";
        recipientEmail = guardian.email;
      }
    } else if (invoice.payer_student_id) {
      const { data: student } = await supabase
        .from("students")
        .select("first_name, last_name, email")
        .eq("id", invoice.payer_student_id)
        .single();
      if (student) {
        recipientName = `${student.first_name} ${student.last_name}`.trim();
        recipientEmail = student.email;
      }
    }

    if (!recipientEmail) {
      console.log("No recipient email for refund notification — skipping");
      return new Response(JSON.stringify({ success: true, message: "No recipient email" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Format amount
    const formatAmount = (minor: number) => {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: currencyCode.toUpperCase(),
      }).format(minor / 100);
    };

    const formattedAmount = formatAmount(amountMinor);
    const orgName = escapeHtml(org?.name || "Your music teacher");
    const safeRecipientName = escapeHtml(recipientName.split(" ")[0]);
    const invoiceNumber = escapeHtml(invoice.invoice_number || "N/A");

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refund Confirmation</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px;text-align:center;">
      <div style="background:rgba(255,255,255,.2);display:inline-block;padding:12px;border-radius:50%;margin-bottom:12px;">
        <div style="font-size:28px;">↩️</div>
      </div>
      <h1 style="color:#fff;font-size:22px;margin:0;">Refund Processed</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hi ${safeRecipientName},
      </p>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 24px;">
        A refund has been processed for your payment. Here are the details:
      </p>

      <!-- Refund Summary -->
      <div style="background:#f1f5f9;border-radius:10px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">Invoice</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;color:#334155;font-size:13px;">
              ${invoiceNumber}
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">Refund Amount</td>
            <td style="padding:6px 0;text-align:right;font-weight:700;color:#2563eb;font-size:16px;">
              ${formattedAmount}
            </td>
          </tr>
        </table>
      </div>

      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 24px;">
        The refund will appear in your account within 5-10 business days, depending on your bank or card issuer.
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${FRONTEND_URL}/portal/invoices" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
          View Your Invoices
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">
        Sent by ${orgName} via <a href="${FRONTEND_URL}" style="color:#2563eb;text-decoration:none;">LessonLoop</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    // Send via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${org?.name || "LessonLoop"} <billing@lessonloop.net>`,
        to: [recipientEmail],
        subject: `Refund of ${formattedAmount} — ${invoiceNumber}`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", errorText);
    } else {
      console.log(`Refund notification sent to ${recipientEmail}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Refund notification error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
