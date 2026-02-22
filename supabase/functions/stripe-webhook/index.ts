import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PLAN_LIMITS } from "../_shared/plan-config.ts";

// Structured logging: only emits in non-production environments
const isProduction = Deno.env.get("ENVIRONMENT") === "production";
const log = (msg: string) => { if (!isProduction) console.log(`[stripe-webhook] ${msg}`); };
const truncate = (id: string | null | undefined) => id ? `...${id.slice(-8)}` : "none";

// Reverse lookup: Stripe price ID → LessonLoop plan key
const PRICE_TO_PLAN: Record<string, string> = {};
const priceEnvPairs = [
  ["STRIPE_PRICE_TEACHER_MONTHLY", "solo_teacher"],
  ["STRIPE_PRICE_TEACHER_YEARLY", "solo_teacher"],
  ["STRIPE_PRICE_STUDIO_MONTHLY", "academy"],
  ["STRIPE_PRICE_STUDIO_YEARLY", "academy"],
  ["STRIPE_PRICE_AGENCY_MONTHLY", "agency"],
  ["STRIPE_PRICE_AGENCY_YEARLY", "agency"],
];
for (const [envKey, planKey] of priceEnvPairs) {
  const priceId = Deno.env.get(envKey);
  if (priceId) PRICE_TO_PLAN[priceId] = planKey;
}

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

    log(`Processing event: ${event.type}`);

    // Deduplication: Stripe can retry webhooks up to ~100 times over 3 days.
    // Record the event ID to ensure exactly-once processing.
    const { error: dedupError } = await supabase
      .from("stripe_webhook_events")
      .insert({ event_id: event.id, event_type: event.type });

    if (dedupError?.code === "23505") {
      log(`Duplicate event ${truncate(event.id)}, skipping`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

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
          log(`Subscription payment succeeded for: ${truncate(invoice.subscription as string)}`);
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
        console.error(`Payment failed: ${truncate(paymentIntent.id)}`, paymentIntent.last_payment_error?.message);
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(supabase, account);
        break;
      }

      default:
        log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    // Returning 500 causes Stripe to retry the webhook (up to ~16 times over 3 days).
    // Critical DB failures in handlers re-throw here to trigger retries.
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

  log(`Subscription checkout completed for org ${truncate(orgId)}, plan: ${plan}`);

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
      past_due_since: null, // Clear any past_due grace period
    })
    .eq("id", orgId);

  if (error) {
    console.error("Failed to update org subscription:", error);
    // Re-throw so Stripe receives 500 and retries the webhook
    throw new Error(`DB update failed for subscription checkout: ${error.message}`);
  }
  log(`Org ${truncate(orgId)} upgraded to ${plan}`);
}

