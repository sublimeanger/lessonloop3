import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendAutoPayReminders } from "../_shared/auto-pay-reminder-core.ts";

/**
 * J10-F5 — sends a 24-hour final auto-pay reminder.
 * Daily cron at 0 8 * * * UTC; targets installments due tomorrow with
 * auto-pay enabled. Independent dedup key (auto_pay_final_reminder) so
 * the 3-day reminder and this one don't conflate. PM brand/last4/expiry
 * + expiry warning shared with the 3-day fn via auto-pay-reminder-core.
 */
serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.includes(supabaseServiceKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result = await sendAutoPayReminders(supabase, {
      leadDays: 1,
      messageType: "auto_pay_final_reminder",
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in auto-pay-final-reminder:", message);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
