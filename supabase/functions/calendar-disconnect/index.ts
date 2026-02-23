import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

async function getValidAccessToken(connection: any): Promise<string | null> {
  if (!connection.access_token) return null;

  // If no expiry recorded, assume expired and try to refresh
  if (!connection.token_expires_at) {
    return connection.access_token; // Best-effort with existing token
  }

  const expiresAt = new Date(connection.token_expires_at);
  const bufferMs = 5 * 60 * 1000;

  if (isNaN(expiresAt.getTime()) || expiresAt.getTime() - Date.now() < bufferMs) {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret || !connection.refresh_token) return connection.access_token;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) return connection.access_token;
    const tokens = await response.json();
    return tokens.access_token;
  }

  return connection.access_token;
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { connection_id, delete_events = false } = await req.json();

    if (!connection_id) {
      return new Response(JSON.stringify({ error: 'connection_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify ownership
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', user.id)
      .single();

    if (connectionError || !connection) {
      return new Response(JSON.stringify({ error: 'Connection not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get a valid (possibly refreshed) access token for Google API calls
    const validToken = connection.provider === 'google'
      ? await getValidAccessToken(connection)
      : null;

    // Optionally delete events from Google Calendar
    if (delete_events && connection.provider === 'google' && validToken) {
      const { data: mappings } = await supabase
        .from('calendar_event_mappings')
        .select('external_event_id')
        .eq('connection_id', connection_id);

      if (mappings && mappings.length > 0) {
        const calendarId = connection.calendar_id || 'primary';
        const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

        // Delete each event (with rate limiting)
        for (const mapping of mappings) {
          if (mapping.external_event_id) {
            try {
              await fetch(`${baseUrl}/${mapping.external_event_id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${validToken}` },
              });
            } catch (e) {
              console.error('Error deleting event:', e);
              // Continue with other deletions
            }
          }
        }
      }
    }

    // Revoke Google token if applicable
    if (connection.provider === 'google' && validToken) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${validToken}`, {
          method: 'POST',
        });
      } catch (e) {
        console.error('Error revoking token:', e);
        // Continue with deletion even if revoke fails
      }
    }

    // Delete mappings first (foreign key constraint)
    await supabase
      .from('calendar_event_mappings')
      .delete()
      .eq('connection_id', connection_id);

    // Delete external busy blocks
    await supabase
      .from('external_busy_blocks')
      .delete()
      .eq('connection_id', connection_id);

    // Delete the connection
    const { error: deleteError } = await supabase
      .from('calendar_connections')
      .delete()
      .eq('id', connection_id);

    if (deleteError) {
      console.error('Error deleting connection:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to delete connection' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log to audit
    await supabase
      .from('audit_log')
      .insert({
        org_id: connection.org_id,
        actor_user_id: user.id,
        action: 'disconnect',
        entity_type: 'calendar_connections',
        entity_id: connection_id,
        before: { provider: connection.provider, calendar_name: connection.calendar_name },
      });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Disconnect error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
