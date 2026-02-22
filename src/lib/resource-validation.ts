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
