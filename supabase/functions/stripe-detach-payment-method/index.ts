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

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // J10-F3: PMs are platform-attached (see stripe-list-payment-methods
    // for the rationale). Retrieve and detach on the platform account
    // — never on the connected account, which never holds these PMs.
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== prefs.stripe_customer_id) {
      throw new Error("Payment method does not belong to this customer");
    }

    await stripe.paymentMethods.detach(paymentMethodId);

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
    const isUnauthorized = error.message === "Unauthorized";
    return new Response(
      JSON.stringify({ error: isUnauthorized ? "Unauthorized" : "An internal error occurred. Please try again." }),
      {
        status: isUnauthorized ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
