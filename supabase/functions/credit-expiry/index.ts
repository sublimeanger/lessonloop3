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
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const count = expired?.length || 0;
  console.log(`Credit expiry: ${count} credits marked as expired`);

  return new Response(
    JSON.stringify({ success: true, expired_count: count }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
