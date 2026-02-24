import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

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

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Rate limit
    const rateCheck = await checkRateLimit(user.id, "stripe-connect-revenue");
    if (!rateCheck.allowed) {
      return rateLimitResponse(corsHeaders, rateCheck);
    }

    const { orgId, startDate, endDate } = await req.json();
    if (!orgId) throw new Error("orgId is required");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify membership (owner/admin/finance)
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .eq("status", "active")
      .single();

    if (!membership || !["owner", "admin", "finance"].includes(membership.role)) {
      throw new Error("Only owners, admins, and finance staff can view revenue data");
    }

    // Get org's connect account
    const { data: org } = await supabase
      .from("organisations")
      .select("stripe_connect_account_id, stripe_connect_status")
      .eq("id", orgId)
      .single();

    if (!org?.stripe_connect_account_id || org.stripe_connect_status !== "active") {
      throw new Error("Stripe Connect account is not active");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const stripeAccount = org.stripe_connect_account_id;

    // Calculate date range
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : now;

    // Fetch balance, payouts, and transactions in parallel
    const [balance, payouts, transactions] = await Promise.all([
      stripe.balance.retrieve({ stripeAccount }),
      stripe.payouts.list(
        { limit: 10 },
        { stripeAccount }
      ),
      stripe.balanceTransactions.list(
        {
          created: {
            gte: Math.floor(start.getTime() / 1000),
            lte: Math.floor(end.getTime() / 1000),
          },
          limit: 100,
        },
        { stripeAccount }
      ),
    ]);

    // Calculate summary from transactions
    let totalRevenue = 0;
    let totalFees = 0;
    let totalRefunds = 0;
    let transactionCount = 0;

    for (const txn of transactions.data) {
      if (txn.type === "charge" || txn.type === "payment") {
        totalRevenue += txn.amount;
        totalFees += txn.fee;
        transactionCount++;
      } else if (txn.type === "refund" || txn.type === "payment_refund") {
        totalRefunds += Math.abs(txn.amount);
      }
    }

    const totalNet = totalRevenue - totalFees - totalRefunds;

    return new Response(
      JSON.stringify({
        balance: {
          available: balance.available.map((b) => ({ amount: b.amount, currency: b.currency })),
          pending: balance.pending.map((b) => ({ amount: b.amount, currency: b.currency })),
        },
        payouts: payouts.data.map((p) => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          arrival_date: p.arrival_date,
          created: p.created,
        })),
        transactions: transactions.data.map((t) => ({
          id: t.id,
          amount: t.amount,
          fee: t.fee,
          net: t.net,
          currency: t.currency,
          type: t.type,
          description: t.description,
          created: t.created,
        })),
        summary: {
          totalRevenue,
          totalFees,
          totalNet,
          totalRefunds,
          transactionCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe Connect revenue error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
