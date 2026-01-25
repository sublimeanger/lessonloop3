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
  subscription_plan?: 'solo_teacher' | 'academy' | 'agency';
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

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // User client to verify token
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
    const { org_name, org_type, full_name, phone, subscription_plan } = body;

    if (!org_name || !org_type || !full_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: org_name, org_type, full_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine plan limits
    const plan = subscription_plan || 'solo_teacher';
    const planLimits = {
      solo_teacher: { max_students: 30, max_teachers: 1 },
      academy: { max_students: 150, max_teachers: 10 },
      agency: { max_students: 9999, max_teachers: 9999 },
    };
    const limits = planLimits[plan] || planLimits.solo_teacher;

    // Use service role client to bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Generate org ID
    const orgId = crypto.randomUUID();
    console.log('[onboarding-setup] Creating organisation:', orgId, org_name, org_type);

    // Step 0: Ensure profile exists (self-healing for edge cases)
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!existingProfile) {
      console.log('[onboarding-setup] Profile missing - creating it');
      const { error: createProfileError } = await adminClient
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name,
          phone: phone || null,
          has_completed_onboarding: false,
        });
      
      if (createProfileError && createProfileError.code !== '23505') {
        console.error('[onboarding-setup] Profile creation failed:', createProfileError);
        return new Response(
          JSON.stringify({ error: `Profile creation failed: ${createProfileError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Ensure owner role exists
      await adminClient
        .from('user_roles')
        .upsert({ user_id: user.id, role: 'owner' }, { onConflict: 'user_id,role' });
    } else {
      // Step 1: Update existing profile with name
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
    }
    console.log('[onboarding-setup] Profile ready');

    // Step 2: Create organisation with subscription details
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

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
        subscription_plan: plan,
        subscription_status: 'trialing',
        trial_ends_at: trialEndsAt.toISOString(),
        max_students: limits.max_students,
        max_teachers: limits.max_teachers,
      });

    if (orgError) {
      console.error('[onboarding-setup] Organisation creation failed:', orgError);
      return new Response(
        JSON.stringify({ error: `Organisation creation failed: ${orgError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('[onboarding-setup] Organisation created');

    // Wait for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 3: Mark onboarding complete and ensure current_org_id is set
    const { error: completeError } = await adminClient
      .from('profiles')
      .update({ 
        current_org_id: orgId,
        has_completed_onboarding: true,
      })
      .eq('id', user.id);

    if (completeError) {
      console.error('[onboarding-setup] Complete update failed:', completeError);
      // Non-fatal - org is created, just log it
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
