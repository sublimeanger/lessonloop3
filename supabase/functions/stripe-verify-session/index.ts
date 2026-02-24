import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

/**
 * Verifies a Stripe Checkout Session or PaymentIntent status.
 * Called by the frontend after redirect-based payment to prevent URL spoofing.
 * Returns { verified: boolean, status: string, invoiceId?: string }
 */
serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("sessionId is required");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First check our local DB record
    const { data: localSession } = await supabase
      .from("stripe_checkout_sessions")
      .select("status, invoice_id, org_id")
      .eq("stripe_session_id", sessionId)
      .single();

    if (!localSession) {
      return new Response(
        JSON.stringify({ verified: false, status: "not_found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Verify the requesting user is related to this session's org
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", localSession.org_id)
      .eq("status", "active")
      .maybeSingle();

    // Also check guardian relationship
    let isGuardian = false;
    if (!membership) {
      const { data: guardian } = await supabase
        .from("guardians")
        .select("id")
        .eq("user_id", user.id)
        .eq("org_id", localSession.org_id)
        .maybeSingle();
      isGuardian = !!guardian;
    }

    if (!membership && !isGuardian) {
      throw new Error("Unauthorized — not associated with this session");
    }

    if (localSession.status === "completed") {
      return new Response(
        JSON.stringify({
          verified: true,
          status: "completed",
          invoiceId: localSession.invoice_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // If still pending, check Stripe directly
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);

    const isComplete = stripeSession.payment_status === "paid" || stripeSession.status === "complete";

    return new Response(
      JSON.stringify({
        verified: isComplete,
        status: stripeSession.status,
        paymentStatus: stripeSession.payment_status,
        invoiceId: localSession.invoice_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }, status: 400 }
    );
  }
});
