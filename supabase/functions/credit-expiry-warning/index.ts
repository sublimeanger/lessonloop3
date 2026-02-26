import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCronAuth } from "../_shared/cron-auth.ts";
import { escapeHtml } from "../_shared/escape-html.ts";
import { isNotificationEnabled } from "../_shared/check-notification-pref.ts";
import { log, logError } from "../_shared/log.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

Deno.serve(async (req) => {
  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  // Find credits expiring in the next 3 days that haven't been redeemed or already expired
  const now = new Date().toISOString();
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: credits, error } = await supabase
    .from("make_up_credits")
    .select(`
      id, credit_value_minor, expires_at, org_id,
      students!make_up_credits_student_id_fkey (id, first_name, last_name)
    `)
    .is("redeemed_at", null)
    .is("expired_at", null)
    .not("expires_at", "is", null)
    .gte("expires_at", now)
    .lte("expires_at", threeDaysFromNow);

  if (error) {
    logError("Credit expiry warning query error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!credits?.length) {
    console.log("No credits expiring in the next 3 days");
    return new Response(
      JSON.stringify({ success: true, sent: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Deduplicate: avoid sending multiple warnings for same credit
  // Check message_log for already-sent warnings
  const creditIds = credits.map((c) => c.id);
  const { data: alreadySent } = await supabase
    .from("message_log")
    .select("related_id")
    .eq("message_type", "credit_expiry_warning")
    .in("related_id", creditIds);

  const sentSet = new Set((alreadySent ?? []).map((m) => m.related_id));
  const unsent = credits.filter((c) => !sentSet.has(c.id));

  let sentCount = 0;

  for (const credit of unsent) {
    try {
      const student = (credit.students as any) as { id: string; first_name: string; last_name: string } | null;
      if (!student) continue;

      const studentName = `${student.first_name} ${student.last_name}`.trim();

      // Find primary guardian
      const { data: sgRow } = await supabase
        .from("student_guardians")
        .select("guardian_id")
        .eq("student_id", student.id)
        .eq("is_primary_payer", true)
        .limit(1)
        .maybeSingle();

      if (!sgRow) continue;

      const { data: guardian } = await supabase
        .from("guardians")
        .select("id, full_name, email, user_id")
        .eq("id", sgRow.guardian_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (!guardian?.email) continue;

      // Check notification preference
      if (guardian.user_id) {
        const enabled = await isNotificationEnabled(supabase, credit.org_id, guardian.user_id, "email_makeup_offers");
        if (!enabled) {
          log(`Guardian ${guardian.id} has makeup emails disabled, skipping credit ${credit.id}`);
          continue;
        }
      }

      // Get org name and currency
      const { data: org } = await supabase
        .from("organisations")
        .select("name, currency_code")
        .eq("id", credit.org_id)
        .single();

      const orgName = org?.name || "LessonLoop";
      const currencySymbol = (org?.currency_code || "GBP") === "GBP" ? "£" : org?.currency_code || "£";
      const creditValue = (credit.credit_value_minor / 100).toFixed(2);
      const expiryDate = new Date(credit.expires_at!).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const subject = `Make-up credit expiring soon for ${escapeHtml(student.first_name)}`;
      const portalUrl = `${FRONTEND_URL}/portal/home`;

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="color: #1a1a1a;">Make-Up Credit Expiring Soon</h2>
          <p>Hi ${escapeHtml(guardian.full_name || "there")},</p>
          <p>Just a heads-up — <strong>${escapeHtml(studentName)}</strong> has a make-up credit worth <strong>${currencySymbol}${creditValue}</strong> that expires on <strong>${escapeHtml(expiryDate)}</strong>.</p>

          <div style="border: 2px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0; background-color: #fffbeb;">
            <h3 style="margin: 0 0 8px 0; color: #b45309;">⏳ Expiring Credit</h3>
            <p style="margin: 0; font-size: 15px;">
              <strong>${currencySymbol}${creditValue}</strong> — expires ${escapeHtml(expiryDate)}
            </p>
          </div>

          <p>If you haven't already, please contact ${escapeHtml(orgName)} to arrange a make-up lesson before the credit expires.</p>

          <div style="margin: 24px 0; text-align: center;">
            <a href="${portalUrl}"
               style="background-color: #f59e0b; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 600; font-size: 16px;">
              View in Portal
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Sent by ${escapeHtml(orgName)} via LessonLoop</p>
        </div>
      `;

      let emailSent = false;

      if (resendApiKey) {
        try {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "LessonLoop <notifications@lessonloop.app>",
              to: [guardian.email],
              subject,
              html,
            }),
          });

          if (emailRes.ok) {
            emailSent = true;
            log(`Sent credit expiry warning to ${guardian.email} for credit ${credit.id}`);
          } else {
            const errText = await emailRes.text();
            logError(`Failed to send to ${guardian.email}:`, errText);
          }
        } catch (emailErr) {
          logError(`Error sending to ${guardian.email}:`, emailErr);
        }
      } else {
        log(`[DRY RUN] Would send credit expiry warning to ${guardian.email}`);
      }

      // Log to message_log
      await supabase.from("message_log").insert({
        org_id: credit.org_id,
        message_type: "credit_expiry_warning",
        channel: "email",
        subject,
        body: `Credit ${currencySymbol}${creditValue} for ${studentName} expires ${expiryDate}`,
        recipient_email: guardian.email,
        recipient_name: guardian.full_name || "",
        recipient_id: guardian.id,
        recipient_type: "guardian",
        related_id: credit.id,
        status: emailSent ? "sent" : "failed",
        sent_at: emailSent ? new Date().toISOString() : null,
      });

      if (emailSent) sentCount++;
    } catch (creditErr) {
      logError(`Error processing credit ${credit.id}:`, creditErr);
    }
  }

  console.log(`Credit expiry warning: ${sentCount} emails sent out of ${unsent.length} credits`);

  return new Response(
    JSON.stringify({ success: true, sent: sentCount, total: unsent.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
