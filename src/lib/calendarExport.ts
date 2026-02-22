import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

interface ExportLesson {
  title: string;
  start_at: string;
  end_at: string;
  location?: { name: string } | null;
}

/**
 * Format a Date as an iCalendar DATETIME string localised to a timezone.
 * Output: 19970714T133000  (no trailing Z – paired with TZID)
 */
function toLocalICSDate(dateStr: string, tz: string): string {
  return formatInTimeZone(parseISO(dateStr), tz, "yyyyMMdd'T'HHmmss");
}

/**
 * Generate a minimal VTIMEZONE component.
 * Full Olson rules aren't needed — most calendar clients resolve the TZID
 * from their own database. We include a stub so the file is spec-valid.
 */
function vtimezone(tz: string): string {
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${tz}`,
    'BEGIN:STANDARD',
    `DTSTART:19700101T000000`,
    `TZNAME:${tz}`,
    'TZOFFSETFROM:+0000',
    'TZOFFSETTO:+0000',
    'END:STANDARD',
    'END:VTIMEZONE',
  ].join('\r\n');
}

/**
 * Generate an .ics file string for a single lesson.
 */
export function generateICSEvent(lesson: ExportLesson, timezone = 'Europe/London'): string {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@lessonloop.app`;
  const location = lesson.location?.name || '';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LessonLoop//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    vtimezone(timezone),
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;TZID=${timezone}:${toLocalICSDate(lesson.start_at, timezone)}`,
    `DTEND;TZID=${timezone}:${toLocalICSDate(lesson.end_at, timezone)}`,
    `SUMMARY:${lesson.title}`,
    location ? `LOCATION:${location}` : '',
    `DTSTAMP:${toLocalICSDate(new Date().toISOString(), 'UTC')}Z`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/**
 * Trigger download of an .ics file.
 */
export function downloadICSFile(lesson: ExportLesson, timezone = 'Europe/London'): void {
  const icsContent = generateICSEvent(lesson, timezone);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${lesson.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a Google Calendar "add event" URL.
 */
export function generateGoogleCalendarUrl(lesson: ExportLesson, timezone = 'Europe/London'): string {
  const start = toLocalICSDate(lesson.start_at, timezone);
  const end = toLocalICSDate(lesson.end_at, timezone);
  const location = lesson.location?.name || '';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: lesson.title,
    dates: `${start}/${end}`,
    details: `Lesson scheduled via LessonLoop`,
    location,
    ctz: timezone,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
