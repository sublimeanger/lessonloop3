import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml } from "../_shared/escape-html.ts";
import { isNotificationEnabled } from "../_shared/check-notification-pref.ts";
import { validateCronAuth } from "../_shared/cron-auth.ts";

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

    // Fetch all orgs with upcoming_reminder_days configured
    const { data: orgs, error: orgsError } = await supabase
      .from("organisations")
      .select("id, name, currency_code, upcoming_reminder_days, bank_account_name, bank_sort_code, bank_account_number, bank_reference_prefix")
      .not("upcoming_reminder_days", "is", null);

    if (orgsError) throw new Error(`Failed to fetch orgs: ${orgsError.message}`);

    let remindersSent = 0;
    const errors: string[] = [];

    for (const org of orgs || []) {
      const reminderDays: number[] = org.upcoming_reminder_days || [7, 1];

      for (const daysAhead of reminderDays) {
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + daysAhead);
        const targetDateStr = targetDate.toISOString().split("T")[0];

        // Find invoices due on this date (non-payment-plan only, as installments have their own reminders)
        const { data: invoices, error: invError } = await supabase
          .from("invoices")
          .select(`
            id, invoice_number, total_minor, paid_minor, currency_code, due_date,
            payer_guardian:guardians(id, full_name, email, user_id)
          `)
          .eq("org_id", org.id)
          .in("status", ["sent"])
          .eq("due_date", targetDateStr)
          .eq("payment_plan_enabled", false);

        if (invError) {
          errors.push(`Org ${org.id}: ${invError.message}`);
          continue;
        }

        for (const invoice of invoices || []) {
          try {
            const guardian = invoice.payer_guardian as any;
            if (!guardian?.email) continue;

            // Check notification prefs
            if (guardian.user_id) {
              const enabled = await isNotificationEnabled(supabase, org.id, guardian.user_id, "email_invoice_reminders");
              if (!enabled) continue;
            }

            // Deduplicate: check if we already sent this reminder for this invoice + day combination
            const dedupKey = `${invoice.id}_${daysAhead}`;
            const { data: existing } = await supabase
              .from("message_log")
              .select("id")
              .eq("related_id", invoice.id)
              .eq("message_type", "invoice_upcoming")
              .like("subject", `%${daysAhead} day%`)
              .gte("created_at", today.toISOString())
              .limit(1);
            if (existing && existing.length > 0) continue;

            const formatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: invoice.currency_code || org.currency_code || "GBP" });
            const amountDue = formatter.format((invoice.total_minor - (invoice.paid_minor || 0)) / 100);
            const orgName = org.name || "LessonLoop";
            const dueDate = new Date(invoice.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

            const subject = `Payment reminder: ${amountDue} due in ${daysAhead} day${daysAhead > 1 ? "s" : ""} — ${invoice.invoice_number}`;

            // Build bank details section if configured
            let bankSection = "";
            if (org.bank_account_name && org.bank_sort_code && org.bank_account_number) {
              const reference = org.bank_reference_prefix
                ? `${org.bank_reference_prefix}-${invoice.invoice_number}`
                : invoice.invoice_number;
              bankSection = `
                <div style="background:#f0f4f8;padding:16px;border-radius:8px;margin:16px 0;">
                  <p style="margin:0 0 8px;font-weight:600;font-size:14px;">Or pay by bank transfer:</p>
                  <p style="margin:4px 0;font-size:13px;"><strong>Account:</strong> ${escapeHtml(org.bank_account_name)}</p>
                  <p style="margin:4px 0;font-size:13px;"><strong>Sort Code:</strong> ${escapeHtml(org.bank_sort_code)}</p>
                  <p style="margin:4px 0;font-size:13px;"><strong>Account No:</strong> ${escapeHtml(org.bank_account_number)}</p>
                  <p style="margin:4px 0;font-size:13px;"><strong>Reference:</strong> ${escapeHtml(reference)}</p>
                </div>`;
            }

            const html = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #333;">Payment Reminder</h1>
                <p>Dear ${escapeHtml(guardian.full_name)},</p>
                <p>This is a friendly reminder that your payment for invoice <strong>${escapeHtml(invoice.invoice_number)}</strong>
                   is due in <strong>${daysAhead} day${daysAhead > 1 ? "s" : ""}</strong>.</p>
                <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
                  <p style="margin: 5px 0;"><strong>Amount due:</strong> ${escapeHtml(amountDue)}</p>
                  <p style="margin: 5px 0;"><strong>Due date:</strong> ${dueDate}</p>
                </div>
                <p style="text-align: center;">
                  <a href="${FRONTEND_URL}/portal/invoices?invoice=${invoice.id}"
                     style="display:inline-block;background-color:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">
                    Pay Now
                  </a>
                </p>
                ${bankSection}
                <p style="font-size:12px;color:#666;">If you have already arranged payment, please disregard this email.</p>
                <p>Thank you,<br>${escapeHtml(orgName)}</p>
              </div>`;

            // Log message
            await supabase.from("message_log").insert({
              org_id: org.id,
              channel: "email",
              subject,
              body: html,
              sender_user_id: null,
              recipient_email: guardian.email,
              recipient_name: guardian.full_name,
              recipient_type: "guardian",
              recipient_id: guardian.id,
              related_id: invoice.id,
              message_type: "invoice_upcoming",
              status: resendApiKey ? "pending" : "logged",
            });

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
                .eq("related_id", invoice.id)
                .eq("message_type", "invoice_upcoming")
                .order("created_at", { ascending: false })
                .limit(1);

              if (response.ok) {
                remindersSent++;
                console.log(`Sent ${daysAhead}-day reminder for ${invoice.invoice_number} to ${guardian.email}`);
              } else {
                errors.push(`Failed to send to ${guardian.email}: ${JSON.stringify(result)}`);
              }
            } else {
              remindersSent++;
              console.log(`Logged ${daysAhead}-day reminder for ${invoice.invoice_number}`);
            }
          } catch (err: any) {
            errors.push(`Invoice ${invoice.id}: ${err.message}`);
          }
        }
      }
    }

    console.log(`Invoice upcoming reminder job complete. Sent: ${remindersSent}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({ success: true, sent: remindersSent, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Invoice upcoming reminders error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
