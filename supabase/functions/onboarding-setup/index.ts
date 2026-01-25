import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OnboardingRequest {
  org_name: string;
  org_type: 'solo_teacher' | 'studio' | 'academy' | 'agency';
  full_name: string;
  phone?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token for user context
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // User client to get user info
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[onboarding-setup] User verified:', user.id);

    // Parse request body
    const body: OnboardingRequest = await req.json();
    const { org_name, org_type, full_name, phone } = body;

    if (!org_name || !org_type || !full_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: org_name, org_type, full_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client to bypass RLS for atomic operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Generate org ID client-side for consistency
    const orgId = crypto.randomUUID();
    console.log('[onboarding-setup] Creating organisation:', orgId, org_name, org_type);

    // Step 1: Update profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ 
        full_name,
        phone: phone || null,
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('[onboarding-setup] Profile update failed:', profileError);
      return new Response(
        JSON.stringify({ error: `Profile update failed: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('[onboarding-setup] Profile updated');

    // Step 2: Create organisation
    const { error: orgError } = await adminClient
      .from('organisations')
      .insert({
        id: orgId,
        name: org_name,
        org_type,
        country_code: 'GB',
        currency_code: 'GBP',
        timezone: 'Europe/London',
        created_by: user.id,
      });

    if (orgError) {
      console.error('[onboarding-setup] Organisation creation failed:', orgError);
      return new Response(
        JSON.stringify({ error: `Organisation creation failed: ${orgError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('[onboarding-setup] Organisation created');

    // Note: The trigger handle_new_organisation will automatically:
    // - Create org_membership with owner role
    // - Set current_org_id on profile if null
    // Give it a moment to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Step 3: Verify the setup completed correctly
    const { data: verifyProfile } = await adminClient
      .from('profiles')
      .select('current_org_id')
      .eq('id', user.id)
      .single();

    // If trigger didn't set current_org_id, set it manually
    if (!verifyProfile?.current_org_id) {
      console.log('[onboarding-setup] Setting current_org_id manually');
      await adminClient
        .from('profiles')
        .update({ current_org_id: orgId })
        .eq('id', user.id);
    }

    console.log('[onboarding-setup] Setup complete, org_id:', orgId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        org_id: orgId,
        message: 'Organisation created successfully' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[onboarding-setup] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
