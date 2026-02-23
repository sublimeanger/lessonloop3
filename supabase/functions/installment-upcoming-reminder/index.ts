import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml } from "../_shared/escape-html.ts";
import { isNotificationEnabled } from "../_shared/check-notification-pref.ts";
import { validateCronAuth } from "../_shared/cron-auth.ts";
import { maybeSendSms } from "../_shared/sms-helpers.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://lessonloop.net";

serve(async (req) => {
  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 3);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    console.log(`Checking for installments due on ${targetDateStr}...`);

    const { data: upcomingInstallments, error } = await supabase
      .from("invoice_installments")
      .select(`
        id, installment_number, amount_minor, due_date, invoice_id,
        invoice:invoices!inner (
          id, invoice_number, total_minor, currency_code, org_id,
          paid_minor, installment_count,
          organisation:organisations!inner(name),
          payer_guardian:guardians(id, full_name, email, phone, user_id, sms_opted_in)
        )
      `)
      .eq("status", "pending")
      .eq("due_date", targetDateStr);

    if (error) throw new Error(`Failed to fetch upcoming installments: ${error.message}`);

    let remindersSent = 0;
    const errors: string[] = [];

    for (const installment of upcomingInstallments || []) {
      try {
        const invoice = installment.invoice as any;
        const org = invoice.organisation;
        const guardian = invoice.payer_guardian;

        if (!guardian?.email) continue;

        // Check notification prefs
        if (guardian.user_id) {
          const enabled = await isNotificationEnabled(supabase, invoice.org_id, guardian.user_id, "email_invoice_reminders");
          if (!enabled) continue;
        }

        // Deduplicate
        const { data: existing } = await supabase
          .from("message_log")
          .select("id")
          .eq("related_id", installment.id)
          .eq("message_type", "installment_upcoming")
          .gte("created_at", today.toISOString())
          .limit(1);
        if (existing && existing.length > 0) continue;

        const formatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: invoice.currency_code || "GBP" });
        const installmentAmount = formatter.format(installment.amount_minor / 100);
        const remainingAfter = formatter.format((invoice.total_minor - (invoice.paid_minor || 0) - installment.amount_minor) / 100);
        const orgName = org?.name || "LessonLoop";
        const dueDate = new Date(installment.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

        const subject = `Payment due in 3 days: Installment ${installment.installment_number} of ${invoice.installment_count} — ${invoice.invoice_number}`;

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">Upcoming Payment Reminder</h1>
            <p>Dear ${escapeHtml(guardian.full_name)},</p>
            <p>This is a friendly reminder that installment <strong>${installment.installment_number} of ${invoice.installment_count}</strong>
               for invoice <strong>${escapeHtml(invoice.invoice_number)}</strong> is due in <strong>3 days</strong>.</p>
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <p style="margin: 5px 0;"><strong>Amount due:</strong> ${escapeHtml(installmentAmount)}</p>
              <p style="margin: 5px 0;"><strong>Due date:</strong> ${dueDate}</p>
              <p style="margin: 5px 0;"><strong>Remaining balance after this payment:</strong> ${escapeHtml(remainingAfter)}</p>
            </div>
            <p style="text-align: center;">
              <a href="${FRONTEND_URL}/portal/invoices?invoice=${invoice.id}"
                 style="display:inline-block;background-color:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">
                Pay Now
              </a>
            </p>
            <p style="font-size:12px;color:#666;">If you have already arranged payment, please disregard this email.</p>
            <p>Thank you,<br>${escapeHtml(orgName)}</p>
          </div>`;

        // Log message
        const { error: logError } = await supabase.from("message_log").insert({
          org_id: invoice.org_id,
          channel: "email",
          subject,
          body: html,
          sender_user_id: null,
          recipient_email: guardian.email,
          recipient_name: guardian.full_name,
          recipient_type: "guardian",
          recipient_id: guardian.id,
          related_id: installment.id,
          message_type: "installment_upcoming",
          status: resendApiKey ? "pending" : "logged",
        });
        if (logError) console.error("Failed to log message:", logError);

        // Send via Resend
        if (resendApiKey) {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `${orgName} <billing@lessonloop.net>`,
              to: [guardian.email],
              subject,
              html,
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
            .eq("related_id", installment.id)
            .eq("message_type", "installment_upcoming")
            .order("created_at", { ascending: false })
            .limit(1);

          if (response.ok) {
            remindersSent++;
            console.log(`Sent upcoming reminder for installment #${installment.installment_number} of ${invoice.invoice_number} to ${guardian.email}`);
          } else {
            errors.push(`Failed to send to ${guardian.email}: ${JSON.stringify(result)}`);
          }
        } else {
          remindersSent++;
          console.log(`Logged upcoming reminder for installment #${installment.installment_number} of ${invoice.invoice_number}`);
        }

        // SMS (additive, after email)
        const smsBody = `${orgName}: Installment ${installment.installment_number} of ${invoice.installment_count} (${installmentAmount}) is due in 3 days (${dueDate}).`;
        await maybeSendSms(supabase, {
          orgId: invoice.org_id,
          guardianId: guardian.id,
          guardianPhone: guardian.phone,
          guardianEmail: guardian.email,
          guardianUserId: guardian.user_id,
          guardianName: guardian.full_name,
          guardianSmsOptedIn: guardian.sms_opted_in,
          smsPrefKey: "sms_invoice_reminders",
          relatedId: installment.id,
          messageType: "installment_upcoming_sms",
          body: smsBody,
        });
      } catch (err: any) {
        errors.push(`Installment ${installment.id}: ${err.message}`);
      }
    }

    console.log(`Upcoming installment reminder job complete. Sent: ${remindersSent}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({ success: true, sent: remindersSent, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Upcoming installment reminders error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
