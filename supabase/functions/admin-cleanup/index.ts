import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface CleanupRequest {
  user_ids?: string[];
  org_id?: string;
  delete_incomplete_onboarding?: boolean;
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  const isProduction = Deno.env.get("ENVIRONMENT") === "production";
  if (isProduction) {
    return new Response(JSON.stringify({ error: "Not available in production" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify calling user is an owner
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Org ownership is now verified below after resolving orgId

    const body: CleanupRequest = await req.json();
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Resolve org scope
    const { data: profile } = await userClient
      .from('profiles')
      .select('current_org_id')
      .eq('id', user.id)
      .single();

    const orgId = body.org_id || profile?.current_org_id;
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'Could not determine org scope' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller is owner in THIS org
    const { data: orgMembership } = await userClient
      .from('org_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .eq('role', 'owner')
      .maybeSingle();

    if (!orgMembership) {
      return new Response(
        JSON.stringify({ error: 'Only owners of this org can perform cleanup' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-cleanup] Triggered by user ${user.id} for org ${orgId}`);

    // Get all user IDs that belong to this org
    const { data: orgMembers } = await adminClient
      .from('org_memberships')
      .select('user_id')
      .eq('org_id', orgId);

    const orgUserIds = new Set(orgMembers?.map(m => m.user_id) || []);

    const deleted: string[] = [];
    const errors: string[] = [];

    // Get user IDs to delete
    let userIdsToDelete: string[] = (body.user_ids || []).filter(id => orgUserIds.has(id));

    if (body.delete_incomplete_onboarding) {
      const { data: incompleteProfiles } = await adminClient
        .from('profiles')
        .select('id')
        .eq('has_completed_onboarding', false);

      if (incompleteProfiles) {
        const incompleteOrgIds = incompleteProfiles
          .map(p => p.id)
          .filter(id => orgUserIds.has(id));
        userIdsToDelete = [...new Set([...userIdsToDelete, ...incompleteOrgIds])];
      }
    }

    // Don't delete the calling user
    userIdsToDelete = userIdsToDelete.filter(id => id !== user.id);

    for (const userId of userIdsToDelete) {
      try {
        // Delete from public tables first (RLS bypass with service role)
        await adminClient.from('org_memberships').delete().eq('user_id', userId);
        await adminClient.from('profiles').delete().eq('id', userId);

        // Delete from auth.users
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
        
        if (deleteError) {
          errors.push(`${userId}: ${deleteError.message}`);
        } else {
          deleted.push(userId);
        }
      } catch (err) {
        errors.push(`${userId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    console.log(`[admin-cleanup] Org ${orgId} | Deleted: ${deleted.length} | Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[admin-cleanup] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
