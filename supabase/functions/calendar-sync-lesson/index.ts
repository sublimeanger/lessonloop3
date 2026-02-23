import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface SyncPayload {
  lesson_id: string;
  action: 'create' | 'update' | 'delete';
}

async function refreshAccessToken(
  supabase: any,
  connectionId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error('Google credentials not configured');
    return null;
  }

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
    console.error('Token refresh failed');
    await supabase
      .from('calendar_connections')
      .update({ sync_status: 'error' })
      .eq('id', connectionId);
    return null;
  }

  const tokens = await response.json();
  const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

  // Update stored tokens
  await supabase
    .from('calendar_connections')
    .update({
      access_token: tokens.access_token,
      token_expires_at: tokenExpiresAt.toISOString(),
    })
    .eq('id', connectionId);

  return tokens.access_token;
}

async function getValidAccessToken(
  supabase: any,
  connection: any
): Promise<string | null> {
  // Check if token is expired or about to expire (within 5 minutes)
  if (!connection.token_expires_at) {
    return await refreshAccessToken(supabase, connection.id, connection.refresh_token);
  }
  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes

  if (isNaN(expiresAt.getTime()) || expiresAt.getTime() - now.getTime() < bufferMs) {
    // Token needs refresh
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

    const payload: SyncPayload = await req.json();
    const { lesson_id, action } = payload;

    if (!lesson_id || !action) {
      return new Response(JSON.stringify({ error: 'Missing lesson_id or action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch lesson details
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        *,
        location:locations(name, address_line_1, city, postcode),
        room:rooms(name),
        participants:lesson_participants(
          student:students(first_name, last_name)
        )
      `)
      .eq('id', lesson_id)
      .single();

    if (lessonError && action !== 'delete') {
      console.error('Lesson not found:', lessonError);
      return new Response(JSON.stringify({ error: 'Lesson not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For delete, we need to get the teacher from existing mappings
    let teacherUserId = lesson?.teacher_user_id;
    let orgId = lesson?.org_id;

    if (action === 'delete' && !teacherUserId) {
      const { data: mapping } = await supabase
        .from('calendar_event_mappings')
        .select('connection:calendar_connections(user_id, org_id)')
        .eq('lesson_id', lesson_id)
        .single();

      if (mapping?.connection) {
        teacherUserId = (mapping.connection as any).user_id;
        orgId = (mapping.connection as any).org_id;
      }
    }

    if (!teacherUserId || !orgId) {
      return new Response(JSON.stringify({ message: 'No teacher to sync' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Authorisation: user must be a member of the lesson's org ---
    const { data: membership } = await supabase
      .from('org_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Google calendar connection for this teacher
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', teacherUserId)
      .eq('org_id', orgId)
      .eq('provider', 'google')
      .eq('sync_enabled', true)
      .eq('sync_status', 'active')
      .single();

    if (connectionError || !connection) {
      // No Google Calendar connected for this teacher
      return new Response(JSON.stringify({ message: 'No active Google Calendar connection' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(supabase, connection);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Failed to get access token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const calendarId = connection.calendar_id || 'primary';
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    // Get existing mapping if any
    const { data: existingMapping } = await supabase
      .from('calendar_event_mappings')
      .select('*')
      .eq('connection_id', connection.id)
      .eq('lesson_id', lesson_id)
      .single();

    let result: { success: boolean; external_event_id?: string; error?: string };

    if (action === 'delete') {
      // Delete event from Google Calendar
      if (existingMapping?.external_event_id) {
        const deleteResponse = await fetch(
          `${baseUrl}/${existingMapping.external_event_id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (deleteResponse.ok || deleteResponse.status === 404) {
          // Remove mapping
          await supabase
            .from('calendar_event_mappings')
            .delete()
            .eq('id', existingMapping.id);

          result = { success: true };
        } else {
          result = { success: false, error: 'Failed to delete event' };
        }
      } else {
        result = { success: true }; // No event to delete
      }
    } else {
      // Build event object for create/update
      const locationParts: string[] = [];
      if ((lesson.room as any)?.name) locationParts.push((lesson.room as any).name);
      if ((lesson.location as any)?.name) locationParts.push((lesson.location as any).name);
      if ((lesson.location as any)?.address_line_1) locationParts.push((lesson.location as any).address_line_1);
      if ((lesson.location as any)?.city) locationParts.push((lesson.location as any).city);

      const studentNames = (lesson.participants as any[])
        ?.map(p => `${p.student?.first_name} ${p.student?.last_name}`)
        .filter(Boolean)
        .join(', ') || '';

      const event = {
        summary: lesson.title,
        description: studentNames ? `Students: ${studentNames}${lesson.notes_shared ? '\n\n' + lesson.notes_shared : ''}` : lesson.notes_shared || '',
        location: locationParts.join(', ') || undefined,
        start: {
          dateTime: lesson.start_at,
          timeZone: 'UTC',
        },
        end: {
          dateTime: lesson.end_at,
          timeZone: 'UTC',
        },
        status: lesson.status === 'cancelled' ? 'cancelled' : 'confirmed',
      };

      if (action === 'update' && existingMapping?.external_event_id) {
        // Update existing event
        const updateResponse = await fetch(
          `${baseUrl}/${existingMapping.external_event_id}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        );

        if (updateResponse.ok) {
          const updatedEvent = await updateResponse.json();
          
          await supabase
            .from('calendar_event_mappings')
            .update({
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
              error_message: null,
            })
            .eq('id', existingMapping.id);

          result = { success: true, external_event_id: updatedEvent.id };
        } else {
          const errorText = await updateResponse.text();
          
          await supabase
            .from('calendar_event_mappings')
            .update({
              sync_status: 'failed',
              error_message: errorText.substring(0, 500),
            })
            .eq('id', existingMapping.id);

          result = { success: false, error: errorText };
        }
      } else {
        // Create new event
        const createResponse = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });

        if (createResponse.ok) {
          const createdEvent = await createResponse.json();

          // Create or update mapping
          if (existingMapping) {
            await supabase
              .from('calendar_event_mappings')
              .update({
                external_event_id: createdEvent.id,
                sync_status: 'synced',
                last_synced_at: new Date().toISOString(),
                error_message: null,
              })
              .eq('id', existingMapping.id);
          } else {
            await supabase
              .from('calendar_event_mappings')
              .insert({
                connection_id: connection.id,
                lesson_id: lesson_id,
                external_event_id: createdEvent.id,
                sync_status: 'synced',
                last_synced_at: new Date().toISOString(),
              });
          }

          result = { success: true, external_event_id: createdEvent.id };
        } else {
          const errorText = await createResponse.text();
          result = { success: false, error: errorText };
        }
      }
    }

    // Update connection last_sync_at
    await supabase
      .from('calendar_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
