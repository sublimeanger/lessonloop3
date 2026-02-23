import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// ─── VTIMEZONE definitions for common music-school timezones ───
const VTIMEZONE_MAP: Record<string, string> = {
  'Europe/London': [
    'BEGIN:VTIMEZONE',
    'TZID:Europe/London',
    'BEGIN:STANDARD',
    'DTSTART:19701025T020000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0000',
    'TZNAME:GMT',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700329T010000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
    'TZOFFSETFROM:+0000',
    'TZOFFSETTO:+0100',
    'TZNAME:BST',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
  ].join('\r\n'),
  'America/New_York': [
    'BEGIN:VTIMEZONE',
    'TZID:America/New_York',
    'BEGIN:STANDARD',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'TZNAME:EST',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'TZNAME:EDT',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
  ].join('\r\n'),
  'America/Chicago': [
    'BEGIN:VTIMEZONE',
    'TZID:America/Chicago',
    'BEGIN:STANDARD',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0600',
    'TZNAME:CST',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
    'TZOFFSETFROM:-0600',
    'TZOFFSETTO:-0500',
    'TZNAME:CDT',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
  ].join('\r\n'),
  'America/Denver': [
    'BEGIN:VTIMEZONE',
    'TZID:America/Denver',
    'BEGIN:STANDARD',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
    'TZOFFSETFROM:-0600',
    'TZOFFSETTO:-0700',
    'TZNAME:MST',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
    'TZOFFSETFROM:-0700',
    'TZOFFSETTO:-0600',
    'TZNAME:MDT',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
  ].join('\r\n'),
  'America/Los_Angeles': [
    'BEGIN:VTIMEZONE',
    'TZID:America/Los_Angeles',
    'BEGIN:STANDARD',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
    'TZOFFSETFROM:-0700',
    'TZOFFSETTO:-0800',
    'TZNAME:PST',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
    'TZOFFSETFROM:-0800',
    'TZOFFSETTO:-0700',
    'TZNAME:PDT',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
  ].join('\r\n'),
  'Australia/Sydney': [
    'BEGIN:VTIMEZONE',
    'TZID:Australia/Sydney',
    'BEGIN:STANDARD',
    'DTSTART:19700405T030000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=4',
    'TZOFFSETFROM:+1100',
    'TZOFFSETTO:+1000',
    'TZNAME:AEST',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19701004T020000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=10',
    'TZOFFSETFROM:+1000',
    'TZOFFSETTO:+1100',
    'TZNAME:AEDT',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
  ].join('\r\n'),
  'Australia/Melbourne': [
    'BEGIN:VTIMEZONE',
    'TZID:Australia/Melbourne',
    'BEGIN:STANDARD',
    'DTSTART:19700405T030000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=4',
    'TZOFFSETFROM:+1100',
    'TZOFFSETTO:+1000',
    'TZNAME:AEST',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19701004T020000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=10',
    'TZOFFSETFROM:+1000',
    'TZOFFSETTO:+1100',
    'TZNAME:AEDT',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
  ].join('\r\n'),
  'Pacific/Auckland': [
    'BEGIN:VTIMEZONE',
    'TZID:Pacific/Auckland',
    'BEGIN:STANDARD',
    'DTSTART:19700405T030000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=4',
    'TZOFFSETFROM:+1300',
    'TZOFFSETTO:+1200',
    'TZNAME:NZST',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700927T020000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=9',
    'TZOFFSETFROM:+1200',
    'TZOFFSETTO:+1300',
    'TZNAME:NZDT',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
  ].join('\r\n'),
};

// ─── DST offset rules for local-time conversion ───
interface DSTRule {
  stdOffset: number;   // minutes from UTC in standard time
  dstOffset: number;   // minutes from UTC in daylight time
  // DST start: month (1-based), weekday occurrence (negative = last), hour
  dstStart: { month: number; week: number; hour: number };
  // DST end (return to standard)
  dstEnd: { month: number; week: number; hour: number };
}

