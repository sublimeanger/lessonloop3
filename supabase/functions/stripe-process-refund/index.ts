import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { log } from "../_shared/log.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

/**
 * Process a full or partial refund for a Stripe payment.
 * Auth: owner/admin, or any role in solo_teacher orgs (canManageBilling equivalent).
 * Body: { paymentId: string, amount?: number (minor), reason?: string }
 */
serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // REF-M3: Rate limiting — 5 refunds per hour per user
    const rlResult = await checkRateLimit(user.id, "stripe-process-refund");
    if (!rlResult.allowed) {
      return rateLimitResponse(corsHeaders, rlResult);
    }

    const { paymentId, amount, reason } = await req.json();
    if (!paymentId) throw new Error("paymentId is required");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id, invoice_id, org_id, amount_minor, provider, provider_reference, method")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) throw new Error("Payment not found");
    if (payment.provider !== "stripe" || !payment.provider_reference) {
      throw new Error("Only Stripe payments can be refunded through this flow");
    }

    // REF-H3: Check invoice status — block refunds on voided/draft/cancelled invoices
    const { data: invoice } = await supabase
      .from("invoices")
      .select("status")
      .eq("id", payment.invoice_id)
      .single();

    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === "void") throw new Error("Cannot refund a voided invoice");
    if (invoice.status === "cancelled") throw new Error("Cannot refund a cancelled invoice");
    if (invoice.status === "draft") throw new Error("Cannot refund an unpaid invoice");

    // Verify permissions: owner/admin, or any role in solo_teacher org
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", payment.org_id)
      .eq("status", "active")
      .single();

    if (!membership) throw new Error("Not a member of this organisation");

    const { data: org } = await supabase
      .from("organisations")
      .select("org_type, currency_code")
      .eq("id", payment.org_id)
      .single();

    if (!org) throw new Error("Organisation not found");

    const isAdminRole = ["owner", "admin"].includes(membership.role);
    const isSoloTeacher = org.org_type === "solo_teacher";

    if (!isAdminRole && !isSoloTeacher) {
      throw new Error("Insufficient permissions to process refunds");
    }

    // Calculate refundable amount (original - already refunded)
    const { data: existingRefunds } = await supabase
      .from("refunds")
      .select("amount_minor")
      .eq("payment_id", paymentId)
      .eq("status", "succeeded");

    const totalRefunded = (existingRefunds || []).reduce(
      (sum: number, r: any) => sum + r.amount_minor, 0
    );
    const maxRefundable = payment.amount_minor - totalRefunded;

    if (maxRefundable <= 0) {
      throw new Error("This payment has already been fully refunded");
    }

    // REF-M2: Use != null to distinguish "no amount" (full) from zero (invalid)
    const refundAmount = amount != null ? Math.round(amount) : maxRefundable;

    if (refundAmount <= 0) throw new Error("Refund amount must be greater than zero");
    if (refundAmount > maxRefundable) {
      throw new Error(`Maximum refundable amount is ${maxRefundable}. Already refunded: ${totalRefunded}`);
    }

    // Process refund via Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Insert a pending refund row BEFORE calling Stripe API
    const { data: refundRecord, error: refundInsertError } = await supabase
      .from("refunds")
      .insert({
        payment_id: paymentId,
        invoice_id: payment.invoice_id,
        org_id: payment.org_id,
        amount_minor: refundAmount,
        reason: reason || null,
        status: "pending",
        stripe_refund_id: null,
        refunded_by: user.id,
      })
      .select("id")
      .single();

    if (refundInsertError) {
      console.error("Failed to insert pending refund record:", refundInsertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create refund record" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: payment.provider_reference,
      amount: refundAmount,
      reason: "requested_by_customer",
    };

    // PAY-H3 FIX: Always refund on the platform account.
    // LessonLoop uses destination charges (transfer_data.destination) for Connect,
    // so refunds must be issued on the platform — NOT on the connected account.
    // Stripe automatically reverses the transfer to the connected account.
    let stripeRefund: Stripe.Refund;
    try {
      stripeRefund = await stripe.refunds.create(refundParams);
    } catch (stripeErr) {
      // Stripe rejected the refund — mark DB row as failed
      await supabase.from("refunds").update({ status: "failed" }).eq("id", refundRecord.id);
      throw stripeErr;
    }

    log(`Stripe refund created: ${stripeRefund.id}, amount: ${refundAmount}`);

    // Update the pending refund row with Stripe result
    const finalStatus = stripeRefund.status === "succeeded" ? "succeeded" : "pending";
    const { error: refundUpdateError } = await supabase
      .from("refunds")
      .update({ status: finalStatus, stripe_refund_id: stripeRefund.id })
      .eq("id", refundRecord.id);

    if (refundUpdateError) {
      console.error("Failed to update refund record after Stripe success:", refundUpdateError);
      return new Response(
        JSON.stringify({ success: false, error: "Stripe refund succeeded but DB update failed", stripeRefundId: stripeRefund.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Atomically recalculate invoice paid_minor
    const { error: recalcError } = await supabase.rpc('recalculate_invoice_paid', {
      _invoice_id: payment.invoice_id,
    });

    if (recalcError) {
      console.error("Failed to recalculate invoice after refund:", recalcError);
    }

    log(`Invoice recalculated after refund`);

    // REF-H1: Audit log entry for admin-initiated refund
    await supabase.from("audit_log").insert({
      org_id: payment.org_id,
      actor_user_id: user.id,
      action: "refund_processed",
      entity_type: "invoice",
      entity_id: payment.invoice_id,
      after: {
        refund_id: refundRecord.id,
        payment_id: paymentId,
        amount_minor: refundAmount,
        stripe_refund_id: stripeRefund.id,
        status: finalStatus,
        reason: reason || null,
        source: "admin_initiated",
      },
    });

    // Trigger refund notification email (best-effort, non-blocking)
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-refund-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          refundId: refundRecord?.id,
          paymentId,
          invoiceId: payment.invoice_id,
          orgId: payment.org_id,
          amountMinor: refundAmount,
          currencyCode: org.currency_code || "GBP",
        }),
      });
    } catch (err) {
      console.error("Failed to trigger refund notification:", err);
    }

    return new Response(
      JSON.stringify({
        success: true,
        refundId: refundRecord?.id,
        stripeRefundId: stripeRefund.id,
        amountMinor: refundAmount,
        status: stripeRefund.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Refund error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }, status: 400 }
    );
  }
});
