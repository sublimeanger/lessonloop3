import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

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

    // Optionally delete events from Google Calendar
    if (delete_events && connection.provider === 'google' && connection.access_token) {
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
                headers: { Authorization: `Bearer ${connection.access_token}` },
              });
            } catch (e) {
              console.error('Error deleting event:', e);
              // Continue with other deletions
            }
          }
        }
      }
    }

    // Optionally delete Zoom meetings
    if (delete_events && connection.provider === 'zoom' && connection.access_token) {
      const { data: zoomMappings } = await supabase
        .from('zoom_meeting_mappings')
        .select('id, zoom_meeting_id, lesson_id')
        .eq('connection_id', connection_id);

      if (zoomMappings && zoomMappings.length > 0) {
        const lessonIds: string[] = [];
        for (const mapping of zoomMappings) {
          if (mapping.zoom_meeting_id) {
            try {
              await fetch(`https://api.zoom.us/v2/meetings/${mapping.zoom_meeting_id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${connection.access_token}` },
              });
            } catch (e) {
              console.error('Error deleting Zoom meeting:', e);
            }
          }
          lessonIds.push(mapping.lesson_id);
        }
        // Clear online_meeting_url on affected lessons
        if (lessonIds.length > 0) {
          await supabase
            .from('lessons')
            .update({ online_meeting_url: null })
            .in('id', lessonIds);
        }
      }
    }

    // Revoke Google token if applicable
    if (connection.provider === 'google' && connection.access_token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${connection.access_token}`, {
          method: 'POST',
        });
      } catch (e) {
        console.error('Error revoking token:', e);
        // Continue with deletion even if revoke fails
      }
    }

    // Revoke Zoom token if applicable
    if (connection.provider === 'zoom' && connection.access_token) {
      const zoomClientId = Deno.env.get('ZOOM_CLIENT_ID');
      const zoomClientSecret = Deno.env.get('ZOOM_CLIENT_SECRET');
      if (zoomClientId && zoomClientSecret) {
        try {
          await fetch('https://zoom.us/oauth/revoke', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(`${zoomClientId}:${zoomClientSecret}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ token: connection.access_token }),
          });
        } catch (e) {
          console.error('Error revoking Zoom token:', e);
        }
      }
    }

    // Delete mappings first (foreign key constraint)
    await supabase
      .from('calendar_event_mappings')
      .delete()
      .eq('connection_id', connection_id);

    // Delete Zoom meeting mappings
    await supabase
      .from('zoom_meeting_mappings')
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
