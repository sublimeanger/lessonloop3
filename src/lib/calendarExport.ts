import { format, parseISO } from 'date-fns';

interface ExportLesson {
  title: string;
  start_at: string;
  end_at: string;
  location?: { name: string } | null;
}

/** Format a Date as an iCalendar DATETIME string (UTC) */
function toICSDate(dateStr: string): string {
  const d = parseISO(dateStr);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generate an .ics file string for a single lesson.
 */
export function generateICSEvent(lesson: ExportLesson): string {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@lessonloop.app`;
  const location = lesson.location?.name || '';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LessonLoop//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${toICSDate(lesson.start_at)}`,
    `DTEND:${toICSDate(lesson.end_at)}`,
    `SUMMARY:${lesson.title}`,
    location ? `LOCATION:${location}` : '',
    `DTSTAMP:${toICSDate(new Date().toISOString())}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/**
 * Trigger download of an .ics file.
 */
export function downloadICSFile(lesson: ExportLesson): void {
  const icsContent = generateICSEvent(lesson);
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
export function generateGoogleCalendarUrl(lesson: ExportLesson): string {
  const start = toICSDate(lesson.start_at);
  const end = toICSDate(lesson.end_at);
  const location = lesson.location?.name || '';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: lesson.title,
    dates: `${start}/${end}`,
    details: `Lesson scheduled via LessonLoop`,
    location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
