import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, sanitiseFromName } from "../_shared/escape-html.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

interface FailureSample {
  guardian_id: string;
  guardian_name: string;
  invoice_number: string;
  amount_minor: number;
  error_code: string | null;
  error_message: string | null;
  is_paused: boolean;
}

interface AutoPayAlertRequest {
  org_id: string;
  run_date: string;
  total_attempts: number;
  succeeded: number;
  failed: number;
  requires_action: number;
  paused_today: number;
  failure_samples: FailureSample[];
}

const CURRENCY = (minor: number) => `£${(minor / 100).toFixed(2)}`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Service-role auth — exact match.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${supabaseServiceKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: AutoPayAlertRequest = await req.json();
    const {
      org_id,
      run_date,
      total_attempts,
      succeeded,
      failed,
      requires_action,
      paused_today,
      failure_samples,
    } = body;

    if (!org_id || !run_date) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Idempotency: 6-hour dedup keyed on org_id (message_log.related_id is a
    // uuid column, so we can't pack run_date into it; the cron runs once
    // daily and this window covers any re-trigger within the same day).
    const { data: existingSent } = await supabase
      .from("message_log")
      .select("id")
      .eq("message_type", "auto_pay_run_alert")
      .eq("related_id", org_id)
      .eq("status", "sent")
      .gte("sent_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (existingSent && existingSent.length > 0) {
      console.log(`Auto-pay alert already sent for org ${org_id} within 6h — skipping`);
      return new Response(
        JSON.stringify({ success: true, message: "Already sent recently" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
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
      console.log("No active finance-team members for org; skipping auto-pay alert");
      return new Response(
        JSON.stringify({ success: true, message: "No finance-team recipients" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
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
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const orgName = escapeHtml(org?.name || "Your academy");

    const subject = paused_today > 0
      ? `⚠️ Auto-pay run — ${failed + requires_action} failed, ${paused_today} paused (${run_date})`
      : `⚠️ Auto-pay run — ${failed + requires_action} failed (${run_date})`;

    const samples = failure_samples.slice(0, 10);
    const overflow = failure_samples.length > 10 ? failure_samples.length - 10 : 0;

    const samplesRows = samples.length > 0
      ? samples.map((s) => `
        <tr>
          <td style="padding:8px 6px;font-size:13px;color:#334155;border-bottom:1px solid #e2e8f0;">${escapeHtml(s.guardian_name || "Unknown")}${s.is_paused ? ' <span style="background:#fef2f2;color:#991b1b;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600;">paused</span>' : ""}</td>
          <td style="padding:8px 6px;font-size:13px;color:#334155;border-bottom:1px solid #e2e8f0;">${escapeHtml(s.invoice_number || "")}</td>
          <td style="padding:8px 6px;font-size:13px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;">${CURRENCY(s.amount_minor)}</td>
          <td style="padding:8px 6px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0;"><code style="background:#f1f5f9;padding:1px 5px;border-radius:3px;">${escapeHtml(s.error_code || "—")}</code></td>
        </tr>`).join("")
      : "";

    const overflowFooter = overflow > 0
      ? `<p style="margin:8px 0 0;color:#64748b;font-size:12px;">…and ${overflow} more</p>`
      : "";

    const ctaUrl = `${FRONTEND_URL}/dashboard`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Auto-pay run summary</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
  <div style="max-width:620px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:linear-gradient(135deg,#d97706,#ea580c);padding:32px;text-align:center;">
      <div style="background:rgba(255,255,255,.2);display:inline-block;padding:12px;border-radius:50%;margin-bottom:12px;">
        <div style="font-size:28px;">⚠️</div>
      </div>
      <h1 style="color:#fff;font-size:22px;margin:0;">Auto-pay run had failures</h1>
      <p style="color:rgba(255,255,255,.85);font-size:13px;margin:6px 0 0;">${escapeHtml(run_date)}</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Today's auto-pay run for <strong>${orgName}</strong> didn't go cleanly.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
        <table style="width:100%;font-size:13px;color:#475569;">
          <tr><td style="padding:4px 0;">Total attempts</td><td style="text-align:right;font-weight:600;">${total_attempts}</td></tr>
          <tr><td style="padding:4px 0;color:#16a34a;">Succeeded</td><td style="text-align:right;font-weight:600;color:#16a34a;">${succeeded}</td></tr>
          <tr><td style="padding:4px 0;color:#dc2626;">Failed</td><td style="text-align:right;font-weight:600;color:#dc2626;">${failed}</td></tr>
          <tr><td style="padding:4px 0;color:#b45309;">Requires action (3DS)</td><td style="text-align:right;font-weight:600;color:#b45309;">${requires_action}</td></tr>
          <tr><td style="padding:4px 0;color:#991b1b;">Paused today</td><td style="text-align:right;font-weight:600;color:#991b1b;">${paused_today}</td></tr>
        </table>
      </div>
      ${samples.length > 0 ? `
      <p style="color:#475569;font-size:13px;font-weight:600;margin:20px 0 8px;">Failure samples</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:8px 6px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Guardian</th>
            <th style="padding:8px 6px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Invoice</th>
            <th style="padding:8px 6px;text-align:right;font-size:11px;color:#94a3b8;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Amount</th>
            <th style="padding:8px 6px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Code</th>
          </tr>
        </thead>
        <tbody>${samplesRows}</tbody>
      </table>
      ${overflowFooter}` : ""}
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#1e293b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Open dashboard</a>
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
      console.log("RESEND_API_KEY not configured — skipping auto-pay alert send");
    }

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
      message_type: "auto_pay_run_alert",
      related_id: org_id,
      related_type: "auto_pay_run",
      status: sentOk ? "sent" : "failed",
      sent_at: sentOk ? new Date().toISOString() : null,
      source: "auto_pay_cron",
    });

    return new Response(
      JSON.stringify({ success: true, notified: recipients.length }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error(
      "Auto-pay alert error:",
      error instanceof Error ? error.message : error,
    );
    return new Response(
      JSON.stringify({ error: "An internal error occurred." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

serve(handler);
