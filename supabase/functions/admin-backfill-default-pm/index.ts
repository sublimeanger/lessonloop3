import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateCronAuth } from "../_shared/cron-auth.ts";

// J10-F1 / J10-P1-C3 — One-shot operator-triggered backfill driver.
// For every guardian_payment_preferences row with default_payment_method_id
// IS NULL but stripe_customer_id IS NOT NULL, list the customer's saved
// cards from Stripe and pick the most recently created. Calls the
// service-role RPC backfill_guardian_default_pm_set (J10-P1-C2) to set
// the field if still null at write time.
//
// Auth: validateCronAuth (x-cron-secret header). Operators trigger this
// once per environment via curl with INTERNAL_CRON_SECRET; not on a
// schedule.
//
// Stripe scope: PMs are platform-attached because setup_future_usage
// runs on a platform PI in stripe-create-payment-intent. List with no
// stripeAccount — the connected account never holds these PMs.

interface BackfillError {
  guardian_id: string;
  org_id: string;
  error: string;
}

serve(async (req) => {
  const authError = validateCronAuth(req);
  if (authError) return authError;

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const { data: candidates, error: queryError } = await supabase
      .from("guardian_payment_preferences")
      .select("guardian_id, org_id, stripe_customer_id")
      .is("default_payment_method_id", null)
      .not("stripe_customer_id", "is", null);

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    if (!candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, updated: 0, skipped: 0, errors: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    let updated = 0;
    let skipped = 0;
    const errors: BackfillError[] = [];

    for (const row of candidates) {
      try {
        const cards = await stripe.paymentMethods.list({
          customer: row.stripe_customer_id,
          type: "card",
          limit: 100,
        });

        if (!cards.data.length) {
          skipped++;
          continue;
        }

        // Stripe returns most-recent first by default. Take card 0.
        const pmId = cards.data[0].id;

        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          "backfill_guardian_default_pm_set",
          {
            _guardian_id: row.guardian_id,
            _org_id: row.org_id,
            _payment_method_id: pmId,
          }
        );

        if (rpcError) {
          errors.push({
            guardian_id: row.guardian_id,
            org_id: row.org_id,
            error: rpcError.message,
          });
          continue;
        }

        if ((rpcResult as { updated?: boolean })?.updated) {
          updated++;
        } else {
          skipped++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push({
          guardian_id: row.guardian_id,
          org_id: row.org_id,
          error: message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        processed: candidates.length,
        updated,
        skipped,
        errors,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin-backfill-default-pm]", message);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
