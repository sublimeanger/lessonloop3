/** Shared constants for resource upload validation */

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'video/mp4',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export function validateResourceFile(file: File): void {
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    throw new Error('File type not supported');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File exceeds 50MB limit');
  }
}

/**
 * Sanitise a user-supplied file name before storing in the database.
 * Strips path traversal, null bytes, control characters, and truncates.
 */
export function sanitizeFileName(rawName: string): string {
  let name = rawName;
  // Strip any directory path (forward and back slashes)
  const lastSlash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  if (lastSlash >= 0) name = name.substring(lastSlash + 1);
  // Remove null bytes and control characters (U+0000–U+001F, U+007F)
  // eslint-disable-next-line no-control-regex
  name = name.replace(/[\x00-\x1f\x7f]/g, '');
  // Remove characters problematic in file systems / HTML contexts
  name = name.replace(/[<>"'`|*?]/g, '_');
  // Collapse consecutive dots (prevents hidden-file tricks)
  name = name.replace(/\.{2,}/g, '.');
  // Trim leading/trailing whitespace and dots
  name = name.replace(/^[\s.]+|[\s.]+$/g, '');
  // Truncate to 255 characters
  if (name.length > 255) name = name.substring(0, 255);
  // Fallback if empty after sanitisation
  return name || 'unnamed-file';
}
