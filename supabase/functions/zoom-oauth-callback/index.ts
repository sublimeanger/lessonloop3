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
      console.error('Zoom OAuth error:', error);
      return Response.redirect(`${redirectUri}?zoom_error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return Response.redirect(`${redirectUri}?zoom_error=no_code`);
    }

    // Get Zoom OAuth credentials
    const clientId = Deno.env.get('ZOOM_CLIENT_ID');
    const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!clientId || !clientSecret) {
      return Response.redirect(`${redirectUri}?zoom_error=not_configured`);
    }

    // Exchange code for tokens (Zoom uses Basic auth)
    // Must match the redirect_uri registered with Zoom (app domain proxy)
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://app.lessonloop.net';
    const callbackUrl = `${frontendUrl}/auth/zoom/callback`;
    const basicAuth = btoa(`${clientId}:${clientSecret}`);

    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Zoom token exchange failed:', errorText);
      return Response.redirect(`${redirectUri}?zoom_error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + (expires_in * 1000));

    // Fetch Zoom user info
    let zoomUserId = 'me';
    let zoomDisplayName = 'Zoom Account';

    try {
      const userResponse = await fetch('https://api.zoom.us/v2/users/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (userResponse.ok) {
        const zoomUser = await userResponse.json();
        zoomUserId = zoomUser.id || 'me';
        zoomDisplayName = zoomUser.display_name || zoomUser.first_name
          ? `${zoomUser.first_name || ''} ${zoomUser.last_name || ''}`.trim()
          : zoomUser.email || 'Zoom Account';
      }
    } catch (e) {
      console.error('Error fetching Zoom user info:', e);
      // Non-fatal — continue with defaults
    }

    // Store connection in database
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', stateData.user_id)
      .eq('org_id', stateData.org_id)
      .eq('provider', 'zoom')
      .is('guardian_id', null)
      .single();

    if (existingConnection) {
      // Update existing connection
      const { error: updateError } = await supabase
        .from('calendar_connections')
        .update({
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt.toISOString(),
          calendar_id: zoomUserId,
          calendar_name: zoomDisplayName,
          sync_status: 'active',
          sync_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConnection.id);

      if (updateError) {
        console.error('Error updating Zoom connection:', updateError);
        return Response.redirect(`${redirectUri}?zoom_error=save_failed`);
      }
    } else {
      // Create new connection
      const { error: insertError } = await supabase
        .from('calendar_connections')
        .insert({
          user_id: stateData.user_id,
          org_id: stateData.org_id,
          provider: 'zoom',
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt.toISOString(),
          calendar_id: zoomUserId,
          calendar_name: zoomDisplayName,
          sync_status: 'active',
          sync_enabled: true,
        });

      if (insertError) {
        console.error('Error creating Zoom connection:', insertError);
        return Response.redirect(`${redirectUri}?zoom_error=save_failed`);
      }
    }

    // Log to audit
    await supabase
      .from('audit_log')
      .insert({
        org_id: stateData.org_id,
        actor_user_id: stateData.user_id,
        action: 'connect',
        entity_type: 'calendar_connections',
        entity_id: null,
        after: { provider: 'zoom', display_name: zoomDisplayName },
      });

    // Redirect back to settings with success
    return Response.redirect(`${redirectUri}?zoom_connected=true`);

  } catch (error) {
    console.error('Zoom OAuth callback error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
