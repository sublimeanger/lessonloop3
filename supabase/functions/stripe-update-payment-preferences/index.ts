import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { getStripeClient } from "../_shared/stripe-client.ts";
import { wrapEdgeFn } from "../_shared/sentry.ts";

/**
 * Updates guardian payment preferences (auto-pay toggle, default payment method).
 *
 * J8-F8 / J8-F9 (Area 2 audit, closed 2026-04-28):
 * Validates that defaultPaymentMethodId belongs to the guardian's Stripe
 * customer before persisting, mirroring the pattern in
 * stripe-detach-payment-method. Pairs with the migration that drops the
 * direct UPDATE RLS policy on guardian_payment_preferences — this edge
 * function is now the only path for parents to mutate their preferences
 * (the other being stripe-detach-payment-method which already validates).
 */
serve(wrapEdgeFn("stripe-update-payment-preferences", async (req) => {
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
    // getUser(token) — local JWKS verification accepts legacy HS256 JWTs.
    // See: audit/findings/2026-05-10-getuser-noargs-sweep.md
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const { orgId, autoPayEnabled, defaultPaymentMethodId } = await req.json();
    if (!orgId) throw new Error("orgId is required");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find guardian for this user
    const { data: guardian } = await supabase
      .from("guardians")
      .select("id")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!guardian) throw new Error("Guardian not found");

    // J8-F8: If a default payment method is being set, verify it belongs to
    // this guardian's Stripe customer. PMs are platform-attached (see
    // stripe-list-payment-methods rationale); retrieve on the platform
    // account, not the connected account.
    if (typeof defaultPaymentMethodId === "string") {
      const { data: prefs } = await supabase
        .from("guardian_payment_preferences")
        .select("stripe_customer_id")
        .eq("guardian_id", guardian.id)
        .eq("org_id", orgId)
        .maybeSingle();

      if (!prefs?.stripe_customer_id) {
        // No customer record yet — this should not happen in production because
        // PMs are only surfaced to the parent after a successful checkout that
        // creates both the customer record and the preferences row. If we hit
        // this, it indicates the client sent a defaultPaymentMethodId without
        // a prior charge, which is a bug.
        throw new Error("No Stripe customer on file for this guardian; complete a payment first.");
      }

      // J24-A: org-scoped Stripe key (test for e2e org, live otherwise).
      const { stripe } = await getStripeClient(orgId, supabase);
      const pm = await stripe.paymentMethods.retrieve(defaultPaymentMethodId);
      if (pm.customer !== prefs.stripe_customer_id) {
        throw new Error("Payment method does not belong to this customer");
      }
    }

    // Build update payload
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof autoPayEnabled === "boolean") {
      updateData.auto_pay_enabled = autoPayEnabled;
    }
    if (typeof defaultPaymentMethodId === "string") {
      updateData.default_payment_method_id = defaultPaymentMethodId;
    }

    // Upsert preferences. Note: stripe_customer_id is intentionally NOT writable
    // through this function — it is managed by stripe-create-payment-intent.
    const { error: upsertError } = await supabase
      .from("guardian_payment_preferences")
      .upsert(
        {
          guardian_id: guardian.id,
          org_id: orgId,
          ...updateData,
        },
        { onConflict: "guardian_id,org_id" }
      );

    if (upsertError) throw new Error(upsertError.message);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in stripe-update-payment-preferences:", error);
    const isUnauthorized = error.message === "Unauthorized";
    const isClientError = error.message === "Payment method does not belong to this customer"
      || error.message === "No Stripe customer on file for this guardian; complete a payment first."
      || error.message === "orgId is required"
      || error.message === "Guardian not found"
      || error.message === "No authorization header";
    const status = isUnauthorized ? 401 : (isClientError ? 400 : 500);
    return new Response(
      JSON.stringify({
        error: isUnauthorized
          ? "Unauthorized"
          : (isClientError ? error.message : "An internal error occurred. Please try again.")
      }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}));
