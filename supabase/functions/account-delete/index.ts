// Account self-deletion edge function
// Apple App Store requirement 5.1.1(v) — users must be able to delete their own account.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // 1. Verify Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User-scoped client (uses the caller's JWT)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 2. Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Rate limit — 2 requests per 5 minutes (account deletion is irreversible)
    const rateLimitResult = await checkRateLimit(user.id, "account-delete", {
      maxRequests: 2,
      windowMinutes: 5,
    });
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult);
    }

    // 4. Check if user is sole owner of any org
    const { data: ownedOrgs } = await supabaseAdmin
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .eq('status', 'active');

    if (ownedOrgs && ownedOrgs.length > 0) {
      for (const membership of ownedOrgs) {
        const { count } = await supabaseAdmin
          .from('org_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', membership.org_id)
          .eq('role', 'owner')
          .eq('status', 'active')
          .neq('user_id', user.id);
        if (count === 0) {
          return new Response(JSON.stringify({
            error: 'You are the sole owner of an organisation. Please transfer ownership or delete the organisation before deleting your account.'
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // 5. Delete user data using the service role client

    // 5a. Nullify guardian.user_id for all guardians linked to this user
    // This prevents dangling FK references after auth user deletion
    const { error: guardianError } = await supabaseAdmin
      .from('guardians')
      .update({ user_id: null })
      .eq('user_id', user.id);

    if (guardianError) {
      console.error('Failed to unlink guardians:', guardianError);
      // Non-blocking — continue with deletion
    }

    // 5b. Clean up AI data
    await supabaseAdmin.from('ai_messages').delete().eq('user_id', user.id);
    await supabaseAdmin.from('ai_action_proposals').delete().eq('user_id', user.id);

    // 5c. Clean up notification preferences
    await supabaseAdmin.from('notification_preferences').delete().eq('user_id', user.id);

    // 5d. Remove all org memberships for this user
    const { error: membershipError } = await supabaseAdmin
      .from("org_memberships")
      .delete()
      .eq("user_id", user.id);

    if (membershipError) {
      console.error("Failed to delete org_memberships:", membershipError);
      throw membershipError;
    }

    // 5b. Delete the user's profile record
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (profileError) {
      console.error("Failed to delete profile:", profileError);
      throw profileError;
    }

    // 5c. Delete the auth user (this also invalidates all sessions)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    );

    if (deleteUserError) {
      console.error("Failed to delete auth user:", deleteUserError);
      throw deleteUserError;
    }

    // 5. Return success
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Account delete error:", error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
