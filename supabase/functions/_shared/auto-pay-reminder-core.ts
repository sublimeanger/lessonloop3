// J10-F5 / J10-F6 — shared core for auto-pay heads-up reminders.
//
// Two cadences fire from this body:
//   - leadDays=3, messageType='auto_pay_reminder' (proactive 3-day notice)
//   - leadDays=1, messageType='auto_pay_final_reminder' (24-hour final)
//
// Both kept; not a replacement. Dedup is keyed on messageType +
// related_id, so the two cadences never conflate.
//
// Per-installment work: query installments whose due_date is exactly
// today + leadDays, look up guardian payment prefs, fetch PM brand /
// last4 / expiry from Stripe (best-effort), warn if expiry precedes
// charge month, send via Resend, log to message_log. Failures on any
// single installment do not abort the loop.

import Stripe from "https://esm.sh/stripe@14.21.0";
import { escapeHtml } from "./escape-html.ts";
import { isNotificationEnabled } from "./check-notification-pref.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

// Brand label dictionary lifted from PaymentMethodsCard.tsx so the
// reminder copy matches the in-app card list. Keep the two in sync —
// they don't share a module because edge fns can't import from src/.
const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  diners: "Diners",
  jcb: "JCB",
  unionpay: "UnionPay",
};

function getBrandLabel(brand: string): string {
  return BRAND_LABELS[brand] || brand.charAt(0).toUpperCase() + brand.slice(1);
}

interface CardDetails {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface SendOpts {
  leadDays: 1 | 3;
  messageType: string;
}

interface SendResult {
  message: string;
  sent: number;
}

export async function sendAutoPayReminders(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  opts: SendOpts,
): Promise<SendResult> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2023-10-16" }) : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() + opts.leadDays);
  const targetDateStr = targetDate.toISOString().split("T")[0];

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
    .in("status", ["pending", "partially_paid"])
    .eq("due_date", targetDateStr);

  if (queryError) {
    throw new Error(`Query failed: ${queryError.message}`);
  }

  if (!installments || installments.length === 0) {
    return { message: "No upcoming installments", sent: 0 };
  }

  let sent = 0;

