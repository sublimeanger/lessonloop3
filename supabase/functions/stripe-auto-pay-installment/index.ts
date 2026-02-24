import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Auto-pay cron function.
 * Finds installments due today (or overdue) where the guardian has auto-pay enabled,
 * and creates off-session PaymentIntents to charge their default card.
 *
 * Intended to be called daily via pg_cron or a Supabase scheduled invocation.
 */
serve(async (req) => {
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is authorized (service role or cron secret)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.includes(supabaseServiceKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Find all due/overdue installments with auto-pay enabled
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
          currency_code,
          status
        )
      `)
      .in("status", ["pending", "overdue"])
      .lte("due_date", today);

    if (queryError) {
      console.error("Failed to query installments:", queryError);
      throw new Error(`Query failed: ${queryError.message}`);
    }

    if (!installments || installments.length === 0) {
      return new Response(JSON.stringify({ message: "No installments due", processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failed = 0;
    const results: Array<{ installmentId: string; status: string; error?: string }> = [];

    for (const inst of installments) {
      const invoice = (inst as any).invoices;
      if (!invoice || !invoice.payer_guardian_id) continue;
      if (!["sent", "overdue"].includes(invoice.status)) continue;

      // Check if guardian has auto-pay enabled
      const { data: prefs } = await supabase
        .from("guardian_payment_preferences")
        .select("stripe_customer_id, default_payment_method_id, auto_pay_enabled")
        .eq("guardian_id", invoice.payer_guardian_id)
        .eq("org_id", invoice.org_id)
        .maybeSingle();

      if (!prefs?.auto_pay_enabled || !prefs.stripe_customer_id || !prefs.default_payment_method_id) {
        continue;
      }

      // Check if this installment was already paid
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("id")
        .eq("invoice_id", inst.invoice_id)
        .eq("amount_minor", inst.amount_minor)
        .gte("paid_at", `${inst.due_date}T00:00:00Z`)
        .maybeSingle();

      if (existingPayment) continue;

      // Get org details for Connect routing
      const { data: org } = await supabase
        .from("organisations")
        .select("stripe_connect_account_id, platform_fee_percent")
        .eq("id", invoice.org_id)
        .single();

      try {
        const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
          amount: inst.amount_minor,
          currency: (invoice.currency_code || "gbp").toLowerCase(),
          customer: prefs.stripe_customer_id,
          payment_method: prefs.default_payment_method_id,
          off_session: true,
          confirm: true,
          metadata: {
            lessonloop_invoice_id: inst.invoice_id,
            lessonloop_installment_id: inst.id,
            lessonloop_org_id: invoice.org_id,
            lessonloop_auto_pay: "true",
          },
        };

        // Stripe Connect routing
        const stripeOpts: Stripe.RequestOptions = {};
        if (org?.stripe_connect_account_id) {
          paymentIntentParams.transfer_data = {
            destination: org.stripe_connect_account_id,
          };
          if (org.platform_fee_percent && org.platform_fee_percent > 0) {
            paymentIntentParams.application_fee_amount = Math.round(
              inst.amount_minor * (org.platform_fee_percent / 100)
            );
          }
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams, stripeOpts);

        if (paymentIntent.status === "succeeded") {
          // The webhook will handle recording the payment, so we just log success
          results.push({ installmentId: inst.id, status: "succeeded" });
          processed++;
        } else {
          results.push({ installmentId: inst.id, status: paymentIntent.status });
          if (paymentIntent.status === "requires_action") {
            // Card requires authentication — can't be done off-session
            // Notify the parent to pay manually
            console.log(`Installment ${inst.id} requires authentication, skipping auto-pay`);
          }
          failed++;
        }
      } catch (err: any) {
        console.error(`Auto-pay failed for installment ${inst.id}:`, err.message);
        results.push({ installmentId: inst.id, status: "failed", error: err.message });
        failed++;

        // If card declined, notify the parent
        if (err.code === "card_declined" || err.type === "StripeCardError") {
          // Could trigger a notification email here in a future iteration
          console.log(`Card declined for installment ${inst.id} — manual payment required`);
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "Auto-pay complete", processed, failed, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in stripe-auto-pay-installment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
