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

  // 1. Expire waiting/matched entries past expires_at
  const { data: expired, error: expireError } = await supabase
    .from("make_up_waitlist")
    .update({ status: "expired", updated_at: now })
    .in("status", ["waiting", "matched"])
    .lt("expires_at", now)
    .select("id");

  if (expireError) console.error("Expire error:", expireError.message);

  // 2. WL-M5 FIX: Return stale offered entries back to waiting.
  //    Use per-entry offer_expires_at (set by offer_makeup_slot RPC) when available.
  //    Fall back to offered_at + 48h for legacy entries without offer_expires_at.
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // 2a. Entries WITH offer_expires_at — use the per-entry deadline
  const { data: returnedByDeadline, error: deadlineError } = await supabase
    .from("make_up_waitlist")
    .update({
      status: "waiting",
      matched_lesson_id: null,
      matched_at: null,
      offered_at: null,
      offer_expires_at: null,
      updated_at: now,
    })
    .eq("status", "offered")
    .not("offer_expires_at", "is", null)
    .lt("offer_expires_at", now)
    .select("id");

  if (deadlineError) console.error("Deadline return-to-waiting error:", deadlineError.message);

  // 2b. Legacy entries WITHOUT offer_expires_at — fallback to 48h from offered_at
  const { data: returnedByFallback, error: fallbackError } = await supabase
    .from("make_up_waitlist")
    .update({
      status: "waiting",
      matched_lesson_id: null,
      matched_at: null,
      offered_at: null,
      updated_at: now,
    })
    .eq("status", "offered")
    .is("offer_expires_at", null)
    .lt("offered_at", fortyEightHoursAgo)
    .select("id");

  if (fallbackError) console.error("Fallback return-to-waiting error:", fallbackError.message);

  const expiredCount = expired?.length || 0;
  const returnedCount = (returnedByDeadline?.length || 0) + (returnedByFallback?.length || 0);

  console.log(`Waitlist expiry: ${expiredCount} expired, ${returnedCount} returned to waiting`);

  return new Response(
    JSON.stringify({ success: true, expired: expiredCount, returned_to_waiting: returnedCount }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
