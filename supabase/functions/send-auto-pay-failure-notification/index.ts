import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, sanitiseFromName } from "../_shared/escape-html.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

interface FailureNotificationRequest {
  org_id: string;
  invoice_id: string;
  installment_id: string;
  guardian_id: string;
  attempt_id: string;
  amount_minor: number;
  currency_code: string;
  error_code: string | null;
  error_type: string | null;
  stripe_status: string | null;
  invoice_number: string;
  is_pause_threshold: boolean;
  consecutive_failure_count: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  AUD: "A$",
  CAD: "C$",
};

function formatAmount(minorUnits: number, currencyCode: string): string {
  const code = (currencyCode || "GBP").toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code];
  const value = (minorUnits / 100).toFixed(2);
  return symbol ? `${symbol}${value}` : `${code} ${value}`;
}

interface ErrorCopy {
  subject: string;
  headline: string;
  action: string;
}

function copyForError(
  errorCode: string | null,
  stripeStatus: string | null,
  invoiceNumber: string,
): ErrorCopy {
  const inv = invoiceNumber || "your invoice";

  if (errorCode === "expired_card") {
    return {
      subject: `[Action needed] Your card has expired — ${inv}`,
      headline: "Your card on file has expired",
      action: "Update your card in the parent portal.",
    };
  }
  if (errorCode === "insufficient_funds") {
    return {
      subject: `Payment failed (insufficient funds) — ${inv}`,
      headline: "We couldn't take payment — insufficient funds",
      action: "Top up your account or update your card; we'll retry tomorrow.",
    };
  }
  if (
    stripeStatus === "requires_action" ||
    errorCode === "authentication_required" ||
    errorCode === "authentication_not_handled"
  ) {
    return {
      subject: `[Action needed] Bank authentication required — ${inv}`,
      headline: "Your bank requires you to authenticate this payment",
      action:
        "Pay manually from the parent portal — your bank will prompt you to authenticate.",
    };
  }
  if (errorCode === "card_not_supported") {
    return {
      subject: `Your card isn't supported — ${inv}`,
      headline: "This card type isn't accepted",
      action: "Try a different card from the parent portal.",
    };
  }
  if (errorCode === "card_declined") {
    return {
      subject: `Payment failed — ${inv}`,
      headline: "Your bank declined the payment",
      action: "Check with your bank or update your card in the parent portal.",
    };
  }
  return {
    subject: `Payment failed — ${inv}`,
    headline: "We couldn't take your payment",
    action: "Please pay manually or update your card in the parent portal.",
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Service-role auth — exact match (mirrors send-recurring-billing-alert
    // and send-refund-notification).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${supabaseServiceKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: FailureNotificationRequest = await req.json();
    const {
      org_id,
      invoice_id,
      installment_id,
      guardian_id,
      attempt_id,
      amount_minor,
      currency_code,
      error_code,
      error_type,
      stripe_status,
      invoice_number,
      is_pause_threshold,
      consecutive_failure_count,
    } = body;

    if (!org_id || !invoice_id || !installment_id || !guardian_id || !attempt_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Dedup via auto_pay_attempts. The most recent prior attempt for this
    // installment that already had its notification sent within the last 20h
    // is compared by stripe_error_code: if the code matches, dedup; if it
    // changed (e.g. yesterday card_declined -> today expired_card), the
    // change is informative and we send again.
    const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
    const { data: priorNotified } = await supabase
      .from("auto_pay_attempts")
      .select("id, stripe_error_code, attempted_at")
      .eq("installment_id", installment_id)
      .eq("notification_sent", true)
      .neq("id", attempt_id)
      .gte("attempted_at", twentyHoursAgo)
      .order("attempted_at", { ascending: false })
      .limit(1);

    if (priorNotified && priorNotified.length > 0) {
      const prior = priorNotified[0];
      const sameCode = (prior.stripe_error_code ?? null) === (error_code ?? null);
      if (sameCode) {
        console.log(
          `Auto-pay failure notification deduped for installment ${installment_id} (same error_code within 20h)`,
        );
        return new Response(
          JSON.stringify({ sent: false, deduped: true }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // Fetch guardian + org for personalisation.
    const { data: guardian } = await supabase
      .from("guardians")
      .select("email, full_name")
      .eq("id", guardian_id)
      .single();

    if (!guardian?.email) {
      console.log(`No guardian email for ${guardian_id} — skipping notification`);
      return new Response(
        JSON.stringify({ sent: false, deduped: false, message: "No guardian email" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const { data: org } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", org_id)
      .single();

    const orgName = escapeHtml(org?.name || "Your academy");
    const safeFirstName = escapeHtml((guardian.full_name || "there").split(" ")[0]);
    const safeInvoiceNumber = escapeHtml(invoice_number || "");
    const formattedAmount = formatAmount(amount_minor, currency_code);
    const copy = copyForError(error_code, stripe_status, invoice_number);

    const ctaUrl = `${FRONTEND_URL}/portal/invoices/${invoice_id}`;

    const pausedBlock = is_pause_threshold
      ? `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 6px;color:#991b1b;font-size:14px;font-weight:600;">Auto-payment is now paused</p>
        <p style="margin:0;color:#7f1d1d;font-size:13px;line-height:1.5;">
          Auto-payment has been paused for your account after ${consecutive_failure_count} failed attempts.
          You'll need to re-enable it from the parent portal once you've fixed the issue above.
          We won't try to charge your card again until you do.
        </p>
      </div>`
      : "";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(copy.headline)}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:32px;text-align:center;">
      <div style="background:rgba(255,255,255,.2);display:inline-block;padding:12px;border-radius:50%;margin-bottom:12px;">
        <div style="font-size:28px;">⚠️</div>
      </div>
      <h1 style="color:#fff;font-size:22px;margin:0;">${escapeHtml(copy.headline)}</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px;">Hi ${safeFirstName},</p>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        We tried to take an automatic payment of <strong>${formattedAmount}</strong> for invoice
        <strong>${safeInvoiceNumber}</strong> but it didn't go through.
      </p>
      <div style="background:#f1f5f9;border-radius:10px;padding:18px;margin:0 0 16px;">
        <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">${escapeHtml(copy.action)}</p>
      </div>
      ${pausedBlock}
      <div style="text-align:center;margin:24px 0;">
        <a href="${ctaUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
          ${is_pause_threshold ? "Open the parent portal" : "View invoice & pay"}
        </a>
      </div>
    </div>
    <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">Sent by ${orgName} via <a href="${FRONTEND_URL}" style="color:#2563eb;text-decoration:none;">LessonLoop</a></p>
    </div>
  </div>
</body>
</html>`;

    let emailOk = false;
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
            to: [guardian.email],
            subject: copy.subject,
            html: emailHtml,
          }),
        });
        emailOk = emailResponse.ok;
        if (!emailResponse.ok) {
          console.error("Resend API error:", await emailResponse.text());
        }
      } catch (err) {
        console.error("Resend send failed:", err);
      }
    } else {
      console.log("RESEND_API_KEY not configured — skipping auto-pay failure send");
    }

    // Log to message_log. error_message holds error_code|attempt_id so the
    // dedup query in future runs (which uses auto_pay_attempts as the source
    // of truth) is corroborated by message_log if anyone audits.
    await supabase.from("message_log").insert({
      org_id,
      channel: "email",
      subject: copy.subject,
      body: "",
      sender_user_id: null,
      recipient_type: "guardian",
      recipient_id: guardian_id,
      recipient_email: guardian.email,
      recipient_name: guardian.full_name || null,
      message_type: "auto_pay_failure",
      related_id: installment_id,
      related_type: "invoice_installment",
      status: emailOk ? "sent" : "failed",
      sent_at: emailOk ? new Date().toISOString() : null,
      source: "auto_pay_cron",
      error_message: emailOk
        ? null
        : `attempt:${attempt_id} code:${error_code ?? "unknown"} type:${error_type ?? "unknown"}`,
    });

    // Mark this attempt as notified so the next run can dedup against it.
    if (emailOk) {
      const { error: markErr } = await supabase
        .from("auto_pay_attempts")
        .update({ notification_sent: true })
        .eq("id", attempt_id);
      if (markErr) {
        console.error("Failed to mark notification_sent on attempt:", markErr);
      }
    }

    return new Response(
      JSON.stringify({ sent: emailOk, deduped: false }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error(
      "Auto-pay failure notification error:",
      error instanceof Error ? error.message : error,
    );
    return new Response(
      JSON.stringify({ error: "An internal error occurred." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

serve(handler);
