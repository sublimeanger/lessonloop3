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
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth to get their info
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Fetch invite by token
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("invites")
      .select("id, org_id, email, role, expires_at, accepted_at")
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

    // Validate invite status
    if (invite.accepted_at) {
      return new Response(
        JSON.stringify({ error: "This invitation has already been accepted" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This invitation has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email matches (case-insensitive)
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return new Response(
        JSON.stringify({ 
          error: `This invitation was sent to ${invite.email}. Please log in with that email address.` 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert org membership (handles duplicate case)
    const { error: membershipError } = await supabaseAdmin
      .from("org_memberships")
      .upsert(
        {
          org_id: invite.org_id,
          user_id: user.id,
          role: invite.role,
          status: "active",
        },
        { onConflict: "org_id,user_id" }
      );

    if (membershipError) {
      console.error("Error creating membership:", membershipError);
      return new Response(
        JSON.stringify({ error: "Failed to create membership" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark invite as accepted
    const { error: updateError } = await supabaseAdmin
      .from("invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    if (updateError) {
      console.error("Error updating invite:", updateError);
      // Non-fatal - membership was created
    }

    // Update profile's current_org_id if null
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("current_org_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && !profile.current_org_id) {
      await supabaseAdmin
        .from("profiles")
        .update({ current_org_id: invite.org_id })
        .eq("id", user.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        org_id: invite.org_id,
        role: invite.role,
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
