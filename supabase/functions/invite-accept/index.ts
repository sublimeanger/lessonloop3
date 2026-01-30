import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
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

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("invites")
      .select("id, org_id, email, role, expires_at, accepted_at, related_student_id")
      .eq("token", token)
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ error: "Invitation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: `This invitation was sent to ${invite.email}. Please log in with that email address.` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create org membership
    await supabaseAdmin.from("org_memberships").upsert(
      { org_id: invite.org_id, user_id: user.id, role: invite.role, status: "active" },
      { onConflict: "org_id,user_id" }
    );

    // If this is a parent invite, create/link guardian record
    if (invite.role === "parent") {
      // Get user's profile for full_name
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      // Check if guardian already exists for this user in this org
      const { data: existingGuardian } = await supabaseAdmin
        .from("guardians")
        .select("id")
        .eq("org_id", invite.org_id)
        .eq("user_id", user.id)
        .maybeSingle();

      let guardianId = existingGuardian?.id;

      if (!guardianId) {
        // Create guardian record
        const { data: newGuardian, error: guardianError } = await supabaseAdmin
          .from("guardians")
          .insert({
            org_id: invite.org_id,
            user_id: user.id,
            full_name: profile?.full_name || user.email?.split("@")[0] || "Guardian",
            email: user.email,
          })
          .select("id")
          .single();

        if (guardianError) {
          console.error("Error creating guardian:", guardianError);
        } else {
          guardianId = newGuardian.id;
        }
      }

      // Link guardian to student if related_student_id is provided
      if (guardianId && invite.related_student_id) {
        // Check if link already exists
        const { data: existingLink } = await supabaseAdmin
          .from("student_guardians")
          .select("id")
          .eq("guardian_id", guardianId)
          .eq("student_id", invite.related_student_id)
          .maybeSingle();

        if (!existingLink) {
          await supabaseAdmin.from("student_guardians").insert({
            guardian_id: guardianId,
            student_id: invite.related_student_id,
            relationship: "parent",
            is_primary_payer: true,
          });
        }
      }
    }

    // Mark invite as accepted
    await supabaseAdmin.from("invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);

    // Set current org and mark onboarding complete for invited users
    // (they're joining an existing org, not creating one)
    await supabaseAdmin
      .from("profiles")
      .update({ 
        current_org_id: invite.org_id,
        has_completed_onboarding: true 
      })
      .eq("id", user.id);

    return new Response(
      JSON.stringify({ success: true, org_id: invite.org_id, role: invite.role }),
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
