import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Parse state to get user context
    let stateData: { user_id: string; org_id: string; redirect_uri: string; nonce: string };
    try {
      stateData = JSON.parse(atob(state || ''));
    } catch {
      return new Response('Invalid state parameter', { status: 400 });
    }

    const redirectUri = stateData.redirect_uri || '/settings';

    // Handle OAuth errors
    if (error) {
      console.error('Xero OAuth error:', error);
      return Response.redirect(`${redirectUri}?xero_error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return Response.redirect(`${redirectUri}?xero_error=no_code`);
    }

    // Get Xero OAuth credentials
    const clientId = Deno.env.get('XERO_CLIENT_ID');
    const clientSecret = Deno.env.get('XERO_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!clientId || !clientSecret) {
      return Response.redirect(`${redirectUri}?xero_error=not_configured`);
    }

    // Exchange code for tokens
    const callbackUrl = `${supabaseUrl}/functions/v1/xero-oauth-callback`;

    const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Xero token exchange failed:', errorText);
      return Response.redirect(`${redirectUri}?xero_error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + (expires_in * 1000));

    // Fetch Xero tenant connections
    const connectionsResponse = await fetch('https://api.xero.com/connections', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    let tenantId = '';
    let tenantName = 'Xero Organisation';

    if (connectionsResponse.ok) {
      const connections = await connectionsResponse.json();
      if (connections && connections.length > 0) {
        tenantId = connections[0].tenantId;
        tenantName = connections[0].tenantName || 'Xero Organisation';
      }
    }

    if (!tenantId) {
      console.error('No Xero tenant found');
      return Response.redirect(`${redirectUri}?xero_error=no_tenant`);
    }

    // Store connection in database (service role — bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upsert: one Xero connection per org (ON CONFLICT org_id)
    const { error: upsertError } = await supabase
      .from('xero_connections')
      .upsert(
        {
          org_id: stateData.org_id,
          connected_by: stateData.user_id,
          tenant_id: tenantId,
          tenant_name: tenantName,
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt.toISOString(),
          sync_status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id' },
      );

    if (upsertError) {
      console.error('Error saving Xero connection:', upsertError);
      return Response.redirect(`${redirectUri}?xero_error=save_failed`);
    }

    // Log to audit
    await supabase
      .from('audit_log')
      .insert({
        org_id: stateData.org_id,
        actor_user_id: stateData.user_id,
        action: 'connect',
        entity_type: 'xero_connections',
        entity_id: null,
        after: { tenant_name: tenantName, tenant_id: tenantId },
      });

    // Redirect back to settings with success
    return Response.redirect(`${redirectUri}?xero_connected=true`);

  } catch (error) {
    console.error('Xero OAuth callback error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
