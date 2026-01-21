import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Get frontend URL from environment or use default
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://id-preview--c541d756-90e7-442a-ba85-0c723aeabc14.lovable.app";

interface InvoiceEmailRequest {
  invoiceId: string;
  recipientEmail: string;
  recipientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  orgName: string;
  isReminder: boolean;
  customMessage?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      invoiceId,
      recipientEmail,
      recipientName,
      invoiceNumber,
      amount,
      dueDate,
      orgName,
      isReminder,
      customMessage,
    }: InvoiceEmailRequest = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

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

    const htmlContent = isReminder
      ? `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; margin-bottom: 20px;">Payment Reminder</h1>
          <p>Dear ${recipientName},</p>
          <p>This is a friendly reminder that payment for the following invoice is due:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
            <p style="margin: 5px 0;"><strong>Amount Due:</strong> ${amount}</p>
            <p style="margin: 5px 0;"><strong>Due Date:</strong> ${dueDate}</p>
          </div>
          ${customMessage ? `<p>${customMessage}</p>` : ""}
          <p style="text-align: center;">
            <a href="${portalLink}" style="${buttonStyle}">View & Pay Invoice</a>
          </p>
          <p style="font-size: 12px; color: #666;">
            Click the button above to view your invoice and make a payment securely online.
          </p>
          <p>Thank you,<br>${orgName}</p>
        </div>`
      : `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; margin-bottom: 20px;">Invoice ${invoiceNumber}</h1>
          <p>Dear ${recipientName},</p>
          <p>Please find below the details of your invoice:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
            <p style="margin: 5px 0;"><strong>Amount Due:</strong> ${amount}</p>
            <p style="margin: 5px 0;"><strong>Due Date:</strong> ${dueDate}</p>
          </div>
          ${customMessage ? `<p>${customMessage}</p>` : ""}
          <p style="text-align: center;">
            <a href="${portalLink}" style="${buttonStyle}">View & Pay Invoice</a>
          </p>
          <p style="font-size: 12px; color: #666;">
            Click the button above to view your invoice and make a payment securely online.
          </p>
          <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
          <p>Thank you for your business,<br>${orgName}</p>
        </div>`;

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
        from: `${orgName} <onboarding@resend.dev>`,
        to: [recipientEmail],
        subject,
        html: htmlContent,
      }),
    });

    const result = await response.json();
    console.log("Email sent:", result);

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
