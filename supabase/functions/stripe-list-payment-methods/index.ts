import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

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

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { orgId } = await req.json();
    if (!orgId) throw new Error("orgId is required");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find guardian for this user
    const { data: guardian } = await supabase
      .from("guardians")
      .select("id")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!guardian) {
      return new Response(JSON.stringify({ paymentMethods: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up Stripe customer ID from payment preferences
    const { data: prefs } = await supabase
      .from("guardian_payment_preferences")
      .select("stripe_customer_id, default_payment_method_id, auto_pay_enabled")
      .eq("guardian_id", guardian.id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!prefs?.stripe_customer_id) {
      return new Response(JSON.stringify({ paymentMethods: [], defaultPaymentMethodId: null, autoPayEnabled: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the org's connected account (if any) to determine which Stripe account to query
    const { data: org } = await supabase
      .from("organisations")
      .select("stripe_connect_account_id")
      .eq("id", orgId)
      .single();

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // List payment methods for this customer
    const stripeOpts: Stripe.RequestOptions = {};
    if (org?.stripe_connect_account_id) {
      stripeOpts.stripeAccount = org.stripe_connect_account_id;
    }

    const methods = await stripe.paymentMethods.list(
      { customer: prefs.stripe_customer_id, type: "card" },
      stripeOpts
    );

    const paymentMethods = methods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || "unknown",
      last4: pm.card?.last4 || "****",
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
    }));

    return new Response(
      JSON.stringify({
        paymentMethods,
        defaultPaymentMethodId: prefs.default_payment_method_id,
        autoPayEnabled: prefs.auto_pay_enabled,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in stripe-list-payment-methods:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
