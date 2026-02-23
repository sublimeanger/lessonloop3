import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateCronAuth } from '../_shared/cron-auth.ts';

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
    console.error(`Token refresh failed for connection ${connectionId}`);
    await supabase
      .from('calendar_connections')
      .update({ sync_status: 'error' })
      .eq('id', connectionId);
    return null;
  }

  const tokens = await response.json();
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await supabase.from('calendar_connections').update({
    access_token: tokens.access_token,
    token_expires_at: tokenExpiresAt.toISOString(),
  }).eq('id', connectionId);

  return tokens.access_token;
}

async function getValidAccessToken(supabase: any, connection: any): Promise<string | null> {
  const expiresAt = new Date(connection.token_expires_at);
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    return await refreshAccessToken(supabase, connection.id, connection.refresh_token);
  }
  return connection.access_token;
}

Deno.serve(async (req) => {
  // Only allow cron/internal calls
  const authError = validateCronAuth(req);
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active Google Calendar connections
    const { data: connections, error } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('provider', 'google')
      .eq('sync_enabled', true)
      .eq('sync_status', 'active');

    if (error || !connections || connections.length === 0) {
      return new Response(JSON.stringify({ message: 'No connections to refresh', count: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 14);

    let refreshed = 0;
    let errors = 0;

    for (const connection of connections) {
      try {
        const accessToken = await getValidAccessToken(supabase, connection);
        if (!accessToken) { errors++; continue; }

        const calendarId = connection.calendar_id || 'primary';
        const url = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
        );
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

        // Delete old busy blocks
        await supabase
          .from('external_busy_blocks')
          .delete()
          .eq('connection_id', connection.id);

        // Insert new ones
        const busyBlocks = events
          .filter((event: any) => {
            if (event.status === 'cancelled') return false;
            if (event.transparency === 'transparent') return false;
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
          await supabase.from('external_busy_blocks').insert(busyBlocks);
        }

        await supabase.from('calendar_connections').update({
          last_sync_at: new Date().toISOString(),
        }).eq('id', connection.id);

        refreshed++;

        // Small delay between connections to avoid Google rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (e) {
        console.error(`Error refreshing connection ${connection.id}:`, e);
        errors++;
      }
    }

    console.log(`Busy block refresh complete: ${refreshed} refreshed, ${errors} errors out of ${connections.length}`);

    return new Response(JSON.stringify({ refreshed, errors, total: connections.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Refresh busy blocks error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
