import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

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

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Rate limit
    const rateCheck = await checkRateLimit(user.id, "stripe-refund");
    if (!rateCheck.allowed) {
      return rateLimitResponse(corsHeaders, rateCheck);
    }

    const { paymentId, amountMinor, reason } = await req.json();
    if (!paymentId) throw new Error("paymentId is required");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch payment and verify org membership
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id, invoice_id, org_id, amount_minor, provider, provider_reference")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) throw new Error("Payment not found");

    // Verify caller is owner/admin/finance
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", payment.org_id)
      .eq("status", "active")
      .single();

    if (!membership || !["owner", "admin", "finance"].includes(membership.role)) {
      throw new Error("Only owners, admins, and finance staff can issue refunds");
    }

    // Validate payment is a Stripe payment
    if (payment.provider !== "stripe" || !payment.provider_reference) {
      throw new Error("Only Stripe payments can be refunded through this endpoint");
    }

    // Calculate max refundable amount (payment minus existing refunds)
    const { data: existingRefunds } = await supabase
      .from("refunds")
      .select("amount_minor")
      .eq("payment_id", paymentId)
      .in("status", ["pending", "succeeded"]);

    const totalRefunded = existingRefunds?.reduce(
      (sum: number, r: { amount_minor: number }) => sum + r.amount_minor, 0
    ) || 0;
    const maxRefundable = payment.amount_minor - totalRefunded;

    if (maxRefundable <= 0) {
      throw new Error("This payment has already been fully refunded");
    }

    // Determine refund amount (full if not specified)
    const refundAmount = amountMinor || maxRefundable;

    if (refundAmount <= 0) throw new Error("Refund amount must be positive");
    if (refundAmount > maxRefundable) {
      throw new Error(`Refund amount (${refundAmount}) exceeds refundable balance (${maxRefundable})`);
    }

    // Create refund record first (pending)
    const { data: refundRecord, error: insertError } = await supabase
      .from("refunds")
      .insert({
        org_id: payment.org_id,
        payment_id: paymentId,
        invoice_id: payment.invoice_id,
        amount_minor: refundAmount,
        reason: reason || null,
        status: "pending",
        initiated_by: user.id,
      })
      .select("id")
      .single();

    if (insertError || !refundRecord) {
      throw new Error("Failed to create refund record");
    }

    // Issue refund via Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    try {
      const stripeRefund = await stripe.refunds.create({
        payment_intent: payment.provider_reference,
        amount: refundAmount,
        reason: "requested_by_customer",
        reverse_transfer: true,
        refund_application_fee: true,
      }, {
        idempotencyKey: `refund_${refundRecord.id}`,
      });

      // Update refund record with Stripe details
      await supabase
        .from("refunds")
        .update({
          stripe_refund_id: stripeRefund.id,
          stripe_charge_id: stripeRefund.charge as string,
          status: stripeRefund.status === "succeeded" ? "succeeded" : "pending",
          completed_at: stripeRefund.status === "succeeded" ? new Date().toISOString() : null,
        })
        .eq("id", refundRecord.id);

      // If succeeded immediately, update invoice paid_minor
      if (stripeRefund.status === "succeeded") {
        await reconcileInvoicePaidMinor(supabase, payment.invoice_id);
      }

      // Audit log
      await supabase.rpc("log_audit_event", {
        _org_id: payment.org_id,
        _user_id: user.id,
        _action: "refund_issued",
        _entity_type: "payment",
        _entity_id: paymentId,
        _details: {
          refund_id: refundRecord.id,
          amount_minor: refundAmount,
          stripe_refund_id: stripeRefund.id,
          reason: reason || null,
        },
      });

      return new Response(
        JSON.stringify({
          refundId: refundRecord.id,
          stripeRefundId: stripeRefund.id,
          amountMinor: refundAmount,
          status: stripeRefund.status === "succeeded" ? "succeeded" : "pending",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } catch (stripeError: unknown) {
      // Mark our refund record as failed
      await supabase
        .from("refunds")
        .update({ status: "failed" })
        .eq("id", refundRecord.id);

      const msg = stripeError instanceof Error ? stripeError.message : "Stripe refund failed";
      throw new Error(msg);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe refund error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});

/** Recalculate paid_minor on an invoice after a refund */
async function reconcileInvoicePaidMinor(supabase: any, invoiceId: string) {
  // Sum all payments
  const { data: payments } = await supabase
    .from("payments")
    .select("amount_minor")
    .eq("invoice_id", invoiceId);
  const totalPaid = payments?.reduce(
    (sum: number, p: { amount_minor: number }) => sum + p.amount_minor, 0
  ) || 0;

  // Sum all succeeded refunds
  const { data: refunds } = await supabase
    .from("refunds")
    .select("amount_minor")
    .eq("invoice_id", invoiceId)
    .eq("status", "succeeded");
  const totalRefunded = refunds?.reduce(
    (sum: number, r: { amount_minor: number }) => sum + r.amount_minor, 0
  ) || 0;

  const netPaid = totalPaid - totalRefunded;

  // Update invoice
  const { data: invoice } = await supabase
    .from("invoices")
    .select("total_minor, status")
    .eq("id", invoiceId)
    .single();

  const updateData: Record<string, unknown> = { paid_minor: netPaid };

  // If invoice was paid but now has refunds, reopen it
  if (invoice?.status === "paid" && netPaid < invoice.total_minor) {
    updateData.status = "sent";
  }

  await supabase.from("invoices").update(updateData).eq("id", invoiceId);
}