// Handle invoice payment checkout completion
async function handleInvoiceCheckoutCompleted(supabase: any, session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.lessonloop_invoice_id;
  const installmentId = session.metadata?.lessonloop_installment_id || null;
  const payRemaining = session.metadata?.lessonloop_pay_remaining === "true";
  
  if (!invoiceId) {
    console.error("No invoice ID in session metadata");
    return;
  }

  log(`Checkout completed for invoice ${truncate(invoiceId)}, installment: ${truncate(installmentId)}, payRemaining: ${payRemaining}`);

  const paymentIntentId = session.payment_intent as string;

  // DOUBLE PAYMENT GUARD: Check if payment with this provider_reference already exists
  if (paymentIntentId) {
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("provider_reference", paymentIntentId)
      .maybeSingle();

    if (existingPayment) {
      log(`Payment already recorded for PI ${truncate(paymentIntentId)}, skipping`);
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
      amount_minor: checkoutSession?.amount_minor || session.amount_total,
      method: "card",
      provider: "stripe",
      provider_reference: paymentIntentId,
      paid_at: new Date().toISOString(),
    });

  if (paymentError) {
    if (paymentError.code === '23505') {
      log(`Duplicate payment prevented by DB constraint for PI ${truncate(paymentIntentId)}`);
      return;
    }
    console.error("Failed to record payment:", paymentError);
    return;
  }

  // ─── Installment reconciliation ───────────────────────────

  // If pay_remaining, mark all pending/overdue installments as paid
  if (payRemaining) {
    const { error: bulkUpdateError } = await supabase
      .from("invoice_installments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("invoice_id", invoiceId)
      .in("status", ["pending", "overdue"]);

    if (bulkUpdateError) {
      console.error("Failed to bulk-update installments:", bulkUpdateError);
    }
  }

  // If specific installment, store the stripe payment intent on it
  if (installmentId) {
    const { error: instUpdateError } = await supabase
      .from("invoice_installments")
      .update({
        stripe_payment_intent_id: paymentIntentId,
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", installmentId);

    if (instUpdateError) {
      console.error("Failed to update installment with payment intent:", instUpdateError);
    }
  }

  // Update paid_minor on the invoice
  const { data: payments } = await supabase
    .from("payments")
    .select("amount_minor")
    .eq("invoice_id", invoiceId);

  const totalPaid = payments?.reduce((sum: number, p: any) => sum + p.amount_minor, 0) || 0;

  // Update paid_minor and check if fully paid
  const { data: invoice } = await supabase
    .from("invoices")
    .select("total_minor")
    .eq("id", invoiceId)
    .single();

  const updateData: Record<string, unknown> = { paid_minor: totalPaid };
  if (invoice && totalPaid >= invoice.total_minor) {
    updateData.status = "paid";
  }

  const { error: invoiceUpdateError } = await supabase
    .from("invoices")
    .update(updateData)
    .eq("id", invoiceId);

  if (invoiceUpdateError) {
    console.error("Failed to update invoice:", invoiceUpdateError);
  } else {
    log(`Invoice ${truncate(invoiceId)} updated: paid_minor=${totalPaid}${totalPaid >= (invoice?.total_minor || 0) ? ', status=paid' : ''}`);
  }
}

async function handleCheckoutExpired(supabase: any, session: Stripe.Checkout.Session) {
  const { error } = await supabase
    .from("stripe_checkout_sessions")
    .update({ status: "expired" })
    .eq("stripe_session_id", session.id);

  if (error) {
    console.error("Failed to update expired session:", error);
  }
}

async function handleSubscriptionCreated(supabase: any, subscription: Stripe.Subscription) {
  const orgId = subscription.metadata?.lessonloop_org_id;
  const plan = subscription.metadata?.lessonloop_plan;
  
  if (!orgId) {
    log("Subscription created without org ID — likely handled in checkout");
    return;
  }

  log(`Subscription created for org ${truncate(orgId)}`);

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
    throw new Error(`DB update failed for subscription created: ${error.message}`);
  }
}

async function handleSubscriptionUpdated(supabase: any, subscription: Stripe.Subscription) {
  // Detect plan from current price (handles portal plan changes)
  let detectedPlan: string | undefined;
  const currentPriceId = subscription.items?.data?.[0]?.price?.id;
  if (currentPriceId && PRICE_TO_PLAN[currentPriceId]) {
    detectedPlan = PRICE_TO_PLAN[currentPriceId];
  }

  if (detectedPlan && detectedPlan !== subscription.metadata?.lessonloop_plan) {
    log(`Plan change detected via price: ${subscription.metadata?.lessonloop_plan} → ${detectedPlan}`);
  }

  const orgId = subscription.metadata?.lessonloop_org_id;
  
  // Detect pending cancellation (cancel_at_period_end)
  const isPendingCancellation = subscription.cancel_at_period_end === true && subscription.status === "active";
  const cancelsAtTs = isPendingCancellation && subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

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

  if (!orgId) {
    // Try to find org by subscription ID
    const { data: org } = await supabase
      .from("organisations")
      .select("id")
      .eq("stripe_subscription_id", subscription.id)
      .single();
    
    if (!org) {
      log("Cannot find org for subscription update");
      return;
    }
    
    const plan = detectedPlan || subscription.metadata?.lessonloop_plan;
    const limits = plan ? (PLAN_LIMITS[plan] || PLAN_LIMITS.solo_teacher) : undefined;

    const updateData: Record<string, unknown> = { subscription_status: status, cancels_at: cancelsAtTs };
    if (status === "active") {
      updateData.past_due_since = null;
    }
    if (plan) {
      updateData.subscription_plan = plan;
    }
    if (limits) {
      updateData.max_students = limits.max_students;
      updateData.max_teachers = limits.max_teachers;
    }

    const { error } = await supabase
      .from("organisations")
      .update(updateData)
      .eq("id", org.id);

    if (error) {
      console.error("Failed to update org subscription status:", error);
      throw new Error(`DB update failed for subscription update (lookup): ${error.message}`);
    }
    log(`Org ${truncate(org.id)} subscription updated to ${status}${plan ? `, plan: ${plan}` : ''}`);
    return;
  }

  // If we have orgId in metadata
  const plan = detectedPlan || subscription.metadata?.lessonloop_plan;
  const limits = PLAN_LIMITS[plan || "solo_teacher"] || PLAN_LIMITS.solo_teacher;

  const { error } = await supabase
    .from("organisations")
    .update({
      subscription_plan: plan || undefined,
      subscription_status: status,
      max_students: limits.max_students,
      max_teachers: limits.max_teachers,
      past_due_since: status === "active" ? null : undefined,
      cancels_at: cancelsAtTs,
    })
    .eq("id", orgId);

  if (error) {
    console.error("Failed to update org on subscription update:", error);
    throw new Error(`DB update failed for subscription update: ${error.message}`);
  }
  log(`Org ${truncate(orgId)} subscription updated: ${status}${plan ? `, plan: ${plan}` : ''}`);
}

async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  // Find org by subscription ID
  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (!org) {
    log("Cannot find org for deleted subscription");
    return;
  }

  // Mark as cancelled and restrict DB-level limits so triggers block new inserts
  const { CANCELLED_LIMITS } = await import("../_shared/plan-config.ts");
  const { error } = await supabase
    .from("organisations")
    .update({
      subscription_status: "cancelled",
      stripe_subscription_id: null,
      max_students: CANCELLED_LIMITS.max_students,
      max_teachers: CANCELLED_LIMITS.max_teachers,
    })
    .eq("id", org.id);

  if (error) {
    console.error("Failed to update org on subscription deletion:", error);
    throw new Error(`DB update failed for subscription deletion: ${error.message}`);
  }
  log(`Org ${truncate(org.id)} subscription cancelled`);
}

async function handleAccountUpdated(supabase: any, account: Stripe.Account) {
  const orgId = account.metadata?.lessonloop_org_id;
  
  const resolveOrgId = async (): Promise<string | null> => {
    if (orgId) return orgId;
    const { data: org } = await supabase
      .from("organisations")
      .select("id")
      .eq("stripe_connect_account_id", account.id)
      .single();
    return org?.id || null;
  };

  const resolvedOrgId = await resolveOrgId();
  if (!resolvedOrgId) {
    log("Cannot find org for account.updated event");
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
    .eq("id", resolvedOrgId);

  if (error) {
    console.error("Failed to update org connect status:", error);
  } else {
    log(`Org ${truncate(resolvedOrgId)} Connect status → ${newStatus}`);
  }
}

async function handleSubscriptionPaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  
  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!org) {
    log("Cannot find org for payment failure");
    return;
  }

  const { error } = await supabase
    .from("organisations")
    .update({
      subscription_status: "past_due",
      past_due_since: new Date().toISOString(),
    })
    .eq("id", org.id);

  if (error) {
    console.error("Failed to update org on payment failure:", error);
    throw new Error(`DB update failed for payment failure: ${error.message}`);
  }
  log(`Org ${truncate(org.id)} marked past_due`);
}
