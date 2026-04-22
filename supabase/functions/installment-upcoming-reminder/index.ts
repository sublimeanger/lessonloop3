import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml } from "../_shared/escape-html.ts";
import { isNotificationEnabled } from "../_shared/check-notification-pref.ts";
import { validateCronAuth } from "../_shared/cron-auth.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

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
          payer_guardian:guardians(id, full_name, email, user_id),
          payer_student:students(id, first_name, last_name, email)
        )
      `)
      .in("status", ["pending", "partially_paid"])
      .eq("due_date", targetDateStr);

    if (error) throw new Error(`Failed to fetch upcoming installments: ${error.message}`);

    let remindersSent = 0;
    const errors: string[] = [];

    for (const installment of upcomingInstallments || []) {
      try {
        const invoice = installment.invoice as any;
        const org = invoice.organisation;
        const guardian = invoice.payer_guardian;
        const student = invoice.payer_student;

        // J6-F8: resolve recipient — guardian first, then student fallback.
        // Student-payer invoices previously received no reminder at all.
        const recipientEmail = guardian?.email || student?.email;
        const recipientName = guardian?.full_name
          || (student ? `${student.first_name} ${student.last_name}`.trim() : null);
        const recipientType: "guardian" | "student" | null = guardian?.email
          ? "guardian"
          : student?.email
          ? "student"
          : null;
        const recipientId = guardian?.email ? guardian?.id : student?.id;

        if (!recipientEmail || !recipientName || !recipientType) continue;

        // Check notification prefs — only guardians have user_id for prefs.
        // Students without a user_id always receive (no prefs to check).
        if (recipientType === "guardian" && guardian.user_id) {
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

        // J6-F7: compute outstanding on this installment so partially_paid
        // installments show the real amount due, not the nominal amount.
        const { data: priorPayments } = await supabase
          .from("payments")
          .select("id, amount_minor")
          .eq("installment_id", installment.id);
        const priorPaymentIds = (priorPayments || []).map((p: any) => p.id);
        let priorRefunded = 0;
        if (priorPaymentIds.length > 0) {
          const { data: priorRefundRows } = await supabase
            .from("refunds")
            .select("amount_minor")
            .in("payment_id", priorPaymentIds)
            .eq("status", "succeeded");
          priorRefunded = (priorRefundRows || []).reduce(
            (s: number, r: any) => s + r.amount_minor, 0,
          );
        }
        const priorApplied = (priorPayments || []).reduce(
          (s: number, p: any) => s + p.amount_minor, 0,
        ) - priorRefunded;
        const outstanding = installment.amount_minor - priorApplied;

        // Skip if essentially nothing owed on this installment
        // (status lag from a payment that just landed).
        if (outstanding < 100) continue;

        const formatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: invoice.currency_code || "GBP" });
        const installmentAmount = formatter.format(outstanding / 100);
        const remainingAfter = formatter.format((invoice.total_minor - (invoice.paid_minor || 0) - outstanding) / 100);
        const orgName = org?.name || "LessonLoop";
        const dueDate = new Date(installment.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

        const subject = `Payment due in 3 days: Installment ${installment.installment_number} of ${invoice.installment_count} — ${invoice.invoice_number}`;

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">Upcoming Payment Reminder</h1>
            <p>Dear ${escapeHtml(recipientName)},</p>
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
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          recipient_type: recipientType,
          recipient_id: recipientId,
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
              to: [recipientEmail],
              subject,
              html,
              headers: {
                'List-Unsubscribe': `<${FRONTEND_URL}/portal/settings?tab=notifications>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
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
            console.log(`Sent upcoming reminder for installment #${installment.installment_number} of ${invoice.invoice_number} to ${recipientEmail}`);
          } else {
            errors.push(`Failed to send to ${recipientEmail}: ${JSON.stringify(result)}`);
          }
        } else {
          remindersSent++;
          console.log(`Logged upcoming reminder for installment #${installment.installment_number} of ${invoice.invoice_number}`);
        }
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
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
