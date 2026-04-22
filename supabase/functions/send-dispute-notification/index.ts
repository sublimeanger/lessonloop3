import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, sanitiseFromName } from "../_shared/escape-html.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

interface DisputeNotificationRequest {
  disputeId: string;
  orgId: string;
  event: "opened" | "won" | "lost" | "closed";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${supabaseServiceKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { disputeId, orgId, event }: DisputeNotificationRequest = await req.json();

    if (!disputeId || !orgId || !event) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Idempotency: 5-minute window per dispute + event.
    const dedupKey = `dispute-${disputeId}-${event}`;
    const { data: existingSent } = await supabase
      .from("message_log")
      .select("id")
      .eq("message_type", "dispute_notification")
      .eq("related_id", dedupKey)
      .eq("status", "sent")
      .gte("sent_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(1);

    if (existingSent && existingSent.length > 0) {
      console.log(`Dispute notification already sent for ${dedupKey} — skipping`);
      return new Response(
        JSON.stringify({ success: true, message: "Already sent recently" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch dispute + invoice + org context.
    const { data: dispute } = await supabase
      .from("payment_disputes")
      .select(`
        id, amount_minor, currency_code, reason, status, outcome,
        evidence_due_by, stripe_dashboard_url,
        invoice_id, payment_id, org_id
      `)
      .eq("id", disputeId)
      .single();

    if (!dispute) {
      return new Response(JSON.stringify({ error: "Dispute not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("invoice_number, payer_guardian_id, payer_student_id")
      .eq("id", dispute.invoice_id)
      .single();

    const { data: org } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", orgId)
      .single();

    // Resolve org owners (not individual parents — this is an operator alert).
    const { data: owners } = await supabase
      .from("org_memberships")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role", "owner")
      .eq("status", "active");

    const ownerIds = (owners || []).map((o: any) => o.user_id);
    if (ownerIds.length === 0) {
      console.log("No active owners to notify for dispute");
      return new Response(
        JSON.stringify({ success: true, message: "No owners" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch owner email addresses via auth.users admin API.
    const ownerEmails: { userId: string; email: string; name: string }[] = [];
    for (const userId of ownerIds) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      if (authUser?.user?.email) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();
        ownerEmails.push({
          userId,
          email: authUser.user.email,
          name: profile?.full_name || authUser.user.email.split("@")[0],
        });
      }
    }

    if (ownerEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No owner emails resolvable" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const formatAmount = (minor: number) =>
      new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: dispute.currency_code?.toUpperCase() || "GBP",
      }).format(minor / 100);

    const formattedAmount = formatAmount(dispute.amount_minor);
    const orgName = escapeHtml(org?.name || "Your academy");
    const invoiceNumber = escapeHtml(invoice?.invoice_number || "Unknown");
    const stripeUrl = escapeHtml(dispute.stripe_dashboard_url || "https://dashboard.stripe.com/disputes");

    // Compose subject + body by event type.
    let subject: string;
    let heading: string;
    let bodyHtml: string;
    let ctaLabel: string;
    let ctaUrl: string;
    let headerColor: string;
    let icon: string;

    if (event === "opened") {
      subject = `⚠️ Chargeback opened — ${formattedAmount} — ${invoiceNumber}`;
      heading = "Chargeback opened";
      headerColor = "linear-gradient(135deg,#dc2626,#ea580c)";
      icon = "⚠️";
      const deadline = dispute.evidence_due_by
        ? new Date(dispute.evidence_due_by).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "not specified";
      bodyHtml = `
        <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
          A cardholder has disputed a payment of <strong>${formattedAmount}</strong> on invoice <strong>${invoiceNumber}</strong>.
        </p>
        <p style="color:#dc2626;font-size:14px;line-height:1.6;margin:0 0 16px;font-weight:600;">
          Evidence must be submitted by ${deadline}, or the dispute will default to lost.
        </p>
        <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 16px;">
          <strong>Reason:</strong> ${escapeHtml(dispute.reason)}
        </p>
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 16px;">
          Submit evidence directly in the Stripe dashboard (you'll need your Stripe login). LessonLoop shows the dispute in-app on the invoice detail page.
        </p>`;
      ctaLabel = "Submit evidence on Stripe";
      ctaUrl = stripeUrl;
    } else if (event === "won") {
      subject = `✅ Chargeback won — ${formattedAmount} — ${invoiceNumber}`;
      heading = "Chargeback won";
      headerColor = "linear-gradient(135deg,#059669,#10b981)";
      icon = "✅";
      bodyHtml = `
        <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
          The chargeback of <strong>${formattedAmount}</strong> on invoice <strong>${invoiceNumber}</strong> was resolved in your favour. Funds remain with you.
        </p>
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 16px;">
          No further action needed.
        </p>`;
      ctaLabel = "View invoice";
      ctaUrl = `${FRONTEND_URL}/invoices/${dispute.invoice_id}`;
    } else if (event === "lost") {
      subject = `❌ Chargeback lost — ${formattedAmount} — ${invoiceNumber}`;
      heading = "Chargeback lost";
      headerColor = "linear-gradient(135deg,#991b1b,#7f1d1d)";
      icon = "❌";
      bodyHtml = `
        <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
          The chargeback of <strong>${formattedAmount}</strong> on invoice <strong>${invoiceNumber}</strong> was resolved against you. Funds have been permanently returned to the cardholder.
        </p>
        <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 16px;">
          LessonLoop has automatically recorded a compensating refund and updated the invoice to show the amount as outstanding.
        </p>
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 16px;">
          You may wish to follow up with the parent directly regarding payment.
        </p>`;
      ctaLabel = "View invoice";
      ctaUrl = `${FRONTEND_URL}/invoices/${dispute.invoice_id}`;
    } else {
      // "closed" generic — covers warning_closed and charge_refunded outcomes.
      subject = `Chargeback closed — ${formattedAmount} — ${invoiceNumber}`;
      heading = "Chargeback closed";
      headerColor = "linear-gradient(135deg,#64748b,#475569)";
      icon = "ℹ️";
      bodyHtml = `
        <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
          The dispute on invoice <strong>${invoiceNumber}</strong> has closed. No money movement resulted.
        </p>
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 16px;">
          Outcome: ${escapeHtml(dispute.outcome ?? dispute.status)}
        </p>`;
      ctaLabel = "View invoice";
      ctaUrl = `${FRONTEND_URL}/invoices/${dispute.invoice_id}`;
    }

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
      <p style="margin:0;color:#94a3b8;font-size:12px;">Sent to account owners of ${orgName} by LessonLoop</p>
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
            to: ownerEmails.map((o) => o.email),
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
      console.log("RESEND_API_KEY not configured — skipping dispute notification send");
    }

    // Log (single row for the batch — recipient_email = comma-joined).
    await supabase.from("message_log").insert({
      org_id: orgId,
      channel: "email",
      subject,
      body: "",
      sender_user_id: null,
      recipient_type: "owner",
      recipient_id: ownerEmails[0]?.userId ?? null,
      recipient_email: ownerEmails.map((o) => o.email).join(", "),
      recipient_name: ownerEmails.map((o) => o.name).join(", "),
      message_type: "dispute_notification",
      related_id: dedupKey,
      related_type: "dispute",
      status: sentOk ? "sent" : "failed",
      sent_at: sentOk ? new Date().toISOString() : null,
    });

    return new Response(JSON.stringify({ success: true, notified: ownerEmails.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Dispute notification error:", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: "An internal error occurred." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
