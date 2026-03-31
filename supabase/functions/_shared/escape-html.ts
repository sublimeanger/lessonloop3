/**
 * Escapes user-provided strings before inserting into HTML templates.
 * Prevents XSS injection in server-rendered email content.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escapes HTML and converts newlines to <br> tags.
 * Use for multi-line user content in email bodies.
 */
export function escapeAndLineBreak(str: string): string {
  return escapeHtml(str).replace(/\n/g, '<br>');
}

/**
 * Sanitise a display name for use in email "from" address.
 * Strips control characters and limits length.
 */
export function sanitiseFromName(name: string): string {
  return name
    .replace(/[\r\n\t\x00-\x1f]/g, '')
    .replace(/["<>]/g, '')
    .slice(0, 100)
    .trim() || 'LessonLoop';
}
