import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

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

    console.debug('[profile-ensure] User verified');

    // Per-user rate limiting
    const rlResult = await checkRateLimit(user.id, "profile-ensure");
    if (!rlResult.allowed) {
      return rateLimitResponse(corsHeaders, rlResult);
    }

    // Use service role client to bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if profile exists
    const { data: existingProfile, error: fetchError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[profile-ensure] Error checking profile:', fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Profile exists - return it
    if (existingProfile) {
      console.log('[profile-ensure] Profile exists');
      return new Response(
        JSON.stringify({ profile: existingProfile, created: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Profile doesn't exist - create it
    console.debug('[profile-ensure] Creating profile');

    const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

    const { data: newProfile, error: insertError } = await adminClient
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        has_completed_onboarding: false,
      })
      .select()
      .single();

    if (insertError) {
      // Handle race condition - profile might have been created by trigger
      if (insertError.code === '23505') { // Unique violation
        console.log('[profile-ensure] Profile created by trigger, fetching...');
        const { data: raceProfile } = await adminClient
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        return new Response(
          JSON.stringify({ profile: raceProfile, created: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.error('[profile-ensure] Error creating profile:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Role assignment is handled by:
    // - handle_new_user() trigger for normal signups (assigns 'owner')
    // - invite-accept edge function for invited users (assigns via org_memberships)

    console.log('[profile-ensure] Profile created successfully');

    return new Response(
      JSON.stringify({ profile: newProfile, created: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[profile-ensure] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
