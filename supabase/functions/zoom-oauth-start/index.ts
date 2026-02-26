import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

/** Validate redirect_uri against allowed domains to prevent open-redirect attacks. */
function validateRedirectUri(uri: string | undefined | null): string {
  const fallback = `${FRONTEND_URL}/settings`;
  if (!uri || typeof uri !== "string") return fallback;

  try {
    const parsed = new URL(uri);
    const allowed = [
      "lessonloop.net",
      "www.lessonloop.net",
      "app.lessonloop.net",
    ];
    const isAllowed =
      allowed.includes(parsed.hostname) ||
      parsed.hostname.endsWith(".lovable.app") ||
      parsed.hostname.endsWith(".lovableproject.com");

    if (parsed.protocol === "https:" && isAllowed) {
      return uri;
    }
  } catch {
    // invalid URL — fall through to fallback
  }

  return fallback;
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { org_id, redirect_uri } = await req.json();

    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Zoom OAuth credentials
    const clientId = Deno.env.get('ZOOM_CLIENT_ID');
    const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({
        error: 'Zoom integration not configured',
        message: 'Please contact support to enable Zoom integration.',
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate state token (include user and org info for callback)
    const stateData = {
      user_id: user.id,
      org_id,
      redirect_uri: validateRedirectUri(redirect_uri),
      nonce: crypto.randomUUID(),
    };
    const state = btoa(JSON.stringify(stateData));

    // Build Zoom OAuth URL — redirect through app domain for Zoom domain verification
    const callbackUrl = `${FRONTEND_URL}/auth/zoom/callback`;

    const authUrl = new URL('https://zoom.us/oauth/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);

    return new Response(JSON.stringify({
      auth_url: authUrl.toString(),
      state,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error starting Zoom OAuth flow:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
