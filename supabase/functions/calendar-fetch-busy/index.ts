import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

async function refreshAccessToken(
  supabase: any,
  connectionId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) return null;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    await supabase
      .from('calendar_connections')
      .update({ sync_status: 'error' })
      .eq('id', connectionId);
    return null;
  }

  const tokens = await response.json();
  const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

  await supabase
    .from('calendar_connections')
    .update({
      access_token: tokens.access_token,
      token_expires_at: tokenExpiresAt.toISOString(),
    })
    .eq('id', connectionId);

  return tokens.access_token;
}

async function getValidAccessToken(supabase: any, connection: any): Promise<string | null> {
  if (!connection.token_expires_at) {
    return await refreshAccessToken(supabase, connection.id, connection.refresh_token);
  }
  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  if (isNaN(expiresAt.getTime()) || expiresAt.getTime() - now.getTime() < bufferMs) {
    return await refreshAccessToken(supabase, connection.id, connection.refresh_token);
  }

  return connection.access_token;
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- JWT Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optionally accept a specific connection_id from request body
    let connectionId: string | null = null;
    try {
      const body = await req.json();
      connectionId = body.connection_id || null;
    } catch {
      // No body
    }

    // Get connections to sync — always scoped to the authenticated user
    let query = supabase
      .from('calendar_connections')
      .select('*')
      .eq('provider', 'google')
      .eq('sync_enabled', true)
      .eq('sync_status', 'active')
      .eq('user_id', user.id);

    if (connectionId) {
      query = query.eq('id', connectionId);
    }

    const { data: connections, error: connectionsError } = await query;

    if (connectionsError || !connections || connections.length === 0) {
      return new Response(JSON.stringify({ message: 'No connections to sync', synced: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Define time window: now to 14 days ahead
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 14);

    let synced = 0;
    let errors = 0;

    for (const connection of connections) {
      try {
        const accessToken = await getValidAccessToken(supabase, connection);
        if (!accessToken) {
          errors++;
          continue;
        }

        const calendarId = connection.calendar_id || 'primary';
        
        // Fetch events from Google Calendar
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
        url.searchParams.set('timeMin', timeMin.toISOString());
        url.searchParams.set('timeMax', timeMax.toISOString());
        url.searchParams.set('singleEvents', 'true');
        url.searchParams.set('maxResults', '250');
        url.searchParams.set('orderBy', 'startTime');

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          console.error(`Failed to fetch events for connection ${connection.id}`);
          errors++;
          continue;
        }

        const data = await response.json();
        const events = data.items || [];

        // Delete old busy blocks for this connection
        await supabase
          .from('external_busy_blocks')
          .delete()
          .eq('connection_id', connection.id);

        // Insert new busy blocks (excluding all-day events and free events)
        const busyBlocks = events
          .filter((event: any) => {
            // Skip cancelled events
            if (event.status === 'cancelled') return false;
            // Skip free (transparent) events
            if (event.transparency === 'transparent') return false;
            // Skip all-day events (no dateTime)
            if (!event.start?.dateTime || !event.end?.dateTime) return false;
            return true;
          })
          .map((event: any) => ({
            connection_id: connection.id,
            user_id: connection.user_id,
            org_id: connection.org_id,
            start_at: event.start.dateTime,
            end_at: event.end.dateTime,
            title: event.summary || 'Busy',
            source_event_id: event.id,
            fetched_at: new Date().toISOString(),
          }));

        if (busyBlocks.length > 0) {
          const { error: insertError } = await supabase
            .from('external_busy_blocks')
            .insert(busyBlocks);

          if (insertError) {
            console.error(`Failed to insert busy blocks for connection ${connection.id}:`, insertError);
            errors++;
            continue;
          }
        }

        // Update last_sync_at
        await supabase
          .from('calendar_connections')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', connection.id);

        synced++;
      } catch (e) {
        console.error(`Error syncing connection ${connection.id}:`, e);
        errors++;
      }
    }

    return new Response(JSON.stringify({ synced, errors, total: connections.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Fetch busy error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
