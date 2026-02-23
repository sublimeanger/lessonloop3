import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// ── iCal date helpers ────────────────────────────────────────────────

/** Format a Date as iCal UTC stamp: YYYYMMDDTHHMMSSZ */
function formatICalDateUTC(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Format a UTC ISO string as local iCal date in the given timezone: YYYYMMDDTHHMMSS (no Z) */
function formatICalLocalDate(utcIso: string, timezone: string): string {
  const d = new Date(utcIso);
  const offset = getTimezoneOffsetMinutes(d, timezone);
  const local = new Date(d.getTime() + offset * 60 * 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${local.getUTCFullYear()}${pad(local.getUTCMonth() + 1)}${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}${pad(local.getUTCMinutes())}${pad(local.getUTCSeconds())}`
  );
}

// ── Timezone offset calculation ──────────────────────────────────────

interface TZRule {
  standard: { offsetFrom: string; offsetTo: string; name: string; month: number; day: 'lastSun' | number };
  daylight: { offsetFrom: string; offsetTo: string; name: string; month: number; day: 'lastSun' | number } | null;
  baseOffsetMinutes: number;
  dstOffsetMinutes: number;
}

const TIMEZONE_RULES: Record<string, TZRule> = {
  'Europe/London': {
    standard: { offsetFrom: '+0100', offsetTo: '+0000', name: 'GMT', month: 10, day: 'lastSun' },
    daylight: { offsetFrom: '+0000', offsetTo: '+0100', name: 'BST', month: 3, day: 'lastSun' },
    baseOffsetMinutes: 0,
    dstOffsetMinutes: 60,
  },
  'America/New_York': {
    standard: { offsetFrom: '-0400', offsetTo: '-0500', name: 'EST', month: 11, day: 'lastSun' },
    daylight: { offsetFrom: '-0500', offsetTo: '-0400', name: 'EDT', month: 3, day: 'lastSun' },
    baseOffsetMinutes: -300,
    dstOffsetMinutes: -240,
  },
  'America/Chicago': {
    standard: { offsetFrom: '-0500', offsetTo: '-0600', name: 'CST', month: 11, day: 'lastSun' },
    daylight: { offsetFrom: '-0600', offsetTo: '-0500', name: 'CDT', month: 3, day: 'lastSun' },
    baseOffsetMinutes: -360,
    dstOffsetMinutes: -300,
  },
  'America/Denver': {
    standard: { offsetFrom: '-0600', offsetTo: '-0700', name: 'MST', month: 11, day: 'lastSun' },
    daylight: { offsetFrom: '-0700', offsetTo: '-0600', name: 'MDT', month: 3, day: 'lastSun' },
    baseOffsetMinutes: -420,
    dstOffsetMinutes: -360,
  },
  'America/Los_Angeles': {
    standard: { offsetFrom: '-0700', offsetTo: '-0800', name: 'PST', month: 11, day: 'lastSun' },
    daylight: { offsetFrom: '-0800', offsetTo: '-0700', name: 'PDT', month: 3, day: 'lastSun' },
    baseOffsetMinutes: -480,
    dstOffsetMinutes: -420,
  },
  'Australia/Sydney': {
    standard: { offsetFrom: '+1100', offsetTo: '+1000', name: 'AEST', month: 4, day: 'lastSun' },
    daylight: { offsetFrom: '+1000', offsetTo: '+1100', name: 'AEDT', month: 10, day: 'lastSun' },
    baseOffsetMinutes: 600,
    dstOffsetMinutes: 660,
  },
  'Australia/Melbourne': {
    standard: { offsetFrom: '+1100', offsetTo: '+1000', name: 'AEST', month: 4, day: 'lastSun' },
    daylight: { offsetFrom: '+1000', offsetTo: '+1100', name: 'AEDT', month: 10, day: 'lastSun' },
    baseOffsetMinutes: 600,
    dstOffsetMinutes: 660,
  },
  'Pacific/Auckland': {
    standard: { offsetFrom: '+1300', offsetTo: '+1200', name: 'NZST', month: 4, day: 'lastSun' },
    daylight: { offsetFrom: '+1200', offsetTo: '+1300', name: 'NZDT', month: 9, day: 'lastSun' },
    baseOffsetMinutes: 720,
    dstOffsetMinutes: 780,
  },
};

/** Find the last Sunday of a given month/year (UTC day-of-month). */
function lastSundayOf(year: number, month: number): number {
  // month is 1-based; Date uses 0-based so next month day 0 = last day of this month
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDow = new Date(Date.UTC(year, month - 1, lastDay)).getUTCDay(); // 0=Sun
  return lastDay - lastDow;
}

/** Is the given UTC date in DST for the specified timezone? */
function isDST(d: Date, rule: TZRule): boolean {
  if (!rule.daylight) return false;
  const year = d.getUTCFullYear();

  // DST start transition (clocks go forward) — last Sunday of daylight.month at 01:00 UTC
  const dstStartDay = lastSundayOf(year, rule.daylight.month);
  const dstStart = Date.UTC(year, rule.daylight.month - 1, dstStartDay, 1, 0, 0);

  // DST end transition (clocks go back) — last Sunday of standard.month at 01:00 UTC
  const dstEndDay = lastSundayOf(year, rule.standard.month);
  const dstEnd = Date.UTC(year, rule.standard.month - 1, dstEndDay, 1, 0, 0);

  const t = d.getTime();

  // Northern hemisphere: DST start < DST end (e.g. March → November)
  if (dstStart < dstEnd) {
    return t >= dstStart && t < dstEnd;
  }
  // Southern hemisphere: DST start > DST end (e.g. October → April)
  return t >= dstStart || t < dstEnd;
}

function getTimezoneOffsetMinutes(d: Date, timezone: string): number {
  const rule = TIMEZONE_RULES[timezone];
  if (!rule) return 0; // Unknown timezone → UTC
  return isDST(d, rule) ? rule.dstOffsetMinutes : rule.baseOffsetMinutes;
}

// ── VTIMEZONE generation ─────────────────────────────────────────────

function generateVTIMEZONE(timezone: string): string[] {
  const rule = TIMEZONE_RULES[timezone];
  if (!rule) return []; // Unknown timezone → no VTIMEZONE (UTC fallback)

  const lines: string[] = [
    'BEGIN:VTIMEZONE',
    `TZID:${timezone}`,
  ];

  // Standard component
  const stdDay = rule.standard.day === 'lastSun' ? '-1SU' : rule.standard.day.toString();
  lines.push(
    'BEGIN:STANDARD',
    `DTSTART:19701025T020000`,
    `RRULE:FREQ=YEARLY;BYDAY=${stdDay};BYMONTH=${rule.standard.month}`,
    `TZOFFSETFROM:${rule.standard.offsetFrom}`,
    `TZOFFSETTO:${rule.standard.offsetTo}`,
    `TZNAME:${rule.standard.name}`,
    'END:STANDARD',
  );

  // Daylight component
  if (rule.daylight) {
    const dstDay = rule.daylight.day === 'lastSun' ? '-1SU' : rule.daylight.day.toString();
    lines.push(
      'BEGIN:DAYLIGHT',
      `DTSTART:19700329T010000`,
      `RRULE:FREQ=YEARLY;BYDAY=${dstDay};BYMONTH=${rule.daylight.month}`,
      `TZOFFSETFROM:${rule.daylight.offsetFrom}`,
      `TZOFFSETTO:${rule.daylight.offsetTo}`,
      `TZNAME:${rule.daylight.name}`,
      'END:DAYLIGHT',
    );
  }

  lines.push('END:VTIMEZONE');
  return lines;
}

// ── iCal text helpers ────────────────────────────────────────────────

function escapeICalText(text: string | null): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\n/g, '\\n');
}

/** Fold lines longer than 75 octets per RFC 5545 §3.1 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  let result = line.substring(0, 75);
  let remaining = line.substring(75);
  while (remaining.length > 0) {
    result += '\r\n ' + remaining.substring(0, 74);
    remaining = remaining.substring(74);
  }
  return result;
}

function generateEventUID(lessonId: string, domain: string): string {
  return `${lessonId}@${domain}`;
}

// ── Main handler ─────────────────────────────────────────────────────

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

    // ── Date range: 3 months back → 6 months ahead ──────────────────
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 6);

    // ── Build query based on connection type ─────────────────────────
    let calendarName = `${orgName} Lessons`;
    let lessons: any[] = [];

    if (connection.guardian_id) {
      // Parent feed — scoped to guardian's children
      const { data: studentLinks } = await supabase
        .from('student_guardians')
        .select('student_id, student:students(first_name)')
        .eq('guardian_id', connection.guardian_id)
        .eq('org_id', connection.org_id);

      const studentIds = (studentLinks || []).map((s: any) => s.student_id);
      const childNames = (studentLinks || [])
        .map((s: any) => s.student?.first_name)
        .filter(Boolean)
        .join(' & ');

      if (childNames) calendarName = `${childNames}'s Music Lessons`;

      if (studentIds.length > 0) {
        const { data: participantRecords } = await supabase
          .from('lesson_participants')
          .select('lesson_id')
          .in('student_id', studentIds)
          .eq('org_id', connection.org_id);

        const lessonIds = [...new Set((participantRecords || []).map((p: any) => p.lesson_id))];

        if (lessonIds.length > 0) {
          const { data } = await supabase
            .from('lessons')
            .select(`
              id, title, start_at, end_at, status, notes_shared, updated_at,
              location:locations(name, address_line_1, city, postcode),
              room:rooms(name),
              participants:lesson_participants(student:students(first_name, last_name))
            `)
            .in('id', lessonIds)
            .eq('org_id', connection.org_id)
            .gte('start_at', startDate.toISOString())
            .lte('start_at', endDate.toISOString())
            .order('start_at', { ascending: true });
          lessons = data || [];
        }
      }
    } else {
      // Teacher feed — scoped to teacher's lessons
      const { data, error: lessonsError } = await supabase
        .from('lessons')
        .select(`
          id, title, start_at, end_at, status, notes_shared, updated_at,
          location:locations(name, address_line_1, city, postcode),
          room:rooms(name),
          participants:lesson_participants(student:students(first_name, last_name))
        `)
        .eq('org_id', connection.org_id)
        .eq('teacher_user_id', connection.user_id)
        .gte('start_at', startDate.toISOString())
        .lte('start_at', endDate.toISOString())
        .order('start_at', { ascending: true });

      if (lessonsError) {
        console.error('Error fetching lessons:', lessonsError);
        return new Response('Error fetching lessons', {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        });
      }
      lessons = data || [];
    }

    // ── Generate iCal content ────────────────────────────────────────
    const domain = 'lessonloop.app';
    const now = formatICalDateUTC(new Date());
    const useTZID = !!TIMEZONE_RULES[timezone];

    // Token expiry warning
    let expiryWarning: string | null = null;
    if (connection.ical_token_expires_at) {
      const expiresAt = new Date(connection.ical_token_expires_at);
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      if (expiresAt <= sevenDaysFromNow) {
        const expiryDate = expiresAt.toISOString().split('T')[0];
        expiryWarning = `Your calendar feed URL expires on ${expiryDate}. Please regenerate in Settings.`;
      }
    }

    const icalLines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LessonLoop//Calendar Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeICalText(calendarName)}`,
      `X-WR-TIMEZONE:${timezone}`,
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
    ];

    if (expiryWarning) {
      icalLines.push(`X-LESSONLOOP-WARNING:${escapeICalText(expiryWarning)}`);
    }

    // VTIMEZONE block
    icalLines.push(...generateVTIMEZONE(timezone));

    // ── Events ───────────────────────────────────────────────────────
    for (const lesson of lessons) {
      // Date formatting — use TZID if we have rules, otherwise UTC
      const dtStart = useTZID
        ? `DTSTART;TZID=${timezone}:${formatICalLocalDate(lesson.start_at, timezone)}`
        : `DTSTART:${formatICalDateUTC(new Date(lesson.start_at))}`;
      const dtEnd = useTZID
        ? `DTEND;TZID=${timezone}:${formatICalLocalDate(lesson.end_at, timezone)}`
        : `DTEND:${formatICalDateUTC(new Date(lesson.end_at))}`;

      // Location
      const locationParts: string[] = [];
      if ((lesson.room as any)?.name) locationParts.push((lesson.room as any).name);
      if ((lesson.location as any)?.name) locationParts.push((lesson.location as any).name);
      if ((lesson.location as any)?.address_line_1) locationParts.push((lesson.location as any).address_line_1);
      if ((lesson.location as any)?.city) locationParts.push((lesson.location as any).city);
      if ((lesson.location as any)?.postcode) locationParts.push((lesson.location as any).postcode);
      const location = locationParts.join(', ');

      // Description
      const studentNames = (lesson.participants as any[])
        ?.map((p: any) => `${p.student?.first_name} ${p.student?.last_name}`)
        .filter(Boolean)
        .join(', ') || '';

      let description = '';
      if (studentNames) description += `Students: ${studentNames}`;
      if (lesson.notes_shared) {
        description += description ? '\n\n' : '';
        description += lesson.notes_shared;
      }

      // SEQUENCE from updated_at (seconds since epoch / 60 to keep small)
      const updatedAt = lesson.updated_at || lesson.start_at;
      const sequence = Math.floor(new Date(updatedAt).getTime() / 60000);
      const lastModified = formatICalDateUTC(new Date(updatedAt));

      // Status text for summary
      const isCancelled = lesson.status === 'cancelled';
      const isCompleted = lesson.status === 'completed';
      const summaryStatus = isCancelled ? ' [Cancelled]' : isCompleted ? ' [Completed]' : '';

      icalLines.push('BEGIN:VEVENT');
      icalLines.push(`UID:${generateEventUID(lesson.id, domain)}`);
      icalLines.push(`DTSTAMP:${now}`);
      icalLines.push(dtStart);
      icalLines.push(dtEnd);
      icalLines.push(`SUMMARY:${escapeICalText(lesson.title)}${summaryStatus}`);
      icalLines.push(`SEQUENCE:${sequence}`);
      icalLines.push(`LAST-MODIFIED:${lastModified}`);

      if (isCancelled) icalLines.push('STATUS:CANCELLED');
      else if (isCompleted) icalLines.push('STATUS:CONFIRMED');
      else icalLines.push('STATUS:CONFIRMED');

      if (location) icalLines.push(`LOCATION:${escapeICalText(location)}`);
      if (description) icalLines.push(`DESCRIPTION:${escapeICalText(description)}`);

      icalLines.push('CATEGORIES:LessonLoop');
      icalLines.push('COLOR:dodgerblue');

      // 15-minute reminder (only for non-cancelled)
      if (!isCancelled) {
        icalLines.push(
          'BEGIN:VALARM',
          'TRIGGER:-PT15M',
          'ACTION:DISPLAY',
          'DESCRIPTION:Lesson in 15 minutes',
          'END:VALARM',
        );
      }

      icalLines.push('END:VEVENT');
    }

    icalLines.push('END:VCALENDAR');

    // Fold long lines per RFC 5545
    const folded = icalLines.map(foldLine);

    // Update last_sync_at
    await supabase
      .from('calendar_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id);

    return new Response(folded.join('\r\n'), {
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
