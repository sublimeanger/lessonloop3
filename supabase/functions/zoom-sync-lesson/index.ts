import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface SyncPayload {
  lesson_id: string;
  action: 'create' | 'update' | 'delete';
}

async function refreshZoomAccessToken(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = Deno.env.get('ZOOM_CLIENT_ID');
  const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error('Zoom credentials not configured');
    return null;
  }

  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    console.error('Zoom token refresh failed:', await response.text());
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
      refresh_token: tokens.refresh_token || refreshToken, // Zoom may return a new refresh token
      token_expires_at: tokenExpiresAt.toISOString(),
    })
    .eq('id', connectionId);

  return tokens.access_token;
}

async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  connection: { id: string; access_token: string; refresh_token: string; token_expires_at: string }
): Promise<string | null> {
  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes

  if (expiresAt.getTime() - now.getTime() < bufferMs) {
    return await refreshZoomAccessToken(supabase, connection.id, connection.refresh_token);
  }

  return connection.access_token;
}

function buildMeetingTopic(lesson: { title: string }): string {
  return lesson.title || 'Online Lesson';
}

function calculateDurationMinutes(startAt: string, endAt: string): number {
  return Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
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

    // For non-delete actions, only sync online lessons
    if (action !== 'delete' && lesson && !lesson.is_online) {
      return new Response(JSON.stringify({ message: 'Lesson is not online, skipping Zoom sync' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get teacher user ID and org
    let teacherUserId = lesson?.teacher_user_id;
    let orgId = lesson?.org_id;

    // For delete, fall back to the mapping's connection info
    if (action === 'delete' && !teacherUserId) {
      const { data: mapping } = await supabase
        .from('zoom_meeting_mappings')
        .select('connection:calendar_connections(user_id, org_id)')
        .eq('lesson_id', lesson_id)
        .single();

      if (mapping?.connection) {
        teacherUserId = (mapping.connection as { user_id: string }).user_id;
        orgId = (mapping.connection as { org_id: string }).org_id;
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

    // Get Zoom connection for this teacher
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', teacherUserId)
      .eq('org_id', orgId)
      .eq('provider', 'zoom')
      .eq('sync_enabled', true)
      .eq('sync_status', 'active')
      .single();

    if (connectionError || !connection) {
      return new Response(JSON.stringify({ message: 'No active Zoom connection' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(supabase, connection);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Failed to get Zoom access token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get existing mapping if any
    const { data: existingMapping } = await supabase
      .from('zoom_meeting_mappings')
      .select('*')
      .eq('lesson_id', lesson_id)
      .single();

    let result: { success: boolean; zoom_meeting_id?: number; join_url?: string; error?: string };

    if (action === 'delete') {
      // Delete Zoom meeting
      if (existingMapping?.zoom_meeting_id) {
        const deleteResponse = await fetch(
          `https://api.zoom.us/v2/meetings/${existingMapping.zoom_meeting_id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (deleteResponse.ok || deleteResponse.status === 404) {
          // Remove mapping
          await supabase
            .from('zoom_meeting_mappings')
            .delete()
            .eq('id', existingMapping.id);

          // Clear meeting URL on lesson
          await supabase
            .from('lessons')
            .update({ online_meeting_url: null })
            .eq('id', lesson_id);

          result = { success: true };
        } else {
          result = { success: false, error: 'Failed to delete Zoom meeting' };
        }
      } else {
        result = { success: true }; // No meeting to delete
      }
    } else if (action === 'update' && existingMapping?.zoom_meeting_id) {
      // Update existing Zoom meeting
      const duration = calculateDurationMinutes(lesson.start_at, lesson.end_at);
      const topic = buildMeetingTopic(lesson);

      const updateResponse = await fetch(
        `https://api.zoom.us/v2/meetings/${existingMapping.zoom_meeting_id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topic,
            start_time: lesson.start_at,
            duration,
            timezone: 'UTC',
          }),
        }
      );

      if (updateResponse.ok || updateResponse.status === 204) {
        await supabase
          .from('zoom_meeting_mappings')
          .update({
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', existingMapping.id);

        result = { success: true, zoom_meeting_id: existingMapping.zoom_meeting_id };
      } else {
        const errorText = await updateResponse.text();
        await supabase
          .from('zoom_meeting_mappings')
          .update({
            sync_status: 'failed',
            error_message: errorText.substring(0, 500),
          })
          .eq('id', existingMapping.id);

        result = { success: false, error: errorText };
      }
    } else {
      // Create new Zoom meeting
      const duration = calculateDurationMinutes(lesson.start_at, lesson.end_at);
      const topic = buildMeetingTopic(lesson);

      const studentNames = (lesson.participants as { student: { first_name: string; last_name: string } }[])
        ?.map((p) => `${p.student?.first_name} ${p.student?.last_name}`)
        .filter(Boolean)
        .join(', ') || '';

      const agenda = studentNames ? `Students: ${studentNames}` : '';

      const createResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          type: 2, // Scheduled meeting
          start_time: lesson.start_at,
          duration,
          timezone: 'UTC',
          agenda,
          settings: {
            join_before_host: true,
            waiting_room: false,
            auto_recording: 'none',
            mute_upon_entry: true,
          },
        }),
      });

      if (createResponse.ok) {
        const meeting = await createResponse.json();

        // Create or update mapping
        if (existingMapping) {
          await supabase
            .from('zoom_meeting_mappings')
            .update({
              zoom_meeting_id: meeting.id,
              join_url: meeting.join_url,
              start_url: meeting.start_url || null,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
              error_message: null,
            })
            .eq('id', existingMapping.id);
        } else {
          await supabase
            .from('zoom_meeting_mappings')
            .insert({
              connection_id: connection.id,
              lesson_id: lesson_id,
              zoom_meeting_id: meeting.id,
              join_url: meeting.join_url,
              start_url: meeting.start_url || null,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            });
        }

        // Store join URL on the lesson
        await supabase
          .from('lessons')
          .update({ online_meeting_url: meeting.join_url })
          .eq('id', lesson_id);

        result = { success: true, zoom_meeting_id: meeting.id, join_url: meeting.join_url };
      } else {
        const errorText = await createResponse.text();
        console.error('Zoom meeting creation failed:', errorText);
        result = { success: false, error: errorText };
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
    console.error('Zoom sync error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
