import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { getStripeClient } from "../_shared/stripe-client.ts";

import { wrapEdgeFn } from "../_shared/sentry.ts";
import { classifyAndRespond, type SafeErrorMap } from "../_shared/stripe-error.ts";

const SAFE_MESSAGES: SafeErrorMap = {
  exact: {
    "No authorization header": 401,
    "Unauthorized": 401,
    "orgId is required": 400,
  },
};

serve(wrapEdgeFn("stripe-list-payment-methods", async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    // Pass token explicitly — getUser() no-args calls /auth/v1/user which on
    // this project rejects legacy HS256 JWTs. See
    // audit/findings/2026-05-10-getuser-noargs-sweep.md.
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    let __body: any;
    try {
      __body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { orgId } = __body;
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

    // J24-A: org-scoped Stripe key. Defaults to live; only the e2e
    // test org is opted into test mode (organisations.stripe_test_mode).
    const { stripe } = await getStripeClient(orgId, supabase);

    // J10-F3: PMs are platform-attached. The source PI in
    // stripe-create-payment-intent runs on the platform account (with
    // transfer_data.destination for Connect) and sets
    // setup_future_usage='off_session', so Stripe attaches the PM to
    // the platform customer. Listing on the connected account returns
    // empty under any Connect-enabled org.
    const methods = await stripe.paymentMethods.list({
      customer: prefs.stripe_customer_id,
      type: "card",
    });

    const paymentMethods = methods.data.map((pm: any) => ({
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
  } catch (error: unknown) {
    return classifyAndRespond(error, SAFE_MESSAGES, corsHeaders, "stripe-list-payment-methods");
  }
}));
