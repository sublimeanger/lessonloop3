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
      console.error('OAuth error:', error);
      return Response.redirect(`${redirectUri}?calendar_error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return Response.redirect(`${redirectUri}?calendar_error=no_code`);
    }

    // Get Google OAuth credentials
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!clientId || !clientSecret) {
      return Response.redirect(`${redirectUri}?calendar_error=not_configured`);
    }

    // Exchange code for tokens
    const callbackUrl = `${supabaseUrl}/functions/v1/calendar-oauth-callback`;
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return Response.redirect(`${redirectUri}?calendar_error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + (expires_in * 1000));

    // Fetch user's primary calendar
    const calendarListResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1',
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    let calendarId = 'primary';
    let calendarName = 'Primary Calendar';

    if (calendarListResponse.ok) {
      const calendarList = await calendarListResponse.json();
      if (calendarList.items && calendarList.items.length > 0) {
        const primaryCalendar = calendarList.items.find((c: any) => c.primary) || calendarList.items[0];
        calendarId = primaryCalendar.id || 'primary';
        calendarName = primaryCalendar.summary || 'Google Calendar';
      }
    }

    // Store connection in database
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', stateData.user_id)
      .eq('org_id', stateData.org_id)
      .eq('provider', 'google')
      .single();

    if (existingConnection) {
      // Update existing connection
      const { error: updateError } = await supabase
        .from('calendar_connections')
        .update({
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt.toISOString(),
          calendar_id: calendarId,
          calendar_name: calendarName,
          sync_status: 'active',
          sync_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConnection.id);

      if (updateError) {
        console.error('Error updating connection:', updateError);
        return Response.redirect(`${redirectUri}?calendar_error=save_failed`);
      }
    } else {
      // Create new connection
      const { error: insertError } = await supabase
        .from('calendar_connections')
        .insert({
          user_id: stateData.user_id,
          org_id: stateData.org_id,
          provider: 'google',
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt.toISOString(),
          calendar_id: calendarId,
          calendar_name: calendarName,
          sync_status: 'active',
          sync_enabled: true,
        });

      if (insertError) {
        console.error('Error creating connection:', insertError);
        return Response.redirect(`${redirectUri}?calendar_error=save_failed`);
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
        after: { provider: 'google', calendar_name: calendarName },
      });

    // Redirect back to settings with success
    return Response.redirect(`${redirectUri}?calendar_connected=google`);

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
