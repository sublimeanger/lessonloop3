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

    const { paymentMethodId, orgId } = await req.json();
    if (!paymentMethodId || !orgId) throw new Error("paymentMethodId and orgId are required");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find guardian for this user
    const { data: guardian } = await supabase
      .from("guardians")
      .select("id")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!guardian) throw new Error("Guardian not found");

    // Verify the customer belongs to this user
    const { data: prefs } = await supabase
      .from("guardian_payment_preferences")
      .select("stripe_customer_id, default_payment_method_id")
      .eq("guardian_id", guardian.id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!prefs?.stripe_customer_id) throw new Error("No saved payment methods found");

    // Get the org's connected account
    const { data: org } = await supabase
      .from("organisations")
      .select("stripe_connect_account_id")
      .eq("id", orgId)
      .single();

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const stripeOpts: Stripe.RequestOptions = {};
    if (org?.stripe_connect_account_id) {
      stripeOpts.stripeAccount = org.stripe_connect_account_id;
    }

    // Verify the payment method belongs to this customer
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId, stripeOpts);
    if (pm.customer !== prefs.stripe_customer_id) {
      throw new Error("Payment method does not belong to this customer");
    }

    // Detach the payment method
    await stripe.paymentMethods.detach(paymentMethodId, stripeOpts);

    // If this was the default, clear it
    if (prefs.default_payment_method_id === paymentMethodId) {
      await supabase
        .from("guardian_payment_preferences")
        .update({ default_payment_method_id: null })
        .eq("guardian_id", guardian.id)
        .eq("org_id", orgId);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in stripe-detach-payment-method:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
