// CRON SETUP REQUIRED:
// This function must be scheduled via Supabase Dashboard → Edge Functions → Schedules
// Schedule: Daily at 2am UTC (0 2 * * *)
// Also schedule credit-expiry-warning with the same frequency (0 2 * * *)
//
// Without this cron schedule, expired credits will never be marked as expired
// and the credit-expiry-warning emails will never be sent.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCronAuth } from "../_shared/cron-auth.ts";

serve(async (req) => {
  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date().toISOString();

  // CRD-H2 FIX: Find credit IDs linked to active waitlist entries — these must NOT expire
  const { data: protectedCredits } = await supabase
    .from("make_up_waitlist")
    .select("credit_id")
    .not("credit_id", "is", null)
    .in("status", ["waiting", "matched", "offered", "accepted"]);

  const protectedCreditIds = new Set(
    (protectedCredits ?? []).map((r: { credit_id: string }) => r.credit_id)
  );

  // CRD-C1 FIX: Exclude protected credits BEFORE the update to eliminate race condition.
  // Previously, all credits were expired first, then protected ones were un-expired,
  // leaving a window where concurrent requests could see them as expired.
  const protectedIdArray = Array.from(protectedCreditIds);

  // Build the base query
  let query = supabase
    .from("make_up_credits")
    .update({ expired_at: now, updated_at: now })
    .is("redeemed_at", null)
    .is("expired_at", null)
    .is("voided_at", null)
    .not("expires_at", "is", null)
    .lt("expires_at", now);

  // Exclude protected credits from the update entirely
  if (protectedIdArray.length > 0) {
    query = query.not("id", "in", `(${protectedIdArray.join(",")})`);
  }

  const { data: expired, error } = await query.select("id");

  if (error) {
    console.error("Credit expiry error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const count = expired?.length || 0;
  console.log(`Credit expiry: ${count} credits marked as expired`);
  if (protectedIdArray.length > 0) {
    console.log(`Credit expiry: ${protectedIdArray.length} credits protected (linked to active waitlist)`);
  }

  // Expire waitlist entries linked to the now-expired credits (1.7)
  let waitlistExpiredCount = 0;
  if (count > 0) {
    const creditIds = (expired ?? []).map((c: { id: string }) => c.id);
    const { data: expiredWaitlist, error: wlError } = await supabase
      .from("make_up_waitlist")
      .update({ status: "expired" })
      .in("credit_id", creditIds)
      .eq("status", "waiting")
      .select("id");

    if (wlError) {
      console.error("Waitlist expiry error:", wlError.message);
    } else {
      waitlistExpiredCount = expiredWaitlist?.length || 0;
      console.log(`Credit expiry: ${waitlistExpiredCount} waitlist entries expired`);
    }
  }

  return new Response(
    JSON.stringify({ success: true, expired_count: count, protected_count: protectedIdArray.length, waitlist_expired_count: waitlistExpiredCount }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
