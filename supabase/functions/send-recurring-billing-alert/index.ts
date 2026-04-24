import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, sanitiseFromName } from "../_shared/escape-html.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

interface AlertRequest {
  template_id: string;
  run_id: string;
  org_id: string;
  outcome: "partial" | "failed";
  invoice_count: number;
  recipients_skipped: number;
  recipients_total: number;
  period_start: string;
  period_end: string;
  template_name?: string;
  error_samples?: Array<{ student_id: string | null; error_code: string; error_message: string }>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Service-role auth — matches send-dispute-notification, send-invoice-email-internal.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${supabaseServiceKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: AlertRequest = await req.json();
    const {
      template_id,
      run_id,
      org_id,
      outcome,
      invoice_count,
      recipients_skipped,
      recipients_total,
      period_start,
      period_end,
      template_name,
      error_samples,
    } = body;

    if (!template_id || !run_id || !org_id || !outcome) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Idempotency: 5-minute dedup keyed on (template_id, run_id, outcome).
    const dedupKey = `recurring-alert-${template_id}-${run_id}-${outcome}`;
    const { data: existingSent } = await supabase
      .from("message_log")
      .select("id")
      .eq("message_type", "recurring_run_alert")
      .eq("related_id", dedupKey)
      .eq("status", "sent")
      .gte("sent_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(1);

    if (existingSent && existingSent.length > 0) {
      console.log(`Recurring alert already sent for ${dedupKey} — skipping`);
      return new Response(
        JSON.stringify({ success: true, message: "Already sent recently" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Resolve org context.
    const { data: org } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", org_id)
      .single();

    // Resolve finance team (owner + admin + finance, active).
    const { data: memberships } = await supabase
      .from("org_memberships")
      .select("user_id")
      .eq("org_id", org_id)
      .in("role", ["owner", "admin", "finance"])
      .eq("status", "active");

    const memberUserIds = (memberships || []).map((m: any) => m.user_id);
    if (memberUserIds.length === 0) {
      console.log("No active finance-team members for org; skipping alert");
      return new Response(
        JSON.stringify({ success: true, message: "No finance-team recipients" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch member emails via auth admin API + profile names.
    const recipients: { userId: string; email: string; name: string }[] = [];
    for (const userId of memberUserIds) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      if (authUser?.user?.email) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();
        recipients.push({
          userId,
          email: authUser.user.email,
          name: profile?.full_name || authUser.user.email.split("@")[0],
        });
      }
    }

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No recipient emails resolvable" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const orgName = escapeHtml(org?.name || "Your academy");
    const tmplName = escapeHtml(template_name || "a recurring billing template");

    // Compose subject + body by outcome.
    const isFailed = outcome === "failed";
    const subject = isFailed
      ? `❌ Recurring billing run failed — ${tmplName}`
      : `⚠️ Recurring billing run partial — ${tmplName} (${recipients_skipped} skipped)`;

    const headerColor = isFailed
      ? "linear-gradient(135deg,#991b1b,#7f1d1d)"
      : "linear-gradient(135deg,#d97706,#ea580c)";
    const icon = isFailed ? "❌" : "⚠️";
    const heading = isFailed ? "Recurring billing run failed" : "Recurring billing run completed with skips";

    let errorSummary = "";
    if (error_samples && error_samples.length > 0) {
      const samples = error_samples.slice(0, 5).map((e) => {
        return `<li style="margin:4px 0;color:#334155;font-size:13px;"><code style="background:#f1f5f9;padding:2px 6px;border-radius:3px;">${escapeHtml(e.error_code)}</code> — ${escapeHtml(e.error_message)}</li>`;
      }).join("");
      const overflow = error_samples.length > 5
        ? `<p style="margin:8px 0 0;color:#64748b;font-size:12px;">(${error_samples.length - 5} more — see run detail in app.)</p>`
        : "";
      errorSummary = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0 0 8px;color:#475569;font-size:13px;font-weight:600;">Error samples:</p>
          <ul style="margin:0;padding-left:20px;">${samples}</ul>
          ${overflow}
        </div>`;
    }

    const bodyHtml = `
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        The recurring billing run for <strong>${tmplName}</strong> ${isFailed ? "did not generate any invoices" : `completed with ${recipients_skipped} skipped recipient${recipients_skipped === 1 ? "" : "s"}`}.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
        <table style="width:100%;font-size:13px;color:#475569;">
          <tr><td style="padding:4px 0;">Period</td><td style="text-align:right;">${escapeHtml(period_start)} – ${escapeHtml(period_end)}</td></tr>
          <tr><td style="padding:4px 0;">Invoices generated</td><td style="text-align:right;">${invoice_count}</td></tr>
          <tr><td style="padding:4px 0;">Recipients skipped</td><td style="text-align:right;">${recipients_skipped}</td></tr>
          <tr><td style="padding:4px 0;">Recipients total</td><td style="text-align:right;">${recipients_total}</td></tr>
        </table>
      </div>
      ${errorSummary}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:16px 0 0;">
        Open the recurring billing tab in the app to review the run and address the skipped recipients.
      </p>`;

    const ctaUrl = `${FRONTEND_URL}/settings/recurring-billing`;
    const ctaLabel = "Open recurring billing";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:${headerColor};padding:32px;text-align:center;">
      <div style="background:rgba(255,255,255,.2);display:inline-block;padding:12px;border-radius:50%;margin-bottom:12px;">
        <div style="font-size:28px;">${icon}</div>
      </div>
      <h1 style="color:#fff;font-size:22px;margin:0;">${escapeHtml(heading)}</h1>
    </div>
    <div style="padding:32px;">
      ${bodyHtml}
      <div style="text-align:center;margin:24px 0;">
        <a href="${ctaUrl}" style="display:inline-block;background:#1e293b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(ctaLabel)}</a>
      </div>
    </div>
    <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">Sent to the finance team of ${orgName} by LessonLoop</p>
    </div>
  </div>
</body>
</html>`;

    let sentOk = false;
    if (resendApiKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: `${sanitiseFromName(org?.name || "LessonLoop")} <billing@lessonloop.net>`,
            to: recipients.map((r) => r.email),
            subject,
            html: emailHtml,
          }),
        });
        sentOk = emailResponse.ok;
        if (!emailResponse.ok) {
          console.error("Resend API error:", await emailResponse.text());
        }
      } catch (err) {
        console.error("Resend send failed:", err);
      }
    } else {
      console.log("RESEND_API_KEY not configured — skipping recurring alert send");
    }

    // Single batched message_log row (matches dispute-notification pattern).
    await supabase.from("message_log").insert({
      org_id,
      channel: "email",
      subject,
      body: "",
      sender_user_id: null,
      recipient_type: "finance_team",
      recipient_id: recipients[0]?.userId ?? null,
      recipient_email: recipients.map((r) => r.email).join(", "),
      recipient_name: recipients.map((r) => r.name).join(", "),
      message_type: "recurring_run_alert",
      related_id: dedupKey,
      related_type: "recurring_template_run",
      status: sentOk ? "sent" : "failed",
      sent_at: sentOk ? new Date().toISOString() : null,
      source: "recurring_scheduler_alert",
    });

    return new Response(JSON.stringify({ success: true, notified: recipients.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Recurring billing alert error:", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: "An internal error occurred." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
