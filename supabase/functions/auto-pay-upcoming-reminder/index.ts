import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml } from "../_shared/escape-html.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

/**
 * Sends a heads-up email to parents 3 days before an auto-pay charge.
 * Called daily via pg_cron or a Supabase scheduled invocation.
 */
serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Verify caller authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.includes(supabaseServiceKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the target date (3 days from now)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    // Find installments due in 3 days
    const { data: installments, error: queryError } = await supabase
      .from("invoice_installments")
      .select(`
        id,
        invoice_id,
        amount_minor,
        installment_number,
        due_date,
        invoices!inner (
          id,
          org_id,
          payer_guardian_id,
          invoice_number,
          currency_code
        )
      `)
      .in("status", ["pending"])
      .eq("due_date", targetDateStr);

    if (queryError) {
      console.error("Failed to query installments:", queryError);
      throw new Error(`Query failed: ${queryError.message}`);
    }

    if (!installments || installments.length === 0) {
      return new Response(JSON.stringify({ message: "No upcoming installments", sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    for (const inst of installments) {
      const invoice = (inst as any).invoices;
      if (!invoice?.payer_guardian_id) continue;

      // Check if guardian has auto-pay enabled
      const { data: prefs } = await supabase
        .from("guardian_payment_preferences")
        .select("stripe_customer_id, default_payment_method_id, auto_pay_enabled")
        .eq("guardian_id", invoice.payer_guardian_id)
        .eq("org_id", invoice.org_id)
        .maybeSingle();

      if (!prefs?.auto_pay_enabled || !prefs.default_payment_method_id) continue;

      // Get guardian email
      const { data: guardian } = await supabase
        .from("guardians")
        .select("full_name, email")
        .eq("id", invoice.payer_guardian_id)
        .single();

      if (!guardian?.email) continue;

      // Get org name
      const { data: org } = await supabase
        .from("organisations")
        .select("name, currency_code")
        .eq("id", invoice.org_id)
        .single();

      if (!org) continue;

      const currency = invoice.currency_code || org.currency_code || "GBP";
      const formatAmount = (minor: number) => {
        return new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(minor / 100);
      };

      const amountStr = formatAmount(inst.amount_minor);
      const dueDateStr = new Date(inst.due_date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      // Get last 4 digits of card (from Stripe or stored data)
      const cardInfo = "your saved card";

      const subject = `Upcoming auto-payment: ${amountStr} on ${dueDateStr}`;
      const portalLink = `${FRONTEND_URL}/portal/invoices?invoice=${inst.invoice_id}`;

      const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; margin-bottom: 20px;">Upcoming Auto-Payment</h1>
        <p>Dear ${escapeHtml(guardian.full_name || "Parent")},</p>
        <p>This is a heads-up that your scheduled auto-payment will be processed soon:</p>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Amount:</strong> ${escapeHtml(amountStr)}</p>
          <p style="margin: 5px 0;"><strong>Invoice:</strong> ${escapeHtml(invoice.invoice_number)}</p>
          <p style="margin: 5px 0;"><strong>Installment:</strong> ${inst.installment_number}</p>
          <p style="margin: 5px 0;"><strong>Payment date:</strong> ${escapeHtml(dueDateStr)}</p>
          <p style="margin: 5px 0;"><strong>Payment method:</strong> ${escapeHtml(cardInfo)}</p>
        </div>

        <p style="font-size: 14px; color: #666;">
          This payment will be charged automatically to ${escapeHtml(cardInfo)}.
          If you need to change your payment method or disable auto-pay, visit your
          <a href="${FRONTEND_URL}/portal/profile" style="color: #2563eb;">profile settings</a>.
        </p>

        <p style="text-align: center; margin: 20px 0;">
          <a href="${portalLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Invoice</a>
        </p>

        <p>Thank you,<br>${escapeHtml(org.name)}</p>
      </div>`;

      // Log to message_log
      await supabase.from("message_log").insert({
        org_id: invoice.org_id,
        channel: "email",
        subject,
        body: htmlContent,
        recipient_email: guardian.email,
        recipient_name: guardian.full_name,
        recipient_type: "guardian",
        related_id: inst.invoice_id,
        message_type: "auto_pay_reminder",
        status: resendApiKey ? "pending" : "logged",
      });

      if (resendApiKey) {
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `${org.name} <billing@lessonloop.net>`,
              to: [guardian.email],
              subject,
              html: htmlContent,
            }),
          });

          if (response.ok) {
            sent++;
            await supabase
              .from("message_log")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("related_id", inst.invoice_id)
              .eq("message_type", "auto_pay_reminder")
              .order("created_at", { ascending: false })
              .limit(1);
          }
        } catch (err) {
          console.error(`Failed to send reminder for installment ${inst.id}:`, err);
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "Reminders sent", sent }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in auto-pay-upcoming-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
