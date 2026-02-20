import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Format date to iCal format (YYYYMMDDTHHMMSSZ)
function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Escape special characters for iCal text fields
function escapeICalText(text: string | null): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Generate a unique UID for each event
function generateEventUID(lessonId: string, domain: string): string {
  return `${lessonId}@${domain}`;
}

Deno.serve(async (req) => {
  // Public endpoint authenticated via URL token, but still use shared CORS
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Missing token parameter', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Create Supabase client with service role for validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up the calendar connection by iCal token
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('id, user_id, org_id, sync_enabled, ical_token_expires_at')
      .eq('ical_token', token)
      .eq('provider', 'apple')
      .single();

    if (connectionError || !connection) {
      console.error('Invalid or expired iCal token');
      return new Response('Invalid or expired feed URL', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Check token expiry
    if (connection.ical_token_expires_at && new Date(connection.ical_token_expires_at) < new Date()) {
      return new Response('Feed URL has expired. Please generate a new one in LessonLoop settings.', {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (!connection.sync_enabled) {
      return new Response('Calendar sync is disabled', { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Fetch organisation details for timezone
    const { data: org } = await supabase
      .from('organisations')
      .select('name, timezone')
      .eq('id', connection.org_id)
      .single();

    const orgName = org?.name || 'LessonLoop';
    const timezone = org?.timezone || 'Europe/London';

    // Fetch upcoming lessons for this user (teacher)
    // Get lessons from the past month to 6 months ahead
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 6);

    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select(`
        id,
        title,
        start_at,
        end_at,
        status,
        notes_shared,
        location:locations(name, address_line_1, city, postcode),
        room:rooms(name),
        participants:lesson_participants(
          student:students(first_name, last_name)
        )
      `)
      .eq('org_id', connection.org_id)
      .eq('teacher_user_id', connection.user_id)
      .neq('status', 'cancelled')
      .gte('start_at', startDate.toISOString())
      .lte('start_at', endDate.toISOString())
      .order('start_at', { ascending: true });

    if (lessonsError) {
      console.error('Error fetching lessons:', lessonsError);
      return new Response('Error fetching lessons', { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Generate iCal content
    const domain = 'lessonloop.app';
    const now = formatICalDate(new Date());
    
    // Check if token expires within 7 days for warning
    let expiryWarning: string | null = null;
    if (connection.ical_token_expires_at) {
      const expiresAt = new Date(connection.ical_token_expires_at);
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      if (expiresAt <= sevenDaysFromNow) {
        const expiryDate = expiresAt.toISOString().split('T')[0];
        expiryWarning = `Your calendar feed URL expires on ${expiryDate}. Please regenerate in Settings.`;
      }
    }

    let icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LessonLoop//Calendar Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${orgName} Lessons`,
      `X-WR-TIMEZONE:${timezone}`,
    ];

    if (expiryWarning) {
      icalContent.push(`X-LESSONLOOP-WARNING:${expiryWarning}`);
    }

    // Add each lesson as an event
    for (const lesson of lessons || []) {
      const startAt = new Date(lesson.start_at);
      const endAt = new Date(lesson.end_at);
      
      // Build location string
      const locationParts: string[] = [];
      if ((lesson.room as any)?.name) {
        locationParts.push((lesson.room as any).name);
      }
      if ((lesson.location as any)?.name) {
        locationParts.push((lesson.location as any).name);
      }
      if ((lesson.location as any)?.address_line_1) {
        locationParts.push((lesson.location as any).address_line_1);
      }
      if ((lesson.location as any)?.city) {
        locationParts.push((lesson.location as any).city);
      }
      if ((lesson.location as any)?.postcode) {
        locationParts.push((lesson.location as any).postcode);
      }
      const location = locationParts.join(', ');

      // Build description with student names
      const studentNames = (lesson.participants as any[])
        ?.map(p => `${p.student?.first_name} ${p.student?.last_name}`)
        .filter(Boolean)
        .join(', ') || '';
      
      let description = '';
      if (studentNames) {
        description += `Students: ${studentNames}`;
      }
      if (lesson.notes_shared) {
        description += description ? '\\n\\n' : '';
        description += lesson.notes_shared;
      }

      // Add status indicator
      const statusText = lesson.status === 'completed' ? ' [Completed]' : '';

      icalContent.push(
        'BEGIN:VEVENT',
        `UID:${generateEventUID(lesson.id, domain)}`,
        `DTSTAMP:${now}`,
        `DTSTART:${formatICalDate(startAt)}`,
        `DTEND:${formatICalDate(endAt)}`,
        `SUMMARY:${escapeICalText(lesson.title)}${statusText}`,
      );

      if (location) {
        icalContent.push(`LOCATION:${escapeICalText(location)}`);
      }

      if (description) {
        icalContent.push(`DESCRIPTION:${escapeICalText(description)}`);
      }

      icalContent.push('END:VEVENT');
    }

    icalContent.push('END:VCALENDAR');

    // Update last_sync_at timestamp
    await supabase
      .from('calendar_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id);

    // Return iCal file
    return new Response(icalContent.join('\r\n'), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="lessons.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Error generating iCal feed:', error);
    return new Response('Internal server error', { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }
});
