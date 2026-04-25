import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendAutoPayReminders } from "../_shared/auto-pay-reminder-core.ts";
import { validateCronAuth } from "../_shared/cron-auth.ts";

/**
 * Sends a heads-up email to parents 3 days before an auto-pay charge.
 * Called daily via pg_cron at 0 8 * * * UTC.
 *
 * J10-P1-C5: body extracted to _shared/auto-pay-reminder-core.ts so the
 * 24-hour final reminder (auto-pay-final-reminder) can share the same
 * PM-detail and expiry-warning logic. Behaviour-preserving for the 3-day
 * cadence — same dedup key (auto_pay_reminder), same recipients, same
 * outstanding-aware amount.
 */
serve(async (req) => {
  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result = await sendAutoPayReminders(supabase, {
      leadDays: 3,
      messageType: "auto_pay_reminder",
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in auto-pay-upcoming-reminder:", message);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
