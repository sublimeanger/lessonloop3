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

    // 4. Delete user data using the service role client

    // 4a. Remove all org memberships for this user
    const { error: membershipError } = await supabaseAdmin
      .from("org_memberships")
      .delete()
      .eq("user_id", user.id);

    if (membershipError) {
      console.error("Failed to delete org_memberships:", membershipError);
      throw membershipError;
    }

    // 4b. Delete the user's profile record
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (profileError) {
      console.error("Failed to delete profile:", profileError);
      throw profileError;
    }

    // 4c. Delete the auth user (this also invalidates all sessions)
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
