import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml } from "../_shared/escape-html.ts";

// This function runs on a schedule (e.g., daily) to send automated overdue invoice reminders
// based on each organisation's configured reminder days (e.g., [7, 14, 30])

import { validateCronAuth } from "../_shared/cron-auth.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://lessonloop3.lovable.app";

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  total_minor: number;
  currency_code: string;
  due_date: string;
  days_overdue: number;
  org_id: string;
  org_name: string;
  overdue_reminder_days: number[];
  payer_guardian: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  payer_student: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

serve(async (req) => {
  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting overdue reminder check...");

    // Find all overdue invoices with their org settings
    const { data: overdueInvoices, error: invoicesError } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        total_minor,
        currency_code,
        due_date,
        org_id,
        organisation:organisations!inner(
          name,
          overdue_reminder_days
        ),
        payer_guardian:guardians(id, full_name, email),
        payer_student:students(id, first_name, last_name)
      `)
      .eq("status", "overdue");

    if (invoicesError) {
      throw new Error(`Failed to fetch overdue invoices: ${invoicesError.message}`);
    }

    if (!overdueInvoices || overdueInvoices.length === 0) {
      console.log("No overdue invoices found");
      return new Response(
        JSON.stringify({ success: true, message: "No overdue invoices", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let remindersSent = 0;
    const errors: string[] = [];

    for (const invoice of overdueInvoices) {
      try {
        const org = invoice.organisation as any;
        const reminderDays: number[] = org?.overdue_reminder_days || [7, 14, 30];
        
        // Calculate days overdue
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        // Check if today matches a reminder day
        if (!reminderDays.includes(daysOverdue)) {
          continue;
        }

        // Check if we already sent a reminder for this specific day
        const { data: existingReminder } = await supabase
          .from("message_log")
          .select("id")
          .eq("related_id", invoice.id)
          .eq("message_type", "overdue_reminder")
          .gte("created_at", today.toISOString())
          .limit(1);

        if (existingReminder && existingReminder.length > 0) {
          console.log(`Already sent reminder for invoice ${invoice.invoice_number} today`);
          continue;
        }

        // Get recipient info
        const guardian = invoice.payer_guardian as any;
        if (!guardian?.email) {
          console.log(`No email for invoice ${invoice.invoice_number}, skipping`);
          continue;
        }

        const recipientEmail = guardian.email;
        const recipientName = guardian.full_name;
        const orgName = org?.name || "LessonLoop";

        // Format amount
        const formatter = new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: invoice.currency_code || "GBP",
        });
        const amount = formatter.format(invoice.total_minor / 100);

        // Build email content
        const portalLink = `${FRONTEND_URL}/portal/invoices?invoice=${invoice.id}`;
        const urgencyLevel = daysOverdue >= 30 ? "urgent" : daysOverdue >= 14 ? "important" : "friendly";
        
        const subject = urgencyLevel === "urgent"
          ? `⚠️ URGENT: Invoice ${invoice.invoice_number} is ${daysOverdue} days overdue`
          : urgencyLevel === "important"
          ? `Important: Invoice ${invoice.invoice_number} requires attention`
          : `Reminder: Invoice ${invoice.invoice_number} is overdue`;

        const buttonStyle = `
          display: inline-block;
          background-color: ${urgencyLevel === "urgent" ? "#dc2626" : "#2563eb"};
          color: #ffffff;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin: 20px 0;
        `.replace(/\s+/g, " ").trim();

        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: ${urgencyLevel === "urgent" ? "#dc2626" : "#333"}; margin-bottom: 20px;">
              Payment ${urgencyLevel === "urgent" ? "Urgently Required" : "Reminder"}
            </h1>
            <p>Dear ${escapeHtml(recipientName)},</p>
            <p>Invoice <strong>${escapeHtml(invoice.invoice_number)}</strong> is now <strong>${daysOverdue} days overdue</strong>.</p>
            <div style="background: ${urgencyLevel === "urgent" ? "#fef2f2" : "#f5f5f5"}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${urgencyLevel === "urgent" ? "#dc2626" : "#2563eb"};">
              <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${escapeHtml(invoice.invoice_number)}</p>
              <p style="margin: 5px 0;"><strong>Amount Due:</strong> ${escapeHtml(amount)}</p>
              <p style="margin: 5px 0;"><strong>Original Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p style="margin: 5px 0; color: ${urgencyLevel === "urgent" ? "#dc2626" : "#666"};"><strong>Days Overdue:</strong> ${daysOverdue}</p>
            </div>
            ${urgencyLevel === "urgent" 
              ? "<p style='color: #dc2626;'><strong>Please pay this invoice immediately to avoid any disruption to lessons.</strong></p>" 
              : "<p>Please settle this invoice at your earliest convenience.</p>"
            }
            <p style="text-align: center;">
              <a href="${portalLink}" style="${buttonStyle}">Pay Now</a>
            </p>
            <p style="font-size: 12px; color: #666;">
              If you have already made payment, please disregard this email. Payments may take 1-2 business days to process.
            </p>
            <p>Thank you,<br>${escapeHtml(orgName)}</p>
          </div>
        `;

        // Log to message_log
        const { error: logError } = await supabase.from("message_log").insert({
          org_id: invoice.org_id,
          channel: "email",
          subject,
          body: htmlContent,
          sender_user_id: null, // System generated
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          recipient_type: "guardian",
          recipient_id: guardian.id,
          related_id: invoice.id,
          message_type: "overdue_reminder",
          status: resendApiKey ? "pending" : "logged",
        });

        if (logError) {
          console.error(`Failed to log message for invoice ${invoice.invoice_number}:`, logError);
        }

        // Send email if Resend is configured
        if (resendApiKey) {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
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

          // Update message log status
          await supabase
            .from("message_log")
            .update({
              status: response.ok ? "sent" : "failed",
              sent_at: response.ok ? new Date().toISOString() : null,
              error_message: response.ok ? null : JSON.stringify(result),
            })
            .eq("related_id", invoice.id)
            .eq("message_type", "overdue_reminder")
            .order("created_at", { ascending: false })
            .limit(1);

          if (response.ok) {
            remindersSent++;
            console.log(`Sent ${daysOverdue}-day reminder for invoice ${invoice.invoice_number} to ${recipientEmail}`);
          } else {
            errors.push(`Failed to send to ${recipientEmail}: ${JSON.stringify(result)}`);
          }
        } else {
          remindersSent++;
          console.log(`Logged ${daysOverdue}-day reminder for invoice ${invoice.invoice_number} (Resend not configured)`);
        }
      } catch (invoiceError: any) {
        errors.push(`Invoice ${invoice.invoice_number}: ${invoiceError.message}`);
      }
    }

    console.log(`Overdue reminder job complete. Sent: ${remindersSent}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: remindersSent,
        errors: errors.length > 0 ? errors : undefined,
      }),
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
