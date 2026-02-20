import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Trial period in days
const TRIAL_DAYS = 30;

// ─── CANONICAL PLAN CONFIG ───────────────────────────────────────
// DB enum values: solo_teacher, academy, agency
// User-facing keys: teacher, studio, agency
// All incoming plan keys are normalised via CANONICAL_KEY before lookup.
// ─────────────────────────────────────────────────────────────────

/** Normalise any incoming plan key to a canonical key */
const CANONICAL_KEY: Record<string, string> = {
  solo_teacher: 'teacher',
  academy: 'studio',
  teacher: 'teacher',
  studio: 'studio',
  agency: 'agency',
};

/** Stripe Price IDs per canonical plan */
const PLAN_PRICES: Record<string, { monthly: string; yearly: string }> = {
  teacher: {
    monthly: Deno.env.get("STRIPE_PRICE_TEACHER_MONTHLY") || "price_teacher_monthly",
    yearly: Deno.env.get("STRIPE_PRICE_TEACHER_YEARLY") || "price_teacher_yearly",
  },
  studio: {
    monthly: Deno.env.get("STRIPE_PRICE_STUDIO_MONTHLY") || "price_studio_monthly",
    yearly: Deno.env.get("STRIPE_PRICE_STUDIO_YEARLY") || "price_studio_yearly",
  },
  agency: {
    monthly: Deno.env.get("STRIPE_PRICE_AGENCY_MONTHLY") || "price_agency_monthly",
    yearly: Deno.env.get("STRIPE_PRICE_AGENCY_YEARLY") || "price_agency_yearly",
  },
};

/** Plan limits per canonical plan */
const PLAN_LIMITS: Record<string, { max_students: number; max_teachers: number }> = {
  teacher: { max_students: 9999, max_teachers: 1 },
  studio: { max_students: 9999, max_teachers: 5 },
  agency: { max_students: 9999, max_teachers: 9999 },
};

/** Canonical key → DB enum value (for writing to organisations table) */
const DB_PLAN_MAP: Record<string, string> = {
  teacher: 'solo_teacher',
  studio: 'academy',
  agency: 'agency',
};

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Create client for auth check
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Parse request
    const { orgId, plan, billingInterval, successUrl, cancelUrl } = await req.json();
    
    if (!orgId || !plan) {
      throw new Error("orgId and plan are required");
    }

    // Normalise plan key to canonical form
    const canonicalPlan = CANONICAL_KEY[plan];
    if (!canonicalPlan) {
      throw new Error("Invalid plan");
    }

    const interval = billingInterval === "yearly" ? "yearly" : "monthly";

    // Create service role client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is owner/admin of this org
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Only org owners/admins can manage subscriptions");
    }

    // Fetch org details
    const { data: org, error: orgError } = await supabase
      .from("organisations")
      .select("id, name, stripe_customer_id, stripe_subscription_id, subscription_plan, subscription_status")
      .eq("id", orgId)
      .single();

    if (orgError || !org) {
      throw new Error("Organisation not found");
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get or create Stripe customer
    let customerId = org.stripe_customer_id;
    
    if (!customerId) {
      // Get user profile for email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", user.id)
        .single();

      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        name: profile?.full_name || org.name,
        metadata: {
          lessonloop_org_id: orgId,
          lessonloop_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to org
      await supabase
        .from("organisations")
        .update({ stripe_customer_id: customerId })
        .eq("id", orgId);
    }

    // If org already has an active subscription, redirect to customer portal instead
    if (org.stripe_subscription_id && org.subscription_status === 'active') {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: successUrl || `${req.headers.get("origin")}/settings?tab=billing`,
      });

      return new Response(
        JSON.stringify({ 
          type: "portal",
          url: portalSession.url 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Get the price ID for the selected plan (using canonical key)
    const priceId = PLAN_PRICES[canonicalPlan]?.[interval];
    if (!priceId) {
      throw new Error("Invalid plan configuration");
    }

    // Get plan limits
    const planLimits = PLAN_LIMITS[canonicalPlan] || PLAN_LIMITS.teacher;
    const dbPlanKey = DB_PLAN_MAP[canonicalPlan] || canonicalPlan;

    // Build success/cancel URLs
    const baseUrl = successUrl?.split("?")[0] || `${req.headers.get("origin")}/settings`;
    const finalSuccessUrl = `${baseUrl}?tab=billing&subscription=success`;
    const finalCancelUrl = cancelUrl || `${baseUrl}?tab=billing&subscription=cancelled`;

    // Create Stripe Checkout Session for subscription
    // No Stripe trial - trial is handled in-app, subscription starts immediately when upgrading
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      subscription_data: {
        metadata: {
          lessonloop_org_id: orgId,
          lessonloop_plan: dbPlanKey,
          max_students: planLimits.max_students.toString(),
          max_teachers: planLimits.max_teachers.toString(),
        },
        // No trial_period_days - trial is handled in-app, not via Stripe
      },
      metadata: {
        lessonloop_org_id: orgId,
        lessonloop_plan: dbPlanKey,
      },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
    });

    return new Response(
      JSON.stringify({ 
        type: "checkout",
        sessionId: session.id, 
        url: session.url 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe subscription checkout error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