  for (const inst of installments) {
    // deno-lint-ignore no-explicit-any
    const invoice = (inst as any).invoices;
    if (!invoice?.payer_guardian_id) continue;

    const { data: prefs } = await supabase
      .from("guardian_payment_preferences")
      .select("stripe_customer_id, default_payment_method_id, auto_pay_enabled")
      .eq("guardian_id", invoice.payer_guardian_id)
      .eq("org_id", invoice.org_id)
      .maybeSingle();

    if (!prefs?.auto_pay_enabled || !prefs.default_payment_method_id) continue;

    const { data: guardian } = await supabase
      .from("guardians")
      .select("full_name, email, user_id")
      .eq("id", invoice.payer_guardian_id)
      .single();

    if (!guardian?.email) continue;

    if (guardian.user_id) {
      const prefEnabled = await isNotificationEnabled(
        supabase, invoice.org_id, guardian.user_id, "email_invoice_reminders",
      );
      if (!prefEnabled) {
        console.log(`Guardian ${invoice.payer_guardian_id} opted out of invoice reminders`);
        continue;
      }
    }

    const { data: org } = await supabase
      .from("organisations")
      .select("name, currency_code")
      .eq("id", invoice.org_id)
      .single();

    if (!org) continue;

    const currency = invoice.currency_code || org.currency_code || "GBP";
    const formatAmount = (minor: number) =>
      new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(minor / 100);

    // J7-F4: outstanding (not nominal) so partially_paid reminders
    // match what Stripe will actually charge.
    const { data: priorPayments } = await supabase
      .from("payments")
      .select("id, amount_minor")
      .eq("installment_id", inst.id);
    // deno-lint-ignore no-explicit-any
    const priorPaymentIds = (priorPayments || []).map((p: any) => p.id);
    let priorRefunded = 0;
    if (priorPaymentIds.length > 0) {
      const { data: priorRefundRows } = await supabase
        .from("refunds")
        .select("amount_minor")
        .in("payment_id", priorPaymentIds)
        .eq("status", "succeeded");
      priorRefunded = (priorRefundRows || []).reduce(
        // deno-lint-ignore no-explicit-any
        (s: number, r: any) => s + r.amount_minor, 0,
      );
    }
    const priorApplied = (priorPayments || []).reduce(
      // deno-lint-ignore no-explicit-any
      (s: number, p: any) => s + p.amount_minor, 0,
    ) - priorRefunded;
    const outstanding = inst.amount_minor - priorApplied;

    if (outstanding < 100) continue;

    const amountStr = formatAmount(outstanding);
    const dueDate = new Date(inst.due_date);
    const dueDateStr = dueDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // J10-F5: fetch PM brand/last4/expiry from Stripe so the email
    // matches the saved-cards list. Best-effort — a detached PM,
    // network blip, or missing API key falls through to the legacy
    // 'your saved card' wording.
    let card: CardDetails | null = null;
    let cardExpiringBeforeCharge = false;

    if (stripe) {
      try {
        const pm = await stripe.paymentMethods.retrieve(prefs.default_payment_method_id);
        if (pm.card) {
          card = {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          };
          // J10-F6: card.exp_year/exp_month is the LAST month the
          // card is valid. If charge falls after that month, expiry
          // beats charge.
          const chargeYear = dueDate.getFullYear();
          const chargeMonth = dueDate.getMonth() + 1;
          if (
            card.expYear < chargeYear ||
            (card.expYear === chargeYear && card.expMonth < chargeMonth)
          ) {
            cardExpiringBeforeCharge = true;
          }
        }
      } catch (err) {
        console.error(
          `[auto-pay-reminder-core] Stripe PM retrieve failed for guardian ${invoice.payer_guardian_id}:`,
          err,
        );
      }
    }

    const cardInfo = card
      ? `${getBrandLabel(card.brand)} ending ${card.last4} (expires ${
        String(card.expMonth).padStart(2, "0")
      }/${card.expYear})`
      : "your saved card";

    const baseSubject = opts.leadDays === 1
      ? `Final reminder: auto-payment tomorrow — ${amountStr}`
      : `Upcoming auto-payment: ${amountStr} on ${dueDateStr}`;
    const subject = cardExpiringBeforeCharge
      ? `[Action needed] ${baseSubject}`
      : baseSubject;

    const portalLink = `${FRONTEND_URL}/portal/invoices?invoice=${inst.invoice_id}`;
    const profileLink = `${FRONTEND_URL}/portal/profile`;

    const expiryWarningBlock = cardExpiringBeforeCharge
      ? `<div style="border: 2px solid #dc2626; background: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; color: #991b1b;">
          <strong>⚠ Your card expires before this payment date.</strong><br>
          Please <a href="${profileLink}" style="color: #991b1b; text-decoration: underline;">update your card details</a> to avoid a failed payment.
        </div>`
      : "";

    const heading = opts.leadDays === 1 ? "Auto-Payment Tomorrow" : "Upcoming Auto-Payment";
    const intro = opts.leadDays === 1
      ? "This is a final reminder that your scheduled auto-payment will be processed tomorrow:"
      : "This is a heads-up that your scheduled auto-payment will be processed soon:";

    const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333; margin-bottom: 20px;">${heading}</h1>
      <p>Dear ${escapeHtml(guardian.full_name || "Parent")},</p>
      <p>${intro}</p>

      ${expiryWarningBlock}

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
        <a href="${profileLink}" style="color: #2563eb;">profile settings</a>.
      </p>

      <p style="text-align: center; margin: 20px 0;">
        <a href="${portalLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Invoice</a>
      </p>

      <p>Thank you,<br>${escapeHtml(org.name)}</p>
    </div>`;

    // Dedup: skip if a reminder of THIS messageType already sent today
    // for this installment. J7-F5: exclude status='failed' so a
    // previously-failed send doesn't block same-day retry.
    const { data: existing } = await supabase
      .from("message_log")
      .select("id")
      .eq("related_id", inst.id)
      .eq("message_type", opts.messageType)
      .in("status", ["sent", "pending", "logged"])
      .gte("created_at", today.toISOString())
      .limit(1);
    if (existing && existing.length > 0) continue;

    await supabase.from("message_log").insert({
      org_id: invoice.org_id,
      channel: "email",
      subject,
      body: htmlContent,
      recipient_email: guardian.email,
      recipient_name: guardian.full_name,
      recipient_type: "guardian",
      related_id: inst.id,
      message_type: opts.messageType,
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
            headers: {
              "List-Unsubscribe": `<${FRONTEND_URL}/portal/settings?tab=notifications>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }),
        });

        if (response.ok) {
          sent++;
          await supabase
            .from("message_log")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("related_id", inst.id)
            .eq("message_type", opts.messageType)
            .order("created_at", { ascending: false })
            .limit(1);
        }
      } catch (err) {
        console.error(`Failed to send reminder for installment ${inst.id}:`, err);
      }
    }
  }

  return { message: "Reminders sent", sent };
}
