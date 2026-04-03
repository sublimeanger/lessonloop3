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
  timezone?: string;
  also_teaches?: boolean;
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

    // Block unverified emails from creating organisations
    if (!user.email_confirmed_at) {
      return new Response(
        JSON.stringify({ error: 'Please verify your email address before setting up your account.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[onboarding-setup] User verified:', user.id);

    // Rate limiting
    const rlResult = await checkRateLimit(user.id, "onboarding-setup");
    if (!rlResult.allowed) {
      return rateLimitResponse(corsHeaders, rlResult);
    }

    // Parse request body
    const body: OnboardingRequest = await req.json();
    const { org_type, phone, subscription_plan, also_teaches } = body;
    let { org_name, full_name } = body;

    if (!org_name || !org_type || !full_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: org_name, org_type, full_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitise: strip control characters and trim
    // eslint-disable-next-line no-control-regex
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

    // Validate timezone if provided — must be a well-known IANA format
    const VALID_TZ_PATTERN = /^[A-Za-z]+\/[A-Za-z_\/\-]+$/;
    if (body.timezone && !VALID_TZ_PATTERN.test(body.timezone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid timezone. Must be an IANA timezone (e.g. Europe/London).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine plan limits
    const plan = subscription_plan || 'solo_teacher';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.solo_teacher;

    // Set smart defaults for parent reschedule policy based on org type
    const policyDefaults: Record<string, string> = {
      solo_teacher: 'self_service',
      studio: 'request_only',
      academy: 'request_only',
      agency: 'admin_locked',
    };
    const parentReschedulePolicy = policyDefaults[org_type] || 'request_only';

    // Derive country and currency from the user's timezone (defaults to GB/GBP)
    const tzCountryMap: Record<string, { country: string; currency: string }> = {
      'Europe/London': { country: 'GB', currency: 'GBP' },
      'America/New_York': { country: 'US', currency: 'USD' },
      'America/Chicago': { country: 'US', currency: 'USD' },
      'America/Denver': { country: 'US', currency: 'USD' },
      'America/Los_Angeles': { country: 'US', currency: 'USD' },
      'Europe/Dublin': { country: 'IE', currency: 'EUR' },
      'Pacific/Auckland': { country: 'NZ', currency: 'NZD' },
    };
    const tz = body.timezone || 'Europe/London';
    const isAustralia = tz.startsWith('Australia/');
    const detected = isAustralia
      ? { country: 'AU', currency: 'AUD' }
      : tzCountryMap[tz] || { country: 'GB', currency: 'GBP' };

    // Use service role client for the atomic RPC call
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('[onboarding-setup] Calling complete_onboarding RPC for org:', org_name, org_type);

    // Single atomic RPC call — all steps run in one transaction.
    // If any step fails, everything rolls back. No partial state.
    const { data: result, error: rpcError } = await adminClient.rpc('complete_onboarding', {
      _user_id: user.id,
      _user_email: user.email,
      _full_name: full_name,
      _phone: phone || null,
      _org_name: org_name,
      _org_type: org_type,
      _country_code: detected.country,
      _currency_code: detected.currency,
      _timezone: tz,
      _subscription_plan: plan,
      _max_students: limits.max_students,
      _max_teachers: limits.max_teachers,
      _parent_reschedule_policy: parentReschedulePolicy,
      _trial_days: TRIAL_DAYS,
      _also_teaches: also_teaches || false,
    });

    if (rpcError) {
      console.error('[onboarding-setup] RPC failed:', rpcError);
      return new Response(
        JSON.stringify({ error: 'An internal error occurred. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[onboarding-setup] RPC result:', result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[onboarding-setup] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
