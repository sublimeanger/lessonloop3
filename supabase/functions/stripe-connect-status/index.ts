import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { getStripeClient } from "../_shared/stripe-client.ts";
import { wrapEdgeFn } from "../_shared/sentry.ts";

serve(wrapEdgeFn("stripe-connect-status", async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    // Verify membership
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .eq("status", "active")
      .single();

    if (!membership) throw new Error("Not a member of this organisation");

    const { data: org } = await supabase
      .from("organisations")
      .select("stripe_connect_account_id, stripe_connect_status, stripe_connect_onboarded_at, platform_fee_percent")
      .eq("id", orgId)
      .single();

    if (!org) throw new Error("Organisation not found");

    let stripeStatus = null;
    let dashboardUrl = null;

    if (org.stripe_connect_account_id) {
      // J24-A: org-scoped Stripe key (live by default, test for e2e org).
      const { stripe } = await getStripeClient(orgId, supabase);

      try {
        const account = await stripe.accounts.retrieve(org.stripe_connect_account_id);
        
        const newStatus = account.charges_enabled && account.payouts_enabled
          ? "active"
          : account.details_submitted
          ? "restricted"
          : "pending";

        // Update status if changed
        if (newStatus !== org.stripe_connect_status) {
          const updateData: Record<string, unknown> = { stripe_connect_status: newStatus };
          if (newStatus === "active" && !org.stripe_connect_onboarded_at) {
            updateData.stripe_connect_onboarded_at = new Date().toISOString();
          }
          await supabase.from("organisations").update(updateData).eq("id", orgId);
        }

        stripeStatus = {
          status: newStatus,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
        };

        // Generate dashboard login link for standard accounts
        if (account.details_submitted) {
          dashboardUrl = `https://dashboard.stripe.com/${org.stripe_connect_account_id}`;
        }
      } catch (err: any) {
        // If account no longer exists or is deauthorized, mark as disconnected
        if (err?.type === "StripeInvalidRequestError" || err?.statusCode === 404) {
          await supabase.from("organisations").update({
            stripe_connect_status: "disconnected",
            stripe_connect_account_id: null,
          }).eq("id", orgId);
          stripeStatus = { status: "disconnected" };
        } else {
          console.error("Failed to retrieve Stripe account:", err);
          stripeStatus = { status: org.stripe_connect_status, error: true };
        }
      }
    }

    const currentStatus = stripeStatus?.status === "disconnected" ? "disconnected" : org.stripe_connect_status;

    return new Response(
      JSON.stringify({
        connected: !!org.stripe_connect_account_id && currentStatus !== "disconnected",
        status: currentStatus,
        onboardedAt: org.stripe_connect_onboarded_at,
        platformFeePercent: org.platform_fee_percent,
        stripe: stripeStatus,
        dashboardUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe Connect status error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
}));
