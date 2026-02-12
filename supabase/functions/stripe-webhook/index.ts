import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Unlimited students for all plans - matches pricing-config.ts
const PLAN_LIMITS: Record<string, { max_students: number; max_teachers: number }> = {
  solo_teacher: { max_students: 9999, max_teachers: 1 },
  academy: { max_students: 9999, max_teachers: 5 },
  agency: { max_students: 9999, max_teachers: 9999 },
};

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
      // Invoice payment events (for one-off invoice payments)
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Check if this is a subscription checkout or invoice payment
        if (session.mode === "subscription") {
          await handleSubscriptionCheckoutCompleted(supabase, stripe, session);
        } else {
          await handleInvoiceCheckoutCompleted(supabase, session);
        }
        break;
      }
      
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutExpired(supabase, session);
        break;
      }

      // Subscription lifecycle events
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(supabase, subscription);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          console.log(`Subscription payment succeeded for: ${invoice.subscription}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await handleSubscriptionPaymentFailed(supabase, invoice);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment failed:", paymentIntent.id, paymentIntent.last_payment_error?.message);
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(supabase, account);
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

// Handle subscription checkout completion
async function handleSubscriptionCheckoutCompleted(
  supabase: any, 
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  const orgId = session.metadata?.lessonloop_org_id;
  const plan = session.metadata?.lessonloop_plan;
  
  if (!orgId) {
    console.error("No org ID in subscription session metadata");
    return;
  }

  console.log(`Subscription checkout completed for org: ${orgId}, plan: ${plan}`);

  // Get the subscription details
  const subscriptionId = session.subscription as string;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Update organisation with subscription details
  const limits = PLAN_LIMITS[plan || "solo_teacher"] || PLAN_LIMITS.solo_teacher;
  
  const { error } = await supabase
    .from("organisations")
    .update({
      subscription_plan: plan || "solo_teacher",
      subscription_status: "active",
      stripe_subscription_id: subscriptionId,
      max_students: limits.max_students,
      max_teachers: limits.max_teachers,
      trial_ends_at: null, // Clear trial since now on paid plan
    })
    .eq("id", orgId);

  if (error) {
    console.error("Failed to update org subscription:", error);
  } else {
    console.log(`Org ${orgId} upgraded to ${plan}`);
  }
}

// Handle invoice payment checkout completion
async function handleInvoiceCheckoutCompleted(supabase: any, session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.lessonloop_invoice_id;
  
  if (!invoiceId) {
    console.error("No invoice ID in session metadata");
    return;
  }

  console.log(`Processing completed checkout for invoice: ${invoiceId}`);

  const paymentIntentId = session.payment_intent as string;

  // DOUBLE PAYMENT GUARD: Check if payment with this provider_reference already exists
  if (paymentIntentId) {
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("provider_reference", paymentIntentId)
      .maybeSingle();

    if (existingPayment) {
      console.log(`Payment already recorded for payment_intent: ${paymentIntentId}, skipping duplicate`);
      return;
    }
  }

  // Update our checkout session record
  const { error: updateSessionError } = await supabase
    .from("stripe_checkout_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId,
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
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      org_id: checkoutSession?.org_id,
      amount_minor: session.amount_total || checkoutSession?.amount_minor,
      method: "card",
      provider: "stripe",
      provider_reference: paymentIntentId,
      paid_at: new Date().toISOString(),
    });

  if (paymentError) {
    // Check if it's a duplicate key error (another safety net)
    if (paymentError.code === '23505') {
      console.log(`Duplicate payment prevented by database constraint for: ${paymentIntentId}`);
      return;
    }
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
    .from("payments")
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

async function handleSubscriptionCreated(supabase: any, subscription: Stripe.Subscription) {
  const orgId = subscription.metadata?.lessonloop_org_id;
  const plan = subscription.metadata?.lessonloop_plan;
  
  if (!orgId) {
    console.log("Subscription created without org ID - likely handled in checkout");
    return;
  }

  console.log(`Subscription created for org: ${orgId}`);

  const limits = PLAN_LIMITS[plan || "solo_teacher"] || PLAN_LIMITS.solo_teacher;

  const { error } = await supabase
    .from("organisations")
    .update({
      subscription_plan: plan || "solo_teacher",
      subscription_status: subscription.status === "active" ? "active" : "trialing",
      stripe_subscription_id: subscription.id,
      max_students: limits.max_students,
      max_teachers: limits.max_teachers,
    })
    .eq("id", orgId);

  if (error) {
    console.error("Failed to update org on subscription created:", error);
  }
}

async function handleSubscriptionUpdated(supabase: any, subscription: Stripe.Subscription) {
  const orgId = subscription.metadata?.lessonloop_org_id;
  
  if (!orgId) {
    // Try to find org by subscription ID
    const { data: org } = await supabase
      .from("organisations")
      .select("id")
      .eq("stripe_subscription_id", subscription.id)
      .single();
    
    if (!org) {
      console.log("Cannot find org for subscription update");
      return;
    }
    
    // Map Stripe status to our status
    let status: string;
    switch (subscription.status) {
      case "active":
        status = "active";
        break;
      case "past_due":
        status = "past_due";
        break;
      case "canceled":
        status = "cancelled";
        break;
      case "paused":
        status = "paused";
        break;
      default:
        status = "active";
    }

    const { error } = await supabase
      .from("organisations")
      .update({ subscription_status: status })
      .eq("id", org.id);

    if (error) {
      console.error("Failed to update org subscription status:", error);
    } else {
      console.log(`Org ${org.id} subscription status updated to ${status}`);
    }
    return;
  }

  // If we have orgId in metadata
  const plan = subscription.metadata?.lessonloop_plan;
  const limits = PLAN_LIMITS[plan || "solo_teacher"] || PLAN_LIMITS.solo_teacher;

  let status: string;
  switch (subscription.status) {
    case "active":
      status = "active";
      break;
    case "past_due":
      status = "past_due";
      break;
    case "canceled":
      status = "cancelled";
      break;
    case "paused":
      status = "paused";
      break;
    default:
      status = "active";
  }

  const { error } = await supabase
    .from("organisations")
    .update({
      subscription_plan: plan || undefined,
      subscription_status: status,
      max_students: limits.max_students,
      max_teachers: limits.max_teachers,
    })
    .eq("id", orgId);

  if (error) {
    console.error("Failed to update org on subscription update:", error);
  } else {
    console.log(`Org ${orgId} subscription updated: ${status}`);
  }
}

async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  // Find org by subscription ID
  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (!org) {
    console.log("Cannot find org for deleted subscription");
    return;
  }

  // Downgrade to trial/cancelled state
  const { error } = await supabase
    .from("organisations")
    .update({
      subscription_status: "cancelled",
      stripe_subscription_id: null,
    })
    .eq("id", org.id);

  if (error) {
    console.error("Failed to update org on subscription deletion:", error);
  } else {
    console.log(`Org ${org.id} subscription cancelled`);
  }
}

async function handleAccountUpdated(supabase: any, account: Stripe.Account) {
  const orgId = account.metadata?.lessonloop_org_id;
  if (!orgId) {
    // Try to find org by connect account ID
    const { data: org } = await supabase
      .from("organisations")
      .select("id")
      .eq("stripe_connect_account_id", account.id)
      .single();

    if (!org) {
      console.log("Cannot find org for account.updated event");
      return;
    }

    const newStatus = account.charges_enabled && account.payouts_enabled
      ? "active"
      : account.details_submitted
      ? "restricted"
      : "pending";

    const updateData: Record<string, unknown> = { stripe_connect_status: newStatus };
    if (newStatus === "active") {
      updateData.stripe_connect_onboarded_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("organisations")
      .update(updateData)
      .eq("id", org.id);

    if (error) {
      console.error("Failed to update org connect status:", error);
    } else {
      console.log(`Org ${org.id} Connect status updated to ${newStatus}`);
    }
    return;
  }

  // Has orgId in metadata
  const newStatus = account.charges_enabled && account.payouts_enabled
    ? "active"
    : account.details_submitted
    ? "restricted"
    : "pending";

  const updateData: Record<string, unknown> = { stripe_connect_status: newStatus };
  if (newStatus === "active") {
    updateData.stripe_connect_onboarded_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("organisations")
    .update(updateData)
    .eq("id", orgId);

  if (error) {
    console.error("Failed to update org connect status:", error);
  } else {
    console.log(`Org ${orgId} Connect status updated to ${newStatus}`);
  }
}

async function handleSubscriptionPaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  
  // Find org by subscription ID
  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!org) {
    console.log("Cannot find org for payment failure");
    return;
  }

  // Mark as past due
  const { error } = await supabase
    .from("organisations")
    .update({ subscription_status: "past_due" })
    .eq("id", org.id);

  if (error) {
    console.error("Failed to update org on payment failure:", error);
  } else {
    console.log(`Org ${org.id} marked as past_due due to payment failure`);
  }
}
