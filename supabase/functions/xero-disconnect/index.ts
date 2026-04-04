import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- JWT Auth ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { org_id } = await req.json();
    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Admin role check ---
    const { data: membership } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', org_id)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership || membership.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden — admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete all entity mappings for this org
    await supabase
      .from('xero_entity_mappings')
      .delete()
      .eq('org_id', org_id);

    // Delete the Xero connection
    const { error: deleteError } = await supabase
      .from('xero_connections')
      .delete()
      .eq('org_id', org_id);

    if (deleteError) {
      console.error('Error deleting Xero connection:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to disconnect Xero' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log to audit
    await supabase
      .from('audit_log')
      .insert({
        org_id,
        actor_user_id: user.id,
        action: 'disconnect',
        entity_type: 'xero_connections',
        entity_id: null,
        after: null,
      });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Xero disconnect error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
