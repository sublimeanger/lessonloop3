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
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // 1. Expire waiting/matched entries past expires_at
  const { data: expired, error: expireError } = await supabase
    .from("make_up_waitlist")
    .update({ status: "expired", updated_at: now })
    .in("status", ["waiting", "matched"])
    .lt("expires_at", now)
    .select("id");

  if (expireError) console.error("Expire error:", expireError.message);

  // 2. Return stale offered entries (no response in 48h) back to waiting
  const { data: returned, error: returnError } = await supabase
    .from("make_up_waitlist")
    .update({
      status: "waiting",
      matched_lesson_id: null,
      matched_at: null,
      offered_at: null,
      updated_at: now,
    })
    .eq("status", "offered")
    .lt("offered_at", fortyEightHoursAgo)
    .select("id");

  if (returnError) console.error("Return-to-waiting error:", returnError.message);

  const expiredCount = expired?.length || 0;
  const returnedCount = returned?.length || 0;

  console.log(`Waitlist expiry: ${expiredCount} expired, ${returnedCount} returned to waiting`);

  return new Response(
    JSON.stringify({ success: true, expired: expiredCount, returned_to_waiting: returnedCount }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
