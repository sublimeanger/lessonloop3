import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  const visible = local.charAt(0);
  return `${visible}***@${domain}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // IP-based rate limiting — 5 requests per minute
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    const rlResult = await checkRateLimit(`ip:${clientIp}`, "invite_get");
    if (!rlResult.allowed) {
      return rateLimitResponse(corsHeaders, rlResult);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch invite by token
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("invites")
      .select("org_id, email, role, expires_at, accepted_at")
      .eq("token", token)
      .maybeSingle();

    if (inviteError) {
      console.error("Error fetching invite:", inviteError?.message || "unknown error");
      return new Response(
        JSON.stringify({ error: "Failed to fetch invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invite) {
      return new Response(
        JSON.stringify({ error: "Invitation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already accepted
    if (invite.accepted_at) {
      return new Response(
        JSON.stringify({ error: "This invitation has already been accepted" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This invitation has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch organisation details
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organisations")
      .select("name, org_type")
      .eq("id", invite.org_id)
      .maybeSingle();

    if (orgError) {
      console.error("Error fetching organisation:", orgError?.message || "unknown error");
    }

    // Return minimal safe payload with redacted email
    return new Response(
      JSON.stringify({
        invite: {
          org_id: invite.org_id,
          email: redactEmail(invite.email),
          role: invite.role,
          expires_at: invite.expires_at,
        },
        organisation: org ? { name: org.name, org_type: org.org_type } : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", (err as Error)?.message || "unknown error");
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