const DST_RULES: Record<string, DSTRule> = {
  'Europe/London':        { stdOffset: 0,    dstOffset: 60,   dstStart: { month: 3, week: -1, hour: 1 },  dstEnd: { month: 10, week: -1, hour: 2 } },
  'America/New_York':     { stdOffset: -300, dstOffset: -240, dstStart: { month: 3, week: 2, hour: 2 },   dstEnd: { month: 11, week: 1, hour: 2 } },
  'America/Chicago':      { stdOffset: -360, dstOffset: -300, dstStart: { month: 3, week: 2, hour: 2 },   dstEnd: { month: 11, week: 1, hour: 2 } },
  'America/Denver':       { stdOffset: -420, dstOffset: -360, dstStart: { month: 3, week: 2, hour: 2 },   dstEnd: { month: 11, week: 1, hour: 2 } },
  'America/Los_Angeles':  { stdOffset: -480, dstOffset: -420, dstStart: { month: 3, week: 2, hour: 2 },   dstEnd: { month: 11, week: 1, hour: 2 } },
  'Australia/Sydney':     { stdOffset: 600,  dstOffset: 660,  dstStart: { month: 10, week: 1, hour: 2 },  dstEnd: { month: 4, week: 1, hour: 3 } },
  'Australia/Melbourne':  { stdOffset: 600,  dstOffset: 660,  dstStart: { month: 10, week: 1, hour: 2 },  dstEnd: { month: 4, week: 1, hour: 3 } },
  'Pacific/Auckland':     { stdOffset: 720,  dstOffset: 780,  dstStart: { month: 9, week: -1, hour: 2 },  dstEnd: { month: 4, week: 1, hour: 3 } },
};

/** Find the Nth (or last) occurrence of a given weekday (0=Sun) in a month/year */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  if (n > 0) {
    // Nth occurrence (1-based)
    const first = new Date(Date.UTC(year, month - 1, 1));
    let day = 1 + ((weekday - first.getUTCDay() + 7) % 7);
    day += (n - 1) * 7;
    return day;
  } else {
    // Last occurrence
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const last = new Date(Date.UTC(year, month - 1, lastDay));
    const day = lastDay - ((last.getUTCDay() - weekday + 7) % 7);
    return day;
  }
}

/** Get the UTC offset in minutes for a given UTC date in a given timezone */
function getOffsetMinutes(utcDate: Date, tz: string): number {
  const rule = DST_RULES[tz];
  if (!rule) return 0; // Unknown timezone → UTC

  const year = utcDate.getUTCFullYear();
  // All DST transitions are on Sunday (weekday 0)
  const dstStartDay = nthWeekdayOfMonth(year, rule.dstStart.month, 0, rule.dstStart.week);
  const dstEndDay = nthWeekdayOfMonth(year, rule.dstEnd.month, 0, rule.dstEnd.week);

  // Transition timestamps in UTC
  const dstStartUTC = Date.UTC(year, rule.dstStart.month - 1, dstStartDay, rule.dstStart.hour) - rule.stdOffset * 60000;
  const dstEndUTC = Date.UTC(year, rule.dstEnd.month - 1, dstEndDay, rule.dstEnd.hour) - rule.dstOffset * 60000;

  const ts = utcDate.getTime();

  // Southern hemisphere: DST spans across year boundary (start > end)
  if (dstStartUTC > dstEndUTC) {
    // DST if before end OR after start
    if (ts >= dstStartUTC || ts < dstEndUTC) return rule.dstOffset;
    return rule.stdOffset;
  }

  // Northern hemisphere: DST between start and end
  if (ts >= dstStartUTC && ts < dstEndUTC) return rule.dstOffset;
  return rule.stdOffset;
}

/** Convert a UTC ISO string to local iCal date format: YYYYMMDDTHHMMSS (no Z) */
function formatICalLocalDate(utcIso: string, tz: string): string {
  const utcDate = new Date(utcIso);
  const offsetMs = getOffsetMinutes(utcDate, tz) * 60000;
  const local = new Date(utcDate.getTime() + offsetMs);

  const y = local.getUTCFullYear();
  const mo = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  const h = String(local.getUTCHours()).padStart(2, '0');
  const mi = String(local.getUTCMinutes()).padStart(2, '0');
  const s = String(local.getUTCSeconds()).padStart(2, '0');
  return `${y}${mo}${d}T${h}${mi}${s}`;
}

