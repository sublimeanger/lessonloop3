import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { PLAN_LIMITS, TRIAL_DAYS } from '../_shared/plan-config.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';



interface OnboardingRequest {
  org_name: string;
  org_type: 'solo_teacher' | 'studio' | 'academy' | 'agency';
  full_name: string;
  phone?: string;
  subscription_plan?: 'solo_teacher' | 'academy' | 'agency';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const corsHeaders = getCorsHeaders(req);

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

    // Rate limiting
    const rlResult = await checkRateLimit(user.id, "onboarding-setup");
    if (!rlResult.allowed) {
      return rateLimitResponse(corsHeaders, rlResult);
    }

    // Idempotency guard: check if user already onboarded
    const adminClientEarly = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: existingCheck } = await adminClientEarly
      .from('profiles')
      .select('has_completed_onboarding, current_org_id')
      .eq('id', user.id)
      .maybeSingle();

    if (existingCheck?.has_completed_onboarding && existingCheck?.current_org_id) {
      console.log('[onboarding-setup] Already onboarded, returning existing org:', existingCheck.current_org_id);
      return new Response(
        JSON.stringify({ success: true, org_id: existingCheck.current_org_id, message: 'Already onboarded — returning existing organisation' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: OnboardingRequest = await req.json();
    let { org_name, org_type, full_name, phone, subscription_plan } = body;

    if (!org_name || !org_type || !full_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: org_name, org_type, full_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitise: strip control characters and trim
    const stripControl = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
    full_name = stripControl(full_name);
    org_name = stripControl(org_name);

    if (full_name.length === 0 || full_name.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Full name must be between 1 and 100 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (org_name.length === 0 || org_name.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Organisation name must be between 1 and 100 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const VALID_ORG_TYPES = ['solo_teacher', 'studio', 'academy', 'agency'];
    if (!VALID_ORG_TYPES.includes(org_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid organisation type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const VALID_PLANS = ['solo_teacher', 'academy', 'agency'];
    if (subscription_plan && !VALID_PLANS.includes(subscription_plan)) {
      return new Response(
        JSON.stringify({ error: 'Invalid subscription plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine plan limits - unlimited students for all plans
    const plan = subscription_plan || 'solo_teacher';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.solo_teacher;

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
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    // Set smart defaults for parent reschedule policy based on org type
    const policyDefaults: Record<string, string> = {
      solo_teacher: 'self_service', // Solo teachers want max automation
      studio: 'request_only',       // Studios want balanced control
      academy: 'request_only',      // Academies want balanced control
      agency: 'admin_locked',       // Agencies in schools need full control
    };
    const parentReschedulePolicy = policyDefaults[org_type] || 'request_only';

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
        parent_reschedule_policy: parentReschedulePolicy,
      });

    if (orgError) {
      console.error('[onboarding-setup] Organisation creation failed:', orgError);
      return new Response(
        JSON.stringify({ error: `Organisation creation failed: ${orgError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('[onboarding-setup] Organisation created with policy:', parentReschedulePolicy);

    // Wait for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 3.5: For solo_teacher orgs, create a teacher record for the owner
    if (org_type === 'solo_teacher') {
      console.log('[onboarding-setup] Creating teacher record for solo teacher');
      
      const { error: teacherError } = await adminClient
        .from('teachers')
        .insert({
          org_id: orgId,
          user_id: user.id,
          display_name: full_name,
          email: user.email,
          status: 'active',
        });

      if (teacherError && teacherError.code !== '23505') {
        console.error('[onboarding-setup] Teacher creation failed:', teacherError);
        // Non-fatal - log but don't fail onboarding
      } else {
        console.log('[onboarding-setup] Teacher record created');
      }
    }

    // Step 4: Mark onboarding complete and ensure current_org_id is set
    const { error: completeError } = await adminClient
      .from('profiles')
      .update({ 
        current_org_id: orgId,
        has_completed_onboarding: true,
      })
      .eq('id', user.id);

    if (completeError) {
      console.error('[onboarding-setup] Complete update failed:', completeError);
      return new Response(
        JSON.stringify({ error: 'Organisation created but completion flag failed. Please refresh and try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
