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

  // Mark credits as expired where expires_at has passed and they haven't been
  // redeemed, already expired, or voided (CRD-H1 FIX: added voided_at IS NULL)
  const { data: expired, error } = await supabase
    .from("make_up_credits")
    .update({ expired_at: now, updated_at: now })
    .is("redeemed_at", null)
    .is("expired_at", null)
    .is("voided_at", null)
    .not("expires_at", "is", null)
    .lt("expires_at", now)
    .select("id");

  // CRD-H2 FIX: Filter out protected credits (those linked to active waitlist entries)
  // The Supabase client doesn't support NOT IN subqueries, so we filter post-query
  // and only keep the ones that are NOT protected
  const toExpire = (expired ?? []).filter(
    (c: { id: string }) => !protectedCreditIds.has(c.id)
  );
  const toProtect = (expired ?? []).filter(
    (c: { id: string }) => protectedCreditIds.has(c.id)
  );

  // Undo expiry for protected credits (they were already updated above)
  if (toProtect.length > 0) {
    const protectIds = toProtect.map((c: { id: string }) => c.id);
    await supabase
      .from("make_up_credits")
      .update({ expired_at: null, updated_at: now })
      .in("id", protectIds);
    console.log(
      `Credit expiry: ${toProtect.length} credits protected (linked to active waitlist)`
    );
  }

  if (error) {
    console.error("Credit expiry error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const count = toExpire.length;
  console.log(`Credit expiry: ${count} credits marked as expired`);

  // Expire waitlist entries linked to the now-expired credits (1.7)
  let waitlistExpiredCount = 0;
  if (toExpire.length > 0) {
    const creditIds = toExpire.map((c: { id: string }) => c.id);
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
    JSON.stringify({ success: true, expired_count: count, protected_count: toProtect.length, waitlist_expired_count: waitlistExpiredCount }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