/** Format date as UTC iCal: YYYYMMDDTHHMMSSZ */
function formatICalDateUTC(date: Date): string {
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
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Missing token parameter', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up the calendar connection by iCal token
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('id, user_id, org_id, sync_enabled, ical_token_expires_at, guardian_id')
      .eq('ical_token', token)
      .eq('provider', 'apple')
      .single();

    if (connectionError || !connection) {
      console.error('Invalid or expired iCal token');
      return new Response('Invalid or expired feed URL', {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    // Check token expiry
    if (connection.ical_token_expires_at && new Date(connection.ical_token_expires_at) < new Date()) {
      return new Response('Feed URL has expired. Please generate a new one in LessonLoop settings.', {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    if (!connection.sync_enabled) {
      return new Response('Calendar sync is disabled', {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
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
    const hasVtimezone = timezone in VTIMEZONE_MAP;

    // 3 months back, 6 months ahead
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 6);

    const lessonSelect = `
      id, title, start_at, end_at, status, notes_shared, updated_at,
      location:locations(name, address_line_1, city, postcode),
      room:rooms(name),
      participants:lesson_participants(
        student:students(first_name, last_name)
      )
    `;

    let lessons: any[] | null = null;
    let lessonsError: any = null;
    let calendarName = `${orgName} Lessons`;

    if (connection.guardian_id) {
      // ─── Parent feed: scope to guardian's children ───
      const { data: studentLinks } = await supabase
        .from('student_guardians')
        .select('student_id')
        .eq('guardian_id', connection.guardian_id)
        .eq('org_id', connection.org_id);

      const studentIds = (studentLinks || []).map((s: any) => s.student_id);

      if (studentIds.length === 0) {
        // No children — return empty calendar
        const emptyIcal = [
          'BEGIN:VCALENDAR', 'VERSION:2.0',
          'PRODID:-//LessonLoop//Calendar Feed//EN',
          'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
          `X-WR-CALNAME:Music Lessons`, `X-WR-TIMEZONE:${timezone}`,
          'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
          'END:VCALENDAR',
        ].join('\r\n');
        return new Response(emptyIcal, {
          headers: { ...corsHeaders, 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        });
      }

      // Get lesson IDs for these students within date range
      const { data: participantRecords } = await supabase
        .from('lesson_participants')
        .select('lesson_id')
        .in('student_id', studentIds)
        .eq('org_id', connection.org_id);

      const lessonIds = [...new Set((participantRecords || []).map((p: any) => p.lesson_id))];

      if (lessonIds.length === 0) {
        lessons = [];
      } else {
        const result = await supabase
          .from('lessons')
          .select(lessonSelect)
          .in('id', lessonIds)
          .eq('org_id', connection.org_id)
          .gte('start_at', startDate.toISOString())
          .lte('start_at', endDate.toISOString())
          .order('start_at', { ascending: true });
        lessons = result.data;
        lessonsError = result.error;
      }

      // Build child names for calendar title
      const { data: children } = await supabase
        .from('students')
        .select('first_name')
        .in('id', studentIds);
      if (children && children.length > 0) {
        const names = children.map((c: any) => c.first_name);
        calendarName = names.length <= 3
          ? `${names.join(' & ')}'s Music Lessons`
          : `${names.slice(0, 2).join(', ')} + ${names.length - 2} more — Lessons`;
      }
    } else {
      // ─── Teacher feed: scope to teacher's own lessons ───
      const result = await supabase
        .from('lessons')
        .select(lessonSelect)
        .eq('org_id', connection.org_id)
        .eq('teacher_user_id', connection.user_id)
        .gte('start_at', startDate.toISOString())
        .lte('start_at', endDate.toISOString())
        .order('start_at', { ascending: true });
      lessons = result.data;
      lessonsError = result.error;
    }

    if (lessonsError) {
      console.error('Error fetching lessons:', lessonsError);
      return new Response('Error fetching lessons', {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    const domain = 'lessonloop.app';
    const now = formatICalDateUTC(new Date());

    // Token expiry warning
    let expiryWarning: string | null = null;
    if (connection.ical_token_expires_at) {
      const expiresAt = new Date(connection.ical_token_expires_at);
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      if (expiresAt <= sevenDaysFromNow) {
        expiryWarning = `Your calendar feed URL expires on ${expiresAt.toISOString().split('T')[0]}. Please regenerate in Settings.`;
      }
    }

    // ─── Build VCALENDAR ───
    const icalContent: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LessonLoop//Calendar Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${calendarName}`,
      `X-WR-TIMEZONE:${timezone}`,
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
    ];

    if (expiryWarning) {
      icalContent.push(`X-LESSONLOOP-WARNING:${expiryWarning}`);
    }

    // Add VTIMEZONE if available
    if (hasVtimezone) {
      icalContent.push(VTIMEZONE_MAP[timezone]);
    }

    // ─── Build VEVENTs ───
    for (const lesson of lessons || []) {
      // Build location string
      const locationParts: string[] = [];
      if ((lesson.room as any)?.name) locationParts.push((lesson.room as any).name);
      if ((lesson.location as any)?.name) locationParts.push((lesson.location as any).name);
      if ((lesson.location as any)?.address_line_1) locationParts.push((lesson.location as any).address_line_1);
      if ((lesson.location as any)?.city) locationParts.push((lesson.location as any).city);
      if ((lesson.location as any)?.postcode) locationParts.push((lesson.location as any).postcode);
      const location = locationParts.join(', ');

      // Build description with student names
      const studentNames = (lesson.participants as any[])
        ?.map(p => `${p.student?.first_name} ${p.student?.last_name}`)
        .filter(Boolean)
        .join(', ') || '';

      let description = '';
      if (studentNames) description += `Students: ${studentNames}`;
      if (lesson.notes_shared) {
        description += description ? '\\n\\n' : '';
        description += lesson.notes_shared;
      }

      // SEQUENCE from updated_at
      const sequence = Math.floor(
        new Date(lesson.updated_at || lesson.start_at).getTime() / 1000
      );

      // LAST-MODIFIED
      const lastModified = formatICalDateUTC(
        new Date(lesson.updated_at || lesson.start_at)
      );

      // Date formatting: use TZID if we have a VTIMEZONE, otherwise UTC
      let dtStart: string;
      let dtEnd: string;
      if (hasVtimezone) {
        dtStart = `DTSTART;TZID=${timezone}:${formatICalLocalDate(lesson.start_at, timezone)}`;
        dtEnd = `DTEND;TZID=${timezone}:${formatICalLocalDate(lesson.end_at, timezone)}`;
      } else {
        dtStart = `DTSTART:${formatICalDateUTC(new Date(lesson.start_at))}`;
        dtEnd = `DTEND:${formatICalDateUTC(new Date(lesson.end_at))}`;
      }

      const isCancelled = lesson.status === 'cancelled';
      const statusText = lesson.status === 'completed' ? ' [Completed]' : '';

      const eventLines: string[] = [
        'BEGIN:VEVENT',
        `UID:${generateEventUID(lesson.id, domain)}`,
        `DTSTAMP:${now}`,
        dtStart,
        dtEnd,
        `SUMMARY:${escapeICalText(lesson.title)}${statusText}`,
        `SEQUENCE:${sequence}`,
        `LAST-MODIFIED:${lastModified}`,
        'CATEGORIES:LessonLoop',
        'COLOR:dodgerblue',
      ];

      if (isCancelled) {
        eventLines.push('STATUS:CANCELLED');
      } else {
        eventLines.push('STATUS:CONFIRMED');
      }

      if (location) eventLines.push(`LOCATION:${escapeICalText(location)}`);
      if (description) eventLines.push(`DESCRIPTION:${escapeICalText(description)}`);

      // 15-minute reminder (only for non-cancelled future lessons)
      if (!isCancelled) {
        eventLines.push(
          'BEGIN:VALARM',
          'TRIGGER:-PT15M',
          'ACTION:DISPLAY',
          'DESCRIPTION:Lesson in 15 minutes',
          'END:VALARM',
        );
      }

      eventLines.push('END:VEVENT');
      icalContent.push(...eventLines);
    }

    icalContent.push('END:VCALENDAR');

    // Update last_sync_at
    await supabase
      .from('calendar_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id);

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
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }
});
