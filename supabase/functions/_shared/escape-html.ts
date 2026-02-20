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
