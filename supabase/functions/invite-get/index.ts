import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Fetch invite by token
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("invites")
      .select("org_id, email, role, expires_at, accepted_at")
      .eq("token", token)
      .maybeSingle();

    if (inviteError) {
      console.error("Error fetching invite:", inviteError);
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
      console.error("Error fetching organisation:", orgError);
    }

    // Return minimal safe payload
    return new Response(
      JSON.stringify({
        invite: {
          org_id: invite.org_id,
          email: invite.email,
          role: invite.role,
          expires_at: invite.expires_at,
        },
        organisation: org ? { name: org.name, org_type: org.org_type } : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
