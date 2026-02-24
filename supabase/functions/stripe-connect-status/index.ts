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
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
      
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

        // Standard accounts use their own Stripe dashboard (no account ID in URL)
        if (account.details_submitted) {
          dashboardUrl = "https://dashboard.stripe.com/";
        }
      } catch (err) {
        console.error("Failed to retrieve Stripe account:", err);
        stripeStatus = { status: org.stripe_connect_status, error: true };
      }
    }

    return new Response(
      JSON.stringify({
        connected: !!org.stripe_connect_account_id,
        status: org.stripe_connect_status,
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
});
