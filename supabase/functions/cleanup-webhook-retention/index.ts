/**
 * Cleanup Webhook Retention
 *
 * Daily retention sweep for stripe_webhook_events and platform_audit_log.
 * Calls the SQL function public.cleanup_webhook_retention() which
 * encapsulates the actual delete policy (90d webhook events, 90/365d
 * audit log by severity) and self-audits the result.
 *
 * Runs daily at 03:30 UTC via pg_cron (registered in
 * 20260503100100_webhook_retention_cron.sql). Pattern C cron auth.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCronAuth } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    console.log("[cleanup-webhook-retention] Starting retention sweep");

    const { data, error } = await supabase.rpc("cleanup_webhook_retention");

    if (error) {
      console.error("[cleanup-webhook-retention] RPC failed:", error);
      // Best-effort: write a critical platform_audit_log row so the
      // failure is visible even though the SQL function never wrote
      // its own self-audit row.
      await supabase.from("platform_audit_log").insert({
        action: "webhook_retention_sweep_failed",
        source: "cleanup-webhook-retention",
        severity: "error",
        details: { error_message: error.message, error_code: error.code },
      });
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[cleanup-webhook-retention] Sweep complete: ${JSON.stringify(data)}`
    );

    return new Response(
      JSON.stringify({ success: true, result: data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cleanup-webhook-retention]", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
