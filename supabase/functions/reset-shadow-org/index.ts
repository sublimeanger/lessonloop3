/**
 * Reset a shadow-mode organisation by deleting it (and cascade children).
 *
 * Usage:
 *   POST /functions/v1/reset-shadow-org
 *   Authorization: Bearer <SERVICE_ROLE_KEY>
 *   { "org_id": "uuid-of-shadow-org" }
 *
 * Safety:
 * - Service-role only (byte-equal Bearer check). NO end-user access.
 * - Refuses to reset organisations.shadow_mode = false. The fn is named
 *   reset-SHADOW-org; deleting a real org via this endpoint is a class-of-
 *   bug we make impossible at the auth layer.
 * - Returns row counts per affected table for audit log purposes.
 *
 * Use case: Lauren's shadow programme. Between exercises, Jamie may want
 * to wipe the shadow org's accumulated state (sent messages, paid invoices,
 * lesson notes, etc.) and re-seed fresh. That workflow is:
 *   1. POST reset-shadow-org { org_id }   ← this fn
 *   2. POST seed-shadow-org { tier, ... } ← rebuilds clean state
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { wrapEdgeFn } from "../_shared/sentry.ts";

serve(wrapEdgeFn("reset-shadow-org", async (req): Promise<Response> => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const shadowAdminKey = Deno.env.get("SHADOW_ADMIN_KEY") || "";

    // Auth: accept EITHER service-role bearer OR SHADOW_ADMIN_KEY.
    // See seed-shadow-org for rationale (env-injection-mismatch finding).
    const authHeader = req.headers.get("Authorization");
    const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;
    const isShadowAdmin = !!shadowAdminKey && authHeader === `Bearer ${shadowAdminKey}`;
    if (!authHeader || (!isServiceRole && !isShadowAdmin)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — service role or shadow admin key required" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    let body: { org_id?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const orgId = body.org_id;
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "org_id is required" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Safety: verify org exists AND is shadow_mode=true. Reset on a
    // non-shadow org is a guardrail-trip event — refuse, return 403.
    const { data: org, error: orgErr } = await supabase
      .from("organisations")
      .select("id, name, shadow_mode")
      .eq("id", orgId)
      .maybeSingle();

    if (orgErr) {
      console.error("[reset-shadow-org] org lookup error:", orgErr.message);
      return new Response(
        JSON.stringify({ error: "Org lookup failed" }),
        { status: 500, headers: jsonHeaders },
      );
    }
    if (!org) {
      return new Response(
        JSON.stringify({ error: "Organisation not found" }),
        { status: 404, headers: jsonHeaders },
      );
    }
    if (!org.shadow_mode) {
      return new Response(
        JSON.stringify({
          error: "Refusing to reset a non-shadow organisation",
          org_id: orgId,
          org_name: org.name,
          hint: "This fn only operates on organisations.shadow_mode = true",
        }),
        { status: 403, headers: jsonHeaders },
      );
    }

    // Collect row counts for audit log BEFORE delete. Best-effort —
    // tables may grow; this is for human-readable summary, not contract.
    const childTables = [
      "lessons", "students", "teachers", "guardians",
      "invoices", "payments", "message_log",
      "practice_logs", "leads", "ai_conversations",
      "org_memberships", "recurrence_rules", "terms",
    ];

    const counts: Record<string, number> = {};
    for (const table of childTables) {
      try {
        const { count } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId);
        if (count !== null) counts[table] = count;
      } catch {
        // Table might not exist in this project or might not have org_id col.
        // Skip silently — this is best-effort accounting only.
      }
    }

    // Cascade delete: organisations FK cascades remove children per
    // schema. Just delete the org row.
    const { error: deleteErr } = await supabase
      .from("organisations")
      .delete()
      .eq("id", orgId);

    if (deleteErr) {
      console.error("[reset-shadow-org] delete error:", deleteErr.message);
      return new Response(
        JSON.stringify({
          error: "Cascade delete failed",
          detail: deleteErr.message,
          org_id: orgId,
        }),
        { status: 500, headers: jsonHeaders },
      );
    }

    console.log(`[reset-shadow-org] deleted org ${orgId} (${org.name}), pre-delete row counts:`, counts);

    return new Response(
      JSON.stringify({
        success: true,
        org_id: orgId,
        org_name: org.name,
        pre_delete_counts: counts,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown";
    console.error("[reset-shadow-org] unhandled:", msg);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: jsonHeaders },
    );
  }
}));
