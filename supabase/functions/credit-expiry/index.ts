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

  // Mark credits as expired where expires_at has passed and they haven't been redeemed or already expired
  const { data: expired, error } = await supabase
    .from("make_up_credits")
    .update({ expired_at: now, updated_at: now })
    .is("redeemed_at", null)
    .is("expired_at", null)
    .not("expires_at", "is", null)
    .lt("expires_at", now)
    .select("id");

  if (error) {
    console.error("Credit expiry error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const count = expired?.length || 0;
  console.log(`Credit expiry: ${count} credits marked as expired`);

  // Expire waitlist entries linked to the now-expired credits (1.7)
  let waitlistExpiredCount = 0;
  if (expired && expired.length > 0) {
    const creditIds = expired.map((c: { id: string }) => c.id);
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
    JSON.stringify({ success: true, expired_count: count, waitlist_expired_count: waitlistExpiredCount }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
