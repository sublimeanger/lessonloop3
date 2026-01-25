import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupRequest {
  user_ids?: string[];
  delete_incomplete_onboarding?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Check if user is an owner in any org
    const { data: membership } = await userClient
      .from('org_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Only owners can perform cleanup' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CleanupRequest = await req.json();
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const deleted: string[] = [];
    const errors: string[] = [];

    // Get user IDs to delete
    let userIdsToDelete: string[] = body.user_ids || [];

    if (body.delete_incomplete_onboarding) {
      const { data: incompleteProfiles } = await adminClient
        .from('profiles')
        .select('id')
        .eq('has_completed_onboarding', false);

      if (incompleteProfiles) {
        userIdsToDelete = [...new Set([
          ...userIdsToDelete,
          ...incompleteProfiles.map(p => p.id)
        ])];
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

    console.log('[admin-cleanup] Deleted:', deleted.length, 'Errors:', errors.length);

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
