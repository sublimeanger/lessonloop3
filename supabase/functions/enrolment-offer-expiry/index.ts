import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCronAuth } from "../_shared/cron-auth.ts";

const handler = async (req: Request): Promise<Response> => {
  // Validate cron auth
  const authError = validateCronAuth(req);
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // 1. Find expired offers
    const { data: expiredEntries, error: fetchError } = await supabaseService
      .from("enrolment_waitlist")
      .select("id, org_id, contact_name, child_first_name, instrument_name")
      .eq("status", "offered")
      .lt("offer_expires_at", now);

    if (fetchError) {
      console.error("Failed to fetch expired offers:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!expiredEntries || expiredEntries.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expired offers found", expired_count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${expiredEntries.length} expired offer(s)`);

    let expiredCount = 0;

    // 2. Expire each entry
    for (const entry of expiredEntries) {
      const { error: updateError } = await supabaseService
        .from("enrolment_waitlist")
        .update({ status: "expired" })
        .eq("id", entry.id)
        .eq("org_id", entry.org_id);

      if (updateError) {
        console.error(`Failed to expire entry ${entry.id}:`, updateError);
        continue;
      }

      // Log activity
      await supabaseService.from("enrolment_waitlist_activity").insert({
        org_id: entry.org_id,
        waitlist_id: entry.id,
        activity_type: "offer_expired",
        description: `Offer expired for ${entry.child_first_name} (${entry.instrument_name}) — no response received`,
      });

      expiredCount++;
    }

    // v1: No auto-cascade to next in queue. Admin handles re-offering manually.

    return new Response(
      JSON.stringify({
        message: `Expired ${expiredCount} offer(s)`,
        expired_count: expiredCount,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("enrolment-offer-expiry error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
