import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { log } from "../_shared/log.ts";

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

    const refundAmount = amount ? Math.round(amount) : maxRefundable;

    if (refundAmount <= 0) throw new Error("Refund amount must be greater than zero");
    if (refundAmount > maxRefundable) {
      throw new Error(`Maximum refundable amount is ${maxRefundable}. Already refunded: ${totalRefunded}`);
    }

    // Process refund via Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Determine if this is a Connect payment
    const { data: orgConnect } = await supabase
      .from("organisations")
      .select("stripe_connect_account_id")
      .eq("id", payment.org_id)
      .single();

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: payment.provider_reference,
      amount: refundAmount,
      reason: "requested_by_customer",
    };

    let stripeRefund: Stripe.Refund;
    if (orgConnect?.stripe_connect_account_id) {
      stripeRefund = await stripe.refunds.create(refundParams, {
        stripeAccount: orgConnect.stripe_connect_account_id,
      });
    } else {
      stripeRefund = await stripe.refunds.create(refundParams);
    }

    log(`Stripe refund created: ${stripeRefund.id}, amount: ${refundAmount}`);

    // Record the refund
    const { data: refundRecord, error: refundInsertError } = await supabase
      .from("refunds")
      .insert({
        payment_id: paymentId,
        invoice_id: payment.invoice_id,
        org_id: payment.org_id,
        amount_minor: refundAmount,
        reason: reason || null,
        status: stripeRefund.status === "succeeded" ? "succeeded" : "pending",
        stripe_refund_id: stripeRefund.id,
        refunded_by: user.id,
      })
      .select("id")
      .single();

    if (refundInsertError) {
      console.error("Failed to record refund:", refundInsertError);
      // Refund happened on Stripe side — don't throw, but log
    }

    // Recalculate invoice paid_minor
    const { data: allPayments } = await supabase
      .from("payments")
      .select("amount_minor")
      .eq("invoice_id", payment.invoice_id);

    const { data: allRefunds } = await supabase
      .from("refunds")
      .select("amount_minor")
      .eq("invoice_id", payment.invoice_id)
      .eq("status", "succeeded");

    const totalPaid = (allPayments || []).reduce((sum: number, p: any) => sum + p.amount_minor, 0);
    const totalRefundedNow = (allRefunds || []).reduce((sum: number, r: any) => sum + r.amount_minor, 0);
    const netPaid = totalPaid - totalRefundedNow;

    const { data: invoice } = await supabase
      .from("invoices")
      .select("total_minor, status")
      .eq("id", payment.invoice_id)
      .single();

    const invoiceUpdate: Record<string, unknown> = { paid_minor: netPaid };
    if (invoice && netPaid < invoice.total_minor && invoice.status === "paid") {
      // Reopen invoice since it's no longer fully paid
      invoiceUpdate.status = "sent";
    }

    await supabase
      .from("invoices")
      .update(invoiceUpdate)
      .eq("id", payment.invoice_id);

    log(`Invoice recalculated after refund: net_paid=${netPaid}`);

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
