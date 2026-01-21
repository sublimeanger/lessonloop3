import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey || !webhookSecret) {
      throw new Error("Stripe configuration missing");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", message);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Processing Stripe event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session);
        break;
      }
      
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutExpired(supabase, session);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment failed:", paymentIntent.id, paymentIntent.last_payment_error?.message);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function handleCheckoutCompleted(supabase: any, session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.lessonloop_invoice_id;
  
  if (!invoiceId) {
    console.error("No invoice ID in session metadata");
    return;
  }

  console.log(`Processing completed checkout for invoice: ${invoiceId}`);

  // Update our checkout session record
  const { error: updateSessionError } = await supabase
    .from("stripe_checkout_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      stripe_payment_intent_id: session.payment_intent,
    })
    .eq("stripe_session_id", session.id);

  if (updateSessionError) {
    console.error("Failed to update checkout session:", updateSessionError);
  }

  // Get the checkout session record to get org_id
  const { data: checkoutSession } = await supabase
    .from("stripe_checkout_sessions")
    .select("org_id, amount_minor")
    .eq("stripe_session_id", session.id)
    .single();

  // Record the payment
  const { error: paymentError } = await supabase
    .from("invoice_payments")
    .insert({
      invoice_id: invoiceId,
      org_id: checkoutSession?.org_id,
      amount_minor: session.amount_total || checkoutSession?.amount_minor,
      payment_method: "card",
      reference: `Stripe: ${session.payment_intent}`,
      paid_at: new Date().toISOString(),
    });

  if (paymentError) {
    console.error("Failed to record payment:", paymentError);
    return;
  }

  // Check if invoice is fully paid
  const { data: invoice } = await supabase
    .from("invoices")
    .select("total_minor")
    .eq("id", invoiceId)
    .single();

  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("amount_minor")
    .eq("invoice_id", invoiceId);

  const totalPaid = payments?.reduce((sum: number, p: any) => sum + p.amount_minor, 0) || 0;

  if (invoice && totalPaid >= invoice.total_minor) {
    // Mark invoice as paid
    const { error: invoiceUpdateError } = await supabase
      .from("invoices")
      .update({ status: "paid" })
      .eq("id", invoiceId);

    if (invoiceUpdateError) {
      console.error("Failed to update invoice status:", invoiceUpdateError);
    } else {
      console.log(`Invoice ${invoiceId} marked as paid`);
    }
  }

  console.log(`Payment recorded for invoice ${invoiceId}: ${session.amount_total}`);
}

async function handleCheckoutExpired(supabase: any, session: Stripe.Checkout.Session) {
  const { error } = await supabase
    .from("stripe_checkout_sessions")
    .update({ status: "expired" })
    .eq("stripe_session_id", session.id);

  if (error) {
    console.error("Failed to update expired session:", error);
  } else {
    console.log(`Checkout session expired: ${session.id}`);
  }
}
